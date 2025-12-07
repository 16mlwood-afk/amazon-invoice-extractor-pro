// ============================================
// STATE TRANSITION FUNCTIONS
// ============================================

(function() {
  // Update state icon based on current phase
  window.updateStateIcon = function(state, phase = null) {
    const stateIcon = document.querySelector(`.status-${state} .state-icon`);
    if (stateIcon) {
      if (state === window.UI_STATES.DOWNLOADING && phase) {
        stateIcon.textContent = window.PHASE_ICONS[phase] || window.PHASE_ICONS.downloading;
      } else {
        stateIcon.textContent = window.PHASE_ICONS[state] || '📋';
      }
    }
  };

  // State transition functions
  window.setUIState = function(state, data = {}) {
    console.log('🎨 Switching to state:', state);

    // Hide all states
    document.querySelectorAll('.status-state').forEach(el => {
      el.classList.remove('active');
    });

    // Show target state
    const targetState = document.querySelector(`.status-${state}`);
    if (targetState) {
      targetState.classList.add('active');
      window.setCurrentState(state);
      console.log('✅ State switched to:', state);
    } else {
      console.error('❌ State element not found:', `.status-${state}`);
    }

    // Update state-specific icon
    window.updateStateIcon(state, data.phase);

    // Update state-specific data
    switch (state) {
      case window.UI_STATES.IDLE:
        window.updateIdleState(data);
        break;
      case window.UI_STATES.DOWNLOADING:
        window.updateDownloadingState(data);
        break;
      case window.UI_STATES.SUCCESS:
        window.updateSuccessState(data);
        break;
      case window.UI_STATES.ERROR:
        window.updateErrorState(data);
        break;
    }
  };

  window.updateIdleState = function(data = {}) {
    // Order count functionality removed - just show skeleton loading state
    window.showSkeletonLoading(false); // Ensure skeleton is hidden
    window.updateStateIcon(window.UI_STATES.IDLE);
  };

  window.updateDownloadingState = function(data = {}) {
    const isCollecting = data.total === null;
    let phase = 'downloading';

    if (isCollecting) {
      // COLLECTION PHASE
      phase = 'collecting';
      const progressText = document.querySelector('.progress-text');
      if (progressText) {
        progressText.innerHTML = `
          <span>Collecting orders...</span>
        `;
      }
      const currentFileSmall = document.querySelector('.current-file small');
      if (currentFileSmall) {
        currentFileSmall.innerHTML = `
          Found: <span id="currentCount">${data.current || 0}</span> invoices so far
        `;
      }
      const progressBar = document.getElementById('progressBar');
      if (progressBar) {
        progressBar.style.width = '0%';
      }
      const progressPercentage = document.getElementById('progressPercentage');
      if (progressPercentage) {
        progressPercentage.textContent = '0%';
      }
      const timeEstimate = document.getElementById('timeEstimate');
      if (timeEstimate) {
        timeEstimate.style.display = 'none';
      }

    } else {
      // DOWNLOAD PHASE
      phase = data.current === 0 ? 'preparing' : 'downloading';
      const percentage = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
      const progressText = document.querySelector('.progress-text');
      if (progressText) {
        progressText.innerHTML = `
          <span id="currentCount">${data.current || 0}</span> of
          <span id="totalCount">${data.total}</span> invoices • <span id="progressPercentage">${percentage}%</span>
        `;
      }
      const currentFileSmall = document.querySelector('.current-file small');
      if (currentFileSmall) {
        currentFileSmall.innerHTML = `
          Currently: <span id="currentFile">${data.currentFile || '--'}</span>
        `;
      }

      const progressBar = document.getElementById('progressBar');
      if (progressBar) {
        progressBar.style.width = percentage + '%';
      }

      // Show time estimate if we have enough data
      const timeRemaining = window.calculateTimeRemaining(data.current, data.total, window.downloadStartTime);
      const timeEstimateEl = document.getElementById('timeEstimate');
      const timeRemainingEl = document.getElementById('timeRemaining');

      if (timeEstimateEl && timeRemainingEl && timeRemaining && data.current > 1) {
        timeRemainingEl.textContent = timeRemaining;
        timeEstimateEl.style.display = 'block';
      } else if (timeEstimateEl) {
        timeEstimateEl.style.display = 'none';
      }
    }

    // Update the icon for the current phase
    window.updateStateIcon(window.UI_STATES.DOWNLOADING, phase);
  };

  window.updateSuccessState = function(data = {}) {
    // Set end time for calculating total duration
    window.setDownloadEndTime(Date.now());

    const successCount = data.successCount !== undefined ? data.successCount : window.currentDownloadCount;
    const failedCount = data.failedCount || window.failedDownloads.length;
    const totalTime = window.downloadStartTime && window.downloadEndTime ? window.downloadEndTime - window.downloadStartTime : 0;

    // Update summary card stats
    const successCountEl = document.getElementById('successCount');
    const failedCountEl = document.getElementById('failedCount');
    const totalTimeEl = document.getElementById('totalTime');

    if (successCountEl) successCountEl.textContent = successCount;
    if (failedCountEl) failedCountEl.textContent = failedCount;
    if (totalTimeEl) totalTimeEl.textContent = window.formatDuration(totalTime);

    window.updateStateIcon(window.UI_STATES.SUCCESS);

    // Trigger success animation on the summary icon
    const summaryIcon = document.querySelector('.summary-icon');
    if (summaryIcon) {
      summaryIcon.style.animation = 'none';
      setTimeout(() => {
        summaryIcon.style.animation = 'success-pulse 0.6s ease';
      }, 10);
    }
  };

  // Format duration in milliseconds to readable format
  window.formatDuration = function(ms) {
    const seconds = Math.round(ms / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  window.updateErrorState = function(data = {}) {
    const errorCountEl = document.getElementById('errorCount');
    if (errorCountEl && data.errorCount !== undefined) {
      errorCountEl.textContent = data.errorCount;
    }

    if (data.errors && data.errors.length > 0) {
      const errorList = document.getElementById('errorList');
      if (errorList) {
        errorList.innerHTML = data.errors.map(error =>
          `<div>• ${error}</div>`
        ).join('');
      }
    }

    // Enhanced error summary
    if (data.failedDownloads && data.failedDownloads.length > 0) {
      window.showErrorSummary(data.failedDownloads);
    }

    window.updateStateIcon(window.UI_STATES.ERROR);
  };

  // Enhanced error summary display
  window.showErrorSummary = function(failedItems) {
    const errorSummary = document.getElementById('errorSummary');
    const errorDetailsList = document.getElementById('errorDetailsList');

    if (errorDetailsList) {
      errorDetailsList.innerHTML = failedItems.map(item =>
        `<li>
          <span class="error-filename">${item.filename || 'Unknown file'}</span>
          <span class="error-reason">${item.error || 'Unknown error'}</span>
        </li>`
      ).join('');
    }

    if (errorSummary) {
      errorSummary.style.display = 'block';
    }
  };
})();