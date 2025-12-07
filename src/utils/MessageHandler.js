// ===== MESSAGE HANDLER =====
// Centralized message handling for background script

// Import utilities
let logger;

// Initialize logger for service worker context
try {
  // In service worker context, create our own instances
  if (typeof self !== 'undefined') {
    // Create logger instance
    if (typeof self.logger !== 'undefined') {
      logger = self.logger;
    } else {
      logger = {
        info: (...args) => console.log('[INFO]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        debug: (...args) => console.debug('[DEBUG]', ...args)
      };
    }
  } else if (typeof require !== 'undefined') {
    ({ logger } = require('./Logger.js'));
  } else if (typeof Logger !== 'undefined') {
    logger = new Logger('MessageHandler');
  }
} catch (error) {
  // Ultimate fallback to console logging if imports fail
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    debug: (...args) => console.debug('[DEBUG]', ...args)
  };
}

class MessageHandler {
  constructor({
    googleDriveManager,
    metadataManager,
    downloadStateManager,
    optionsManager,
    notificationManager,
    downloadProcessor,
    sessionManager,
    contentScriptManager,
    performanceMonitor
  }) {
    this.handlers = new Map();
    this.googleDriveManager = googleDriveManager;
    this.metadataManager = metadataManager;
    this.downloadStateManager = downloadStateManager;
    this.optionsManager = optionsManager;
    this.notificationManager = notificationManager;
    this.downloadProcessor = downloadProcessor;
    this.sessionManager = sessionManager;
    this.contentScriptManager = contentScriptManager;
    this.performanceMonitor = performanceMonitor;
    this.setupDefaultHandlers();
  }

  // Register a message handler
  registerHandler(action, handler) {
    this.handlers.set(action, handler);
  }

  // Handle incoming messages
  async handleMessage(request, sender, sendResponse) {
    const startTime = performance.now();
    const timerId = performanceMonitor.startTimer(`message_${request.action}`);

    logger.info('Message received', {
      action: request.action,
      sender: sender?.tab?.id ? `tab_${sender.tab.id}` : 'background'
    });

    const handler = this.handlers.get(request.action);
    if (!handler) {
      logger.warn('No handler registered for action', {
        action: request.action,
        availableHandlers: Array.from(this.handlers.keys())
      });
      performanceMonitor.endTimer(timerId, { success: false, error: 'unknown_action' });
      sendResponse({ success: false, error: 'Unknown action: ' + request.action });
      return false;
    }

    try {
      performanceMonitor.addCheckpoint(timerId, 'handler_start');
      const result = await handler(request, sender, sendResponse);
      performanceMonitor.addCheckpoint(timerId, 'handler_complete');

      // Track handler execution
      performanceMonitor.incrementCounter(`handler_${request.action}_calls`);

      // If handler returns true, it will handle sendResponse asynchronously
      if (result === true) {
        performanceMonitor.endTimer(timerId, { async: true, success: true });
        return true;
      }

      // Otherwise, send the response immediately
      performanceMonitor.endTimer(timerId, { async: false, success: true });
      sendResponse(result);
      return false;

    } catch (error) {
      performanceMonitor.endTimer(timerId, { success: false, error: error.message });
      performanceMonitor.incrementCounter(`handler_${request.action}_errors`);
      logger.error('Message handler error', error, {
        action: request.action,
        sender: sender?.tab?.id ? `tab_${sender.tab.id}` : 'background'
      });
      sendResponse({ success: false, error: error.message });
      return false;
    }
  }

