// ===== IMPORT MODULES =====
// importScripts('utils/LicenseManager.js');
importScripts('utils/SessionManager.js');
importScripts('state/DownloadStateManager.js');
importScripts('utils/ContentScriptManager.js');
importScripts('utils/DownloadProcessor.js');

// ===== INTERNAL BUILD: AUTO-ACTIVATION =====

const INTERNAL_LICENSE = 'INTERNAL-BUILD-2024';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    licenseKey: INTERNAL_LICENSE,
    licenseValid: true,
    plan: 'internal',
    activatedAt: new Date().toISOString()
  });
  console.log('🔓 Internal build auto-activated');
});

// ===== END INTERNAL BUILD CONFIG =====



// ============================================

// DOWNLOAD STATE TRACKING FOR POPUP SYNC

// ============================================



let downloadState = {

  isDownloading: false,

  current: 0,

  total: 0,

  successful: 0,

  failed: 0,

  startTime: null,

  downloadItems: []

};



// Download state management is now handled by DownloadStateManager module



// ===== TAB STATE MONITORING =====
// Monitor tab changes and notify popup of content script state changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('🔄 Tab activated:', activeInfo.tabId);

  // Query the active tab for its content script state
  try {
    const response = await chrome.tabs.sendMessage(activeInfo.tabId, { action: 'getContentState' });
    if (response && response.hasState) {
      // Notify popup about the state
      chrome.runtime.sendMessage({
        action: 'contentStateUpdate',
        data: response
      }).catch(() => {}); // Ignore if popup is closed
    }
  } catch (error) {
    // Content script not loaded or not responding - that's fine
    console.log('📭 No content script on active tab or not responding');
  }
});

// Monitor tab updates (URL changes, reloads)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    console.log('🔄 Tab updated and active:', tabId, tab.url);

    // Small delay to let content script initialize
    setTimeout(async () => {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'getContentState' });
        if (response && response.hasState) {
          // Notify popup about the state
          chrome.runtime.sendMessage({
            action: 'contentStateUpdate',
            data: response
          }).catch(() => {}); // Ignore if popup is closed
        }
      } catch (error) {
        // Content script not loaded yet - that's expected during page load
      }
    }, 1000);
  }
});

