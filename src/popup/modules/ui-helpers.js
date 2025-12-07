// ============================================
// UI HELPER FUNCTIONS
// ============================================

(function() {
  /**
   * Update progress UI
   */
  window.updateProgressUI = function(current, total, successful, failed) {
    console.log('📊 Updating progress:', { current, total, successful, failed });

    // Validate numbers
    if (typeof current !== 'number' || typeof total !== 'number') {
      console.error('❌ Invalid progress numbers:', { current, total });
      return;
    }

    // Calculate percentage
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    // Update progress bar width
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }

    // Update current count
    const currentCount = document.getElementById('currentCount');
    if (currentCount) {
      currentCount.textContent = current;
    }

    // Update total count
    const totalCount = document.getElementById('totalCount');
    if (totalCount) {
      totalCount.textContent = total;
    }

    // Update percentage text
    const progressPercentage = document.getElementById('progressPercentage');
    if (progressPercentage) {
      progressPercentage.textContent = `${percentage}%`;
    }

    console.log(`✅ UI updated: ${current}/${total} (${percentage}%)`);
  };

  /**
   * Show completion UI
   */
  window.showCompletionUI = function(successful, failed, total) {
    console.log('🎉 Showing completion:', { successful, failed, total });

    // Update success state with results
    window.setUIState(window.UI_STATES.SUCCESS, {
      successCount: successful,
      failedCount: failed
    });

    // Show toast message
    if (failed === 0 && successful === 0) {
      window.showToast('⚠️ No invoices found in selected date range', 'warning');
      window.setUIState(window.UI_STATES.IDLE);
    } else if (failed === 0) {
      window.showToast(`✅ Successfully downloaded ${successful} invoices!`, 'success');
    } else if (successful === 0) {
      window.showToast(`❌ All ${failed} downloads failed`, 'error');
      window.setUIState(window.UI_STATES.ERROR, {
        errorCount: failed,
        errors: [`${failed} download(s) failed`]
      });
    } else {
      window.showToast(`⚠️ ${successful} succeeded, ${failed} failed`, 'warning');
    }

    // Re-enable button
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Download Invoices';
    }
  };

  /**
   * Show toast message
   */
  window.showToast = function(message, type = 'info') {
    console.log('📢 Toast:', message, type);

    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      const toastDiv = document.createElement('div');
      toastDiv.className = `status-message status-${type}`;
      toastDiv.textContent = message;
      toastDiv.style.cssText = `
        padding: 12px 16px;
        margin: 8px 0;
        border-radius: 6px;
        font-size: 14px;
        animation: slideIn 0.3s ease;
      `;

      // Color based on type
      if (type === 'success') {
        toastDiv.style.background = '#d4edda';
        toastDiv.style.color = '#155724';
        toastDiv.style.border = '1px solid #c3e6cb';
      } else if (type === 'error') {
        toastDiv.style.background = '#f8d7da';
        toastDiv.style.color = '#721c24';
        toastDiv.style.border = '1px solid #f5c6cb';
      } else if (type === 'warning') {
        toastDiv.style.background = '#fff3cd';
        toastDiv.style.color = '#856404';
        toastDiv.style.border = '1px solid #ffeaa7';
      } else {
        toastDiv.style.background = '#d1ecf1';
        toastDiv.style.color = '#0c5460';
        toastDiv.style.border = '1px solid #bee5eb';
      }

      statusDiv.appendChild(toastDiv);

      setTimeout(() => {
        toastDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
          if (toastDiv.parentNode) {
            toastDiv.parentNode.removeChild(toastDiv);
          }
        }, 300);
      }, 5000);
    }
  };

  /**
   * Show skeleton loading
   */
  window.showSkeletonLoading = function(show) {
    const orderCountText = document.getElementById('orderCountText');
    const loadingSkeleton = document.getElementById('loadingSkeleton');

    if (orderCountText) {
      orderCountText.style.display = show ? 'none' : 'block';
    }
    if (loadingSkeleton) {
      loadingSkeleton.style.display = show ? 'block' : 'none';
    }
  };

  /**
   * Show status message
   */
  window.showStatus = function(message, type = 'info') {
    window.showToast(message, type);
  };
})();