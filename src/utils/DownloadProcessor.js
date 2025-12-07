/**
 * Download Processor Module
 * Handles the main download processing logic and URL management
 */

class DownloadProcessor {
  constructor(sessionManager, downloadStateManager, contentScriptManager) {
    this.sessionManager = sessionManager;
    this.downloadStateManager = downloadStateManager;
    this.contentScriptManager = contentScriptManager;
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
}

// Export for use in background script
const downloadProcessor = new DownloadProcessor();

// Make globally available
self.downloadProcessor = downloadProcessor;
console.log('✅ DOWNLOAD-PROCESSOR.JS LOADED - downloadProcessor available:', typeof self.downloadProcessor);