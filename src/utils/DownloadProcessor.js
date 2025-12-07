/**
 * Download Processor Module
 * Handles the main download processing logic and URL management
 */

class DownloadProcessor {
  constructor() {
    // Managers are accessed globally
  }

  /**
   * Detect URL type from Amazon URL
   * @param {string} url - Amazon URL to analyze
   * @returns {string} URL type ('direct_pdf', 'invoice_page', 'orders_page', 'unknown')
   */
  detectUrlType(url) {
    // Direct PDF URL
    if (url.includes('/documents/download/') && url.includes('/invoice.pdf')) {
      return 'direct_pdf';
    }

    // Amazon invoice popover page
    if (url.includes('/invoice/popover') || url.includes('gp/css/summary/print')) {
      return 'invoice_page';
    }

    // Orders page (WRONG - content script bug)
    if (url.includes('/your-orders/orders')) {
      return 'orders_page';
    }

    // Unknown/unsupported
    return 'unknown';
  }

  /**
   * Extract PDF URL from invoice page
   * @param {string} invoicePageUrl - URL of the invoice page
   * @returns {Promise<string>} PDF URL
   */
  async extractPdfUrlFromInvoicePage(invoicePageUrl) {
    console.log('📄 [BACKGROUND] Extracting PDF URL from invoice page:', invoicePageUrl);

    return new Promise((resolve, reject) => {
      let tabId;
      let timeoutId;
      let listenerAdded = false;

      // Create a background tab to load the invoice page
      chrome.tabs.create({
        url: invoicePageUrl,
        active: false // Background tab
      }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('❌ [BACKGROUND] Failed to create tab:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        tabId = tab.id;
        console.log('🔗 [BACKGROUND] Created background tab:', tabId);

        // Set up timeout fallback
        timeoutId = setTimeout(() => {
          cleanup();
          console.warn('⚠️ [BACKGROUND] Tab extraction timeout (15s), using original URL');
          resolve(invoicePageUrl);
        }, 15000);

        // Listen for when the tab is fully loaded
        function onTabUpdated(updatedTabId, changeInfo) {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            // Remove listener to prevent multiple calls
            if (listenerAdded) {
              chrome.tabs.onUpdated.removeListener(onTabUpdated);
              listenerAdded = false;
            }

            // Clear timeout since we got a response
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            // Small delay to ensure page is fully rendered
            setTimeout(async () => {
              try {
                const results = await chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  func: () => {
                    // This function runs in the PAGE context (not background)
                    // Look for print button or direct PDF link
                    const printButtons = document.querySelectorAll('a[href*="invoice.pdf"], button[onclick*="print"], a[onclick*="print"]');

                    for (const button of printButtons) {
                      if (button.href && button.href.includes('invoice.pdf')) {
                        return button.href;
                      }
                      if (button.onclick && button.onclick.toString().includes('invoice.pdf')) {
                        const match = button.onclick.toString().match(/['"]([^'"]*invoice\.pdf[^'"]*)['"]/);
                        if (match) return match[1];
                      }
                    }

                    // Look for PDF download links
                    const pdfLinks = document.querySelectorAll('a[href$=".pdf"]');
                    for (const link of pdfLinks) {
                      if (link.href.includes('invoice') || link.href.includes('Invoice')) {
                        return link.href;
                      }
                    }

                    return null; // No PDF link found
                  }
                });

                cleanup();

                if (results && results[0] && results[0].result) {
                  const pdfUrl = results[0].result;
                  console.log('✅ [BACKGROUND] Extracted PDF URL from tab:', pdfUrl);
                  resolve(pdfUrl);
                } else {
                  console.warn('⚠️ [BACKGROUND] No PDF URL found in tab, using original URL');
                  resolve(invoicePageUrl);
                }
              } catch (error) {
                cleanup();
                console.error('❌ [BACKGROUND] Script execution failed:', error);
                resolve(invoicePageUrl);
              }
            }, 1000); // 1 second delay for page rendering
          }
        }

        // Add the listener
        chrome.tabs.onUpdated.addListener(onTabUpdated);
        listenerAdded = true;

        // Cleanup function
        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          if (listenerAdded) {
            chrome.tabs.onUpdated.removeListener(onTabUpdated);
            listenerAdded = false;
          }
          // Close the background tab
          if (tabId) {
            chrome.tabs.remove(tabId, () => {
              if (chrome.runtime.lastError) {
                console.log('ℹ️ Background tab already closed');
              } else {
                console.log('🗑️ Closed background tab:', tabId);
              }
            });
          }
        };
      });
    });
  }


  /**
   * Sanitize filename for safe file system usage
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    // IMPORTANT: We allow forward slashes for folder structure!
    // Chrome's downloads API will create folders automatically

    // Remove invalid characters EXCEPT forward slashes
    let sanitized = filename.replace(/[<>:"\\|?*\x00-\x1F]/g, '_');

    // Prevent directory traversal attacks
    sanitized = sanitized.replace(/\.\.\//g, ''); // Remove ../
    sanitized = sanitized.replace(/^\.+/, '');     // Remove leading dots

    // Handle Windows reserved names (only in the final filename, not folders)
    const parts = sanitized.split('/');
    parts[parts.length - 1] = parts[parts.length - 1]
      .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, '_$1');

    return parts.join('/').slice(0, 255);
  }

  /**
   * Build the folder path for downloads with monthly subfolders
   * @param {string} marketplace - The marketplace code
   * @param {string} startDate - ISO date string (YYYY-MM-DD)
   * @param {string} endDate - ISO date string (YYYY-MM-DD)
   * @param {string} rangeType - 'Q1_Aug_Oct', 'Q2_Nov_Jan', etc.
   * @param {number} sessionNum - The session number for this download batch
   * @param {string} invoiceDate - ISO date string for this specific invoice (YYYY-MM-DD)
   * @returns {Promise<string>} The folder path with monthly subfolder
   */
  async buildFolderPath(marketplace, startDate, endDate, rangeType, sessionNum, invoiceDate) {
    console.log('📁 Building folder path with params:', {
      marketplace,
      startDate,
      endDate,
      rangeType,
      sessionNum,
      invoiceDate
    });

    // Get base folder from settings (default: 'Amazon_Invoices')
    let baseFolderName = 'Amazon_Invoices';
    try {
      const settings = await OptionsManager.loadSettings();
      if (settings.baseFolder) {
        baseFolderName = settings.baseFolder;
      }
    } catch (error) {
      console.warn('⚠️ Could not load baseFolder setting, using default:', error);
    }

    const marketplaceFolder = `Amazon-${marketplace}`;

    // Format session number (e.g., "Session_001")
    const sessionPrefix = `Session_${String(sessionNum).padStart(3, '0')}`;

    // Build date range string
    let dateRangeStr;
    if (startDate && endDate && rangeType) {
      dateRangeStr = `${startDate}_to_${endDate}_${rangeType}`;
    } else {
      // Fallback for unknown date ranges
      const today = new Date().toISOString().split('T')[0];
      dateRangeStr = `Unknown_Range_${today}`;
    }

    // Session folder: Amazon-DE/Session_001_2025-08-01_to_2025-10-31_Q1_Aug_Oct
    const sessionFolder = `${marketplaceFolder}/${sessionPrefix}_${dateRangeStr}`;

    // Extract month subfolder from invoice date
    let monthSubfolder = '';
    if (invoiceDate) {
      try {
        const date = new Date(invoiceDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // 01-12
        const monthName = date.toLocaleString('en-US', { month: 'long' }); // "August"

        monthSubfolder = `/${year}-${month}_${monthName}`;
        console.log(`📅 Monthly subfolder: ${monthSubfolder}`);
      } catch (error) {
        console.warn('⚠️ Could not parse invoice date:', invoiceDate, error);
        monthSubfolder = '/Unknown_Month';
      }
    } else {
      console.warn('⚠️ No invoice date provided, using root session folder');
      monthSubfolder = '';
    }

    // Final path: Amazon_Invoices/Amazon-DE/Session_001_2025-08-01_to_2025-10-31_Q1_Aug_Oct/2025-08_August
    const folderPath = `${baseFolderName}/${sessionFolder}${monthSubfolder}`;

    console.log('📁 Final folder path:', folderPath);
    return folderPath;
  }

  /**
   * Download PDF and optionally upload to Google Drive based on settings
   */
  async downloadAndUploadPdf(item, googleDriveManager, metadataManager) {
    // Check for order-level duplicates if enabled
    const settings = await OptionsManager.loadSettings();
    if (settings.skipDuplicates && item.orderId) {
      console.log('🔍 Checking for order-level duplicates in batch download...');
      const isOrderDuplicate = await this.checkOrderDuplicate(item.orderId);
      if (isOrderDuplicate) {
        console.log(`⏭️ Skipping download - order ${item.orderId} already processed`);
        return {
          local: null,
          drive: null,
          errors: [],
          duplicate: true,
          reason: 'order_already_processed'
        };
      }
    }

    // Use OptionsManager helper methods
    const shouldDownloadLocal = await OptionsManager.shouldDownloadLocally();
    const shouldUploadDrive = await OptionsManager.shouldUploadToDrive();

    // Log disabled preferences for clarity
    if (!shouldDownloadLocal) {
      console.log(`⏭️ Local download disabled (user preference)`);
    }

    if (!shouldUploadDrive) {
      console.log(`⏭️ Drive upload disabled (user preference)`);
    }

    const results = {
      local: null,
      drive: null,
      errors: []
    };

    try {
      // Fetch the PDF blob
      const response = await fetch(item.pdfUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log(`✅ Fetched blob: ${blob.size} bytes for ${item.filename}`);

      // LOCAL DOWNLOAD (if enabled)
      if (shouldDownloadLocal) {
        console.log(`📥 Local download enabled - downloading ${item.filename}...`);
        try {
          results.local = await this.downloadLocally(blob, item.filename, item.folderPath);
          console.log(`✅ Local: ${item.filename}`);
        } catch (error) {
          console.error(`❌ Local download failed: ${item.filename}`, error);
          results.errors.push({ type: 'local', error });
        }
      }

      // DRIVE UPLOAD (if enabled)
      if (shouldUploadDrive) {
        console.log(`☁️ Drive upload enabled - uploading ${item.filename}...`);
        try {
          // Get drive credentials from storage
          let driveData = await new Promise((resolve) => {
            chrome.storage.local.get(['driveToken', 'sessionData'], resolve);
          });

          // If token is missing, try to get it fresh
          if (!driveData.driveToken) {
            console.log('🔄 Drive token missing, getting fresh one...');
            try {
              driveData.driveToken = await googleDriveManager.getGoogleDriveToken();
              console.log('💾 Fresh Drive token obtained');
            } catch (authError) {
              console.error('❌ Failed to get fresh Drive token:', authError);
              throw new Error('Google Drive authentication required');
            }
          }

          // Extract invoice date from filename for monthly subfolder
          let invoiceDate = null;
          try {
            const dateMatch = item.filename.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              invoiceDate = dateMatch[1];
              console.log(`📅 Extracted invoice date from filename: ${invoiceDate}`);
            } else {
              console.warn(`⚠️ No date found in filename: ${item.filename}`);
            }
          } catch (error) {
            console.warn('⚠️ Error extracting date from filename:', error);
          }

          // Build the full nested folder path for this specific file
          const sessionData = driveData.sessionData || {};
          const folderPath = await this.buildFolderPath(
            sessionData.marketplace || 'Unknown',
            sessionData.startDate,
            sessionData.endDate,
            sessionData.dateRangeType,
            sessionData.sessionNum || 1,
            invoiceDate
          );

          console.log(`📁 Creating Drive folder path for ${item.filename}: ${folderPath}`);

          // Create the nested folder structure in Google Drive
          const fileFolderId = await googleDriveManager.createNestedFolderPath(folderPath, driveData.driveToken);

          results.drive = await googleDriveManager.uploadBlobToDrive(blob, item.filename, fileFolderId, driveData.driveToken);

          // Update metadata with drive file ID if upload was successful
          if (results.drive && results.drive.id && !results.drive.duplicate) {
            console.log(`📄 Updating metadata with Drive file ID: ${results.drive.id}`);
            try {
              // Load existing metadata and update it
              const metadataKey = `metadata_${item.filename}`;
              const existingData = await new Promise(resolve => {
                chrome.storage.local.get(metadataKey, resolve);
              });

              if (existingData[metadataKey]) {
                const metadata = existingData[metadataKey].metadata;
                metadata.driveFileId = results.drive.id;
                metadata.verified = true;

                // Save updated metadata
                await metadataManager.saveMetadata(metadata, item.filename);
                console.log(`✅ Metadata updated with Drive file ID for ${item.filename}`);
              }
            } catch (metaError) {
              console.warn('⚠️ Failed to update metadata with Drive file ID:', metaError);
            }
          }

          console.log(`☁️ Drive: ${item.filename}`);
        } catch (error) {
          console.error(`❌ Drive upload failed: ${item.filename}`, error);
          results.errors.push({ type: 'drive', error });
        }
      }

      // Handle no storage method selected
      if (!shouldDownloadLocal && !shouldUploadDrive) {
        throw new Error('No storage method selected');
      }

      return results;

    } catch (error) {
      console.error(`❌ Failed: ${item.filename}`, error);
      results.errors.push({ type: 'fetch', error });

      // Use OptionsManager for error handling
      const errorHandling = await OptionsManager.getErrorHandling();

      if (errorHandling.strategy === 'stop') {
        throw error;
      } else if (errorHandling.strategy === 'retry') {
        return await this.retryDownload(item, errorHandling.retryAttempts, googleDriveManager, metadataManager);
      }

      return results; // skip
    }
  }

  /**
   * Download blob locally using chrome.downloads API
   * Fixes the URL.createObjectURL error for Service Workers
   */
  async downloadLocally(blob, filename, folderPath = '') {
    try {
      // Check for file-level duplicates if enabled
      const settings = await OptionsManager.loadSettings();
      if (settings.skipFileDuplicates) {
        console.log('🔍 Checking for local file duplicates...');
        const fileHash = await this.generateFileHash(blob);

        if (fileHash) {
          const isFileDuplicate = await this.checkLocalFileDuplicate(fileHash);
          if (isFileDuplicate) {
            console.log(`⏭️ Skipping local download - file with hash ${fileHash} already exists`);
            return {
              success: false,
              duplicate: true,
              reason: 'file_already_exists',
              fileHash: fileHash
            };
          }
          console.log(`✅ File hash ${fileHash} is unique for local download`);
        }
      }

      // Convert blob to data URL (Service Worker compatible)
      const dataUrl = await this.blobToDataUrl(blob);

      // Extract folder path from full path if it includes filename
      let downloadFilename = filename;
      if (folderPath && folderPath.includes('/')) {
        // Remove filename from end of path to get just the folder path
        const pathParts = folderPath.split('/').filter(part => part.length > 0);
        if (pathParts.length > 0 && pathParts[pathParts.length - 1] === filename) {
          pathParts.pop(); // Remove filename
        }
        const folderOnly = pathParts.join('/');
        if (folderOnly) {
          downloadFilename = `${folderOnly}/${filename}`;
        }
      }

      // Use chrome.downloads API with folder structure
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: downloadFilename,
        saveAs: false,
        conflictAction: 'uniquify'
      });

      console.log(`📥 Local download started: ${downloadId} -> ${downloadFilename}`);
      return downloadId;

    } catch (error) {
      console.error(`❌ Local download error:`, error);
      throw error;
    }
  }

  /**
   * Convert blob to data URL (Service Worker compatible)
   */
  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Retry logic for failed downloads
   */
  async retryDownload(item, maxAttempts, googleDriveManager, metadataManager) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔄 Retry ${attempt}/${maxAttempts}: ${item.filename}`);

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

        return await this.downloadAndUploadPdf(item, googleDriveManager, metadataManager);

      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
      }
    }

    throw lastError;
  }

  /**
   * Process downloads with concurrency control
   */
  async processDownloads(downloadItems, marketplace, concurrent, startDate, endDate, dateRangeType, googleDriveManager, metadataManager, downloadStateManager, sessionManager) {
    const startTime = Date.now();
    console.log(`📦 PROCESS DOWNLOADS FUNCTION CALLED - Processing ${downloadItems.length} downloads`);
    console.log('📦 Download items sample:', downloadItems.slice(0, 2));
    console.log('📦 Marketplace:', marketplace, 'Concurrent:', concurrent);

    // Get next session number for this marketplace
    console.log('📦 Getting session number...');
    const sessionNum = await sessionManager.getNextSessionNumber(marketplace);
    console.log('📦 Session number obtained:', sessionNum);

    // Initialize download state
    downloadStateManager.startDownload(downloadItems.length);
    console.log('📊 Download state initialized');

    // Send initial state to popup
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
    const downloadedItems = [];

    // Get Google Drive token and create folder BEFORE downloading
    let driveToken = null;
    let driveFolderId = null;

    try {
      console.log('🔑 Getting Google Drive token...');
      driveToken = await googleDriveManager.getGoogleDriveToken();
      console.log('✅ Got Drive token');

      // Build proper nested folder structure for Google Drive (same as local)
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

      // Get base folder from settings (default: 'Amazon_Invoices')
      let baseFolderName = 'Amazon_Invoices';
      try {
        const settings = await OptionsManager.loadSettings();
        if (settings.baseFolder) {
          baseFolderName = settings.baseFolder;
        }
      } catch (error) {
        console.warn('⚠️ Could not load baseFolder setting for Drive, using default:', error);
      }

      // Create nested folder structure in Google Drive
      console.log(`📁 Creating nested Drive folder structure: ${baseFolderName}/${sessionFolderPath}`);
      driveFolderId = await googleDriveManager.createNestedFolderPath(`${baseFolderName}/${sessionFolderPath}`, driveToken);
      console.log(`✅ Drive folder ready: ${driveFolderId}`);

      // Store tokens and session data in storage for reuse by downloadAndUploadPdf function
      await chrome.storage.local.set({
        driveToken: driveToken,
        driveFolderId: driveFolderId,
        sessionData: {
          marketplace: marketplace,
          startDate: startDate,
          endDate: endDate,
          dateRangeType: dateRangeType,
          sessionNum: sessionNum
        }
      });
      console.log('💾 Drive credentials and session data stored in local storage');
    } catch (error) {
      console.warn('⚠️ Google Drive setup failed, will only save locally:', error);
      // Clear any stale credentials if setup failed
      await chrome.storage.local.remove(['driveToken', 'driveFolderId']);
    }

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

          // Debug logging
          console.log('🐛 FULL ITEM DEBUG:', {
            filename: item.filename,
            orderId: item.orderId,
            url: item.url,
            invoiceUrl: item.invoiceUrl,
            hasUrl: !!item.url,
            hasInvoiceUrl: !!item.invoiceUrl,
            allKeys: Object.keys(item)
          });

          // Detect URL type
          const urlType = this.detectUrlType(downloadUrl);
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
              finalPdfUrl = await this.extractPdfUrlFromInvoicePage(downloadUrl);
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
              const invoiceUrlType = this.detectUrlType(finalPdfUrl);
              if (invoiceUrlType === 'invoice_page') {
                finalPdfUrl = await this.extractPdfUrlFromInvoicePage(finalPdfUrl);
              }
            } else {
              throw new Error('Content script provided orders page URL with no valid invoiceUrl fallback');
            }

          } else {
            throw new Error(`Unsupported URL type: ${urlType}`);
          }

          // Extract invoice date from filename
          let invoiceDate = null;
          try {
            const dateMatch = item.filename.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              invoiceDate = dateMatch[1];
              console.log(`📅 Extracted invoice date from filename: ${invoiceDate}`);
            } else {
              console.warn(`⚠️ No date found in filename: ${item.filename}`);
            }
          } catch (error) {
            console.warn('⚠️ Error extracting date from filename:', error);
          }

          // Build folder path with monthly subfolder
          const folderPath = await this.buildFolderPath(
            marketplace,
            startDate,
            endDate,
            dateRangeType,
            sessionNum,
            invoiceDate
          );
          const filename = `${folderPath}/${item.filename}`;

          // Download and upload simultaneously
          try {
            const result = await this.downloadAndUploadPdf({
              pdfUrl: finalPdfUrl,
              filename: item.filename,
              folderPath: filename,
              ...item
            }, googleDriveManager, metadataManager);

            console.log('✅ Success:', item.filename, 'ID:', result.drive?.id || result.local?.id || 'unknown');
            completed++;

            // Update state
            downloadStateManager.updateProgress(
              completed + failedDownloads.length,
              downloadStateManager.getDownloadState().total,
              completed,
              failedDownloads.length
            );

            // Add to downloaded items
            downloadedItems.push({
              ...item,
              downloadId: result.downloadId,
              downloadTime: new Date().toISOString(),
              localPath: filename
            });

            // Track download
            this.trackDownload(result.downloadId, item.orderId, filename,
              metadataManager.createMetadata(item, { downloadId: result.downloadId }));

          } catch (error) {
            console.error('❌ Download failed:', item.filename, error);
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
    console.log('✅ All downloads and uploads completed!');

    // Send completion message
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

  // ===== DUPLICATE CHECKING FUNCTIONS =====

  /**
   * Check if order has already been downloaded
   */
  async checkOrderDuplicate(orderId) {
    return new Promise((resolve) => {
      chrome.storage.local.get('downloadedInvoices', (data) => {
        const downloaded = data.downloadedInvoices || {};
        resolve(!!downloaded[orderId]);
      });
    });
  }

  /**
   * Check if file with given hash already exists locally
   */
  async checkLocalFileDuplicate(fileHash) {
    return new Promise((resolve) => {
      chrome.storage.local.get('fileHashes', (data) => {
        const fileHashes = data.fileHashes || {};
        resolve(!!fileHashes[fileHash]);
      });
    });
  }

  /**
   * Generate MD5 hash of file blob
   */
  async generateFileHash(blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('⚠️ Could not generate file hash:', error);
      return null;
    }
  }

  /**
   * Read local file for duplicate checking
   */
  async readLocalFile(filePath) {
    return new Promise((resolve, reject) => {
      // This is a simplified version - in practice, we'd need file system access
      // For now, we'll return null as this function seems to be incomplete
      console.warn('⚠️ readLocalFile not fully implemented');
      resolve(null);
    });
  }

  /**
   * Track download for verification
   */
  trackDownload(downloadId, orderId, filename, metadata) {
    // This function tracks downloads for verification
    // Implementation moved to background.js for now
    console.log(`📊 Tracking download: ${downloadId} -> ${filename}`);
  }
}

// Export for use in background script
// Class exported for instantiation in background script
console.log('✅ DOWNLOAD-PROCESSOR.JS LOADED - DownloadProcessor class available:', typeof DownloadProcessor);