console.log('🎧 BACKGROUND SCRIPT: Message listener active');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 BACKGROUND RECEIVED MESSAGE:', request);

  // ADD THIS NEW HANDLER AT THE TOP:
  if (request.action === 'getDownloadState') {
    console.log('📊 Popup requesting download state');
    const state = downloadStateManager.getDownloadState();
    console.log('📊 Sending download state to popup:', state);
    sendResponse({
      success: true,
      state: state
    });
    return true;
  }

  // Handle background download requests
  if (request.type === 'startDownloads') {
    console.log('🎯 MESSAGE RECEIVED: startDownloads type detected');
    console.log('📨 DIAGNOSTIC: Received startDownloads message:', {
      hasDownloadItems: !!request.downloadItems,
      itemCount: request.downloadItems?.length,
      marketplace: request.marketplace,
      startDate: request.startDate,           // Should show date string
      endDate: request.endDate,               // Should show date string
      dateRangeType: request.dateRangeType    // Should show quarter
    });

    // 🆕 ADD THIS DETAILED LOG
    console.log('📅 RAW REQUEST OBJECT KEYS:', Object.keys(request));
    console.log('📅 RAW startDate VALUE:', request.startDate);
    console.log('📅 RAW endDate VALUE:', request.endDate);
    console.log('📅 RAW dateRangeType VALUE:', request.dateRangeType);

    console.log(`📦 Background received download request: ${request.downloadItems.length} items`);

    // Process downloads asynchronously
    processDownloads(request.downloadItems, request.marketplace, request.concurrent, request.startDate, request.endDate, request.dateRangeType)
      .then(() => {
        console.log('✅ Download processing completed');
      })
      .catch(error => {
        console.error('❌ Download processing failed:', error);
      });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === "checkContentScriptLoaded") {
    checkContentScriptLoaded().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ loaded: false, error: error.message });
    });
    return true;
  }

  if (request.action === "executeContentScript") {
    contentScriptManager.executeContentScript();
    sendResponse({success: true});
    return true;
  }

  if (request.action === "injectScript") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        sendResponse({success: false, error: "Geen actieve tab gevonden"});
        return;
      }

      const scriptPath = request.scriptName;
      console.log(`Injecting script: ${scriptPath}`);

      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: [scriptPath]
      }, () => {
        if (chrome.runtime.lastError) {
          console.error(`Fout bij het injecteren van ${scriptPath}:`, chrome.runtime.lastError);
          sendResponse({success: false, error: chrome.runtime.lastError.message});
        } else {
          console.log(`${scriptPath} succesvol geïnjecteerd`);
          sendResponse({success: true});
        }
      });
    });
    return true;
  }

  if (request.action === "downloadComplete") {
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

    // Forward the message to popup
    chrome.runtime.sendMessage(request);
    return true;
  }

  if (request.action === "updateDownloadProgress") {
    // Forward progress updates to popup
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup might be closed, that's okay
    });
    return true;
  }

  if (request.action === "updateDownloadStatus") {
    // Forward status updates to popup
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup might be closed, that's okay
    });
    return true;
  }

  if (request.action === "startTaxDownload") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        sendResponse({error: "Geen actieve tab gevonden"});
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, request, function(response) {
        console.log('Antwoord ontvangen van content script:', response);
        sendResponse(response);
      });
    });
    return true;
  }

  if (request.action === "startMultiMarketplaceDownload") {
    console.log('🌍 Starting multi-marketplace download:', request);

    // Import MarketplaceCoordinator dynamically
    import('./utils/MarketplaceCoordinator.js').then(({ MarketplaceCoordinator }) => {
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
        }
      });

      // Start coordinated download
      coordinator.startCoordinatedDownload({
        startDate: request.startDate,
        endDate: request.endDate
      }, request.accountType).then(summary => {
        console.log('🎯 Multi-marketplace download complete:', summary);
        // Send completion message to popup
        chrome.runtime.sendMessage({
          action: 'multiMarketplaceComplete',
          summary: summary
        });
      }).catch(error => {
        console.error('❌ Multi-marketplace download failed:', error);
        chrome.runtime.sendMessage({
          action: 'multiMarketplaceError',
          error: error.message
        });
      });
    }).catch(error => {
      console.error('Failed to load MarketplaceCoordinator:', error);
      sendResponse({ error: 'Failed to initialize multi-marketplace coordinator' });
    });

    return true;
  }

  if (request.action === "recordSession") {
    historyManager.recordSession(request.sessionData).then(session => {
      sendResponse({ success: true, session: session });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === "getHistoryStats") {
    const summary = historyManager.getDisplaySummary();
    const sessions = historyManager.history.sessions; // Return all sessions for grouping
    sendResponse({ summary: summary, sessions: sessions });
    return true;
  }

  if (request.action === "getSessionDetails") {
    const session = historyManager.getSession(request.sessionId);
    if (session) {
      sendResponse({ success: true, session: session });
    } else {
      sendResponse({ success: false, error: "Session not found" });
    }
    return true;
  }

  if (request.action === "exportHistory") {
    const historyData = historyManager.exportHistory();
    const filename = `amazon_invoice_history_${new Date().toISOString().split('T')[0]}.json`;

    // Store in chrome.storage.local and return data for popup to handle download
    const storageKey = `history_export_${Date.now()}`;
    chrome.storage.local.set({
      [storageKey]: {
        filename: filename,
        data: historyData,
        timestamp: new Date().toISOString()
      }
    }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({
          success: true,
          filename: filename,
          data: historyData,
          storageKey: storageKey
        });
      }
    });
    return true;
  }

  if (request.action === "clearHistory") {
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

    historyManager.saveHistory().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === "getSettings") {
    sendResponse({ settings: userSettings });
    return true;
  }

  if (request.action === "saveSettings") {
    userSettings = { ...userSettings, ...request.settings };
    saveUserSettings();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "resetSettings") {
    userSettings = { ...defaultSettings };
    saveUserSettings();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "exportSessionSummary") {
    const sessionData = request.sessionData;
    const sessionSummary = createSessionSummary(sessionData);

    // Store in chrome.storage.local instead of downloading directly
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `amazon_invoice_session_${timestamp}.json`;
    const storageKey = `export_${timestamp}`;

    chrome.storage.local.set({
      [storageKey]: {
        filename: filename,
        data: sessionSummary,
        timestamp: new Date().toISOString()
      }
    }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        // Return the data so the popup can handle the download
        sendResponse({
          success: true,
          filename: filename,
          data: sessionSummary,
          storageKey: storageKey
        });
      }
    });
    return true;
  }

  if (request.action === "runHealthCheck") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) {
        sendResponse({
          summary: { total: 0, passed: 0, failed: 1, healthy: false, issues: [{ issue: 'tab', message: 'No active tab found' }] }
        });
        return;
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
        sendResponse(results);
      } catch (error) {
        console.error('Health check error:', error);
        sendResponse({
          summary: { total: 0, passed: 0, failed: 1, healthy: false, issues: [{ issue: 'error', message: error.message }] }
        });
      }
    });
    return true;
  }

  if (request.action === "downloadPDF") {
    console.log('📨 RECEIVED downloadPDF request:', request);
    console.log('📄 PDF URL to download:', request.url);
    console.log('📁 Target filename:', request.filename);

    // Validate filename before processing
    if (!request.filename) {
      console.error('❌ No filename provided in downloadPDF request');
      sendResponse({ success: false, error: 'No filename provided' });
      return true;
    }

    // Validate that URL is actually a direct PDF
    const pdfUrl = request.url;
    const isValidPDF = pdfUrl.toLowerCase().endsWith('.pdf') ||
                      pdfUrl.includes('/documents/download/') ||
                      pdfUrl.includes('/invoice.pdf');

    if (!isValidPDF) {
      console.error('❌ URL does not appear to be a direct PDF download:', pdfUrl);
      sendResponse({ success: false, error: 'URL is not a direct PDF download' });
      return true;
    }

    console.log('✅ URL validated as direct PDF download');

    let sanitizedFilename = downloadProcessor.sanitizeFilename(request.filename);

    // Specifieke aanpassing voor Duitse facturen
    if (sanitizedFilename.includes('Bestellnr')) {
      const orderNumber = sanitizedFilename.match(/\d+-\d+-\d+/);
      if (orderNumber) {
        const originalExtension = sanitizedFilename.split('.').pop();
        sanitizedFilename = `${orderNumber[0]}_${sanitizedFilename}.${originalExtension}`;
      }
    }

    console.log('🚀 Starting PDF download:', {
      url: request.url,
      filename: sanitizedFilename,
      isValidPDF: true
    });

    chrome.downloads.download({
      url: request.url,
      filename: sanitizedFilename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Download failed:', chrome.runtime.lastError);
        sendResponse({error: chrome.runtime.lastError.message});
      } else {
        console.log('✅ Download started with ID:', downloadId, 'for file:', sanitizedFilename);

        // Create and save metadata
        const downloadItem = {
          url: request.url,
          orderId: request.orderId,
          filename: sanitizedFilename,
          marketplace: request.marketplace || 'unknown'
        };

        const downloadResult = { downloadId: downloadId };
        const metadata = metadataManager.createMetadata(downloadItem, downloadResult);

        // Save metadata file
        metadataManager.saveMetadata(metadata, sanitizedFilename).then(metaResult => {
          if (metaResult.success) {
            console.log(`📄 Metadata saved: ${metaResult.filename}`);
          } else {
            console.warn('⚠️ Failed to save metadata:', metaResult.error);
          }
        }).catch(error => {
          console.warn('⚠️ Metadata save error:', error);
        });

        // Track this download for verification
        trackDownload(downloadId, request.orderId, sanitizedFilename, metadata);

        sendResponse({success: true, downloadId: downloadId});
      }
    });
    return true;
  }

  if (request.action === "showNotification") {
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

    chrome.notifications.create(notificationId, options, (createdId) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to create notification:', chrome.runtime.lastError);
      } else {
        console.log('Notification created:', createdId);
      }
    });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === "showProgress") {
    const notificationId = `progress_${Date.now()}`;

    const options = {
      type: 'progress',
      title: request.title,
      message: request.message,
      iconUrl: request.iconUrl || chrome.runtime.getURL('images/icon128.PNG'),
      progress: request.progress || 0,
      requireInteraction: false
    };

    chrome.notifications.create(notificationId, options, (createdId) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to create progress notification:', chrome.runtime.lastError);
      } else {
        console.log('Progress notification created:', createdId);
        // Auto-clear progress notifications after 30 seconds
        setTimeout(() => {
          chrome.notifications.clear(createdId);
        }, 30000);
      }
    });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === "showCompletion") {
    const notificationId = `completion_${Date.now()}`;

    const options = {
      type: 'basic',
      title: request.title,
      message: request.message,
      iconUrl: request.iconUrl || chrome.runtime.getURL('images/icon128.PNG'),
      requireInteraction: true
    };

    if (request.buttons && request.buttons.length > 0) {
      options.buttons = request.buttons.map(btn => ({ title: btn.title }));
    }

    chrome.notifications.create(notificationId, options, (createdId) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to create completion notification:', chrome.runtime.lastError);
      } else {
        console.log('Completion notification created:', createdId);
      }
    });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === "showError") {
    const notificationId = `error_${Date.now()}`;

    const options = {
      type: 'basic',
      title: request.title,
      message: request.message,
      iconUrl: request.iconUrl || chrome.runtime.getURL('images/icon128.PNG'),
      requireInteraction: true
    };

    chrome.notifications.create(notificationId, options, (createdId) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to create error notification:', chrome.runtime.lastError);
      } else {
        console.log('Error notification created:', createdId);
      }
    });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === "updateProgressNotification") {
    // Find the most recent progress notification and update it
    chrome.notifications.getAll((notifications) => {
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

        chrome.notifications.update(notificationId, options);
      }
    });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === "createTab") {
    (async () => {
      try {
        const tab = await chrome.tabs.create({ url: request.url, active: false });

        // Wait for tab to complete loading
        await new Promise((resolve) => {
          function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          }
          chrome.tabs.onUpdated.addListener(listener);
        });

        // Send message to tab
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "downloadOpenedPDF",
            filename: request.filename
          });
          console.log(`Tax invoice download gestart`);
          sendResponse({ success: true });
        } catch (error) {
          console.error('Fout bij het verzenden van downloadOpenedPDF bericht:', error);
          sendResponse({ error: error.message });
        }
      } catch (error) {
        console.error('Fout bij het aanmaken van tabblad:', error);
        sendResponse({ error: error.message });
      }
    })();

    return true; // Keep channel open for async response
  }

  if (request.action === "closeCurrentTab") {
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id, () => {
        if (chrome.runtime.lastError) {
          console.error('Fout bij het sluiten van het tabblad:', chrome.runtime.lastError);
        } else {
          console.log('Tabblad gesloten:', sender.tab.id);
        }
      });
    } else {
      console.error('Geen tab-informatie beschikbaar voor het sluiten van het tabblad');
    }
    return true;
  }

  if (request.action === "startDownload") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        sendResponse({error: "Geen actieve tab gevonden"});
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, request, function(response) {
        console.log('Antwoord ontvangen van content script:', response);
        sendResponse(response);
      });
    });
    return true;
  }

  if (request.action === "fetchInvoicePage") {
    fetch(request.url)
      .then(response => response.text())
      .then(html => {
        sendResponse({html: html});
      })
      .catch(error => {
        console.error('Fout bij het ophalen van de factuurpagina:', error);
        sendResponse({error: error.message});
      });
    return true;
  }

  if (request.action === "downloadBusinessPDF") {
    console.log("Background script ontving downloadBusinessPDF verzoek:", request);
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Fout bij het starten van de download:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log(`Business PDF download gestart met ID:`, downloadId);
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    return true;
  }

  if (request.action === "validateLicense") {
    // INTERNAL BUILD: Always return valid
    sendResponse({
      valid: true,
      plan: 'internal',
      message: 'Internal company build'
    });
    return true;
  } else if (request.action === "resetLicense") {
    resetLicense(request.licenseKey)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('Error resetting license:', error);
        sendResponse({success: false, error: 'An error occurred while resetting the license'});
      });
    return true;
  }

  if (request.action === "licenseValidationResult") {
    isLicenseValid = request.isValid;
    console.log('License validation result:', isLicenseValid);
  } else if (request.action === "licenseInvalid") {
    isLicenseValid = false;
    console.log('Licentie ongeldig gemaakt door uitloggen');
  }

  // Handle PDF URL extraction requests from content script
  if (request.action === "extractPdfUrl") {
    downloadProcessor.extractPdfUrlFromInvoicePage(request.invoicePageUrl).then(pdfUrl => {
      sendResponse({ success: true, pdfUrl: pdfUrl });
    }).catch(error => {
      console.error('❌ PDF extraction error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // INTERNAL BUILD: License check disabled
  // if (!isLicenseValid && request.action !== "validateLicense") {
  //     sendResponse({ error: "Invalid license. Please activate the extension first." });
  //     return true;
  // }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateAccountType") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message, () => {
          sendResponse({success: true});
        });
      } else {
        sendResponse({success: false});
      }
    });
    return true;
  }
});

