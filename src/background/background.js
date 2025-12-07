// ===== IMPORT MODULES =====
importScripts('utils/LicenseManager.js');

// Import OptionsManager first (needed by DownloadProcessor)
importScripts('utils/OptionsManager.js');

// Import ProfileManager for account-based organization
importScripts('core/managers/ProfileManager.js');

console.log('✅ ProfileManager loaded:', typeof ProfileManager);

// Import download-manager.js for FileOrganizer
importScripts('content/download-manager.js');

importScripts('utils/SessionManager.js');
importScripts('state/DownloadStateManager.js');
importScripts('utils/ContentScriptManager.js');
importScripts('utils/DownloadProcessor.js');

// Import additional utility modules
importScripts('utils/HistoryManager.js');
importScripts('utils/HealthChecker.js');
importScripts('utils/MetadataManager.js');
importScripts('core/services/GoogleDriveManager.js');
importScripts('utils/NotificationManager.js');
importScripts('utils/PerformanceMonitor.js');
importScripts('utils/MessageHandler.js');

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

// ===== INITIALIZE MANAGERS =====
const optionsManager = new OptionsManager();
const profileManager = new ProfileManager();
const sessionManager = new SessionManager();
const contentScriptManager = new ContentScriptManager();
const notificationManager = new NotificationManager();

// Setup notification listeners
notificationManager.setupNotificationListeners();

const downloadProcessor = new DownloadProcessor();
const googleDriveManager = new GoogleDriveManager();
const metadataManager = new MetadataManager();
const downloadStateManager = new DownloadStateManager();
const performanceMonitor = new PerformanceMonitor();
// Note: licenseManager is created globally by LicenseManager.js

// ===== MIGRATE LEGACY SETTINGS =====
OptionsManager.migrateLegacySettings().catch(error => {
  console.error('❌ Settings migration error:', error);
});

// ===== INITIALIZE MESSAGE HANDLER =====
const messageHandler = new MessageHandler({
  googleDriveManager,
  metadataManager,
  downloadStateManager,
  optionsManager,
  notificationManager,
  downloadProcessor,
  sessionManager,
  contentScriptManager,
  performanceMonitor
});

// ===== MESSAGE HANDLING =====
// Use centralized MessageHandler for all message processing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 1. Listener called for action:', message.action);

  messageHandler.handleMessage(message, sender, sendResponse);

  console.log('📨 2. About to return true');
  const returnValue = true;
  console.log('📨 3. Returning:', returnValue);
  return returnValue;
});



// ============================================

// DOWNLOAD STATE TRACKING FOR POPUP SYNC

// ============================================



let failedDownloads = [];

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



// ===== GOOGLE DRIVE OPERATIONS =====
// Google Drive operations are now handled by GoogleDriveManager module



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

// ===== LEGACY MESSAGE HANDLER REMOVED =====
// Legacy message handler has been removed after successful refactoring and testing
// Second message listener removed - now handled by MessageHandler

// Content script management is now handled by ContentScriptManager module
// ===== SETTINGS MANAGEMENT =====
// Settings management is now handled by OptionsManager module

