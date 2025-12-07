/**
 * Download Coordinator Module
 * Handles the main download process coordination and state management
 */

class DownloadCoordinator {
  constructor() {
    this.pendingDownload = null;
  }

  /**
   * Start the main download process
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {string} accountType - Account type ('business' or 'nonbusiness')
   * @param {string} dateRangeType - Date range type
   */
  async startDownloadProcess(startDate, endDate, accountType, dateRangeType) {
    console.log('📥 Download requested');
    console.log('  Start date:', startDate);
    console.log('  End date:', endDate);
    console.log('  Account type:', accountType);
    console.log('  Date range type:', dateRangeType);

    // Normalize dates immediately to avoid timezone issues
    const normalizedStartDate = this.normalizeDate(new Date(startDate));
    const normalizedEndDate = this.normalizeDate(new Date(endDate));

    console.log('🚀 ACTUAL DOWNLOAD STARTING with PAGINATION!');
    console.log('  Account:', accountType);
    console.log('  Dates (original):', startDate, 'to', endDate);
    console.log('  Dates (normalized):', normalizedStartDate.toISOString(), 'to', normalizedEndDate.toISOString());

    // Set pendingDownload for immediate access
    this.pendingDownload = {
      startDate: normalizedStartDate.toISOString().split('T')[0], // YYYY-MM-DD format
      endDate: normalizedEndDate.toISOString().split('T')[0],
      accountType: accountType,
      dateRangeType: dateRangeType
    };

    console.log('✅ pendingDownload SET TO:', JSON.stringify(this.pendingDownload, null, 2));
    console.log('   Has startDate?:', !!this.pendingDownload.startDate);
    console.log('   Has endDate?:', !!this.pendingDownload.endDate);
    console.log('   Has dateRangeType?:', !!this.pendingDownload.dateRangeType);

    // Use normalized dates from here on
    startDate = normalizedStartDate.toISOString().split('T')[0]; // Back to YYYY-MM-DD
    endDate = normalizedEndDate.toISOString().split('T')[0];

    try {
      // PHASE 0: Create pagination manager early for page checking
      const pm = await this.getPaginationManager();

      // Check if we're on page 1 - if not, navigate there first
      const currentPageNum = pm.getCurrentPageFromURL();
      console.log('  Current page:', currentPageNum);
      console.log('  Current URL:', window.location.href);

      if (currentPageNum !== 1) {
        console.log('⚠️ NOT on page 1, will navigate there first...');
        console.log(`⚠️ Currently on page ${currentPageNum}, need to start from page 1`);

        // Save pendingDownload state before navigation
        console.log('💾 Saving download state before navigation...');

        try {
          await chrome.storage.local.set({
            pendingDownload: {
              ...this.pendingDownload,
              shouldAutoStart: true,
              timestamp: Date.now(),
              attempts: 0,
              reason: 'page_navigation_to_page_1'
            }
          });

          // Verify it was saved
          const verify = await chrome.storage.local.get('pendingDownload');
          if (!verify.pendingDownload) {
            throw new Error('Failed to save pending download state');
          }

          console.log('✅ State saved and verified, navigating...');
        } catch (error) {
          console.error('❌ Failed to save pending download state:', error);
          if (typeof notifyError === 'function') {
            notifyError('Failed to save download state. Please try again.');
          }
          return;
        }

        // Show navigation notification
        this.showNavigationNotification('🔄 Navigating to Page 1', 'Starting collection from the beginning...');

        // Navigate to page 1
        setTimeout(() => {
          window.location.href = this.getPageOneUrl();
        }, 2000);

        return;
      }

      // PHASE 1: Ensure date filter covers our search range
      const dateFilterAdjusted = await this.ensureDateFilterCoversRange(startDate, endDate, accountType, dateRangeType);

      if (dateFilterAdjusted) {
        console.log('⏳ Date filter adjusted - page will reload, download will resume automatically');
        return; // Exit - page will reload and resume
      }

      // PHASE 2: Start actual pagination and collection
      console.log('📄 PHASE 2: Starting pagination and collection...');

      await this.startPaginationProcess(startDate, endDate, accountType, dateRangeType);

    } catch (error) {
      console.error('❌ Download process failed:', error);
      if (typeof notifyError === 'function') {
        notifyError(`Download failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Normalize date to avoid timezone issues
   * @param {Date} date - Date to normalize
   * @returns {Date} Normalized date
   */
  normalizeDate(date) {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    // Set to noon to avoid timezone boundary issues
    date.setHours(12, 0, 0, 0);
    return date;
  }

  /**
   * Get pagination manager instance
   * @returns {Promise<Object>} Pagination manager
   */
  async getPaginationManager() {
    // This would need to be imported or accessed from the global scope
    if (typeof getPaginationManager === 'function') {
      return await getPaginationManager();
    }
    throw new Error('PaginationManager not available');
  }

  /**
   * Ensure date filter covers the search range
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {string} accountType - Account type
   * @param {string} dateRangeType - Date range type
   * @returns {Promise<boolean>} True if filter was adjusted
   */
  async ensureDateFilterCoversRange(startDate, endDate, accountType, dateRangeType) {
    // Delegate to NavigationManager
    if (typeof window.navigationManager !== 'undefined' && window.navigationManager.ensureDateFilterCoversRange) {
      return await window.navigationManager.ensureDateFilterCoversRange(startDate, endDate, accountType, dateRangeType);
    }
    console.warn('NavigationManager not available for date filter check');
    return false;
  }

  /**
   * Start the pagination process
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {string} accountType - Account type
   * @param {string} dateRangeType - Date range type
   */
  async startPaginationProcess(startDate, endDate, accountType, dateRangeType) {
    // This would delegate to the actual pagination logic
    console.log('Starting pagination process...');
    // Implementation would go here
  }

  /**
   * Get URL for page one
   * @returns {string} Page one URL
   */
  getPageOneUrl() {
    const currentUrl = window.location.href;
    const pageOneUrl = currentUrl.replace(/startIndex=\d+/, 'startIndex=0');

    if (currentUrl.includes('startIndex=')) {
      return pageOneUrl;
    } else {
      const separator = currentUrl.includes('?') ? '&' : '?';
      return currentUrl + separator + 'startIndex=0';
    }
  }

  /**
   * Show navigation notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   */
  showNavigationNotification(title, message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: Arial, sans-serif;
      text-align: center;
    `;
    notification.innerHTML = `
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
        ${title}
      </div>
      <div style="font-size: 14px; opacity: 0.9;">
        ${message}
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * Get current pending download state
   * @returns {Object|null} Pending download state
   */
  getPendingDownload() {
    return this.pendingDownload;
  }

  /**
   * Set pending download state
   * @param {Object} state - Download state
   */
  setPendingDownload(state) {
    this.pendingDownload = state;
  }
}

// Export for use in content scripts
const downloadCoordinator = new DownloadCoordinator();