// Content script management is now handled by ContentScriptManager module
// ===== SETTINGS MANAGEMENT =====
// User preferences and configuration

const defaultSettings = {
  // Download behavior
  maxConcurrent: 3,
  delayBetween: 1500,
  rateLimit: 8,
  retryFailed: true,

  // File organization
  folderStructure: 'byYearMonth',
  filenameFormat: 'dated',
  baseFolder: 'Amazon_Invoices',

  // Notifications
  showProgress: true,
  showCompletion: true,
  showErrors: true,
  enableSound: false,

  // Advanced
  saveMetadata: true,
  trackHistory: true,
  verboseLogging: false
};

let userSettings = { ...defaultSettings };

// Load settings from storage
chrome.storage.local.get('userSettings', (data) => {
  if (data.userSettings) {
    userSettings = { ...defaultSettings, ...data.userSettings };
  }
});

// Save settings to storage
function saveUserSettings() {
  chrome.storage.local.set({ userSettings: userSettings });
}

// Create session summary for export
function createSessionSummary(sessionData) {
  const now = new Date();

  return {
    sessionId: sessionData.sessionId || `session_${Date.now()}`,
    exportTimestamp: now.toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,

    // Session metadata
    marketplace: sessionData.marketplace || 'unknown',
    startTime: sessionData.startTime || now.toISOString(),
    endTime: sessionData.endTime || now.toISOString(),
    duration: sessionData.duration || 0,

    // Date range (if applicable)
    dateRange: sessionData.dateRange || null,

    // Download statistics
    statistics: {
      total: sessionData.total || 0,
      successful: sessionData.successful || 0,
      failed: sessionData.failed || 0,
      skipped: sessionData.skipped || 0
    },

    // Download details
    downloads: (sessionData.downloads || []).map(download => ({
      orderId: download.orderId,
      filename: download.filename,
      path: download.path || download.filename,
      size: download.size || 0,
      checksum: download.checksum || null,
      downloaded: download.downloaded || now.toISOString(),
      success: download.success !== false,
      error: download.error || null,
      marketplace: download.marketplace || sessionData.marketplace,
      metadataPath: download.metadataPath || `${download.filename}.meta.json`
    })),

    // Error summary
    errors: sessionData.errors || [],

    // System information
    systemInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },

    // Settings used for this session
    sessionSettings: {
      maxConcurrent: userSettings.maxConcurrent,
      delayBetween: userSettings.delayBetween,
      rateLimit: userSettings.rateLimit,
      folderStructure: userSettings.folderStructure,
      filenameFormat: userSettings.filenameFormat,
      saveMetadata: userSettings.saveMetadata
    },

    // Parser instructions
    parserInstructions: {
      description: "This file contains metadata about downloaded Amazon invoices for automated processing",
      fileFormat: "JSON",
      encoding: "UTF-8",
      schemaVersion: "1.0",
      processingNotes: [
        "Use 'downloads' array to get list of all invoice files",
        "Check 'success' field to identify successful downloads",
        "Use 'path' field for full relative file path",
        "Metadata files are saved alongside PDFs with .meta.json extension",
        "Checksums use MD5 algorithm when available"
      ]
    }
  };
}

