// ============================================
// RETRY FUNCTIONALITY
// ============================================

(function() {
  window.retryFailed = function() {
    const failedDownloads = JSON.parse(localStorage.getItem('failedDownloads') || '[]');

    if (failedDownloads.length > 0) {
      console.log('Retrying failed downloads:', failedDownloads);

      window.setUIState(window.UI_STATES.DOWNLOADING, {
        current: 0,
        total: failedDownloads.length,
        currentFile: 'Retrying failed downloads...'
      });

      chrome.runtime.sendMessage({
        action: "retryFailedDownloads",
        failedDownloads: failedDownloads
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error retrying downloads:', chrome.runtime.lastError);
          window.setUIState(window.UI_STATES.ERROR, {
            errorCount: failedDownloads.length,
            errors: ['Failed to retry downloads']
          });
        } else {
          localStorage.removeItem('failedDownloads');
        }
      });
    }
  };
})();