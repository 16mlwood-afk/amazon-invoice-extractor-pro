/**
 * Navigation Manager Module
 * Handles page navigation, date filtering, and pagination logic
 */

class NavigationManager {
  /**
   * Navigate to page one by modifying the URL
   */
  navigateToPageOne() {
    console.log('🔄 Navigating to page 1...');

    // Get current URL
    const currentUrl = window.location.href;
    console.log('📍 Current URL:', currentUrl);

    // Replace startIndex parameter with 0
    const pageOneUrl = currentUrl.replace(
      /startIndex=\d+/,
      'startIndex=0'
    );

    console.log('🎯 Target URL:', pageOneUrl);

    // Also handle case where startIndex might not exist
    if (currentUrl.includes('startIndex=')) {
      console.log('✅ Found existing startIndex parameter, replacing...');
      window.location.href = pageOneUrl;
    } else {
      // No startIndex in URL - already on page 1 or different URL structure
      console.log('⚠️ No startIndex in URL, adding it...');
      const separator = currentUrl.includes('?') ? '&' : '?';
      const finalUrl = currentUrl + separator + 'startIndex=0';
      console.log('🎯 Final URL:', finalUrl);
      window.location.href = finalUrl;
    }

    console.log('🚀 Navigation initiated...');
  }

  /**
   * Ensure Amazon's date filter covers the requested date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {string} accountType - Account type
   * @param {string} dateRangeType - Date range type
   * @returns {boolean} true if filter was adjusted (page will reload), false if already correct
   */
  async ensureDateFilterCoversRange(startDate, endDate, accountType, dateRangeType) {
    console.log('🔍 Checking if Amazon date filter covers search range...');
    console.log('  Search range:', startDate, 'to', endDate);

    // Find the date filter dropdown
    const dateFilterSelectors = [
      '#timePeriodForm select',
      'select[name="timeFilter"]',
      'select[name="orderFilter"]',
      '#orderFilter'
    ];

    let dateFilterSelect = null;
    for (const selector of dateFilterSelectors) {
      dateFilterSelect = document.querySelector(selector);
      if (dateFilterSelect) {
        console.log('  Found date filter:', selector);
        break;
      }
    }

    if (!dateFilterSelect) {
      console.log('  ⚠️ Could not find date filter dropdown - continuing anyway');
      return false;
    }

    // Get current filter value
    const currentFilter = dateFilterSelect.value;
    console.log('  Current filter value:', currentFilter);

    // Parse search dates
    const searchStart = new Date(startDate);
    const searchEnd = new Date(endDate);
    const searchStartYear = searchStart.getFullYear();
    const searchEndYear = searchEnd.getFullYear();

    // Determine if we need to change the filter
    let needsChange = false;
    let targetFilter = null;

    // Check if search range spans multiple years
    if (searchStartYear !== searchEndYear) {
      // Need "All orders" or specific years
      const allOrdersOption = Array.from(dateFilterSelect.options).find(
        opt => opt.value === 'all' || opt.text.toLowerCase().includes('all')
      );

      if (allOrdersOption) {
        targetFilter = allOrdersOption.value;
        needsChange = currentFilter !== targetFilter;
      }
    } else {
      // Single year search
      const currentYear = new Date().getFullYear();

      if (searchStartYear !== currentYear) {
        // Need to select specific year
        const yearOption = Array.from(dateFilterSelect.options).find(
          opt => opt.value === String(searchStartYear) || opt.text.includes(String(searchStartYear))
        );

        if (yearOption) {
          targetFilter = yearOption.value;
          needsChange = currentFilter !== targetFilter;
        }
      } else {
        // Current year - check if "past three months" covers it
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        if (searchStart < threeMonthsAgo) {
          // Need to select full year
          const yearOption = Array.from(dateFilterSelect.options).find(
            opt => opt.value === String(currentYear) || opt.text.includes(String(currentYear))
          );

          if (yearOption) {
            targetFilter = yearOption.value;
            needsChange = currentFilter !== targetFilter;
          }
        }
      }
    }

    // Apply change if needed
    if (needsChange && targetFilter) {
      console.log('  🔄 Changing filter from', currentFilter, 'to', targetFilter);

      // Show notification to user
      if (typeof notifyInfo === 'function') {
        notifyInfo(`Adjusting date filter to include ${startDate} - ${endDate}...`);
      }

      // Change the filter
      dateFilterSelect.value = targetFilter;

      // Trigger change event
      const changeEvent = new Event('change', { bubbles: true });
      dateFilterSelect.dispatchEvent(changeEvent);

      // Amazon will reload the page, so save state to resume after reload
      await chrome.storage.local.set({
        pendingDownload: {
          startDate: startDate,
          endDate: endDate,
          accountType: accountType,
          dateRangeType: dateRangeType,
          shouldAutoStart: true,
          timestamp: Date.now(),
          reason: 'date_filter_adjusted'
        }
      });

      console.log('  ⏳ Page will reload with new date filter...');
      return true; // Indicate that page will reload
    }

    console.log('  ✅ Date filter is already appropriate');
    return false; // No change needed
  }

  /**
   * Show navigation prompt to user
   * @param {Object} options - Navigation options
   */
  showNavigationPrompt(options) {
    const {
      message = 'Please navigate to your Amazon order history page to continue.',
      title = 'Navigation Required',
      showCancelButton = true,
      cancelText = 'Cancel Download',
      confirmText = 'I\'m Ready - Start Download'
    } = options;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      max-width: 500px;
      text-align: center;
    `;

    modal.innerHTML = `
      <h2 style="color: #232F3E; margin-bottom: 20px;">${title}</h2>
      <p style="color: #555; margin-bottom: 30px; line-height: 1.5;">${message}</p>
      <div style="display: flex; gap: 15px; justify-content: center;">
        ${showCancelButton ? `<button id="cancelBtn" style="padding: 10px 20px; background: #ddd; border: none; border-radius: 5px; cursor: pointer;">${cancelText}</button>` : ''}
        <button id="confirmBtn" style="padding: 10px 20px; background: #FF9900; color: white; border: none; border-radius: 5px; cursor: pointer;">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    return new Promise((resolve) => {
      const confirmBtn = modal.querySelector('#confirmBtn');
      const cancelBtn = modal.querySelector('#cancelBtn');

      confirmBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve(true);
      };

      if (cancelBtn) {
        cancelBtn.onclick = () => {
          document.body.removeChild(overlay);
          resolve(false);
        };
      }

      // Allow ESC key to cancel
      document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
          document.body.removeChild(overlay);
          resolve(false);
          document.removeEventListener('keydown', escHandler);
        }
      });
    });
  }
}

// Export for use in content scripts
// Class exported for instantiation in background script

// Class exported for instantiation in appropriate contexts

// Instantiate NavigationManager and make it globally available
window.navigationManager = new NavigationManager();