// ===== HISTORY MANAGEMENT =====
// Import HistoryManager
const historyManager = new (function() {
  // Inline HistoryManager class for background script
  class HistoryManager {
    constructor() {
      this.storageKey = 'downloadHistory';
      this.maxSessions = 100;
      this.history = {
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
      this.loadHistory();
    }

    async loadHistory() {
      return new Promise((resolve) => {
        chrome.storage.local.get(this.storageKey, (data) => {
          if (data[this.storageKey]) {
            this.history = data[this.storageKey];
            this.history.stats.marketplaces = new Set(this.history.stats.marketplaces || []);
          }
          resolve(this.history);
        });
      });
    }

    async saveHistory() {
      return new Promise((resolve) => {
        const dataToSave = {
          ...this.history,
          stats: {
            ...this.history.stats,
            marketplaces: Array.from(this.history.stats.marketplaces)
          }
        };
        chrome.storage.local.set({ [this.storageKey]: dataToSave }, () => {
          resolve();
        });
      });
    }

    async recordSession(sessionData) {
      const session = {
        id: this.generateSessionId(),
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        marketplace: sessionData.marketplace || 'unknown',
        invoicesDownloaded: sessionData.successful || 0,
        failed: sessionData.failed || 0,
        skipped: sessionData.skipped || 0,
        total: (sessionData.successful || 0) + (sessionData.failed || 0) + (sessionData.skipped || 0),
        duration: sessionData.duration || 0,
        status: sessionData.failed > 0 ? 'completed_with_errors' : 'completed',
        sessionType: sessionData.sessionType || 'single_marketplace',
        downloads: sessionData.downloads || [],
        errors: sessionData.errors || []
      };

      this.history.sessions.unshift(session);
      if (this.history.sessions.length > this.maxSessions) {
        this.history.sessions = this.history.sessions.slice(0, this.maxSessions);
      }

      this.updateStats(session);
      await this.saveHistory();

      console.log(`📊 Session recorded: ${session.invoicesDownloaded} invoices`);
      return session;
    }

    updateStats(session) {
      const stats = this.history.stats;
      stats.totalSessions += 1;
      stats.totalInvoices += session.total;
      stats.lastDownload = session.timestamp;
      stats.marketplaces.add(session.marketplace);

      const sessionDate = new Date(session.timestamp);
      if (!stats.dateRange.earliest || sessionDate < new Date(stats.dateRange.earliest)) {
        stats.dateRange.earliest = session.timestamp;
      }
      if (!stats.dateRange.latest || sessionDate > new Date(stats.dateRange.latest)) {
        stats.dateRange.latest = session.timestamp;
      }

      stats.totalDownloadTime += session.duration;

      const totalSuccessful = this.history.sessions.reduce((sum, s) => sum + s.invoicesDownloaded, 0);
      const totalAttempted = this.history.sessions.reduce((sum, s) => sum + s.total, 0);
      stats.successRate = totalAttempted > 0 ? Math.round((totalSuccessful / totalAttempted) * 100 * 10) / 10 : 0;

      stats.averageSessionSize = Math.round((stats.totalInvoices / stats.totalSessions) * 10) / 10;
    }

    getDisplaySummary() {
      const stats = this.history.stats;
      const sessions = this.history.sessions;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentSessions = sessions.filter(s => new Date(s.timestamp) >= weekAgo);

      const recentActivity = {
        sessions: recentSessions.length,
        invoices: recentSessions.reduce((sum, s) => sum + s.invoicesDownloaded, 0),
        successRate: this.calculateSuccessRate(recentSessions)
      };

      return {
        totalInvoices: stats.totalInvoices.toLocaleString(),
        totalSessions: stats.totalSessions,
        successRate: `${stats.successRate}%`,
        averageSessionSize: stats.averageSessionSize,
        lastDownload: stats.lastDownload ? new Date(stats.lastDownload).toLocaleDateString() : 'Never',
        recentActivity: `${recentActivity.sessions} sessions, ${recentActivity.invoices} invoices`,
        marketplaces: Array.from(stats.marketplaces).sort()
      };
    }

    calculateSuccessRate(sessions) {
      if (sessions.length === 0) return 0;
      const totalSuccessful = sessions.reduce((sum, s) => sum + s.invoicesDownloaded, 0);
      const totalAttempted = sessions.reduce((sum, s) => sum + s.total, 0);
      return totalAttempted > 0 ? Math.round((totalSuccessful / totalAttempted) * 100 * 10) / 10 : 0;
    }

    generateSessionId() {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      return `session_${timestamp}_${random}`;
    }
  }

  return new HistoryManager();
})();

// ===== HEALTH CHECK SYSTEM =====
// Pre-flight checks before starting downloads

class HealthChecker {
  constructor() {
    this.checks = {};
    this.results = {};
  }

  async runAllChecks(context = {}) {
    console.log('🏥 Running health checks...');

    const checks = [
      this.checkMarketplaceAccess(context),
      this.checkPermissions(),
      this.checkStorageSpace(),
      this.checkNetworkConnection(),
      this.checkDownloadPathWritable(),
      this.checkExtensionVersion(),
      this.checkBrowserCompatibility()
    ];

    const results = await Promise.all(checks);
    this.results = Object.fromEntries(results.map(r => [r.name, r]));

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    console.log(`🏥 Health check complete: ${passed}/${total} checks passed`);

    return {
      passed: passed === total,
      results: this.results,
      summary: {
        total,
        passed,
        failed: total - passed,
        healthy: passed === total,
        issues: this.getIssues()
      }
    };
  }

  async checkMarketplaceAccess(context = {}) {
    const marketplace = context.marketplace || 'amazon.com';
    try {
      const response = await fetch(`https://${marketplace}`, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      return {
        name: 'marketplace',
        passed: true,
        message: `${marketplace} is accessible`,
        details: `Successfully connected to ${marketplace}`
      };
    } catch (error) {
      return {
        name: 'marketplace',
        passed: false,
        message: `Cannot access ${marketplace}`,
        details: error.message,
        fix: `Check your internet connection and ensure ${marketplace} is not blocked`
      };
    }
  }

  async checkPermissions() {
    return new Promise((resolve) => {
      chrome.permissions.contains({
        permissions: ['downloads', 'storage', 'activeTab']
      }, (hasPermissions) => {
        if (hasPermissions) {
          resolve({
            name: 'permissions',
            passed: true,
            message: 'Required permissions granted',
            details: 'Extension has necessary permissions'
          });
        } else {
          resolve({
            name: 'permissions',
            passed: false,
            message: 'Missing permissions',
            details: 'Some permissions are not granted',
            fix: 'Check extension permissions in browser settings'
          });
        }
      });
    });
  }

  async checkStorageSpace() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const availableBytes = estimate.quota - estimate.usage;
        const availableGB = (availableBytes / (1024 * 1024 * 1024)).toFixed(2);

        if (availableBytes < 1024 * 1024 * 1024) {
          return {
            name: 'storage',
            passed: false,
            message: `Low disk space: ${availableGB}GB available`,
            details: `Only ${availableGB}GB available`,
            fix: 'Free up disk space before downloading'
          };
        } else {
          return {
            name: 'storage',
            passed: true,
            message: `Storage OK: ${availableGB}GB available`,
            details: `${availableGB}GB of storage space available`
          };
        }
      } else {
        return {
          name: 'storage',
          passed: true,
          message: 'Storage check unavailable',
          details: 'Cannot determine available storage'
        };
      }
    } catch (error) {
      return {
        name: 'storage',
        passed: false,
        message: 'Cannot check storage',
        details: error.message,
        fix: 'Check browser storage settings'
      };
    }
  }

  async checkNetworkConnection() {
    try {
      if (!navigator.onLine) {
        return {
          name: 'network',
          passed: false,
          message: 'No internet connection',
          details: 'Browser reports offline',
          fix: 'Check your internet connection'
        };
      }

      const startTime = Date.now();
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      const responseTime = Date.now() - startTime;

      if (responseTime > 5000) {
        return {
          name: 'network',
          passed: false,
          message: 'Slow connection',
          details: `Response took ${responseTime}ms`,
          fix: 'Connection may be slow'
        };
      } else {
        return {
          name: 'network',
          passed: true,
          message: `Network OK (${responseTime}ms)`,
          details: `Connection test: ${responseTime}ms`
        };
      }
    } catch (error) {
      return {
        name: 'network',
        passed: false,
        message: 'Network issue',
        details: error.message,
        fix: 'Check internet connection'
      };
    }
  }

  async checkDownloadPathWritable() {
    return new Promise((resolve) => {
      // Use data URL instead of blob URL since URL.createObjectURL doesn't work in background scripts
      const testData = 'data:text/plain;base64,dGVzdA=='; // base64 encoded 'test'

      chrome.downloads.download({
        url: testData,
        filename: 'health_check_test.tmp',
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          resolve({
            name: 'downloadPath',
            passed: false,
            message: 'Cannot write to downloads',
            details: chrome.runtime.lastError.message,
            fix: 'Check download folder permissions'
          });
        } else {
          chrome.downloads.erase({ id: downloadId });
          resolve({
            name: 'downloadPath',
            passed: true,
            message: 'Download folder writable',
            details: 'Successfully tested write access'
          });
        }
      });
    });
  }

  checkExtensionVersion() {
    const manifest = chrome.runtime.getManifest();
    return {
      name: 'extensionVersion',
      passed: true,
      message: `Extension v${manifest.version}`,
      details: `Running version ${manifest.version}`
    };
  }

  checkBrowserCompatibility() {
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isEdge = /Edg/.test(navigator.userAgent);

    if (isChrome || isEdge) {
      return {
        name: 'browserCompatibility',
        passed: true,
        message: 'Browser supported',
        details: `Running on ${isChrome ? 'Chrome' : 'Edge'}`
      };
    } else {
      return {
        name: 'browserCompatibility',
        passed: false,
        message: 'Browser may not be supported',
        details: 'Extension designed for Chrome/Edge',
        fix: 'Try Chrome or Edge for best experience'
      };
    }
  }

  getIssues() {
    return Object.values(this.results)
      .filter(result => !result.passed)
      .map(result => ({
        issue: result.name,
        message: result.message,
        fix: result.fix
      }));
  }
}

