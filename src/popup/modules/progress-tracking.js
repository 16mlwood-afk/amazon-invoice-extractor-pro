// ============================================
// PROGRESS TRACKING
// ============================================

(function() {
  window.updateProgress = function(percentage) {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
      progressBar.style.width = percentage + '%';
    }
  };

  window.updateDownloadProgress = function(current, total, statusMessage = null) {
    window.setCurrentDownloadCount(current);
    window.setTotalDownloadCount(total);

    if (window.downloadStartTime === null && current > 0) {
      window.setDownloadStartTime(Date.now());
    }

    window.updateDownloadingState({
      current: current,
      total: total,
      currentFile: statusMessage || '--'
    });
  };

  window.calculateTimeRemaining = function(current, total, startTime) {
    if (!startTime || current === 0 || total === 0) {
      return null;
    }

    const elapsed = Date.now() - startTime;
    const rate = current / elapsed;
    const remaining = (total - current) / rate;

    return window.formatTime(remaining);
  };

  window.formatTime = function(ms) {
    const seconds = Math.round(ms / 1000);

    if (seconds < 60) {
      return seconds <= 1 ? '~1s remaining' : `~${seconds}s remaining`;
    }

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `~${minutes}m remaining`;
    }

    const hours = Math.round(minutes / 60);
    return `~${hours}h remaining`;
  };

  window.updateDownloadStatus = function(message) {
    if (window.currentState === window.UI_STATES.DOWNLOADING) {
      window.setUIState(window.UI_STATES.DOWNLOADING, {
        current: window.currentDownloadCount,
        total: window.totalDownloadCount,
        currentFile: message
      });
    }
  };
})();