  // Setup default message handlers
  setupDefaultHandlers() {
    // Download state handler
    this.registerHandler('getDownloadState', async (request) => {
      try {
        console.log('📊 Popup requesting download state');
        const state = downloadStateManager.getDownloadState();
        console.log('📊 Sending download state to popup:', state);
        return {
          success: true,
          state: state
        };
      } catch (error) {
        console.error('❌ Error getting download state:', error);
        return { success: false, error: error.message };
      }
    });

    // Download info handler
    this.registerHandler('downloadInfo', async (request) => {
      try {
        console.log('[INFO] Download info requested');
        // Return download statistics or status
        const state = this.downloadStateManager.getDownloadState();
        return {
          success: true,
          info: {
            totalDownloads: state.total || 0,
            completedDownloads: state.successful || 0,
            failedDownloads: state.failed || 0,
            inProgress: state.isDownloading || false,
            currentProgress: state.current || 0
          }
        };
      } catch (error) {
        console.error('❌ Error getting download info:', error);
        return { success: false, error: error.message };
      }
    });

    // Download processing handler
    this.registerHandler('startDownloads', async (request) => {
      const handlerTimer = performanceMonitor.startTimer('startDownloads_handler');

      console.log('🚀 startDownloads handler called with request:', {
        action: request.action,
        downloadItemsType: typeof request.downloadItems,
        downloadItemsIsArray: Array.isArray(request.downloadItems),
        downloadItemsLength: request.downloadItems?.length,
        marketplace: request.marketplace,
        startDate: request.startDate,
        endDate: request.endDate,
        dateRangeType: request.dateRangeType,
        concurrent: request.concurrent
      });

      try {
        logger.info('Download request received', {
          itemCount: request.downloadItems?.length || 0,
          marketplace: request.marketplace,
          startDate: request.startDate,
          endDate: request.endDate,
          dateRangeType: request.dateRangeType,
          concurrent: request.concurrent
        });

        // Validate request parameters
        if (!request.downloadItems || !Array.isArray(request.downloadItems)) {
          console.error('❌ Validation failed: downloadItems is not a valid array', {
            downloadItems: request.downloadItems,
            type: typeof request.downloadItems,
            isArray: Array.isArray(request.downloadItems)
          });
          throw new Error('Invalid download items: expected array');
        }

        if (!request.marketplace) {
          console.error('❌ Validation failed: marketplace not specified', {
            marketplace: request.marketplace
          });
          throw new Error('Marketplace not specified');
        }

        console.log('✅ Validation passed, proceeding with download processing');

        performanceMonitor.incrementCounter('download_requests_total');
        performanceMonitor.recordMetric('download_batch_size', request.downloadItems.length);

        // Process downloads asynchronously with comprehensive error handling
        this.downloadProcessor.processDownloads(
          request.downloadItems,
          request.marketplace,
          request.concurrent,
          request.startDate,
          request.endDate,
          request.dateRangeType,
          this.googleDriveManager,
          this.metadataManager,
          this.downloadStateManager,
          this.sessionManager
        ).then(() => {
          logger.info('Download processing completed successfully', {
            itemCount: request.downloadItems.length,
            marketplace: request.marketplace
          });
          performanceMonitor.incrementCounter('download_batches_completed');
          performanceMonitor.endTimer(handlerTimer, { success: true });
        }).catch(error => {
          logger.error('Download processing failed', error, {
            itemCount: request.downloadItems.length,
            marketplace: request.marketplace
          });
          performanceMonitor.incrementCounter('download_batches_failed');
          performanceMonitor.endTimer(handlerTimer, { success: false, error: error.message });

          // Send error notification to popup
          chrome.runtime.sendMessage({
            action: 'downloadError',
            error: 'Download processing failed: ' + error.message,
            failedCount: request.downloadItems.length
          }).catch(() => {
            logger.debug('Popup not available to receive error notification');
          });
        });

        return { success: true };
      } catch (error) {
        performanceMonitor.endTimer(handlerTimer, { success: false, error: error.message });
        logger.error('Error starting downloads', error, {
          marketplace: request.marketplace,
          itemCount: request.downloadItems?.length
        });
        return { success: false, error: error.message };
      }
    });

    // Content script management handlers
    this.registerHandler('checkContentScriptLoaded', async (request) => {
      try {
        const result = await this.contentScriptManager.checkContentScriptLoaded();
        return result;
      } catch (error) {
        console.error('❌ Error checking content script loaded:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('executeContentScript', async (request) => {
      try {
        await this.contentScriptManager.executeContentScript();
        return { success: true };
      } catch (error) {
        console.error('❌ Error executing content script:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('injectScript', async (request) => {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs.length === 0) {
        return { success: false, error: "Geen actieve tab gevonden" };
      }

      const scriptPath = request.scriptName;
      console.log(`Injecting script: ${scriptPath}`);

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: [scriptPath]
        });
        console.log(`${scriptPath} succesvol geïnjecteerd`);
        return { success: true };
      } catch (error) {
        console.error(`Fout bij het injecteren van ${scriptPath}:`, error);
        return { success: false, error: error.message };
      }
    });

    // Download completion handlers
    this.registerHandler('downloadComplete', async (request) => {
      try {
        // Show desktop notification for download completion
        const successCount = request.successCount || request.count || 0;
        const failedCount = request.failedCount || 0;

        let title = 'Download Complete! 🎉';
        let message = `Successfully downloaded ${successCount} invoices`;

        if (failedCount > 0) {
          title = 'Download Finished ⚠️';
          message = `Downloaded ${successCount} invoices, ${failedCount} failed`;
        }

        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('images/icon128.PNG'),
          title: title,
          message: message,
          priority: 2
        });
        return { success: true };
      } catch (error) {
        console.error('❌ Error showing download completion notification:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('updateDownloadProgress', async (request) => {
      // Forward progress updates to popup
      chrome.runtime.sendMessage(request).catch(() => {
        // Popup might be closed, that's okay
      });
      return true;
    });

    this.registerHandler('updateDownloadStatus', async (request) => {
      // Forward status updates to popup
      chrome.runtime.sendMessage(request).catch(() => {
        // Popup might be closed, that's okay
      });
      return true;
    });

    // Multi-marketplace download handler
    this.registerHandler('startMultiMarketplaceDownload', async (request) => {
      try {
        console.log('🌍 Starting multi-marketplace download:', request);

        // Validate request
        if (!request.marketplaces || !Array.isArray(request.marketplaces)) {
          throw new Error('Invalid marketplaces: expected array');
        }

        if (!request.startDate || !request.endDate) {
          throw new Error('Start date and end date are required');
        }

        // Import MarketplaceCoordinator dynamically
        let MarketplaceCoordinator;
        try {
          const module = await import('./MarketplaceCoordinator.js');
          MarketplaceCoordinator = module.MarketplaceCoordinator;
        } catch (importError) {
          throw new Error('Failed to load MarketplaceCoordinator: ' + importError.message);
        }

        const coordinator = new MarketplaceCoordinator();

        // Set marketplace preferences based on request
        request.marketplaces.forEach(code => {
          const domainMap = {
            'us': 'amazon.com',
            'fr': 'amazon.fr',
            'de': 'amazon.de',
            'uk': 'amazon.co.uk',
            'nl': 'amazon.nl',
            'it': 'amazon.it'
          };
          if (domainMap[code]) {
            coordinator.setMarketplaceEnabled(domainMap[code], true);
          } else {
            console.warn(`⚠️ Unknown marketplace code: ${code}`);
          }
        });

        // Start coordinated download with comprehensive error handling
        coordinator.startCoordinatedDownload({
          startDate: request.startDate,
          endDate: request.endDate
        }, request.accountType).then(summary => {
          console.log('🎯 Multi-marketplace download complete:', summary);
          // Send completion message to popup
          chrome.runtime.sendMessage({
            action: 'multiMarketplaceComplete',
            summary: summary
          }).catch(sendError => {
            console.warn('⚠️ Failed to send completion message to popup:', sendError);
          });
        }).catch(error => {
          console.error('❌ Multi-marketplace download failed:', error);
          chrome.runtime.sendMessage({
            action: 'multiMarketplaceError',
            error: error.message
          }).catch(sendError => {
            console.warn('⚠️ Failed to send error message to popup:', sendError);
          });
        });

        return true;
      } catch (error) {
        console.error('❌ Error starting multi-marketplace download:', error);
        // Send immediate error response
        chrome.runtime.sendMessage({
          action: 'multiMarketplaceError',
          error: error.message
        }).catch(sendError => {
          console.warn('⚠️ Failed to send error message to popup:', sendError);
        });
        return { success: false, error: error.message };
      }
    });

    // History management handlers
    this.registerHandler('recordSession', async (request) => {
      try {
        if (!request.sessionData) {
          throw new Error('Session data is required');
        }
        const session = await historyManager.recordSession(request.sessionData);
        return { success: true, session: session };
      } catch (error) {
        console.error('❌ Error recording session:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('getHistoryStats', async (request) => {
      try {
        const summary = historyManager.getDisplaySummary();
        const sessions = historyManager.history.sessions;
        return { summary: summary, sessions: sessions };
      } catch (error) {
        console.error('❌ Error getting history stats:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('getSessionDetails', async (request) => {
      try {
        if (!request.sessionId) {
          throw new Error('Session ID is required');
        }
        const session = historyManager.getSession(request.sessionId);
        if (session) {
          return { success: true, session: session };
        } else {
          return { success: false, error: "Session not found" };
        }
      } catch (error) {
        console.error('❌ Error getting session details:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('exportHistory', async (request) => {
      try {
        const historyData = historyManager.exportHistory();
        if (!historyData) {
          throw new Error('No history data available to export');
        }

        const filename = `amazon_invoice_history_${new Date().toISOString().split('T')[0]}.json`;

        // Store in chrome.storage.local and return data for popup to handle download
        const storageKey = `history_export_${Date.now()}`;
        return new Promise((resolve, reject) => {
          chrome.storage.local.set({
            [storageKey]: {
              filename: filename,
              data: historyData,
              timestamp: new Date().toISOString()
            }
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('❌ Error storing history export:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            console.log('✅ History export data stored successfully');
            resolve({
              success: true,
              storageKey: storageKey,
              filename: filename,
              timestamp: new Date().toISOString()
            });
          });
        });
      } catch (error) {
        console.error('❌ Error exporting history:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('clearHistory', async (request) => {
      try {
        historyManager.history = {
          sessions: [],
          stats: {
            totalInvoices: 0,
            totalSessions: 0,
            successRate: 0,
            averageSessionSize: 0,
            lastDownload: null,
            totalDownloadTime: 0,
            marketplaces: new Set(),
            dateRange: { earliest: null, latest: null }
          }
        };

        await historyManager.saveHistory();
        return { success: true };
      } catch (error) {
        console.error('❌ Error clearing history:', error);
        return { success: false, error: error.message };
      }
    });

    // Settings handlers
    this.registerHandler('getSettings', async (request) => {
      try {
        const settings = await this.optionsManager.loadSettings();
        return { settings: settings };
      } catch (error) {
        console.error('❌ Error getting settings:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('saveSettings', async (request) => {
      try {
        if (!request.settings) {
          throw new Error('Settings data is required');
        }
        await this.optionsManager.updateSettings(request.settings);
        return { success: true };
      } catch (error) {
        console.error('❌ Error saving settings:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('resetSettings', async (request) => {
      try {
        await this.optionsManager.resetSettings();
        return { success: true };
      } catch (error) {
        console.error('❌ Error resetting settings:', error);
        return { success: false, error: error.message };
      }
    });

    // Session summary export handler
    this.registerHandler('exportSessionSummary', async (request) => {
      try {
        if (!request.sessionData) {
          throw new Error('Session data is required');
        }

        const sessionData = request.sessionData;
        const sessionSummary = await createSessionSummary(sessionData);

        // Store in chrome.storage.local instead of downloading directly
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `amazon_invoice_session_${timestamp}.json`;
        const storageKey = `export_${timestamp}`;

        return new Promise((resolve, reject) => {
          chrome.storage.local.set({
            [storageKey]: {
              filename: filename,
              data: sessionSummary,
              timestamp: new Date().toISOString()
            }
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('❌ Error storing session summary export:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            console.log('✅ Session summary export data stored successfully');
            resolve({
              success: true,
              filename: filename,
              data: sessionSummary,
              storageKey: storageKey
            });
          });
        });
      } catch (error) {
        console.error('❌ Error exporting session summary:', error);
        return { success: false, error: error.message };
      }
    });

    // Health check handler
    this.registerHandler('runHealthCheck', async (request) => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        return {
          summary: { total: 0, passed: 0, failed: 1, healthy: false, issues: [{ issue: 'tab', message: 'No active tab found' }] }
        };
      }

      const currentTab = tabs[0];
      const context = {
        marketplace: currentTab.url.includes('amazon.de') ? 'amazon.de' :
                     currentTab.url.includes('amazon.fr') ? 'amazon.fr' :
                     currentTab.url.includes('amazon.co.uk') ? 'amazon.co.uk' :
                     'amazon.com'
      };

      try {
        const results = await healthChecker.runAllChecks(context);
        return results;
      } catch (error) {
        console.error('Health check error:', error);
        return {
          summary: { total: 0, passed: 0, failed: 1, healthy: false, issues: [{ issue: 'error', message: error.message }] }
        };
      }
    });

    // PDF download handler
    this.registerHandler('downloadPDF', async (request) => {
      const downloadTimer = performanceMonitor.startTimer('downloadPDF_handler');

      try {
        logger.info('PDF download request received', {
          url: request.url,
          filename: request.filename,
          orderId: request.orderId,
          marketplace: request.marketplace
        });

        // Validate filename before processing
        if (!request.filename) {
          logger.error('No filename provided in downloadPDF request', null, {
            url: request.url,
            orderId: request.orderId
          });
          performanceMonitor.endTimer(downloadTimer, { success: false, error: 'no_filename' });
          return { success: false, error: 'No filename provided' };
        }

        // Validate that URL is actually a direct PDF
        const pdfUrl = request.url;
        const isValidPDF = pdfUrl.toLowerCase().endsWith('.pdf') ||
                          pdfUrl.includes('/documents/download/') ||
                          pdfUrl.includes('/invoice.pdf');

        if (!isValidPDF) {
          logger.error('URL does not appear to be a direct PDF download', null, {
            url: pdfUrl,
            filename: request.filename
          });
          performanceMonitor.endTimer(downloadTimer, { success: false, error: 'invalid_pdf_url' });
          return { success: false, error: 'URL is not a direct PDF download' };
        }

        logger.debug('URL validated as direct PDF download', { url: pdfUrl });

        // Check for order-level duplicates if enabled
        const settings = await OptionsManager.loadSettings();
        performanceMonitor.addCheckpoint(downloadTimer, 'settings_loaded');

        if (settings.skipDuplicates && request.orderId) {
          logger.debug('Checking for order-level duplicates', { orderId: request.orderId });
          const isOrderDuplicate = await checkOrderDuplicate(request.orderId);
          if (isOrderDuplicate) {
            logger.info('Skipping download - order already processed', {
              orderId: request.orderId,
              reason: 'order_duplicate'
            });
            performanceMonitor.incrementCounter('downloads_skipped_order_duplicate');
            performanceMonitor.endTimer(downloadTimer, {
              success: false,
              reason: 'order_duplicate',
              orderId: request.orderId
            });
            return {
              success: false,
              error: 'Order already downloaded',
              duplicate: true,
              reason: 'order_already_processed'
            };
          }
        }

        // Check for file-level duplicates if enabled (fetch and hash PDF before download)
        let fileHash = null;
        if (settings.skipFileDuplicates) {
          logger.debug('Checking for file-level duplicates', { url: request.url });
          try {
            performanceMonitor.addCheckpoint(downloadTimer, 'duplicate_check_start');
            const pdfResponse = await fetch(request.url);
            if (!pdfResponse.ok) {
              throw new Error(`HTTP ${pdfResponse.status}: ${pdfResponse.statusText}`);
            }

            const pdfBlob = await pdfResponse.blob();
            fileHash = await generateFileHash(pdfBlob);
            performanceMonitor.addCheckpoint(downloadTimer, 'duplicate_check_complete');

            if (fileHash) {
              const isFileDuplicate = await checkLocalFileDuplicate(fileHash);
              if (isFileDuplicate) {
                logger.info('Skipping download - file already exists locally', {
                  fileHash: fileHash,
                  reason: 'file_duplicate'
                });
                performanceMonitor.incrementCounter('downloads_skipped_file_duplicate');
                performanceMonitor.endTimer(downloadTimer, {
                  success: false,
                  reason: 'file_duplicate',
                  fileHash: fileHash
                });
                return {
                  success: false,
                  error: 'File already exists locally',
                  duplicate: true,
                  reason: 'file_already_exists',
                  fileHash: fileHash
                };
              }
              logger.debug('File hash is unique', { fileHash: fileHash });
            }
          } catch (error) {
            logger.warn('Could not check file duplicates (fetch failed)', error, {
              url: request.url
            });
            // Continue with download if we can't check
          }
        }

        const sanitizedFilename = downloadProcessor.sanitizeFilename(request.filename);

        // Specifieke aanpassing voor Duitse facturen
        let finalFilename = sanitizedFilename;
        if (sanitizedFilename.includes('Bestellnr')) {
          const orderNumber = sanitizedFilename.match(/\d+-\d+-\d+/);
          if (orderNumber) {
            const originalExtension = sanitizedFilename.split('.').pop();
            finalFilename = `${orderNumber[0]}_${sanitizedFilename}.${originalExtension}`;
          }
        }

        logger.info('Starting PDF download', {
          url: request.url,
          filename: finalFilename,
          orderId: request.orderId,
          fileHash: fileHash
        });

        performanceMonitor.addCheckpoint(downloadTimer, 'chrome_download_start');

        chrome.downloads.download({
          url: request.url,
          filename: finalFilename,
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            logger.error('Chrome download failed', chrome.runtime.lastError, {
              url: request.url,
              filename: finalFilename,
              orderId: request.orderId
            });
            performanceMonitor.incrementCounter('chrome_download_errors');
            performanceMonitor.endTimer(downloadTimer, {
              success: false,
              error: chrome.runtime.lastError.message,
              downloadId: null
            });
            // Note: This is inside a callback, so we can't return the error directly
            // The popup will need to handle download errors through chrome.downloads.onChanged
          } else {
            logger.info('Chrome download started successfully', {
              downloadId: downloadId,
              filename: finalFilename,
              orderId: request.orderId
            });
            performanceMonitor.incrementCounter('chrome_downloads_started');

            // Create and save metadata
            const downloadItem = {
              url: request.url,
              orderId: request.orderId,
              filename: finalFilename,
              marketplace: request.marketplace || 'unknown'
            };

            const downloadResult = {
              downloadId: downloadId,
              fileHash: fileHash
            };
            const metadata = metadataManager.createMetadata(downloadItem, downloadResult);

            // Save metadata file
            metadataManager.saveMetadata(metadata, finalFilename).then(metaResult => {
              if (metaResult.success) {
                logger.debug('Metadata saved successfully', { filename: metaResult.filename });
              } else {
                logger.warn('Failed to save metadata', null, { error: metaResult.error });
              }
            }).catch(error => {
              logger.warn('Metadata save error', error);
            });

            // Track this download for verification
            trackDownload(downloadId, request.orderId, finalFilename, metadata);

            performanceMonitor.endTimer(downloadTimer, {
              success: true,
              downloadId: downloadId,
              orderId: request.orderId
            });
          }
        });

        // Return success status (actual download result comes via chrome.downloads.onChanged)
        return { success: true, status: 'download_started' };

      } catch (error) {
        performanceMonitor.endTimer(downloadTimer, { success: false, error: error.message });
        logger.error('Error in downloadPDF handler', error, {
          url: request.url,
          filename: request.filename,
          orderId: request.orderId
        });
        return { success: false, error: error.message };
      }
    });

    // Notification handlers
    this.registerHandler('showNotification', async (request) => {
      try {
        if (!request.title || !request.message) {
          throw new Error('Title and message are required for notifications');
        }

        const notificationId = `notification_${Date.now()}`;

        const options = {
          type: request.type || 'basic',
          title: request.title,
          message: request.message,
          iconUrl: request.iconUrl || 'icon.png',
          requireInteraction: request.requireInteraction || false
        };

        if (request.buttons && request.buttons.length > 0) {
          options.buttons = request.buttons;
        }

        return new Promise((resolve) => {
          chrome.notifications.create(notificationId, options, (createdId) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Failed to create notification:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('✅ Notification created:', createdId);
              resolve({ success: true, notificationId: createdId });
            }
          });
        });
      } catch (error) {
        console.error('❌ Error showing notification:', error);
        return { success: false, error: error.message };
      }
    });



    this.registerHandler('showError', async (request) => {
      try {
        if (!request.title || !request.message) {
          throw new Error('Title and message are required for error notifications');
        }

        const notificationId = `error_${Date.now()}`;

        const options = {
          type: 'basic',
          title: request.title,
          message: request.message,
          iconUrl: request.iconUrl || chrome.runtime.getURL('images/icon128.PNG'),
          requireInteraction: true
        };

        return new Promise((resolve) => {
          chrome.notifications.create(notificationId, options, (createdId) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Failed to create error notification:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('✅ Error notification created:', createdId);
              resolve({ success: true, notificationId: createdId });
            }
          });
        });
      } catch (error) {
        console.error('❌ Error showing error notification:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('updateProgressNotification', async (request) => {
      try {
        return new Promise((resolve) => {
          // Find the most recent progress notification and update it
          chrome.notifications.getAll((notifications) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Failed to get notifications:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
              return;
            }

            const progressNotifications = Object.keys(notifications).filter(id =>
              id.startsWith('progress_') && notifications[id].type === 'progress'
            );

            if (progressNotifications.length > 0) {
              // Update the most recent progress notification
              const notificationId = progressNotifications[progressNotifications.length - 1];
              const options = {
                progress: request.progress || 0
              };
              if (request.message) {
                options.message = request.message;
              }

              chrome.notifications.update(notificationId, options, (wasUpdated) => {
                if (chrome.runtime.lastError) {
                  console.error('❌ Failed to update progress notification:', chrome.runtime.lastError);
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  console.log('✅ Progress notification updated:', notificationId);
                  resolve({ success: true, notificationId: notificationId, wasUpdated: wasUpdated });
                }
              });
            } else {
              console.warn('⚠️ No progress notifications found to update');
              resolve({ success: false, error: 'No progress notifications found' });
            }
          });
        });
      } catch (error) {
        console.error('❌ Error updating progress notification:', error);
        return { success: false, error: error.message };
      }
    });

    // Tab management handlers
    this.registerHandler('createTab', async (request) => {
      try {
        if (!request.url) {
          throw new Error('URL is required to create tab');
        }

        const tab = await chrome.tabs.create({ url: request.url, active: false });
        if (!tab || !tab.id) {
          throw new Error('Failed to create tab');
        }

        // Wait for tab to complete loading with timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error('Tab load timeout'));
          }, 30000); // 30 second timeout

          function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              clearTimeout(timeout);
              resolve();
            }
          }
          chrome.tabs.onUpdated.addListener(listener);
        });

        // Send message to tab
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "downloadOpenedPDF",
          filename: request.filename
        });
        console.log(`✅ Tax invoice download started`);
        return { success: true, tabId: tab.id, response: response };
      } catch (error) {
        console.error('❌ Error in createTab handler:', error);
        // Try to close the tab if it was created but failed
        if (tab && tab.id) {
          try {
            await chrome.tabs.remove(tab.id);
            console.log('🧹 Cleaned up failed tab:', tab.id);
          } catch (cleanupError) {
            console.warn('⚠️ Failed to cleanup tab:', cleanupError);
          }
        }
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('closeCurrentTab', async (request) => {
      try {
        if (!sender.tab) {
          throw new Error('No tab information available for closing');
        }

        return new Promise((resolve) => {
          chrome.tabs.remove(sender.tab.id, () => {
            if (chrome.runtime.lastError) {
              console.error('❌ Error closing tab:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('✅ Tab closed:', sender.tab.id);
              resolve({ success: true, tabId: sender.tab.id });
            }
          });
        });
      } catch (error) {
        console.error('❌ Error in closeCurrentTab handler:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('startTaxDownload', async (request) => {
      try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs.length === 0) {
          return { success: false, error: "Geen actieve tab gevonden" };
        }

        return new Promise((resolve) => {
          chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Error sending message to content script:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('✅ Response received from content script:', response);
              resolve(response);
            }
          });
        });
      } catch (error) {
        console.error('❌ Error in startTaxDownload handler:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('startDownload', async (request) => {
      try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs.length === 0) {
          throw new Error('No active tab found');
        }

        return new Promise((resolve) => {
          chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Error sending message to content script:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('✅ Response received from content script:', response);
              resolve({ success: true, response: response });
            }
          });
        });
      } catch (error) {
        console.error('❌ Error in startDownload handler:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('fetchInvoicePage', async (request) => {
      try {
        if (!request.url) {
          throw new Error('URL is required for fetching invoice page');
        }

        const response = await fetch(request.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        return { success: true, html: html, url: request.url };
      } catch (error) {
        console.error('❌ Error fetching invoice page:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('downloadBusinessPDF', async (request) => {
      try {
        if (!request.url || !request.filename) {
          throw new Error('URL and filename are required for PDF download');
        }

        console.log("📨 Background script received downloadBusinessPDF request:", request);

        return new Promise((resolve) => {
          chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: false
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Error starting PDF download:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log(`✅ Business PDF download started with ID:`, downloadId);
              resolve({ success: true, downloadId: downloadId, filename: request.filename });
            }
          });
        });
      } catch (error) {
        console.error('❌ Error in downloadBusinessPDF handler:', error);
        return { success: false, error: error.message };
      }
    });