const healthChecker = new HealthChecker();

// ===== METADATA MANAGEMENT =====
// Import MetadataManager
const metadataManager = new (function() {
  // Inline MetadataManager class for background script
  class MetadataManager {
    constructor() {
      this.sessionId = this.generateSessionId();
      this.extensionVersion = chrome.runtime.getManifest().version;
    }

    generateSessionId() {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      return `session_${timestamp}_${random}`;
    }

    createMetadata(downloadItem, downloadResult) {
      const now = new Date();
      return {
        sessionId: this.sessionId,
        downloadTimestamp: now.toISOString(),
        extensionVersion: this.extensionVersion,
        sourceURL: downloadItem.url,
        marketplace: downloadItem.marketplace || 'unknown',
        orderId: downloadItem.orderId,
        filename: downloadItem.filename,
        downloadId: downloadResult.downloadId,
        acquisitionMethod: 'chrome_downloads_api',
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        processedBy: 'Amazon Invoice Extractor',
        verified: false
      };
    }

    async saveMetadata(metadata, pdfFilename) {
      const metadataKey = `metadata_${pdfFilename}`;
      const metadataEntry = {
        filename: pdfFilename,
        metadata: metadata,
        savedAt: new Date().toISOString(),
        version: '2.0.0'
      };

      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [metadataKey]: metadataEntry }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log(`📝 Metadata saved for ${pdfFilename}`);
            resolve({ success: true, key: metadataKey });
          }
        });
      });
    }
  }

  return new MetadataManager();
})();

// Track active downloads for verification
let activeDownloads = new Map();

function trackDownload(downloadId, orderId, filename, metadata) {
  activeDownloads.set(downloadId, {
    orderId: orderId,
    filename: filename,
    startTime: Date.now(),
    status: 'in_progress',
    metadata: metadata
  });
}

