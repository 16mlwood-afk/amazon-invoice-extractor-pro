// ===== DOWNLOAD-MANAGER.JS =====
// Download infrastructure classes and utilities

(function() {
  // ===== PREVENT MULTIPLE INJECTIONS =====
  if (window.__amazonInvoiceExtensionLoaded) {
    // Silently exit if already loaded
    return;
  }

// ===== FILE ORGANIZER CLASS =====
// Flexible output structure with user-configurable templates

class FileOrganizer {
  constructor() {
    this.templates = {
      // Folder structure templates
      folders: {
        flat: '',
        byYear: '{year}/',
        byYearMonth: '{year}/{month}/',
        byQuarter: '{year}/Q{quarter}/',
        byMarketplace: '{marketplace}/{year}/{month}/',
        byAccount: '{accountName}/{year}/{month}/',
        custom: '{customPath}/'
      },

      // Filename templates
      filenames: {
        default: 'Invoice_{orderId}.pdf',
        dated: '{year}-{month}-{day}_Invoice_{orderId}.pdf',
        detailed: '{year}{month}{day}_{marketplace}_{orderId}.pdf',
        sequential: 'Invoice_{index:04d}_{orderId}.pdf',
        timestamp: '{timestamp}_Invoice_{orderId}.pdf',
        marketplace: '{marketplace}_{orderId}_{year}{month}{day}.pdf'
      }
    };

    // Default user preferences
    this.userPrefs = {
      folderStructure: 'byYearMonth',
      filenameFormat: 'dated',
      baseFolder: 'Amazon_Invoices',
      customPath: '',
      accountName: 'Personal',
      marketplace: detectMarketplace(),
      includeTimestamp: false,
      sanitizeFilenames: true
    };

    // Load saved preferences (async, but we'll use defaults for now)
    this.loadPreferences();
  }

  // Load user preferences from storage
  async loadPreferences() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get('fileOrganizerPrefs', (data) => {
          if (data.fileOrganizerPrefs) {
            this.userPrefs = { ...this.userPrefs, ...data.fileOrganizerPrefs };
          }
          resolve(this.userPrefs);
        });
      } else {
        resolve(this.userPrefs);
      }
    });
  }

  // Generate full path for a download item
  generatePath(item, context = {}) {
    const folderPath = this.generateFolderPath(item, context);
    const filename = this.generateFilename(item, context);
    return `${folderPath}${filename}`;
  }

  // Generate folder path based on template
  generateFolderPath(item, context = {}) {
    const template = this.templates.folders[this.userPrefs.folderStructure];
    if (!template) {
      console.warn(`Unknown folder template: ${this.userPrefs.folderStructure}`);
      return this.templates.folders.flat;
    }

    const data = this.buildTemplateData(item, context);
    return this.interpolateTemplate(template, data);
  }

  // Generate filename based on template
  generateFilename(item, context = {}) {
    const template = this.templates.filenames[this.userPrefs.filenameFormat];
    if (!template) {
      console.warn(`Unknown filename template: ${this.userPrefs.filenameFormat}`);
      return this.templates.filenames.default;
    }

    const data = this.buildTemplateData(item, context);
    let filename = this.interpolateTemplate(template, data);

    // Sanitize filename if enabled
    if (this.userPrefs.sanitizeFilenames) {
      filename = this.sanitizeFilename(filename);
    }

    return filename;
  }

  // Build template data object
  buildTemplateData(item, context = {}) {
    const now = new Date();
    const orderDate = item.orderDate ? new Date(item.orderDate) : now;

    const data = {
      // Order data
      orderId: item.orderId || 'unknown',
      index: item.index !== undefined ? item.index : 0,

      // Date data
      year: orderDate.getFullYear().toString(),
      month: String(orderDate.getMonth() + 1).padStart(2, '0'),
      day: String(orderDate.getDate()).padStart(2, '0'),
      quarter: Math.floor((orderDate.getMonth() + 3) / 3).toString(),

      // Timestamp data
      timestamp: now.toISOString().replace(/[:.]/g, '-').slice(0, -5),
      unix: Math.floor(now.getTime() / 1000).toString(),

      // Marketplace data
      marketplace: this.userPrefs.marketplace || context.marketplace || 'amazon',

      // User preferences
      accountName: this.userPrefs.accountName,
      baseFolder: this.userPrefs.baseFolder,
      customPath: this.userPrefs.customPath,

      // Context data
      ...context
    };

    return data;
  }

  // Interpolate template with data
  interpolateTemplate(template, data) {
    return template.replace(/{(\w+)(?::(\w+))?}/g, (match, key, format) => {
      let value = data[key];

      if (value === undefined) {
        console.warn(`Template variable '${key}' not found in data`);
        return match;
      }

      // Apply formatting
      if (format) {
        switch (format) {
          case '04d':
            value = String(value).padStart(4, '0');
            break;
          case '02d':
            value = String(value).padStart(2, '0');
            break;
          case 'upper':
            value = String(value).toUpperCase();
            break;
          case 'lower':
            value = String(value).toLowerCase();
            break;
        }
      }

      return value;
    });
  }

  // Sanitize filename for filesystem compatibility
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')  // Remove invalid characters
      .replace(/^\.+/, '')                      // Remove leading dots
      .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, '_$1')  // Reserved names
      .slice(0, 255);                          // Limit length
  }

  // Detect current marketplace
  detectMarketplace() {
    return detectMarketplace();
  }
}