    // License handlers
    this.registerHandler('validateLicense', async (request) => {
      try {
        // INTERNAL BUILD: Always return valid
        console.log('🔓 License validation requested (internal build)');
        return {
          success: true,
          valid: true,
          plan: 'internal',
          message: 'Internal company build'
        };
      } catch (error) {
        console.error('❌ Error in license validation:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('resetLicense', async (request) => {
      try {
        if (!request.licenseKey) {
          throw new Error('License key is required for reset');
        }

        const result = await resetLicense(request.licenseKey);
        return result;
      } catch (error) {
        console.error('❌ Error resetting license:', error);
        return { success: false, error: 'An error occurred while resetting the license: ' + error.message };
      }
    });

    this.registerHandler('licenseValidationResult', async (request) => {
      try {
        isLicenseValid = request.isValid;
        console.log('📋 License validation result updated:', isLicenseValid);
        return { success: true };
      } catch (error) {
        console.error('❌ Error updating license validation result:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('licenseInvalid', async (request) => {
      try {
        isLicenseValid = false;
        console.log('🚫 License marked as invalid due to logout');
        return { success: true };
      } catch (error) {
        console.error('❌ Error marking license invalid:', error);
        return { success: false, error: error.message };
      }
    });

    // PDF URL extraction handler
    this.registerHandler('extractPdfUrl', async (request) => {
      try {
        if (!request.invoicePageUrl) {
          throw new Error('Invoice page URL is required for PDF extraction');
        }

        const pdfUrl = await downloadProcessor.extractPdfUrlFromInvoicePage(request.invoicePageUrl);
        return { success: true, pdfUrl: pdfUrl };
      } catch (error) {
        console.error('❌ PDF extraction error:', error);
        return { success: false, error: error.message };
      }
    });

    // Google Drive upload handler
    this.registerHandler('uploadToGoogleDrive', async (request) => {
      try {
        if (!request.sessionPath || !request.metadata) {
          throw new Error('Session path and metadata are required for Google Drive upload');
        }

        const result = await googleDriveManager.uploadSessionToGoogleDrive(request.sessionPath, request.metadata);
        return result;
      } catch (error) {
        console.error('❌ Google Drive upload error:', error);
        return { success: false, error: error.message };
      }
    });

    // Update account type handler
    this.registerHandler('updateAccountType', async (request) => {
      try {
        if (!request.accountType) {
          throw new Error('Account type is required');
        }

        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs.length === 0) {
          throw new Error('No active tab found');
        }

        return new Promise((resolve) => {
          chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Error sending account type update:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('✅ Account type updated successfully');
              resolve({ success: true, response: response });
            }
          });
        });
      } catch (error) {
        console.error('❌ Error updating account type:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('showProgress', async (request) => {
      try {
        await this.notificationManager.showProgress(request.title, request.message, request.progress);
        return { success: true };
      } catch (error) {
        console.error('Failed to show progress notification:', error);
        return { success: false, error: error.message };
      }
    });

    this.registerHandler('showCompletion', async (request) => {
      try {
        await this.notificationManager.showCompletion(request.title, request.message, request.buttons);
        return { success: true };
      } catch (error) {
        console.error('Failed to show completion notification:', error);
        return { success: false, error: error.message };
      }
    });

  }
}

// Export the MessageHandler class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MessageHandler };
} else {
  // For browser environment (window for pages, self for service workers)
  if (typeof self !== 'undefined') {
    self.MessageHandler = MessageHandler;
  }
}