chrome.downloads.onChanged.addListener((delta) => {
  console.log('Download status gewijzigd:', delta);

  if (delta.state && activeDownloads.has(delta.id)) {
    const downloadInfo = activeDownloads.get(delta.id);

    if (delta.state.current === 'complete') {
      console.log('✅ Download completed:', delta.id, downloadInfo.filename);

      // Mark as downloaded in storage
      markAsDownloaded(downloadInfo.orderId, downloadInfo.filename);

      // Update and save verified metadata
      if (downloadInfo.metadata) {
        downloadInfo.metadata.verified = true;
        downloadInfo.metadata.verificationTimestamp = new Date().toISOString();
        downloadInfo.metadata.fileSize = delta.fileSize || 0;
        downloadInfo.metadata.mimeType = delta.mime || 'application/pdf';

        // Save updated metadata
        metadataManager.saveMetadata(downloadInfo.metadata, downloadInfo.filename).then(metaResult => {
          if (metaResult.success) {
            console.log(`✅ Metadata updated and verified: ${metaResult.filename}`);
          }
        }).catch(error => {
          console.warn('⚠️ Failed to update metadata:', error);
        });
      }

      // Clean up tracking
      activeDownloads.delete(delta.id);

    } else if (delta.state.current === 'interrupted') {
      console.error('❌ Download interrupted:', delta.id, downloadInfo.filename, delta.error);

      // Update metadata with error information
      if (downloadInfo.metadata) {
        downloadInfo.metadata.error = delta.error?.current || 'interrupted';
        downloadInfo.metadata.errorType = 'interrupted';
        downloadInfo.metadata.verified = false;

        // Save error metadata
        metadataManager.saveMetadata(downloadInfo.metadata, downloadInfo.filename).then(metaResult => {
          if (metaResult.success) {
            console.log(`⚠️ Error metadata saved: ${metaResult.filename}`);
          }
        }).catch(error => {
          console.warn('⚠️ Failed to save error metadata:', error);
        });
      }

      // Notify popup of failed download
      chrome.runtime.sendMessage({
        action: 'downloadError',
        error: 'Download failed: ' + (delta.error?.current || 'interrupted'),
        failedCount: failedDownloads.length,
        failedDownloads: failedDownloads
      }).catch(() => {
        console.log('ℹ️ Popup not open');
      });

      // Clean up tracking
      activeDownloads.delete(delta.id);
    }
  }
});

function markAsDownloaded(orderId, filename) {
  chrome.storage.local.get('downloadedInvoices', (data) => {
    const downloaded = data.downloadedInvoices || {};
    downloaded[orderId] = {
      filename: filename,
      downloadedAt: new Date().toISOString(),
      verified: true
    };

    chrome.storage.local.set({ downloadedInvoices: downloaded }, () => {
      console.log('📝 Marked as downloaded:', orderId);
    });
  });
}

async function checkContentScriptLoaded(tabId) {
  let tab;
  if (!tabId) {
    // Get active tab if not provided
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length === 0) {
      throw new Error("Geen actieve tab gevonden");
    }
    tab = tabs[0];
    tabId = tab.id;
  } else {
    // Get tab info if tabId provided
    tab = await chrome.tabs.get(tabId);
  }

  try {
    console.log('🔍 Checking if content scripts are loaded...');

    // Content scripts are declared in manifest.json and should auto-load
    // Just ping them to see if they're ready
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: "ping" });

      if (response && response.pong) {
        console.log('✅ Content scripts are loaded and responding');
        return { loaded: true };
      }
    } catch (pingError) {
      console.log('📡 Content scripts not responding yet - they may still be loading');
    }

    // Content scripts are declared in manifest and should load automatically
    // They might just need more time to initialize
    console.log('⏳ Content scripts declared in manifest - waiting for initialization...');
    return { loaded: false, error: 'Content scripts not ready yet' };

  } catch (error) {
    console.error('❌ Error checking content scripts:', error);
    return { loaded: false, error: error.message };
  }
}

// REMOVED: Manual content script injection - scripts are declared in manifest.json and load automatically
/*
async function injectContentScripts(tabId, url) {
  console.log('💉 Injecting content script for tab:', tabId);

  try {
    if (!url) {
      const tab = await chrome.tabs.get(tabId);
      url = tab.url;
    }

    if (!url) throw new Error('No URL');

    console.log('📄 URL:', url);

    // Correct file names for your project - inject in proper order
    const scripts = [
      'helpers.js',          // Load helpers first
      'download-manager.js', // Then download manager
      'pagination-manager.js', // Pagination handling
      'order-scraper.js',    // Order scraping logic
      'content-main.js'      // Main content script last
    ];

    // Inject sequentially to ensure proper loading order
    let index = 0;

    function injectNext() {
      if (index >= scripts.length) {
        console.log('✅ All content scripts injected successfully');
        return Promise.resolve(true);
      }

      const script = scripts[index];
      console.log(`💉 Injecting: ${script}`);

      return chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: [script]
      }).then((results) => {
        if (chrome.runtime.lastError) {
          console.error(`❌ Failed to inject ${script}:`, chrome.runtime.lastError);
          throw chrome.runtime.lastError;
        } else {
          console.log(`✅ Successfully injected: ${script}`);
          index++;
          return injectNext(); // Inject next script
        }
      });
    }

    return injectNext();

    console.log('✅ Content script injected');
    return true;

  } catch (error) {
    console.error('❌ Injection error:', error);
    throw error;
  }
}
*/