// ===== NOTIFICATION MANAGER CLASS =====
// Non-intrusive notifications for download progress and completion

class NotificationManager {
  constructor() {
    this.notifications = new Map();
    this.settings = {
      showProgress: true,
      showCompletion: true,
      showErrors: true,
      autoCloseDelay: 5000,
      enableSound: false
    };
  }

  // Show progress notification
  showProgress(title, message, progress = -1) {
    if (!this.settings.showProgress) return;

    // Send message to background script to create progress notification
    chrome.runtime.sendMessage({
      action: 'showProgress',
      title: title,
      message: message,
      iconUrl: chrome.runtime.getURL('images/icon128.PNG'),
      progress: Math.max(0, Math.min(100, progress)),
      requireInteraction: false
    });
  }

  // Show completion notification
  showCompletion(title, message, buttons = []) {
    if (!this.settings.showCompletion) return;

    const notificationId = `completion_${Date.now()}`;

    // Send message to background script to create notification
    chrome.runtime.sendMessage({
      action: 'showNotification',
      type: 'basic',
      title: title,
      message: message,
      iconUrl: chrome.runtime.getURL('images/icon128.PNG'),
      buttons: buttons.length > 0 ? buttons.map(btn => ({ title: btn.title })) : undefined,
      requireInteraction: true
    }, (response) => {
      if (response && response.notificationId) {
        this.notifications.set(response.notificationId, {
          type: 'completion',
          created: Date.now(),
          buttons: buttons
        });
      } else {
        // Fallback: use generated ID if no response
        this.notifications.set(notificationId, {
          type: 'completion',
          created: Date.now(),
          buttons: buttons
        });
      }
    });
  }

  // Show error notification
  showError(title, message) {
    if (!this.settings.showErrors) return;

    // Send message to background script to create error notification
    chrome.runtime.sendMessage({
      action: 'showError',
      title: title,
      message: message,
      iconUrl: chrome.runtime.getURL('images/icon128.PNG'),
      requireInteraction: true
    });
  }

  // Update progress notification
  updateProgress(notificationId, progress, message = null) {
    // Send message to background script to update progress notification
    chrome.runtime.sendMessage({
      action: 'updateProgressNotification',
      progress: Math.max(0, Math.min(100, progress)),
      message: message
    });
  }

  // Show download start notification
  notifyDownloadStart(totalInvoices, marketplace = 'Amazon') {
    this.showProgress(
      'Amazon Invoice Downloader',
      `Starting download of ${totalInvoices} invoices from ${marketplace}...`,
      0
    );
  }

  // Update download progress
  notifyDownloadProgress(current, total, marketplace = 'Amazon') {
    const progress = total > 0 ? Math.round((current / total) * 100) : 0;
    const notificationId = 'progress_download';

    if (!this.notifications.has(notificationId)) {
      this.showProgress(
        'Downloading Invoices',
        `Processing ${current} of ${total} invoices...`,
        progress
      );
    } else {
      this.updateProgress(
        notificationId,
        progress,
        `Processing ${current} of ${total} invoices from ${marketplace}...`
      );
    }
  }

