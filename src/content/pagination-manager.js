// ===== PAGINATION MANAGER CLASS =====
// Handles multi-page navigation and progress tracking

(function() {
  console.log('🔧 PAGINATION-MANAGER.JS LOADING...');

  // ===== PREVENT MULTIPLE INJECTIONS =====
  if (window.__amazonInvoiceExtensionLoaded) {
    console.log('🔧 PAGINATION-MANAGER.JS: Already loaded, skipping');
    return;
  }

class PaginationManager {
  constructor(config = {}) {
    this.config = {
      delayBetweenPages: config.delayBetweenPages || 1500, // Default 1.5s
      maxRetries: config.maxRetries || 1,
      showProgress: config.showProgress !== false
    };

    this.state = {
      currentPage: 1,
      totalPages: null,
      isRunning: false,
      collectedOrderIds: [], // Changed from collectedOrders to collectedOrderIds
      downloadItems: [], // ✅ Initialize downloadItems array
      cancelled: false
    };

    this.progressOverlay = null;

    // Set as current instance for global access
    window.PaginationManager.currentInstance = this;
  }

  // Detect pagination information from Amazon UI
  getPaginationInfo() {
    // Amazon FR pagination selectors
    const currentPageEl = document.querySelector('.a-pagination .a-selected');
    const paginationLinks = document.querySelectorAll('.a-pagination li:not(.a-disabled) a');

    let currentPage = 1;
    let totalPages = 1;

    if (currentPageEl) {
      currentPage = parseInt(currentPageEl.textContent.trim()) || 1;
    }

    // Find highest page number
    paginationLinks.forEach(link => {
      const pageNum = parseInt(link.textContent.trim());
      if (!isNaN(pageNum) && pageNum > totalPages) {
        totalPages = pageNum;
      }
    });

    console.log(`📄 Pagination: Page ${currentPage} of ${totalPages}`);

    return { currentPage, totalPages };
  }

  // Check if there's a next page available
  hasNextPage() {
    const nextButton = document.querySelector('.a-pagination .a-last:not(.a-disabled) a');
    return !!nextButton;
  }

  // Navigate to the next page (using Amazon's pagination buttons)
  async navigateToNextPage() {
    const currentPage = this.getCurrentPageFromURL();
    const nextPage = currentPage + 1;

    console.log(`📄 Navigating from page ${currentPage} to page ${nextPage}`);

    // Save state BEFORE clicking
    this.state.currentPage = nextPage;
    this.saveState();

    // Find next button
    const nextButton = this.findNextPageButton();

    // CRITICAL DIAGNOSTICS - ADD THESE:
    console.log('🔍 NAVIGATION DIAGNOSTIC:');
    console.log('  1. Next button found?', nextButton !== null);
    console.log('  2. Button element:', nextButton);
    console.log('  3. Button href:', nextButton?.href);
    console.log('  4. Current URL BEFORE click:', window.location.href);
    console.log('  5. Current startIndex BEFORE:', new URLSearchParams(window.location.search).get('startIndex'));

    const beforeUrl = window.location.href;

    if (!nextButton) {
      console.error('❌ Next page button not found!');
      console.log('🔍 Pagination HTML:', document.querySelector('.a-pagination')?.outerHTML);
      throw new Error('Cannot find next page button');
    }

    console.log('📄 Clicking next page button');
    console.log('🔗 Button href:', nextButton.href);

    // Click the button
    nextButton.click();

    // ADD THIS - Check if click did anything:
    setTimeout(() => {
      console.log('⏰ 500ms after click:');
      console.log('  6. Current URL AFTER click:', window.location.href);
      console.log('  7. Current startIndex AFTER:', new URLSearchParams(window.location.search).get('startIndex'));
      console.log('  8. Did URL change?', window.location.href !== beforeUrl);
    }, 500);

    // This should cause page reload - code after shouldn't run!
    console.log('⚠️ If you see this, page did NOT reload!');
  }

  // Find Amazon's next page button
  findNextPageButton() {
    // Try multiple selectors in case Amazon's structure varies
    const selectors = [
      '.a-pagination .a-last:not(.a-disabled) a',  // Primary
      'li.a-last:not(.a-disabled) a',               // Variant
      '.a-pagination li:last-child:not(.a-disabled) a', // Fallback
      'a[aria-label="Next"]',                        // Accessibility
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.href) {
        console.log(`✅ Found next button with selector: ${selector}`);
        return button;
      }
    }

    return null;
  }

  // Add this near other URL parsing functions
  getCurrentPageFromURL() {
    const url = new URL(window.location.href);
    const startIndex = url.searchParams.get('startIndex');

    if (!startIndex) {
      return 1; // No startIndex = page 1
    }

    // Amazon uses startIndex=0 for page 1, startIndex=10 for page 2, etc.
    // Page number = (startIndex / 10) + 1
    const pageNum = Math.floor(parseInt(startIndex) / 10) + 1;

    console.log('🔍 Parsed current page:', pageNum, 'from startIndex:', startIndex);
    return pageNum;
  }

  // Build URL for a specific page number
  buildPaginationURL(pageNum) {
    const url = new URL(window.location.href);

    if (pageNum === 1) {
      // Page 1 has no startIndex parameter
      url.searchParams.delete('startIndex');
    } else {
      // Page 2+ uses startIndex = (pageNum - 1) * 10
      const startIndex = (pageNum - 1) * 10;
      url.searchParams.set('startIndex', startIndex.toString());
    }

    return url.toString();
  }

  // Wait for the new page to load
  async waitForPageLoad(timeout = 5000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        // Check if orders are visible on the page
        const orders = document.querySelectorAll('.order-card, .order, [data-order-id]');

        if (orders.length > 0) {
          clearInterval(checkInterval);
          console.log(`✅ Page loaded with ${orders.length} orders`);
          resolve(true);
          return;
        }

        // Timeout check
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          console.warn('⚠️ Page load timeout');
          resolve(false); // Don't reject, just resolve with false
        }
      }, 200);
    });
  }

  showProgressOverlay(currentPage, totalPages, itemCount, timeRemaining = '') {

  console.log('🔄 Updating overlay: Page ' + currentPage + '/' + totalPages + ', Invoices: ' + itemCount);



  // Remove existing overlay if present

  const existingOverlay = document.getElementById('amazon-invoice-overlay');

  if (existingOverlay) {

    existingOverlay.remove();

  }



  // Create modern overlay

  const overlay = document.createElement('div');

  overlay.id = 'amazon-invoice-overlay';

  overlay.style.cssText = `

    position: fixed;

    top: 50%;

    left: 50%;

    transform: translate(-50%, -50%) scale(0.9);

    width: 450px;

    max-width: 90vw;

    background: linear-gradient(135deg,

      rgba(255, 255, 255, 0.95) 0%,

      rgba(249, 250, 251, 0.95) 100%);

    backdrop-filter: blur(20px);

    border-radius: 24px;

    padding: 40px;

    box-shadow:

      0 20px 60px rgba(0, 0, 0, 0.15),

      0 0 0 1px rgba(255, 255, 255, 0.5) inset;

    z-index: 999999;

    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

    animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;

  `;



  // Calculate progress percentage

  const progressPercent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;



  overlay.innerHTML = `

    <style>

      @keyframes slideIn {

        from {

          opacity: 0;

          transform: translate(-50%, -50%) scale(0.9);

        }

        to {

          opacity: 1;

          transform: translate(-50%, -50%) scale(1);

        }

      }



      @keyframes shimmer {

        0% { background-position: -200% center; }

        100% { background-position: 200% center; }

      }



      @keyframes pulse {

        0%, 100% { transform: scale(1); opacity: 1; }

        50% { transform: scale(1.05); opacity: 0.8; }

      }



      #amazon-invoice-overlay .header-icon {

        width: 56px;

        height: 56px;

        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

        border-radius: 16px;

        display: flex;

        align-items: center;

        justify-content: center;

        font-size: 28px;

        margin: 0 auto 24px;

        box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);

        animation: pulse 2s ease-in-out infinite;

      }



      #amazon-invoice-overlay h2 {

        margin: 0 0 8px 0;

        font-size: 24px;

        font-weight: 700;

        color: #1a202c;

        text-align: center;

        letter-spacing: -0.5px;

      }



      #amazon-invoice-overlay .subtitle {

        margin: 0 0 32px 0;

        font-size: 15px;

        color: #64748b;

        text-align: center;

        font-weight: 500;

      }



      #amazon-invoice-overlay .stats {

        display: grid;

        grid-template-columns: repeat(2, 1fr);

        gap: 16px;

        margin-bottom: 24px;

      }



      #amazon-invoice-overlay .stat {

        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);

        padding: 16px;

        border-radius: 12px;

        text-align: center;

        border: 1px solid rgba(226, 232, 240, 0.8);

      }



      #amazon-invoice-overlay .stat-label {

        font-size: 12px;

        color: #64748b;

        font-weight: 600;

        text-transform: uppercase;

        letter-spacing: 0.5px;

        margin-bottom: 4px;

      }



      #amazon-invoice-overlay .stat-value {

        font-size: 24px;

        font-weight: 700;

        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

        -webkit-background-clip: text;

        -webkit-text-fill-color: transparent;

        background-clip: text;

      }



      #amazon-invoice-overlay .progress-container {

        margin-bottom: 20px;

      }



      #amazon-invoice-overlay .progress-bar-bg {

        width: 100%;

        height: 12px;

        background: #e2e8f0;

        border-radius: 999px;

        overflow: hidden;

        position: relative;

      }



      #amazon-invoice-overlay .progress-bar-fill {

        height: 100%;

        background: linear-gradient(90deg,

          #667eea 0%,

          #764ba2 50%,

          #667eea 100%);

        background-size: 200% 100%;

        border-radius: 999px;

        transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);

        animation: shimmer 2s linear infinite;

        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);

      }



      #amazon-invoice-overlay .progress-text {

        display: flex;

        justify-content: space-between;

        align-items: center;

        margin-top: 12px;

        font-size: 13px;

        color: #64748b;

        font-weight: 500;

      }



      #amazon-invoice-overlay .time-remaining {

        display: flex;

        align-items: center;

        gap: 6px;

        color: #667eea;

        font-weight: 600;

      }



      #amazon-invoice-overlay .cancel-btn {

        width: 100%;

        padding: 14px;

        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);

        color: white;

        border: none;

        border-radius: 12px;

        font-size: 15px;

        font-weight: 600;

        cursor: pointer;

        transition: all 0.2s ease;

        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);

        margin-top: 8px;

      }



      #amazon-invoice-overlay .cancel-btn:hover {

        transform: translateY(-2px);

        box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);

      }



      #amazon-invoice-overlay .cancel-btn:active {

        transform: translateY(0);

      }

    </style>



    <div class="header-icon">📄</div>



    <h2>Collecting Invoices</h2>

    <div class="subtitle">Please wait while we gather your invoices...</div>



    <div class="stats">

      <div class="stat">

        <div class="stat-label">Progress</div>

        <div class="stat-value">${currentPage}/${totalPages}</div>

      </div>

      <div class="stat">

        <div class="stat-label">Found</div>

        <div class="stat-value">${itemCount}</div>

      </div>

    </div>



    <div class="progress-container">

      <div class="progress-bar-bg">

        <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>

      </div>

      <div class="progress-text">

        <span>${progressPercent}% Complete</span>

        ${timeRemaining ? `<span class="time-remaining">⏱️ ${timeRemaining}</span>` : ''}

      </div>

    </div>



    <button class="cancel-btn" onclick="this.closest('#amazon-invoice-overlay').remove(); location.reload();">

      Cancel Collection

    </button>

  `;



  document.body.appendChild(overlay);



  console.log('✅ Updated page progress: Page ' + currentPage + ' of ' + totalPages);

  console.log('✅ Updated invoice count: ' + itemCount);

}

  // Show loading state during transitions
  showLoadingState(message = 'Loading next page...') {
    if (!this.progressOverlay) return;

    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingText = document.getElementById('loading-text');

    if (loadingIndicator && loadingText) {
      loadingText.textContent = message;
      loadingIndicator.style.display = 'flex';
    }
  }

  // Hide loading state
  hideLoadingState() {
    if (!this.progressOverlay) return;

    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }

  // Show status message
  showStatusMessage(message, icon = '💡') {
    if (!this.progressOverlay) return;

    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
      statusMessage.innerHTML = `<strong>${icon}</strong> ${message}`;
      statusMessage.style.display = 'block';
    }
  }

  // Hide status message
  hideStatusMessage() {
    if (!this.progressOverlay) return;

    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
      statusMessage.style.display = 'none';
    }
  }

  // Smooth fade out before navigation
  async fadeOutOverlay() {
    if (!this.progressOverlay) return;

    return new Promise(resolve => {
      this.progressOverlay.classList.add('fade-out');
      setTimeout(resolve, 300);
    });
  }

  // Update header with current state
  updateHeader(icon, text) {
    if (!this.progressOverlay) return;

    const headerIcon = document.getElementById('header-icon');
    const headerText = document.getElementById('header-text');

    if (headerIcon) headerIcon.textContent = icon;
    if (headerText) headerText.textContent = text;
  }

  // Hide progress overlay
  hideProgressOverlay() {
    if (this.progressOverlay) {
      this.progressOverlay.remove();
      this.progressOverlay = null;
    }
  }

  // Cancel the pagination process
  cancel() {
    console.log('🛑 Pagination cancelled by user');
    this.state.cancelled = true;
    this.hideProgressOverlay();
  }

  // Stop the download queue
  stopDownloads() {
    console.log('🛑 Downloads stopped by user');

    // Hide loading state immediately
    this.hideLoadingState();

    // If there's a global download queue, stop it
    if (typeof window.downloadQueue !== 'undefined' && window.downloadQueue) {
      window.downloadQueue.stop();
    }

    // Show completion message
    this.showStatusMessage('Downloads stopped by user', '🛑');
  }

  // Show the stop downloads button (during download phase)
  showStopButton() {
    const stopBtn = document.getElementById('stop-download-btn');
    if (stopBtn) {
      stopBtn.style.display = 'block';
    }
  }

  // Hide the stop downloads button
  hideStopButton() {
    const stopBtn = document.getElementById('stop-download-btn');
    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
  }

  // Save state before page navigation
  async saveState() {
    // 🔍 CRITICAL DEBUGGING: Verify the array reference before saving
    console.log('🔗 VERIFY: this is PaginationManager?', this.constructor?.name === 'PaginationManager');
    console.log('🔗 VERIFY: this.state exists?', !!this.state);
    console.log('🔗 VERIFY: this.state.downloadItems exists?', !!this.state.downloadItems);
    console.log('🔗 VERIFY: Array length:', this.state.downloadItems?.length || 0);
    console.log('🔗 VERIFY: Array object ID:', this.state.downloadItems?.__debug_id__ || 'UNDEFINED');

    // Validate arrays before saving
    if (!Array.isArray(this.state.downloadItems)) {
      console.error('🔴 CRITICAL: downloadItems is not an array before save!', typeof this.state.downloadItems);
      this.state.downloadItems = [];
    }
    if (!Array.isArray(this.state.collectedOrderIds)) {
      console.error('🔴 CRITICAL: collectedOrderIds is not an array before save!', typeof this.state.collectedOrderIds);
      this.state.collectedOrderIds = [];
    }

    const state = {
      currentPage: this.state.currentPage,
      totalPages: this.state.totalPages,
      collectedOrderIds: this.state.collectedOrderIds, // Now directly using collectedOrderIds array
      downloadItems: this.state.downloadItems, // CRITICAL: Use the ACTUAL array, don't create new one
      startDate: this.state.startDate,
      endDate: this.state.endDate,
      dateRangeType: this.state.dateRangeType,
      accountType: this.state.accountType,
      isComplete: this.state.isComplete,     // ← ADD THIS - was missing!
      isRunning: this.state.isRunning,       // ← CHANGE THIS - use actual state instead of hardcoded true
      timestamp: Date.now()
    };

    // 🔍 CRITICAL DEBUGGING: Verify the state object has the same array
    console.log('🔗 VERIFY: state.downloadItems is same reference?', state.downloadItems === this.state.downloadItems);
    console.log('🔗 VERIFY: state.downloadItems object ID:', state.downloadItems?.__debug_id__ || 'UNDEFINED');

    console.log('💾 Saving pagination state:', {
      ...state,
      downloadItems: `${state.downloadItems.length} items`,
      collectedOrderIds: `${state.collectedOrderIds.length} IDs`
    });
    console.log(`🔗 DOWNLOADITEMS DEBUG: Saving ${state.downloadItems.length} download items`);
    console.log(`🔗 DOWNLOADITEMS DEBUG: Array object ID being saved:`, this.state.downloadItems?.__debug_id__ || 'UNDEFINED');

    return new Promise((resolve) => {
      chrome.storage.local.set({ paginationState: state }, () => {
        console.log('💾 Successfully saved pagination state to chrome.storage.local');
        console.log(`🔗 DOWNLOADITEMS DEBUG: Confirmed ${state.downloadItems.length} items saved to storage`);
        resolve();
      });
    });
  }

  // Load state after page reload (static method)
  static async loadState() {
    return new Promise((resolve) => {
      chrome.storage.local.get('paginationState', (data) => {
        const state = data.paginationState || null;

        // CRITICAL: Ensure downloadItems is always an array, never null/undefined
        if (state && (!Array.isArray(state.downloadItems))) {
          console.warn('🔴 CRITICAL: Restored downloadItems was not an array, initializing as empty array');
          state.downloadItems = [];
        }

        // Ensure collectedOrderIds is always an array
        if (state && (!Array.isArray(state.collectedOrderIds))) {
          console.warn('🔴 CRITICAL: Restored collectedOrderIds was not an array, initializing as empty array');
          state.collectedOrderIds = [];
        }

        console.log('🔄 Loaded pagination state from storage:', {
          ...state,
          downloadItems: state ? `${state.downloadItems?.length || 0} items` : 'null',
          collectedOrderIds: state ? `${state.collectedOrderIds?.length || 0} IDs` : 'null'
        });
        console.log(`🔗 DOWNLOADITEMS DEBUG: Loaded ${state?.downloadItems?.length || 0} download items from storage`);
        resolve(state);
      });
    });
  }

  // Clear state when done (static method)
  static async clearState() {
    return new Promise((resolve) => {
      chrome.storage.local.remove('paginationState', resolve);
    });
  }

  // Show detailed progress overlay with comprehensive stats
  showDetailedProgressOverlay(stats) {
    if (!this.config.showProgress) return;

    // Create overlay if it doesn't exist
    if (!this.progressOverlay) {
      this.progressOverlay = document.createElement('div');
      this.progressOverlay.id = 'download-progress-overlay';
      document.body.appendChild(this.progressOverlay);
    }

    // Default stats
    const defaultStats = {
      phase: 'Initializing...',
      currentPage: stats.currentPage || 1,
      totalPages: stats.totalPages || 1,
      ordersCollected: stats.ordersCollected || 0,
      downloaded: stats.downloaded || 0,
      total: stats.total || '--',
      progress: stats.progress || 0,
      estimatedTime: stats.estimatedTime || null
    };

    const s = { ...defaultStats, ...stats };

    this.progressOverlay.innerHTML = `
      <div style="position: fixed; top: 20px; right: 20px;
                  background: white; padding: 24px; border-radius: 12px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                  z-index: 10001; min-width: 300px;">

        <h3 style="margin: 0 0 16px 0; color: #232f3e; font-size: 18px;">
          📥 Downloading Invoices
        </h3>

        <!-- Phase Indicator -->
        <div style="margin-bottom: 12px; color: #565959;">
          <strong>Status:</strong> ${s.phase}
        </div>

        <!-- Page Progress -->
        <div style="margin-bottom: 12px; color: #565959;">
          <strong>Page:</strong> ${s.currentPage} of ${s.totalPages}
        </div>

        <!-- Orders Collected -->
        <div style="margin-bottom: 12px; color: #565959;">
          <strong>Orders Found:</strong> ${s.ordersCollected}
        </div>

        <!-- Download Progress -->
        <div style="margin-bottom: 16px; color: #565959;">
          <strong>Downloaded:</strong> ${s.downloaded} of ${s.total}
        </div>

        <!-- Progress Bar -->
        <div style="background: #e7e7e7; height: 8px; border-radius: 4px; overflow: hidden;">
          <div style="background: #ff9900; height: 100%; width: ${s.progress}%; transition: width 0.3s;"></div>
        </div>

        <!-- Estimated Time -->
        ${s.estimatedTime ? `
          <div style="margin-top: 12px; color: #888; font-size: 12px;">
            Est. time remaining: ${s.estimatedTime}
          </div>
        ` : ''}

        <!-- Cancel Button -->
        <button id="cancel-download" style="
          margin-top: 16px; width: 100%;
          background: #d5d9d9; color: #0f1111;
          border: none; padding: 10px; border-radius: 8px;
          font-size: 14px; cursor: pointer;">
          Cancel Download
        </button>
      </div>
    `;

    // Add cancel handler
    document.getElementById('cancel-download').onclick = () => {
      if (confirm('Cancel download? Progress will be lost.')) {
        this.cancel();
      }
    };
  }

  // Update progress with detailed stats
  updateProgress(stats) {
    this.showDetailedProgressOverlay(stats);
  }

  // Utility: delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export to global scope
window.PaginationManager = PaginationManager;
window.PaginationManager.currentInstance = null;

console.log('✅ PAGINATION-MANAGER.JS LOADED - PaginationManager available:', typeof window.PaginationManager);

})();