async function processDownloads(downloadItems, marketplace, concurrent, startDate, endDate, dateRangeType) {
  const startTime = Date.now();
  console.log(`📦 PROCESS DOWNLOADS FUNCTION CALLED - Processing ${downloadItems.length} downloads`);
  console.log('📦 Download items sample:', downloadItems.slice(0, 2));
  console.log('📦 Marketplace:', marketplace, 'Concurrent:', concurrent);

  // 🆕 Get next session number for this marketplace
  console.log('📦 Getting session number...');
  const sessionNum = await sessionManager.getNextSessionNumber(marketplace);
  console.log('📦 Session number obtained:', sessionNum);

  // Initialize download state
  downloadStateManager.startDownload(downloadItems.length);
  console.log('📊 Download state initialized:', downloadState);

  // 🆕 SEND INITIAL STATE TO POPUP
  chrome.runtime.sendMessage({
    action: 'downloadProgress',
    current: 0,
    total: downloadItems.length,
    successful: 0,
    failed: 0
  }).catch(() => {
    console.log('ℹ️ Popup not open for initial state');
  });

  let completed = 0;
  const failedDownloads = [];

  // Process with concurrency limit
  for (let i = 0; i < downloadItems.length; i += concurrent) {
    const batch = downloadItems.slice(i, i + concurrent);

    await Promise.all(batch.map(async (item) => {
      try {
        // Get the download URL (prioritize invoiceUrl over orders page url)
        const downloadUrl = item.invoiceUrl || item.url;

        if (!downloadUrl) {
          throw new Error('No URL provided');
        }

        console.log(`🔍 Processing: ${item.filename}`);

        // ADD THIS DEBUG BLOCK:
        console.log('🐛 FULL ITEM DEBUG:', {
          filename: item.filename,
          orderId: item.orderId,
          url: item.url,
          invoiceUrl: item.invoiceUrl,
          hasUrl: !!item.url,
          hasInvoiceUrl: !!item.invoiceUrl,
          allKeys: Object.keys(item)
        });

        // REPLACE THIS WITH SMART HANDLER:
        const urlType = downloadProcessor.detectUrlType(downloadUrl);
        console.log(`📋 URL type: ${urlType} (${downloadUrl.substring(0, 50)}...)`);

        let finalPdfUrl;

        if (urlType === 'direct_pdf') {
          // Direct PDF - use as-is
          finalPdfUrl = downloadUrl;
          console.log('✅ Direct PDF URL - ready to download');

        } else if (urlType === 'invoice_page') {
          // Invoice page - extract PDF URL
          console.log('🔄 Invoice page detected - extracting PDF URL...');

          try {
            finalPdfUrl = await downloadProcessor.extractPdfUrlFromInvoicePage(downloadUrl);
            console.log('✅ Extracted PDF URL:', finalPdfUrl.substring(0, 50) + '...');
          } catch (extractError) {
            console.error('❌ PDF extraction failed:', extractError.message);
            throw new Error(`PDF extraction failed: ${extractError.message}`);
          }

        } else if (urlType === 'orders_page') {
          // Orders page URL - this is wrong, but let's try to help
          console.warn('⚠️ Content script sent orders page URL, attempting to use item.invoiceUrl instead');

          // Check if item has an invoiceUrl field we can use
          if (item.invoiceUrl && item.invoiceUrl !== downloadUrl) {
            finalPdfUrl = item.invoiceUrl;
            console.log('🔄 Using invoiceUrl field instead:', finalPdfUrl.substring(0, 50) + '...');

            // Re-check the type of this URL
            const invoiceUrlType = downloadProcessor.detectUrlType(finalPdfUrl);
            if (invoiceUrlType === 'invoice_page') {
              finalPdfUrl = await downloadProcessor.extractPdfUrlFromInvoicePage(finalPdfUrl);
            }
          } else {
            throw new Error('Content script provided orders page URL with no valid invoiceUrl fallback');
          }

        } else {
          throw new Error(`Unsupported URL type: ${urlType}`);
        }

        // 🆕 Extract invoice date from filename
        // Filename format: Invoice_ORDER-ID_YYYY-MM-DD.pdf
        let invoiceDate = null;
        try {
          const dateMatch = item.filename.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            invoiceDate = dateMatch[1]; // e.g., "2025-08-15"
            console.log(`📅 Extracted invoice date from filename: ${invoiceDate}`);
          } else {
            console.warn(`⚠️ No date found in filename: ${item.filename}`);
          }
        } catch (error) {
          console.warn('⚠️ Error extracting date from filename:', error);
        }

        // Build folder path with monthly subfolder
        const folderPath = downloadProcessor.buildFolderPath(
          marketplace,
          startDate,
          endDate,
          dateRangeType,
          sessionNum,
          invoiceDate  // 🆕 Pass invoice date
        );
        const filename = `${folderPath}/${item.filename}`;

        // Download using finalPdfUrl (may have been extracted from invoice page)
        await new Promise((resolve, reject) => {
          chrome.downloads.download({
            url: finalPdfUrl,
            filename: filename,
            saveAs: false
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Download failed:', item.filename, chrome.runtime.lastError);
              failedDownloads.push({
                filename: item.filename,
                orderId: item.orderId,
                error: chrome.runtime.lastError.message
              });
              reject(chrome.runtime.lastError);
            } else {
              console.log('✅ Success:', item.filename, 'ID:', downloadId);
              completed++;

              // Update state
              downloadStateManager.updateProgress(
                completed + failedDownloads.length,
                downloadStateManager.getDownloadState().total,
                completed,
                failedDownloads.length
              );

              // Track download
              trackDownload(downloadId, item.orderId, filename,
                metadataManager.createMetadata(item, { downloadId }));

              resolve();
            }
          });
        }).catch((error) => {
          console.error('❌ Download error:', item.filename, error);
          failedDownloads.push({
            filename: item.filename,
            orderId: item.orderId,
            error: error.message
          });

          downloadStateManager.updateProgress(
            completed + failedDownloads.length,
            downloadStateManager.getDownloadState().total,
            completed,
            failedDownloads.length
          );
        });

      } catch (error) {
        console.error('❌ Item processing error:', item.filename, error);
        failedDownloads.push({
          filename: item.filename,
          orderId: item.orderId,
          error: error.message
        });

        downloadStateManager.updateProgress(
          completed + failedDownloads.length,
          downloadStateManager.getDownloadState().total,
          completed,
          failedDownloads.length
        );
      }
    }));

    // Rate limiting between batches
    if (i + concurrent < downloadItems.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`📊 Final: ${completed} successful, ${failedDownloads.length} failed`);

  // 🆕 AUTO-UPLOAD TO GOOGLE DRIVE
  if (completed > 0) {
    console.log('☁️ Starting Google Drive upload...');

    const sessionMetadata = {
      sessionNumber: sessionNum,
      marketplace: marketplace,
      startDate: startDate,
      endDate: endDate,
      rangeType: dateRangeType,
      totalInvoices: completed,
      downloadedItems: downloadItems,
      downloadTime: new Date().toISOString()
    };

    try {
      // Build session folder path (same logic as DownloadProcessor.buildFolderPath)
      const baseFolder = `Amazon-${marketplace}`;
      const sessionPrefix = `Session_${String(sessionNum).padStart(3, '0')}`;
      let dateRangeStr;
      if (startDate && endDate && dateRangeType) {
        dateRangeStr = `${startDate}_to_${endDate}_${dateRangeType}`;
      } else {
        const today = new Date().toISOString().split('T')[0];
        dateRangeStr = `Unknown_Range_${today}`;
      }
      const sessionFolderPath = `${baseFolder}/${sessionPrefix}_${dateRangeStr}`;

      await uploadSessionToGoogleDrive(sessionFolderPath, sessionMetadata);

      // Send message to popup
      chrome.runtime.sendMessage({
        action: 'uploadComplete',
        success: true,
        message: `Uploaded ${completed} invoices to Google Drive`
      }).catch(() => {});

    } catch (error) {
      console.error('❌ Upload failed:', error);

      chrome.runtime.sendMessage({
        action: 'uploadComplete',
        success: false,
        message: 'Upload failed - files saved locally'
      }).catch(() => {});
    }
  }

  // 🆕 SEND COMPLETION MESSAGE
  chrome.runtime.sendMessage({
    action: 'downloadComplete',
    results: {
      successful: completed,
      failed: failedDownloads.length,
      total: downloadItems.length,
      duration: Date.now() - startTime,
      failedDownloads: failedDownloads
    }
  }).catch(() => {
    console.log('ℹ️ Popup not open for completion message');
  });

  // Reset state
  downloadStateManager.endDownload();
}