  // Show download completion
  notifyDownloadComplete(successful, failed, marketplace = 'Amazon') {
    const title = failed > 0 ? 'Download Completed with Errors' : 'Download Completed Successfully';
    const message = failed > 0
      ? `${successful} invoices downloaded, ${failed} failed from ${marketplace}`
      : `All ${successful} invoices downloaded successfully from ${marketplace}`;

    const buttons = [];
    if (failed > 0) {
      buttons.push({
        title: 'Retry Failed',
        action: () => {
          console.log('Retry failed downloads clicked');
        }
      });
    }

    buttons.push({
      title: 'View Files',
      action: () => {
        chrome.downloads.showDefaultFolder();
      }
    });

    this.showCompletion(title, message, buttons);
  }

  // Show download error
  notifyDownloadError(error, marketplace = 'Amazon') {
    this.showError(
      'Download Failed',
      `Failed to download invoices from ${marketplace}: ${error}`
    );
  }
}

// ===== BANDWIDTH MANAGER CLASS =====
// Adapt download behavior based on network conditions

class BandwidthManager {
  constructor() {
    this.currentProfile = 'normal';
    this.failureRate = 0;
    this.recentFailures = [];
    this.lastAdjustment = Date.now();

    this.profiles = {
      excellent: { maxConcurrent: 10, delayBetween: 500, throttleRate: 20 },
      good: { maxConcurrent: 5, delayBetween: 800, throttleRate: 12 },
      normal: { maxConcurrent: 3, delayBetween: 1500, throttleRate: 8 },
      poor: { maxConcurrent: 2, delayBetween: 2500, throttleRate: 5 },
      terrible: { maxConcurrent: 1, delayBetween: 5000, throttleRate: 2 }
    };
  }

  getAdaptiveSettings(baseSettings = {}) {
    const profile = this.profiles[this.currentProfile];
    return {
      maxConcurrent: Math.min(baseSettings.maxConcurrent || 5, profile.maxConcurrent),
      delayBetween: Math.max(baseSettings.delayBetween || 1000, profile.delayBetween),
      throttleRate: Math.min(baseSettings.throttleRate || 10, profile.throttleRate),
      profile: this.currentProfile
    };
  }

  recordFailure() {
    this.recentFailures.push({ timestamp: Date.now() });
    const cutoff = Date.now() - (10 * 60 * 1000);
    this.recentFailures = this.recentFailures.filter(f => f.timestamp > cutoff);
    this.calculateFailureRate();
  }

  calculateFailureRate() {
    const totalAttempts = Math.max(this.recentFailures.length + 10, 20);
    this.failureRate = this.recentFailures.length / totalAttempts;
  }
}

// ===== DOWNLOAD QUEUE CLASS =====
// Advanced queue system with configurable settings, rate limiting, and error handling

class DownloadQueue {
  constructor(config = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 3,        // Max simultaneous downloads
      delayBetween: config.delayBetween || 1000,      // ms between downloads
      throttleRate: config.throttleRate || 10,        // downloads per minute
      pauseOnError: config.pauseOnError !== false,    // Stop queue if error
      retryFailed: config.retryFailed !== false,      // Auto-retry at end
      maxRetries: config.maxRetries || 3,             // Max retry attempts per item
      retryDelay: config.retryDelay || 2000,          // Delay between retries
      ...config
    };

    this.queue = [];
    this.activeDownloads = new Map();
    this.completedDownloads = [];
    this.failedDownloads = [];
    this.isPaused = false;
    this.isProcessing = false;
    this.downloadsThisMinute = 0;
    this.lastMinuteReset = Date.now();

