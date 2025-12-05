// ===== DOWNLOAD QUEUE MANAGEMENT =====
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

  // Pause processing
  pause() {
    this.isPaused = true;
    console.log('⏸️ Queue paused');
  }

  // Resume processing
  resume() {
    this.isPaused = false;
    console.log('▶️ Queue resumed');
    this.processQueue();
  }

  // Stop processing and clear queue
  stop() {
    this.isPaused = true;
    this.queue = [];
    this.activeDownloads.clear();
    console.log('🛑 Queue stopped');
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

  // Perform the actual download (to be overridden by subclasses)
  async performDownload(item) {
    // Default implementation - override in subclasses
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

      if (this.config.pauseOnError) {
        this.isPaused = true;
        console.log('⏸️ Queue paused due to error');
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
      this.isPaused = false;
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

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DownloadQueue;
}
