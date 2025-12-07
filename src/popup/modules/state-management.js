// ============================================
// STATE MANAGEMENT SYSTEM
// ============================================

(function() {
  // State constants
  window.UI_STATES = {
    IDLE: 'idle',
    DOWNLOADING: 'downloading',
    SUCCESS: 'success',
    ERROR: 'error'
  };

  // Phase icons for different download stages
  window.PHASE_ICONS = {
    idle: '📋',
    collecting: '🔍',
    preparing: '⚙️',
    downloading: '⬇️',
    complete: '✅',
    error: '❌'
  };

  // Global state variables
  window.currentState = window.UI_STATES.IDLE;
  window.orderCount = 0;
  window.currentDateRangeType = 'last-month'; // Default
  window.currentDownloadCount = 0;
  window.totalDownloadCount = 0;
  window.failedDownloads = [];
  window.downloadStartTime = null;
  window.downloadEndTime = null;
  window.downloadItems = new Map(); // Track download items by ID

  // State management functions
  window.setCurrentState = function(state) {
    window.currentState = state;
  };

  window.setOrderCount = function(count) {
    window.orderCount = count;
  };

  window.setCurrentDateRangeType = function(type) {
    window.currentDateRangeType = type;
  };

  window.setCurrentDownloadCount = function(count) {
    window.currentDownloadCount = count;
  };

  window.setTotalDownloadCount = function(count) {
    window.totalDownloadCount = count;
  };

  window.addFailedDownload = function(failedItem) {
    window.failedDownloads.push(failedItem);
  };

  window.clearFailedDownloads = function() {
    window.failedDownloads = [];
  };

  window.setDownloadStartTime = function(time) {
    window.downloadStartTime = time;
  };

  window.setDownloadEndTime = function(time) {
    window.downloadEndTime = time;
  };

  window.getDownloadItems = function() {
    return window.downloadItems;
  };

  window.setDownloadItems = function(items) {
    window.downloadItems = items;
  };
})();