    // Event callbacks
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    this.onItemComplete = null;
  }

  // Add items to queue
  add(items) {
    if (Array.isArray(items)) {
      this.queue.push(...items);
    } else {
      this.queue.push(items);
    }
  }

  // Start processing queue
  async start() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.isPaused = false;

    console.log(`🚀 Starting download queue with ${this.queue.length} items`);
    console.log(`  Config: ${this.config.maxConcurrent} concurrent, ${this.config.throttleRate}/min rate limit`);

    try {
      await this.processQueue();
    } catch (error) {
      console.error('❌ Queue processing error:', error);
      if (this.onError) this.onError(error);
    } finally {
      this.isProcessing = false;
      console.log('✅ Queue processing complete');
      if (this.onComplete) this.onComplete(this.completedDownloads, this.failedDownloads);
    }
  }

  // Get queue statistics
  getStats() {
    return {
      total: this.queue.length + this.activeDownloads.size + this.completedDownloads.length + this.failedDownloads.length,
      queued: this.queue.length,
      active: this.activeDownloads.size,
      completed: this.completedDownloads.length,
      failed: this.failedDownloads.length,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused
    };
  }

  // Process the queue
  async processQueue() {
    while (this.queue.length > 0 && !this.isPaused) {
      // Check rate limit
      await this.enforceRateLimit();

      // Fill active downloads up to maxConcurrent
      while (this.activeDownloads.size < this.config.maxConcurrent && this.queue.length > 0) {
        const item = this.queue.shift();
        this.startDownload(item);
      }

      // Wait for at least one download to complete
      if (this.activeDownloads.size > 0) {
        await this.waitForDownloadCompletion();
      }

      // Small delay between batches
      await this.delay(this.config.delayBetween);
    }

    // Process failed downloads if retry is enabled
    if (this.config.retryFailed && this.failedDownloads.length > 0) {
      await this.retryFailedDownloads();
    }
  }

  // Start downloading an item
  async startDownload(item) {
    const downloadId = this.generateDownloadId();
    this.activeDownloads.set(downloadId, {
      item,
      id: downloadId,
      startTime: Date.now(),
      retries: 0
    });

    console.log(`📥 Starting download: ${item.filename || item.orderId}`);

    try {
      const result = await this.performDownload(item);
      this.handleDownloadSuccess(downloadId, result);
    } catch (error) {
      this.handleDownloadError(downloadId, error);
    }
  }

  // Perform the actual download
  async performDownload(item) {
    try {
      // Check if this is a popover URL that needs PDF extraction
      if (item.url.includes('/invoice/popover') || item.url.includes('invoice-popover')) {
        console.log(`🔍 Processing popover URL: ${item.url}`);

        // Fetch the popover HTML content
        const popoverResponse = await fetch(item.url, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': navigator.userAgent
          },
          credentials: 'include' // Include cookies for authentication
        });

        if (!popoverResponse.ok) {
          throw new Error(`Failed to fetch popover: ${popoverResponse.status}`);
        }

        const htmlContent = await popoverResponse.text();
        console.log(`📄 Popover HTML fetched (${htmlContent.length} chars)`);

        // Extract PDF URL from HTML
        const pdfUrl = this.extractPdfUrlFromHtml(htmlContent, item.orderId);

        if (!pdfUrl) {
          throw new Error('Could not find PDF URL in popover HTML');
        }

        console.log(`🎯 Extracted PDF URL: ${pdfUrl}`);
        item.url = pdfUrl; // Update the URL to the actual PDF
      }

      // Now download the actual PDF
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'downloadPDF',
          url: item.url,
          filename: item.filename,
          orderId: item.orderId
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve({ downloadId: response.downloadId });
          } else {
            reject(new Error(response?.error || 'Download failed'));
          }
        });
      });

    } catch (error) {
      console.error(`❌ Error processing download for ${item.orderId}:`, error);
      throw error;
    }
  }

  // Handle successful download
  handleDownloadSuccess(downloadId, result) {
    const download = this.activeDownloads.get(downloadId);
    if (!download) return;

    download.result = result;
    download.endTime = Date.now();
    download.duration = download.endTime - download.startTime;

    this.completedDownloads.push(download);
    this.activeDownloads.delete(downloadId);

    console.log(`✅ Download complete: ${download.item.filename || download.item.orderId} (${download.duration}ms)`);

    if (this.onItemComplete) {
      this.onItemComplete(download.item, 'success', result);
    }

    if (this.onProgress) {
      this.onProgress(this.getStats());
    }
  }

  // Handle download error
  handleDownloadError(downloadId, error) {
    const download = this.activeDownloads.get(downloadId);
    if (!download) return;

    download.error = error;
    download.endTime = Date.now();
    download.duration = download.endTime - download.startTime;

    // Check if we should retry
    if (download.retries < this.config.maxRetries) {
      download.retries++;
      console.log(`🔄 Retrying download (${download.retries}/${this.config.maxRetries}): ${download.item.filename}`);

      // Put back in queue for retry
      setTimeout(() => {
        this.queue.unshift(download.item);
      }, this.config.retryDelay);

    } else {
      // Max retries reached
      this.failedDownloads.push(download);
      console.error(`❌ Download failed permanently: ${download.item.filename}`, error);

      // Record failure for bandwidth management
      if (typeof bandwidthManager !== 'undefined') {
        bandwidthManager.recordFailure();
      }
    }

    this.activeDownloads.delete(downloadId);

    if (this.onItemComplete) {
      this.onItemComplete(download.item, 'error', error);
    }

    if (this.onProgress) {
      this.onProgress(this.getStats());
    }
  }

  // Wait for at least one download to complete
  async waitForDownloadCompletion() {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (this.activeDownloads.size < this.config.maxConcurrent || this.isPaused) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }

  // Enforce rate limiting
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastReset = now - this.lastMinuteReset;

    // Reset counter every minute
    if (timeSinceLastReset >= 60000) {
      this.downloadsThisMinute = 0;
      this.lastMinuteReset = now;
    }

    // If we've hit the rate limit, wait
    if (this.downloadsThisMinute >= this.config.throttleRate) {
      const waitTime = 60000 - timeSinceLastReset;
      console.log(`⏳ Rate limit reached, waiting ${waitTime}ms`);
      await this.delay(waitTime);
      this.downloadsThisMinute = 0;
      this.lastMinuteReset = Date.now();
    }
  }

  // Retry failed downloads
  async retryFailedDownloads() {
    console.log(`🔄 Retrying ${this.failedDownloads.length} failed downloads`);

    const itemsToRetry = this.failedDownloads
      .filter(download => download.retries < this.config.maxRetries)
      .map(download => download.item);

    this.failedDownloads = this.failedDownloads.filter(download => download.retries >= this.config.maxRetries);

    if (itemsToRetry.length > 0) {
      this.queue.unshift(...itemsToRetry);
      await this.processQueue();
    }
  }

  // Utility methods
  generateDownloadId() {
    return 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Extract PDF URL from popover HTML content
  extractPdfUrlFromHtml(htmlContent, orderId) {
    try {
      // Create a temporary DOM element to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      // Priority 1: Look for actual PDF download links (ending with .pdf)
      const pdfLinks = tempDiv.querySelectorAll('a[href$=".pdf"]');
      for (const link of pdfLinks) {
        const href = link.href || link.getAttribute('href');
        if (href) {
          console.log(`🎯 Found PDF download link: ${href}`);

          // Convert relative URLs to absolute URLs
          let absoluteUrl = href;
          if (href.startsWith('/')) {
            const currentOrigin = window.location.origin;
            absoluteUrl = `${currentOrigin}${href}`;
            console.log(`🔗 Converted PDF relative URL to absolute: ${absoluteUrl}`);
          }

          return absoluteUrl;
        }
      }

      // Priority 2: Look for Amazon document download links
      const downloadLinks = tempDiv.querySelectorAll('a[href*="/documents/download/"]');
      for (const link of downloadLinks) {
        const href = link.href || link.getAttribute('href');
        if (href) {
          console.log(`🎯 Found document download link: ${href}`);

          // Convert relative URLs to absolute URLs
          let absoluteUrl = href;
          if (href.startsWith('/')) {
            const currentOrigin = window.location.origin;
            absoluteUrl = `${currentOrigin}${href}`;
            console.log(`🔗 Converted download relative URL to absolute: ${absoluteUrl}`);
          }

          return absoluteUrl;
        }
      }

      // Priority 3: Fallback to any link with .pdf in the URL
      const fallbackPdfLinks = tempDiv.querySelectorAll('a[href*=".pdf"]');
      for (const link of fallbackPdfLinks) {
        const href = link.href || link.getAttribute('href');
        if (href) {
          console.log(`📎 Found fallback PDF link: ${href}`);

          // Convert relative URLs to absolute URLs
          let absoluteUrl = href;
          if (href.startsWith('/')) {
            const currentOrigin = window.location.origin;
            absoluteUrl = `${currentOrigin}${href}`;
            console.log(`🔗 Converted fallback relative URL to absolute: ${absoluteUrl}`);
          }

          return absoluteUrl;
        }
      }

      // Look for iframe with PDF content (prioritize actual PDFs)
      const pdfIframe = tempDiv.querySelector('iframe[src$=".pdf"]');
      if (pdfIframe) {
        const src = pdfIframe.src || pdfIframe.getAttribute('src');
        if (src) {
          console.log(`🎯 Found PDF iframe: ${src}`);

          // Convert relative URLs to absolute URLs
          let absoluteUrl = src;
          if (src.startsWith('/')) {
            const currentOrigin = window.location.origin;
            absoluteUrl = `${currentOrigin}${src}`;
            console.log(`🔗 Converted PDF iframe relative URL to absolute: ${absoluteUrl}`);
          }

          return absoluteUrl;
        }
      }

      // Look for order-specific PDF links (prioritize actual PDFs)
      const orderPdfLinks = tempDiv.querySelectorAll(`a[href*="${orderId}"][href$=".pdf"]`);
      for (const link of orderPdfLinks) {
        const href = link.href || link.getAttribute('href');
        if (href) {
          console.log(`🎯 Found order-specific PDF link: ${href}`);

          // Convert relative URLs to absolute URLs
          let absoluteUrl = href;
          if (href.startsWith('/')) {
            const currentOrigin = window.location.origin;
            absoluteUrl = `${currentOrigin}${href}`;
            console.log(`🔗 Converted order-specific PDF relative URL to absolute: ${absoluteUrl}`);
          }

          return absoluteUrl;
        }
      }

      // Fallback: Look for any order-specific document download links
      const orderDownloadLinks = tempDiv.querySelectorAll(`a[href*="${orderId}"][href*="/documents/download/"]`);
      for (const link of orderDownloadLinks) {
        const href = link.href || link.getAttribute('href');
        if (href) {
          console.log(`🎯 Found order-specific download link: ${href}`);

          // Convert relative URLs to absolute URLs
          let absoluteUrl = href;
          if (href.startsWith('/')) {
            const currentOrigin = window.location.origin;
            absoluteUrl = `${currentOrigin}${href}`;
            console.log(`🔗 Converted order-specific download relative URL to absolute: ${absoluteUrl}`);
          }

          return absoluteUrl;
        }
      }

      // Regex fallback: Look for actual PDF URLs first
      const pdfUrlRegex = /https?:\/\/[^"'\s]*\/documents\/download\/[^"'\s]*\.pdf[^"'\s]*/gi;
      const matches = htmlContent.match(pdfUrlRegex);
      if (matches && matches.length > 0) {
        console.log(`🎯 Found PDF download URL via regex: ${matches[0]}`);
        return matches[0]; // Already absolute
      }

      // Fallback: Any PDF URL
      const anyPdfRegex = /https?:\/\/[^"'\s]+\.pdf[^"'\s]*/gi;
      const anyMatches = htmlContent.match(anyPdfRegex);
      if (anyMatches && anyMatches.length > 0) {
        console.log(`📎 Found any PDF URL via regex: ${anyMatches[0]}`);
        return anyMatches[0]; // Already absolute
      }

      // Check for relative PDF URLs in HTML attributes (prioritize document downloads)
      const relativeDownloadRegex = /href=["']([^"']*\/documents\/download\/[^"']*\.pdf[^"']*)["']/gi;
      const relativeDownloadMatches = htmlContent.match(relativeDownloadRegex);
      if (relativeDownloadMatches && relativeDownloadMatches.length > 0) {
        const match = relativeDownloadMatches[0];
        const urlMatch = match.match(/href=["']([^"']+)["']/);
        if (urlMatch && urlMatch[1]) {
          const relativeUrl = urlMatch[1];
          console.log(`🎯 Found relative PDF download URL via regex: ${relativeUrl}`);

          // Convert to absolute URL
          const currentOrigin = window.location.origin;
          const absoluteUrl = `${currentOrigin}${relativeUrl}`;
          console.log(`🔗 Converted regex-found PDF download relative URL to absolute: ${absoluteUrl}`);
          return absoluteUrl;
        }
      }

      // Final fallback: Any relative PDF URL
      const relativePdfRegex = /href=["']([^"']*\.pdf[^"']*)["']/gi;
      const relativeMatches = htmlContent.match(relativePdfRegex);
      if (relativeMatches && relativeMatches.length > 0) {
        const match = relativeMatches[0];
        const urlMatch = match.match(/href=["']([^"']+)["']/);
        if (urlMatch && urlMatch[1]) {
          const relativeUrl = urlMatch[1];
          console.log(`📎 Found relative PDF URL via regex: ${relativeUrl}`);

          // Convert to absolute URL
          const currentOrigin = window.location.origin;
          const absoluteUrl = `${currentOrigin}${relativeUrl}`;
          console.log(`🔗 Converted regex-found relative URL to absolute: ${absoluteUrl}`);
          return absoluteUrl;
        }
      }

      console.warn(`⚠️ No PDF URL found in popover HTML for order ${orderId}`);
      return null;

    } catch (error) {
      console.error(`❌ Error extracting PDF URL from HTML:`, error);
      return null;
    }
  }

  // Pause the queue (stop processing new items but finish current ones)
  pause() {
    console.log('⏸️ Download queue paused');
    this.isPaused = true;
  }

  // Resume the queue
  resume() {
    if (!this.isPaused) return;

    console.log('▶️ Download queue resumed');
    this.isPaused = false;
    this.processQueue();
  }

  // Stop the queue completely (cancel all pending downloads)
  stop() {
    console.log('🛑 Download queue stopped');

    this.isPaused = true;
    this.isProcessing = false;

    // Cancel all active downloads
    for (const [downloadId, download] of this.activeDownloads) {
      try {
        // Cancel the Chrome download
        chrome.downloads.cancel(downloadId, () => {
          if (chrome.runtime.lastError) {
            console.log(`⚠️ Could not cancel download ${downloadId}:`, chrome.runtime.lastError.message);
          }
        });
      } catch (error) {
        console.log(`⚠️ Error cancelling download ${downloadId}:`, error);
      }
    }

    // Clear the queue
    this.queue = [];
    this.activeDownloads.clear();

    // Trigger completion callback with cancelled status
    if (this.onComplete) {
      const completed = [...this.completedDownloads];
      const failed = [...this.failedDownloads, ...Array.from(this.activeDownloads.values())];
      this.onComplete(completed, failed);
    }
  }

  // Get current status
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      queueLength: this.queue.length,
      activeCount: this.activeDownloads.size,
      completedCount: this.completedDownloads.length,
      failedCount: this.failedDownloads.length
    };
  }
}

