/**
 * Download State Manager Module
 * Handles download state tracking and synchronization with popup
 */

class DownloadStateManager {
  constructor() {
    this.state = {
      isDownloading: false,
      current: 0,
      total: 0,
      successful: 0,
      failed: 0,
      startTime: null,
      downloadItems: []
    };
  }

  /**
   * Reset download state to initial values
   */
  resetDownloadState() {
    this.state = {
      isDownloading: false,
      current: 0,
      total: 0,
      successful: 0,
      failed: 0,
      startTime: null,
      downloadItems: []
    };
    console.log('🔄 Download state reset');
  }

  /**
   * Get current download state with calculated duration
   * @returns {Object} Current download state
   */
  getDownloadState() {
    return {
      ...this.state,
      duration: this.state.startTime ? Date.now() - this.state.startTime : 0
    };
  }

  /**
   * Update download progress
   * @param {number} current - Current item being processed
   * @param {number} total - Total items to process
   * @param {number} successful - Number of successful downloads
   * @param {number} failed - Number of failed downloads
   */
  updateProgress(current, total, successful, failed) {
    this.state.current = current;
    this.state.total = total;
    this.state.successful = successful;
    this.state.failed = failed;

    // Broadcast progress to popup
    chrome.runtime.sendMessage({
      action: 'downloadProgress',
      current: this.state.current,
      total: this.state.total,
      successful: this.state.successful,
      failed: this.state.failed
    }).catch(() => {
      console.log('ℹ️ Popup not open for progress update');
    });

    console.log(`📊 Progress: ${this.state.current}/${this.state.total}`);
  }

  /**
   * Start download session
   * @param {number} total - Total items to download
   */
  startDownload(total) {
    this.state.isDownloading = true;
    this.state.total = total;
    this.state.startTime = Date.now();
    this.state.current = 0;
    this.state.successful = 0;
    this.state.failed = 0;
    this.state.downloadItems = [];

    console.log(`🚀 Starting download session with ${total} items`);
  }

  /**
   * Mark download as completed successfully
   */
  markSuccessful() {
    this.state.successful++;
    this.state.current++;
  }

  /**
   * Mark download as failed
   */
  markFailed() {
    this.state.failed++;
    this.state.current++;
  }

  /**
   * End download session
   */
  endDownload() {
    this.state.isDownloading = false;
    console.log(`✅ Download session completed: ${this.state.successful} successful, ${this.state.failed} failed`);
  }

  /**
   * Add download item to tracking
   * @param {Object} item - Download item data
   */
  addDownloadItem(item) {
    this.state.downloadItems.push(item);
  }

  /**
   * Get download items
   * @returns {Array} Download items array
   */
  getDownloadItems() {
    return this.state.downloadItems;
  }

  /**
   * Check if currently downloading
   * @returns {boolean} Download status
   */
  isDownloading() {
    return this.state.isDownloading;
  }
}

// Export for use in background script
const downloadStateManager = new DownloadStateManager();

// Make globally available
self.downloadStateManager = downloadStateManager;