// License management is now handled by LicenseManager module
// licenseManager.schedulePeriodicLicenseCheck(); // INTERNAL BUILD: Disabled

// URL detection and PDF extraction are now handled by DownloadProcessor module

// Filename sanitization and folder path building are now handled by DownloadProcessor module

// ===== MESSAGE HANDLERS =====

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message.action);

  if (message.action === 'uploadToGoogleDrive') {
    // Handle Google Drive upload request
    uploadSessionToGoogleDrive(message.sessionPath, message.metadata)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('❌ Google Drive upload error:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate we'll respond asynchronously
    return true;
  }

  // Handle other messages...
  // (existing message handlers can be added here)
});

// ===== GOOGLE DRIVE INTEGRATION =====

/**
 * Upload session folder to Google Drive
 * @param {string} sessionPath - Local path like "Amazon-DE/Session_001_Q1_Aug_Oct"
 * @param {Object} metadata - Session metadata (invoice count, totals, etc.)
 */
async function uploadSessionToGoogleDrive(sessionPath, metadata) {
  console.log('☁️ Uploading session to Google Drive:', sessionPath);

  try {
    // Get OAuth token for Google Drive
    const token = await getGoogleDriveToken();

    // Create folder structure in Drive
    const driveFolderName = `Amazon_Invoices_Pending/${sessionPath.replace(/\//g, '_')}`;
    const folderId = await createDriveFolder(driveFolderName, token);

    // Get downloaded items from metadata
    const downloadedItems = metadata.downloadedItems || [];
    console.log(`📤 Uploading ${downloadedItems.length} files to Drive...`);

    // Upload each file from the downloaded items
    let uploadedCount = 0;
    for (const item of downloadedItems) {
      if (item.filename && item.downloadUrl) {
        try {
          await uploadFileFromUrl(item.downloadUrl, item.filename, folderId, token);
          uploadedCount++;
          console.log(`✅ Uploaded ${uploadedCount}/${downloadedItems.length}: ${item.filename}`);
        } catch (fileError) {
          console.warn(`⚠️ Failed to upload ${item.filename}:`, fileError);
        }
      }
    }

    // Upload summary CSV
    await uploadSessionSummaryCSV(metadata, folderId, token);

    console.log('✅ All files uploaded to Google Drive!');

    // Show success notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '✅ Uploaded to Google Drive',
      message: `${uploadedCount} invoices uploaded. Email will arrive on ${getNextFilingEmailDate()}`
    });

    return { success: true, folderId, uploadedCount };

  } catch (error) {
    console.error('❌ Google Drive upload failed:', error);
    throw error;
  }
}

/**
 * Get Google Drive OAuth token
 */
async function getGoogleDriveToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Create folder in Google Drive
 */
async function createDriveFolder(folderName, token) {
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  const data = await response.json();
  return data.id;
}

/**
 * Upload single file to Google Drive from URL
 */
async function uploadFileFromUrl(fileUrl, fileName, folderId, token) {
  // Fetch the file from the URL
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }

  const fileData = await response.blob();

  const metadata = {
    name: fileName,
    parents: [folderId]
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', fileData);

  const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!uploadResponse.ok) {
    throw new Error(`Google Drive upload failed: ${uploadResponse.status}`);
  }

  return await uploadResponse.json();
}

/**
 * Upload session summary CSV to Drive
 */
async function uploadSessionSummaryCSV(metadata, folderId, token) {
  const csvContent = generateSessionSummaryCSV(metadata);
  const blob = new Blob([csvContent], { type: 'text/csv' });

  const fileMetadata = {
    name: '_SESSION_SUMMARY.csv',
    parents: [folderId]
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
  formData.append('file', blob);

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
}

/**
 * Generate CSV summary
 */
function generateSessionSummaryCSV(metadata) {
  let csv = 'Order_ID,Invoice_Number,Date,Marketplace,Filename,Download_Time\n';

  for (const item of metadata.downloadedItems) {
    csv += `${item.orderId},${item.invoiceNumber},${item.date},${metadata.marketplace},${item.filename},${item.downloadTime}\n`;
  }

  return csv;
}

/**
 * Read local file (for upload)
 */
async function readLocalFile(path) {
  // For Chrome extensions, we need to use the chrome.downloads API to access downloaded files
  // First, find the download by filename
  const downloads = await chrome.downloads.search({
    filename: path
  });

  if (downloads.length === 0) {
    throw new Error(`File not found in downloads: ${path}`);
  }

  const download = downloads[0];

  // Use chrome.downloads API to get the file data
  // This requires the file to still be accessible (not moved/deleted)
  try {
    // Read the file using FileReader or similar
    // Note: This is a simplified version. In practice, you might need to use
    // chrome.downloads.download() with a URL or handle the file differently
    const response = await fetch(`file:///${download.filename}`);
    return await response.blob();
  } catch (error) {
    console.error('❌ Error reading local file:', error);
    throw new Error(`Cannot read file: ${download.filename}`);
  }
}

/**
 * Calculate next filing email date based on current date
 */
function getNextFilingEmailDate() {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();

  // Determine current accounting quarter (Aug-Jul)
  // Q1: Aug-Oct, Q2: Nov-Jan, Q3: Feb-Apr, Q4: May-Jul

  let nextFilingDate;
  let nextFilingYear = currentYear;

  if (currentMonth >= 7 && currentMonth <= 9) { // Aug-Oct (Q1) - next filing is Feb 1st
    nextFilingDate = 'February 1st';
  } else if (currentMonth >= 10 || currentMonth <= 0) { // Nov-Jan (Q2) - next filing is May 1st
    nextFilingDate = 'May 1st';
  } else if (currentMonth >= 1 && currentMonth <= 3) { // Feb-Apr (Q3) - next filing is Aug 1st
    nextFilingDate = 'August 1st';
  } else if (currentMonth >= 4 && currentMonth <= 6) { // May-Jul (Q4) - next filing is Nov 1st
    nextFilingDate = 'November 1st';
    nextFilingYear = currentYear + 1; // Next year for Q4
  }

  return nextFilingYear > currentYear ? `${nextFilingDate}, ${nextFilingYear}` : nextFilingDate;
}