// ===== DOWNLOAD UTILITY FUNCTIONS =====

// Initialize file organizer
const fileOrganizer = new FileOrganizer();

// Initialize notification manager
const notificationManager = new NotificationManager();

// Initialize bandwidth manager
const bandwidthManager = new BandwidthManager();

// Generate filename using file organizer
function generateOrganizedFilename(orderId, orderDate = null, index = 0) {
  const item = {
    orderId: orderId,
    orderDate: orderDate,
    index: index
  };

  return fileOrganizer.generatePath(item, {
    marketplace: detectMarketplace()
  });
}

async function checkDuplicate(orderId) {
  return new Promise((resolve) => {
    chrome.storage.local.get('downloadedInvoices', (data) => {
      const downloaded = data.downloadedInvoices || {};
      resolve(!!downloaded[orderId]);
    });
  });
}

async function initiateDownload(url, filename, orderId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'downloadPDF',
      url: url,
      filename: filename,
      orderId: orderId
    }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else if (response && response.success) {
        resolve({ success: true, downloadId: response.downloadId });
      } else {
        resolve({ success: false, error: response?.error || 'Unknown error' });
      }
    });
  });
}

// Export classes and functions to global scope
window.FileOrganizer = FileOrganizer;
window.NotificationManager = NotificationManager;
window.BandwidthManager = BandwidthManager;
window.DownloadQueue = DownloadQueue;
window.fileOrganizer = fileOrganizer;
window.notificationManager = notificationManager;
window.bandwidthManager = bandwidthManager;
window.generateOrganizedFilename = generateOrganizedFilename;
window.checkDuplicate = checkDuplicate;
window.initiateDownload = initiateDownload;
})();