// Create session summary for export
async function createSessionSummary(sessionData) {
  const now = new Date();
  const settings = await OptionsManager.loadSettings();

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
      maxConcurrent: settings.maxConcurrent,
      delayBetween: settings.delayBetween,
      rateLimit: settings.rateLimit,
      folderStructure: settings.folderStructure,
      filenameFormat: settings.filenameFormat,
      saveMetadata: settings.saveMetadata
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
// HistoryManager is now imported from utils/HistoryManager.js

// ===== HEALTH CHECK SYSTEM =====
// HealthChecker is now imported from utils/HealthChecker.js

// ===== METADATA MANAGEMENT =====
// MetadataManager is now imported from utils/MetadataManager.js

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

chrome.downloads.onChanged.addListener(async (delta) => {
  try {
    console.log('📥 Download status changed:', delta);

    if (!delta.state || !activeDownloads.has(delta.id)) {
      return; // Not a tracked download or no state change
    }

    const downloadInfo = activeDownloads.get(delta.id);
    if (!downloadInfo) {
      console.warn('⚠️ Download info not found for tracked download:', delta.id);
      return;
    }

    if (delta.state.current === 'complete') {
      console.log('✅ Download completed:', delta.id, downloadInfo.filename);

      // File-level duplicate checking
      const settings = await OptionsManager.loadSettings();
      if (settings.skipFileDuplicates) {
        console.log('🔍 Checking for file-level duplicates...');

        try {
          // Get download details to access the file
          const downloads = await chrome.downloads.search({ id: delta.id });
          if (downloads.length > 0) {
            const download = downloads[0];
            const filePath = download.filename;

            // Read the file to generate hash
            const fileBlob = await downloadProcessor.readLocalFile(filePath);
            const fileHash = await downloadProcessor.generateFileHash(fileBlob);

            if (fileHash) {
              // Check if this hash already exists
              const isFileDuplicate = await downloadProcessor.checkLocalFileDuplicate(fileHash);

              if (isFileDuplicate) {
                console.log(`⏭️ File duplicate detected (hash: ${fileHash}), removing download`);

                // Remove the duplicate file
                await chrome.downloads.removeFile(delta.id);
                await chrome.downloads.erase({ id: delta.id });

                // Update metadata to mark as duplicate
                if (downloadInfo.metadata) {
                  downloadInfo.metadata.duplicate = true;
                  downloadInfo.metadata.duplicateType = 'file_hash';
                  downloadInfo.metadata.fileHash = fileHash;
                  downloadInfo.metadata.verified = false;

                  metadataManager.saveMetadata(downloadInfo.metadata, downloadInfo.filename).catch(error => {
                    console.warn('⚠️ Failed to update duplicate metadata:', error);
                  });
                }

                // Notify popup of duplicate
                chrome.runtime.sendMessage({
                  action: 'downloadComplete',
                  success: false,
                  duplicate: true,
                  reason: 'file_already_exists',
                  orderId: downloadInfo.orderId,
                  filename: downloadInfo.filename
                }).catch(() => {}); // Ignore if popup closed

                // Clean up tracking and exit
                activeDownloads.delete(delta.id);
                return;
              } else {
                // Store the hash for future duplicate detection
                chrome.storage.local.get('fileHashes', (data) => {
                  const fileHashes = data.fileHashes || {};
                  fileHashes[fileHash] = {
                    filename: downloadInfo.filename,
                    orderId: downloadInfo.orderId,
                    timestamp: new Date().toISOString(),
                    size: delta.fileSize || 0
                  };
                  chrome.storage.local.set({ fileHashes: fileHashes });
                });

                // Add hash to metadata
                if (downloadInfo.metadata) {
                  downloadInfo.metadata.fileHash = fileHash;
                }
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Error during file duplicate check:', error);
          // Continue with normal processing if duplicate check fails
        }
      }

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

      // Add failed download to the tracking array
      failedDownloads.push({
        orderId: downloadInfo.orderId,
        filename: downloadInfo.filename,
        error: delta.error?.current || 'interrupted',
        timestamp: new Date().toISOString()
      });

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
  } catch (error) {
    console.error('❌ Unexpected error in download change listener:', error);
  }
});

function markAsDownloaded(orderId, filename) {
  try {
    if (!orderId || !filename) {
      console.error('❌ Invalid parameters for markAsDownloaded:', { orderId, filename });
      return;
    }

    chrome.storage.local.get('downloadedInvoices', (data) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error reading downloaded invoices from storage:', chrome.runtime.lastError);
        return;
      }

      const downloaded = data.downloadedInvoices || {};
      downloaded[orderId] = {
        filename: filename,
        downloadedAt: new Date().toISOString(),
        verified: true
      };

      chrome.storage.local.set({ downloadedInvoices: downloaded }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Error saving downloaded invoices to storage:', chrome.runtime.lastError);
        } else {
          console.log('📝 Marked as downloaded:', orderId);
        }
      });
    });
  } catch (error) {
    console.error('❌ Unexpected error in markAsDownloaded:', error);
  }
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





// ===== GOOGLE DRIVE OPERATIONS =====
// Google Drive operations are now handled by GoogleDriveManager module

// License management is now handled by LicenseManager module
licenseManager.schedulePeriodicLicenseCheck(); // INTERNAL BUILD: Re-enabled for license validation

// URL detection and PDF extraction are now handled by DownloadProcessor module

// Filename sanitization and folder path building are now handled by DownloadProcessor module

// ===== MESSAGE HANDLERS =====
// All message handling is now centralized through MessageHandler above

// ===== GOOGLE DRIVE INTEGRATION =====

// ===== GOOGLE DRIVE OPERATIONS =====
// Google Drive operations are now handled by GoogleDriveManager module