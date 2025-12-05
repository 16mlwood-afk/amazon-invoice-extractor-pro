// ===== CONTENT-MAIN.JS =====
// Main entry point and initialization for Amazon Invoice Extractor

(async function() {
  // ===== PREVENT MULTIPLE INJECTIONS =====

  if (window.__amazonInvoiceExtensionLoaded) {
    console.log('⚠️ Content script already loaded, aborting re-injection');
    // Silently exit instead of throwing to avoid console noise
    return;
  }

  // Set flag immediately to prevent other scripts from loading
  window.__amazonInvoiceExtensionLoaded = true;

// ===== AMAZON SCRIPT COMPATIBILITY FIX =====
// Handle Amazon's broken require() usage in browser environment
// Define require immediately to prevent Amazon script errors
if (typeof window.require === 'undefined') {
  window.require = function(module) {
    console.warn('⚠️ Amazon script tried to require:', module, '- returning empty object');
    return {};
  };
  console.log('🛠️ Installed compatibility require() function for Amazon scripts');
}

// ===== GLOBAL ERROR HANDLER FOR AMAZON COMPATIBILITY =====
(function() {
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    console.log('🔍 Error caught:', {message, source, lineno, colno, error: error?.message});

    // Suppress the specific Amazon require() error
    if (message && typeof message === 'string' && message.includes('require is not defined') &&
        source && typeof source === 'string' && source.includes('CPSContextJSBuzzWrapper')) {
      console.warn('🛡️ Suppressed Amazon CPSContextJSBuzzWrapper require() error');
      return true; // Prevent default error handling
    }

    // Call original error handler if it exists
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }

    return false;
  };
  console.log('🛡️ Installed global error handler for Amazon compatibility');
})();

// ===== DELAYED INITIALIZATION =====
// Add a small delay to avoid conflicts with Amazon's script loading
setTimeout(() => {
  initializeContentScript();
}, 500);

async function initializeContentScript() {

console.log('🚀 ===== AMAZON INVOICE EXTRACTOR CONTENT SCRIPT LOADING =====');
console.log('  URL:', window.location.href);
console.log('  Timestamp:', Date.now());
console.log('  User Agent:', navigator.userAgent);
console.log('🚀 ===== END CONTENT SCRIPT HEADER =====');

// ===== GLOBAL VARIABLES =====
let pendingDownload = null;  // Store pending download state for background communication

// Diagnostic: Check if require is defined (expected from Amazon scripts)
if (typeof require !== 'undefined') {
  console.log('ℹ️ require is defined (likely by Amazon scripts):', typeof require);
  console.log('ℹ️ require location:', require.toString().substring(0, 100) + '...');
} else {
  console.log('✅ No require function detected');
}

// ===== NOTIFICATION FUNCTIONS =====
// Notification functions are now defined in helpers.js and available globally

// ===== DATE NORMALIZATION =====
// Note: normalizeDate and isValidDate are now in helpers.js and available globally

// ===== NAVIGATION HELPERS =====

/**
 * Unified resume handler that prioritizes operations and prevents conflicts
 */
async function handlePageResume() {
  console.log('🔍 Checking for any pending operations...');

  // Priority 1: Check for pending download (navigation-based resume)
  console.log('🔍 Checking for pendingDownload state...');
  const pendingResult = await chrome.storage.local.get('pendingDownload');
  console.log('📊 Pending download result:', pendingResult);

  if (pendingResult.pendingDownload?.shouldAutoStart) {
    const age = Date.now() - pendingResult.pendingDownload.timestamp;
    console.log(`⏱️ Pending download age: ${age}ms (max 60000ms)`);

    if (age <= 60000) {
      console.log('🎯 Found valid pending download - this takes priority over pagination state');
      console.log('📋 Pending download details:', {
        startDate: pendingResult.pendingDownload.startDate,
        endDate: pendingResult.pendingDownload.endDate,
        accountType: pendingResult.pendingDownload.accountType,
        reason: pendingResult.pendingDownload.reason || 'unknown'
      });

      // Clear any pagination state to avoid conflicts
      await PaginationManager.clearState();

      // Wait for page to stabilize
      await sleep(1500);

      // Start fresh download
      const { startDate, endDate, accountType } = pendingResult.pendingDownload;
      console.log('🚀 AUTO-STARTING DOWNLOAD from pending state...');

      try {
        // CRITICAL: Clear pending download state BEFORE starting
        // (startDownloadProcess triggers page navigation, so we must clear first)
        console.log('💾 Clearing pending download state before starting...');
        await chrome.storage.local.remove('pendingDownload');

        // Verify it's actually cleared
        const verifyCleared = await chrome.storage.local.get('pendingDownload');
        if (verifyCleared.pendingDownload) {
          throw new Error('Failed to clear pending download state');
        }

        console.log('✅ Pending download state cleared, starting download...');

        // Start the download (this will trigger pagination and page navigation)
        console.log('🚀 Calling startDownloadProcess with params:', { startDate, endDate, accountType, dateRangeType: pendingResult.pendingDownload.dateRangeType });
        await startDownloadProcess(startDate, endDate, accountType, pendingResult.pendingDownload.dateRangeType);

        console.log('✅ Download started successfully from pendingDownload auto-start');

      } catch (error) {
        console.error('❌ Auto-start failed:', error);

        // ONLY restore state for RETRY if it was a download start failure
        // (not a state clear failure)
        if (!error.message.includes('Failed to clear')) {
          // Retry logic - restore state for retry attempts
          const attempts = pendingResult.pendingDownload.attempts || 0;

          if (attempts < 2) {
            await chrome.storage.local.set({
              pendingDownload: {
                ...pendingResult.pendingDownload,
                attempts: attempts + 1,
                lastError: error.message,
                timestamp: Date.now()
              }
            });

            notifyError(`Failed to start download (attempt ${attempts + 1}/3). Refresh to retry.`);
          } else {
            // Give up after 3 attempts
            await chrome.storage.local.remove('pendingDownload');
            notifyError(`Failed to start download after 3 attempts: ${error.message}`);
          }
        } else {
          // State clear failed - this is critical, don't retry
          notifyError('Critical error: Failed to clear download state. Please refresh and try again.');
        }
      }

      return true; // Indicate that resume was handled
    } else {
      console.log('⏰ Pending download too old, clearing...');
      await chrome.storage.local.remove('pendingDownload');
    }
  } else {
    console.log('ℹ️ No pending download state found or shouldAutoStart is false');
  }

  // Priority 2: Check for pagination state (mid-download page navigation)
  const paginationState = await PaginationManager.loadState();

  // Clear empty/invalid pagination state instead of treating it as handled resume
  if (paginationState && !paginationState.isComplete && !paginationState.isRunning && (!paginationState.downloadItems || paginationState.downloadItems.length === 0)) {
    console.log('🧹 Found empty pagination state - clearing instead of resuming...');
    await PaginationManager.clearState();
  } else if (paginationState?.isComplete) {
    console.log('🎉 Found completed pagination state - sending to background downloads...');
    console.log('  Download items:', paginationState.downloadItems?.length || 0);
    console.log('  Completed at:', paginationState.completedAt ? new Date(paginationState.completedAt).toISOString() : 'unknown');

    try {
      // Load date parameters from pendingDownload state
      const pendingDownload = await new Promise(resolve => {
        chrome.storage.local.get('pendingDownload', (data) => resolve(data.pendingDownload));
      });

      // ADD THIS DIAGNOSTIC:
      console.log('🔍 DIAGNOSTIC: pendingDownload state:', pendingDownload);
      console.log('🔍 Has startDate?', pendingDownload?.startDate);
      console.log('🔍 Has endDate?', pendingDownload?.endDate);
      console.log('🔍 Has dateRangeType?', pendingDownload?.dateRangeType);

      // Send downloads to background script
      const marketplace = detectMarketplace();
      console.log('  Marketplace:', marketplace);
      console.log('  Date parameters from pendingDownload:', {
        startDate: pendingDownload?.startDate,
        endDate: pendingDownload?.endDate,
        dateRangeType: pendingDownload?.dateRangeType
      });

      // 🆕 ADD THIS RIGHT BEFORE chrome.runtime.sendMessage
      console.log('🔍 SENDING TO BACKGROUND - Debug Check:');
      console.log('  pendingDownload object:', pendingDownload);
      console.log('  startDate being sent:', pendingDownload?.startDate);
      console.log('  endDate being sent:', pendingDownload?.endDate);
      console.log('  dateRangeType being sent:', pendingDownload?.dateRangeType);
      console.log('  Is pendingDownload defined?:', !!pendingDownload);

      chrome.runtime.sendMessage({
        type: 'startDownloads',
        downloadItems: paginationState.downloadItems,
        marketplace: marketplace,
        concurrent: 3,
        startDate: pendingDownload?.startDate,
        endDate: pendingDownload?.endDate,
        dateRangeType: pendingDownload?.dateRangeType
      });

      // Clear state immediately
      await PaginationManager.clearState();

      // Done - user can close tab now
      notificationManager.showCompletion(
        'Downloads Started',
        `Processing ${paginationState.downloadItems.length} invoices. You can close this tab.`
      );

    } catch (error) {
      console.error('❌ Failed to start background downloads:', error);
      await PaginationManager.clearState();
      notifyError(`Failed to start downloads: ${error.message}`);
    }

    return true; // Indicate that resume was handled
  }

  if (paginationState?.isRunning) {
    console.log('🔄 Found pagination state - resuming pagination...');
    console.log('  Current page:', paginationState.currentPage);
    console.log('  Total pages:', paginationState.totalPages);

    // Notify popup about resumed pagination state
    chrome.runtime.sendMessage({
      action: 'paginationResumed',
      data: {
        currentPage: paginationState.currentPage,
        totalPages: paginationState.totalPages,
        collectedItems: paginationState.downloadItems?.length || 0,
        status: `Resuming collection on page ${paginationState.currentPage} of ${paginationState.totalPages}`
      }
    }).catch(() => {}); // Ignore if popup is closed

    try {
      await resumePagination(paginationState);
    } catch (error) {
      console.error('❌ Pagination resume failed:', error);
      await PaginationManager.clearState();
      notifyError(`Failed to resume pagination: ${error.message}`);
    }

    return true; // Indicate that resume was handled
  }

  console.log('ℹ️ No pending operations found - ready for new downloads');
  return false; // No resume needed
}

function navigateToPageOne() {
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
 * @returns {boolean} true if filter was adjusted (page will reload), false if already correct
 */
async function ensureDateFilterCoversRange(startDate, endDate, accountType, dateRangeType) {
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
    notifyInfo(`Adjusting date filter to include ${startDate} - ${endDate}...`);

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

    console.log('  ✅ Filter changed, page will reload automatically');
    console.log('  ⏳ Download will auto-start after reload...');

    return true; // Indicate that filter was changed
  }

  console.log('  ✅ Date filter already covers search range');
  return false;
}

function showNavigationPrompt(options) {
  const overlay = document.createElement('div');
  overlay.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); z-index: 10000;
                display: flex; align-items: center; justify-content: center;">
      <div style="background: white; padding: 48px; border-radius: 16px;
                  max-width: 600px; text-align: center;">
        <h2 style="margin: 0 0 24px 0; color: #232f3e; font-size: 24px;">
          ⚠️ Date Range Mismatch
        </h2>
        <p style="margin: 24px 0; color: #565959; line-height: 1.6; font-size: 16px;">
          You're on <strong>page ${options.currentPage}</strong> showing orders from
          <strong>${options.currentPageDate.toLocaleDateString()}</strong>
        </p>
        <p style="margin: 24px 0; color: #565959; line-height: 1.6; font-size: 16px;">
          Your search range is:
          <strong>${options.targetStartDate.toLocaleDateString()}</strong> to
          <strong>${options.targetEndDate.toLocaleDateString()}</strong>
        </p>
        <p style="margin: 32px 0 24px 0; color: #ff9900; font-weight: 500; font-size: 16px;">
          💡 Navigate to page 1 to find matching orders
        </p>
        <div style="margin-top: 40px; display: flex; gap: 16px; justify-content: center;">
          <button id="navigate-btn" style="background: #ff9900; color: white;
                  border: none; padding: 16px 32px; border-radius: 10px;
                  font-size: 16px; font-weight: 600; cursor: pointer;
                  min-width: 140px; transition: all 0.2s ease;">
            Go to Page 1
          </button>
          <button id="continue-btn" style="background: white; color: #0f1111;
                  border: 2px solid #d5d9d9; padding: 16px 32px; border-radius: 10px;
                  font-size: 16px; font-weight: 600; cursor: pointer;
                  min-width: 140px; transition: all 0.2s ease;">
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('navigate-btn').onclick = () => {
    overlay.remove();
    options.onNavigate();
  };

  document.getElementById('continue-btn').onclick = () => {
    overlay.remove();
    options.onContinue();
  };
}

// ===== MODULE-LEVEL VARIABLES =====

// PaginationManager instance (created when needed)
let paginationManager = null;

/**
 * Get or create paginationManager instance
 * @returns {Promise<PaginationManager>}
 */
async function getPaginationManager() {
  if (!paginationManager) {
    const settings = await loadPaginationSettings();
    paginationManager = new PaginationManager({
      delayBetweenPages: settings.paginationDelay * 1000,
      showProgress: true
    });
  }
  return paginationManager;
}

// ===== ORDER COLLECTION FUNCTION =====

/**
 * Collect orders from the current page
 * @param {string} startDate - Start date filter (YYYY-MM-DD)
 * @param {string} endDate - End date filter (YYYY-MM-DD)
 * @param {Array} collectedOrderIds - Array of already collected order IDs to avoid duplicates
 * @param {string} accountType - 'business' or 'nonbusiness'
 * @returns {Object} { items: Array of order objects, shouldStop: boolean }
 */
async function collectFromCurrentPage(startDate, endDate, collectedOrderIds = [], accountType = 'nonbusiness') {
  console.log('🔍 Collecting orders from current page...');
  console.log('  Date range:', startDate, 'to', endDate);
  console.log('  Account type:', accountType);
  console.log('  Already collected:', collectedOrderIds.length, 'orders');

  // Don't collect orders from invoice pages - they don't have order cards
  if (window.location.href.includes('/your-orders/invoice')) {
    console.log('📄 On invoice page - skipping order collection');
    return { items: [], shouldStop: false };
  }

  const orderCards = document.querySelectorAll('.order-card');
  console.log(`  ✅ Found ${orderCards.length} orders with: .order-card`);

  const items = [];
  const normalizedStartDate = new Date(startDate);
  const normalizedEndDate = new Date(endDate);

  normalizedStartDate.setHours(0, 0, 0, 0);
  normalizedEndDate.setHours(23, 59, 59, 999);

  console.log('  📅 Search range:', normalizedStartDate.toISOString().split('T')[0], 'to', normalizedEndDate.toISOString().split('T')[0]);

  for (let i = 0; i < orderCards.length; i++) {
    const order = orderCards[i];

    // Extract order ID
    const orderIdMatch = order.innerHTML.match(/orderID=([^&"']+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    if (!orderId) {
      console.warn('  ⚠️ Order', i + 1, '- No order ID found, skipping');
      continue;
    }

    // Skip if already collected
    if (collectedOrderIds.includes(orderId)) {
      console.log('  ⏭️ Order', orderId, '- Already collected, skipping');
      continue;
    }

    // Extract date using text pattern matching
    const textContent = order.innerText || order.textContent;
    const dateMatch = textContent.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);

    if (!dateMatch) {
      console.warn('  ⚠️ Order', orderId, '- No date found in text, skipping');
      continue;
    }

    const dateStr = dateMatch[0]; // e.g., "30 November 2025"
    console.log('  📅 Order', orderId, '- Date found:', dateStr);

    // Parse date
    const orderDate = new Date(dateStr);

    if (isNaN(orderDate.getTime())) {
      console.warn('  ⚠️ Order', orderId, '- Invalid date:', dateStr, ', skipping');
      continue;
    }

    orderDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

    // Check if date is in range
    if (orderDate < normalizedStartDate) {
      console.log('  ⏮️ Order', orderId, '- Date', orderDate.toISOString().split('T')[0], 'is BEFORE range, skipping');
      continue;
    }

    if (orderDate > normalizedEndDate) {
      console.log('  ⏭️ Order', orderId, '- Date', orderDate.toISOString().split('T')[0], 'is AFTER range, skipping');
      continue;
    }

    // Extract invoice URL
    const invoiceLink = order.querySelector('a[href*="invoice"], a[href*="Invoice"]');
    const invoiceUrl = invoiceLink ? invoiceLink.href : null;

    if (!invoiceUrl) {
      console.warn('  ⚠️ Order', orderId, '- No invoice link found, skipping');
      continue;
    }

    console.log('  ✅ Order', orderId, '- IN RANGE, adding to collection');

    // Generate clean, simple filename
    const filename = `Invoice_${orderId}_${orderDate.toISOString().split('T')[0]}.pdf`;
    console.log('  📁 Generated filename:', filename);

    // Add to collection
    items.push({
      orderId: orderId,
      date: orderDate.toISOString().split('T')[0],
      url: window.location.href,
      invoiceUrl: invoiceUrl,
      filename: filename,
      index: items.length,
      accountType: accountType
    });
  }

  console.log(`  Found ${items.length} orders in date range`);

  // Determine if we should stop pagination
  let shouldStop = false;
  if (items.length === 0 && orderCards.length > 0) {
    // Check if all orders are before the start date
    const firstOrderDate = extractFirstOrderDate(orderCards[0]);
    if (firstOrderDate && firstOrderDate < normalizedStartDate) {
      console.log('🛑 No orders found in date range - should stop pagination');
      shouldStop = true;
    }
  }

  console.log('  Collected', items.length, 'new orders from this page');
  console.log('  Should stop pagination?', shouldStop);

  return {
    items: items,
    shouldStop: shouldStop
  };
}

// Helper function
function extractFirstOrderDate(orderElement) {
  const textContent = orderElement.innerText || orderElement.textContent;
  const dateMatch = textContent.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);

  if (dateMatch) {
    const date = new Date(dateMatch[0]);
    date.setHours(12, 0, 0, 0);
    return date;
  }

  return null;
}

/**
 * Extract date from order card using text pattern matching
 */
function extractOrderDateFromText(orderElement) {
  // Get all text content
  const textContent = orderElement.innerText || orderElement.textContent;

  // Look for date patterns
  const datePatterns = [
    // "30 November 2025"
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
    // "30.11.2025"
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
    // "2025-11-30"
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    // "Nov 30, 2025"
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i
  ];

  for (const pattern of datePatterns) {
    const match = textContent.match(pattern);
    if (match) {
      console.log('📅 Found date:', match[0]);
      return match[0];
    }
  }

  console.warn('⚠️ No date found in order card');
  return null;
}

/**
 * Extract order data from a DOM element
 * @param {Element} orderElement - The order DOM element
 * @param {string} accountType - 'business' or 'nonbusiness'
 * @param {number} index - Index in the current page
 * @returns {Object} Order data object
 */
function extractOrderData(orderElement, accountType, index) {
  try {
    // Extract order ID
    const orderId = extractOrderId(orderElement);
    if (!orderId) {
      console.warn('⚠️ Could not extract order ID from element');
      return null;
    }

    // Extract order date
    const orderDate = extractOrderDate(orderElement);

    // Extract invoice URL based on account type
    let invoiceUrl = null;
    if (accountType === 'business') {
      invoiceUrl = extractBusinessInvoiceUrl(orderElement);
    } else {
      invoiceUrl = extractConsumerInvoiceUrl(orderElement);
    }

    // Create order data object
    const orderData = {
      orderId: orderId,
      date: orderDate,
      url: invoiceUrl,
      invoiceUrl: invoiceUrl, // Keep both for compatibility
      index: index,
      accountType: accountType,
      element: orderElement // Keep reference to DOM element
    };

    console.log(`  📦 Order ${orderId}: ${orderDate} - ${invoiceUrl ? 'Has invoice' : 'No invoice'}`);

    return orderData;
  } catch (error) {
    console.error('❌ Error extracting order data:', error);
    return null;
  }
}

/**
 * Extract order ID from order element
 * @param {Element} orderElement
 * @returns {string|null} Order ID
 */
function extractOrderId(orderElement) {
  // Try various selectors for order ID
  const selectors = [
    '[data-order-id]',
    '.order-id',
    '.a-color-secondary a[href*="orderID"]',
    'a[href*="orderID"]'
  ];

  for (const selector of selectors) {
    const element = orderElement.querySelector(selector);
    if (element) {
      // Extract from href attribute
      const href = element.getAttribute('href') || element.href;
      if (href) {
        const match = href.match(/orderID[=\/]([0-9\-]+)/);
        if (match) return match[1];
      }

      // Extract from data attribute
      const orderId = element.getAttribute('data-order-id') || element.textContent;
      if (orderId) return orderId.trim();
    }
  }

  return null;
}

/**
 * Extract business account invoice URL
 * @param {Element} orderElement
 * @returns {string|null} Invoice URL
 */
function extractBusinessInvoiceUrl(orderElement) {
  // Business accounts have different invoice link patterns
  const selectors = [
    'a[href*="invoice"]',
    'a[href*="rechnung"]', // German
    'a[href*="facture"]',  // French
    '.invoice-link a'
  ];

  for (const selector of selectors) {
    const link = orderElement.querySelector(selector);
    if (link && link.href) {
      return link.href;
    }
  }

  return null;
}

/**
 * Extract consumer account invoice URL
 * @param {Element} orderElement
 * @returns {string|null} Invoice URL
 */
function extractConsumerInvoiceUrl(orderElement) {
  // Consumer accounts typically use popover or direct invoice links
  const selectors = [
    'a[href*="invoice"]',
    'a[href*="popover"]',
    '.invoice-link a'
  ];

  for (const selector of selectors) {
    const link = orderElement.querySelector(selector);
    if (link && link.href) {
      return link.href;
    }
  }

  return null;
}

// ===== PAGINATION RESUME FUNCTION =====

/**
 * Resume pagination - collects orders from current page and navigates to next
 * This function is designed to work with page reloads:
 * - Collects from current page
 * - Saves state
 * - Navigates to next page (causes reload)
 * - After reload, this function runs again from the new page
 */
async function resumePagination(state) {
  console.log('🔄 RESUME PAGINATION - Page', state.currentPage);
  console.log('  Total pages:', state.totalPages);
  console.log('  Items collected so far:', state.downloadItems?.length || 0);

  const pm = new PaginationManager();
  pm.state = state; // Restore saved state

  // Step 1: Collect orders from CURRENT page
  console.log(`📄 Collecting orders from page ${state.currentPage}...`);

  const pageResults = await collectFromCurrentPage(
    state.startDate,
    state.endDate,
    state.collectedOrderIds || [],
    state.accountType
  );

  console.log(`  Found ${pageResults.items.length} items on this page`);
  console.log(`  Should stop? ${pageResults.shouldStop}`);

  // Step 2: Add new items to collection
  if (pageResults.items.length > 0) {
    pm.state.downloadItems = pm.state.downloadItems || [];
    pm.state.downloadItems.push(...pageResults.items);

    // Track order IDs to prevent duplicates
    pm.state.collectedOrderIds = pm.state.collectedOrderIds || [];
    pageResults.items.forEach(item => {
      if (item.orderId && !pm.state.collectedOrderIds.includes(item.orderId)) {
        pm.state.collectedOrderIds.push(item.orderId);
      }
    });
  }

  console.log(`  Total items collected across all pages: ${pm.state.downloadItems.length}`);

  // Step 3: Update overlay
  pm.showProgressOverlay(
    state.currentPage,
    state.totalPages,
    pm.state.downloadItems.length
  );

  // Step 4: Check if we should stop or continue
  if (pageResults.shouldStop) {
    console.log('🛑 Stopping pagination - all orders are before date range');
    pm.state.isComplete = true;
    pm.state.isRunning = false;
    await pm.saveState();

    // Reload to trigger download phase
    console.log('🔄 Reloading to start downloads...');
    window.location.reload();
    return; // Page will reload
  }

  // Step 5: Check if there's a next page
  if (!pm.hasNextPage()) {
    console.log('✅ No more pages - pagination complete!');
    pm.state.isComplete = true;
    pm.state.isRunning = false;
    pm.state.completedAt = Date.now();
    await pm.saveState();

    // Reload to trigger download phase
    console.log('🔄 Reloading to start downloads...');
    window.location.reload();
    return; // Page will reload
  }

  // Step 6: Navigate to next page
  console.log(`➡️ Navigating to page ${state.currentPage + 1}...`);

  // Save state BEFORE navigation (critical!)
  await pm.saveState();

  // Small delay to ensure state is saved
  await sleep(500);

  // Navigate (this will reload the page)
  await pm.navigateToNextPage();

  // Code after this SHOULD NOT RUN (page should reload)
  console.log('⚠️ WARNING: Code after navigation is running - page did NOT reload!');
}

// ===== MAIN DOWNLOAD PROCESS =====

async function startDownloadProcess(startDate, endDate, accountType, dateRangeType) {
  console.log('📥 Download requested');
  console.log('  Start date:', startDate);
  console.log('  End date:', endDate);
  console.log('  Account type:', accountType);
  console.log('  Date range type:', dateRangeType);

  // Normalize dates immediately to avoid timezone issues
  const normalizedStartDate = normalizeDate(new Date(startDate));
  const normalizedEndDate = normalizeDate(new Date(endDate));

  console.log('🚀 ACTUAL DOWNLOAD STARTING with PAGINATION!');
  console.log('  Account:', accountType);
  console.log('  Dates (original):', startDate, 'to', endDate);
  console.log('  Dates (normalized):', normalizedStartDate.toISOString(), 'to', normalizedEndDate.toISOString());

  // 🆕 SET pendingDownload here for immediate access
  pendingDownload = {
    startDate: normalizedStartDate.toISOString().split('T')[0], // YYYY-MM-DD format
    endDate: normalizedEndDate.toISOString().split('T')[0],
    accountType: accountType,
    dateRangeType: dateRangeType
  };

  // 🆕 ADD THIS DEBUG LOG
  console.log('✅ pendingDownload SET TO:', JSON.stringify(pendingDownload, null, 2));
  console.log('   Has startDate?:', !!pendingDownload.startDate);
  console.log('   Has endDate?:', !!pendingDownload.endDate);
  console.log('   Has dateRangeType?:', !!pendingDownload.dateRangeType);

  // Use normalized dates from here on
  startDate = normalizedStartDate.toISOString().split('T')[0]; // Back to YYYY-MM-DD
  endDate = normalizedEndDate.toISOString().split('T')[0];

  try {
    // PHASE 0: Create pagination manager early for page checking
    const pm = await getPaginationManager();

    // NEW: Check if we're on page 1 - if not, navigate there first
    const currentPageNum = pm.getCurrentPageFromURL();
    console.log('  Current page:', currentPageNum);
    console.log('  Current URL:', window.location.href);

    if (currentPageNum !== 1) {
      console.log('⚠️ NOT on page 1, will navigate there first...');
      console.log(`⚠️ Currently on page ${currentPageNum}, need to start from page 1`);

      // 🔴 CRITICAL FIX: Save pendingDownload state before navigation
      console.log('💾 Saving download state before navigation...');

      try {
        await chrome.storage.local.set({
          pendingDownload: {
            ...pendingDownload,  // Use the global pendingDownload object
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
        notifyError('Failed to save download state. Please try again.');
        return;
      }

      // Create a temporary notification
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
          🔄 Navigating to Page 1
        </div>
        <div style="font-size: 14px; opacity: 0.9;">
          Starting collection from the beginning...
        </div>
      `;

      document.body.appendChild(notification);

      // Navigate after 1.5 seconds
      setTimeout(() => {
        const page1URL = pm.buildPaginationURL(1);
        console.log('🎯 Navigating to page 1 URL:', page1URL);
        window.location.href = page1URL;
      }, 1500);

      return; // Stop execution
    }

    console.log('✅ On page 1, continuing with download...');

    // PHASE 1: Show we're starting
    notifyInfo('Starting invoice collection...');

    // CRITICAL: Check and adjust Amazon's date filter FIRST
    const filterAdjusted = await ensureDateFilterCoversRange(startDate, endDate, accountType, dateRangeType);

    if (filterAdjusted) {
      // Filter was changed, page will reload, download will auto-resume
      console.log('⏳ Date filter adjusted, waiting for Amazon page reload...');
      console.log('💡 Download will auto-start after reload');
      return; // Exit - page reload will trigger auto-resume
    }

    // Filter is correct, continue with existing logic
    const marketplace = detectMarketplace();
    console.log('  Marketplace:', marketplace);

    // Store date/account info for state persistence
    pm.state.startDate = startDate;
    pm.state.endDate = endDate;
    pm.state.accountType = accountType;
    pm.state.dateRangeType = dateRangeType;

    // Get pagination info from the page
    const paginationInfo = pm.getPaginationInfo();
    console.log(`📄 Will process ${paginationInfo.totalPages} page(s)`);

    notifyInfo(`Found ${paginationInfo.totalPages} pages to process`);

    // Update pagination manager state with actual page info (CRITICAL FIX!)
    pm.state.currentPage = paginationInfo.currentPage;
    pm.state.totalPages = paginationInfo.totalPages;

    // PHASE 3: Show we're checking page position
    if (paginationInfo.currentPage > 1) {
      notifyInfo(`Currently on page ${paginationInfo.currentPage}, checking date range...`);
      console.log(`⚠️ User is on page ${paginationInfo.currentPage}, checking if navigation to page 1 is recommended...`);

      // Get first order on current page - try multiple selectors
      const orderSelectors = ['.order-card', '.order', '[data-order-id]', '.a-box-group.order'];
      let firstOrderElement = null;
      let usedSelector = '';

      for (const selector of orderSelectors) {
        firstOrderElement = document.querySelector(selector);
        if (firstOrderElement) {
          usedSelector = selector;
          break;
        }
      }

      console.log(`🔍 Order element search: found=${!!firstOrderElement}, selector="${usedSelector}"`);

      if (firstOrderElement) {
        const firstOrderDateStr = extractOrderDate(firstOrderElement);
        const parsedDateStr = parseAmazonDate(firstOrderDateStr, marketplace);
        const firstOrderDate = parsedDateStr ? normalizeDate(new Date(parsedDateStr)) : null;

        // Normalize search dates for comparison
        const normalizedStartDate = normalizeDate(new Date(startDate));
        const normalizedEndDate = normalizeDate(new Date(endDate));

        console.log(`📅 Debug: First order date string: "${firstOrderDateStr}"`);
        console.log(`📅 Debug: Parsed date string: "${parsedDateStr}"`);
        console.log(`📅 Debug: First order date (normalized): ${firstOrderDate?.toISOString()}`);
        console.log(`📅 Debug: Start date (normalized): ${normalizedStartDate.toISOString()}`);
        console.log(`📅 Debug: End date (normalized): ${normalizedEndDate.toISOString()}`);
        console.log(`📅 Debug: Comparison: ${firstOrderDate?.toISOString()} > ${normalizedEndDate.toISOString()} = ${firstOrderDate && firstOrderDate > normalizedEndDate}`);

        if (firstOrderDate && firstOrderDate > normalizedEndDate) {
          // Orders on current page are TOO RECENT for search range
          console.log(`📅 Current page has recent orders (${firstOrderDate.toISOString().split('T')[0]}) - search range ends ${endDate}`);
          console.log(`⚠️ Orders here are after your search end date - offering navigation to page 1`);

          // Show navigation prompt
          showNavigationPrompt({
            currentPage: paginationInfo.currentPage,
            currentPageDate: firstOrderDate,
            targetStartDate: normalizedStartDate,  // Use normalized
            targetEndDate: normalizedEndDate,      // Add end date
            onNavigate: async () => {
              console.log('🔄 User chose to navigate to page 1');

              // SAVE download params before navigating with verification
              console.log('💾 Saving download state before navigation...');

              try {
                // Save state with explicit await
                await chrome.storage.local.set({
                  pendingDownload: {
                    startDate: startDate,
                    endDate: endDate,
                    accountType: accountType,
                    dateRangeType: dateRangeType,
                    shouldAutoStart: true,
                    timestamp: Date.now()
                  }
                });

                // Verify storage succeeded
                const verification = await chrome.storage.local.get('pendingDownload');
                if (!verification.pendingDownload) {
                  throw new Error('Storage verification failed');
                }

                console.log('✅ State saved and verified, navigating...');

                // Small delay to ensure storage is fully committed
                await sleep(100);

                navigateToPageOne();

              } catch (error) {
                console.error('❌ Failed to save state:', error);
                notifyError('Failed to save download state. Please try again.');
                // Don't navigate if save failed
              }
            },
            onContinue: () => {
              console.log('ℹ️ User chose to continue from current page');
              notifyInfo('Starting from current page - you may miss recent orders');
            }
          });

          // Exit function - page will reload if user navigates, or continue if they choose to stay
          return;
        } else if (firstOrderDate && firstOrderDate < new Date(startDate)) {
          // Orders on current page are TOO OLD - might have already passed relevant pages
          console.log(`⚠️ First order on page ${paginationInfo.currentPage} (${firstOrderDate.toISOString().split('T')[0]}) is older than search start (${startDate})`);
          console.log(`⚠️ You may have already passed the relevant pages`);
          notifyInfo(`Starting from page ${paginationInfo.currentPage} - relevant orders may be on earlier pages`);
        } else {
          console.log(`ℹ️ First order on page ${paginationInfo.currentPage} (${firstOrderDate ? firstOrderDate.toISOString().split('T')[0] : 'unknown date'}) is within search range, continuing from current page`);
          // First order is within range, continue from current page
          if (paginationInfo.currentPage > 1) {
            const warningMessage = `⚠️ Starting from page ${paginationInfo.currentPage} (not page 1). You may miss orders on earlier pages.`;
            console.log(warningMessage);
            notifyInfo(warningMessage);
          }
        }
      } else {
        console.log(`❌ Could not find any order elements on page ${paginationInfo.currentPage} - cannot check dates, continuing from current page`);
        // Could not find order elements, continue from current page but show warning
        const warningMessage = `⚠️ Starting from page ${paginationInfo.currentPage} (not page 1). You may miss orders on earlier pages.`;
        console.log(warningMessage);
        notifyInfo(warningMessage);
      }
    }

    // PHASE 4: Show we're starting pagination
    console.log('🚀 Starting pagination process...');
    notifyInfo('Beginning order collection across pages...');

    // Show pagination start notification
    if (typeof notificationManager !== 'undefined') {
      notificationManager.showProgress(
        'Collecting Orders',
        `Starting pagination across ${paginationInfo.totalPages} pages...`,
        0
      );
    }

    // Initialize pagination state and save it
    pm.state.isRunning = true;
    pm.state.isComplete = false;
    await pm.saveState();

    // Start pagination - this will navigate pages and eventually reload to trigger downloads
    console.log('🔄 Starting pagination (will reload page when complete)...');
    await resumePagination(pm.state);

    // This code will never be reached due to page reload during pagination
    // Downloads will be triggered by handlePageResume() detecting completion state
    console.log('⚠️ This log should never appear - pagination should have reloaded the page');
    return;

  } catch (error) {
    console.error('❌ Download error:', error);
    notifyError(error.message);
  }
}

// ===== DOWNLOADS WITH COMPLETED PAGINATION =====

async function startDownloadsWithCompletedPagination(paginationState) {
  console.log('🚀 Starting downloads with completed pagination data...');
  console.log(`  Download items: ${paginationState.downloadItems?.length || 0}`);
  console.log(`  Account type: ${paginationState.accountType}`);
  console.log(`  Date range: ${paginationState.startDate} to ${paginationState.endDate}`);

  // Show preparing downloads notification
  if (typeof notificationManager !== 'undefined') {
    notificationManager.showProgress(
      'Preparing Downloads',
      'Preparing downloads...',
      0
    );
  }

  const downloadItems = paginationState.downloadItems || [];

  if (downloadItems.length === 0) {
    console.log('❌ No download items found in pagination state');
    notifyError('No orders found to download');
    return;
  }

  console.log(`📊 Starting download of ${downloadItems.length} invoices within date range...`);

  // Update popup with the real total count now that we know it
  notifyDownloadProgress(0, downloadItems.length, 'Preparing downloads...');

  const startTime = Date.now();

  try {
    const marketplace = detectMarketplace();
    console.log('  Marketplace:', marketplace);

    // Get adaptive settings based on network conditions
    const adaptiveSettings = bandwidthManager.getAdaptiveSettings({
      maxConcurrent: 3,
      delayBetween: 1500,
      throttleRate: 8
    });

    console.log(`📊 Using adaptive settings: ${adaptiveSettings.profile} profile (${adaptiveSettings.maxConcurrent} concurrent, ${adaptiveSettings.delayBetween}ms delay)`);

    // Create download queue with adaptive settings
    window.downloadQueue = new DownloadQueue({
      maxConcurrent: adaptiveSettings.maxConcurrent,
      delayBetween: adaptiveSettings.delayBetween,
      throttleRate: adaptiveSettings.throttleRate,
      pauseOnError: false,     // Don't pause on errors
      retryFailed: true,       // Retry failed downloads
      maxRetries: 2,           // Retry up to 2 times
      retryDelay: 3000         // 3 second delay between retries
    });

    // Set up queue event handlers
    downloadQueue.onProgress = (stats) => {
      const current = stats.completed + stats.failed;
      notifyDownloadProgress(
        current,
        stats.total,
        `Downloaded ${stats.completed}/${stats.total} invoices...`
      );

      // Show notification progress
      if (typeof notificationManager !== 'undefined') {
        notificationManager.notifyDownloadProgress(current, stats.total, detectMarketplace());
      }
    };

    downloadQueue.onItemComplete = (item, status, result) => {
      if (status === 'success') {
        console.log(`✅ Downloaded: ${item.filename}`);
      } else {
        console.error(`❌ Failed: ${item.filename}`, result);
      }
    };

    downloadQueue.onComplete = (completed, failed) => {
      const duration = Date.now() - startTime;
      const durationSec = (duration / 1000).toFixed(1);

      console.log(`✅ DOWNLOAD COMPLETE: ${completed.length} successful, ${failed.length} failed`);
      console.log(`  ⏱️  Total time: ${durationSec}s`);

      // Hide loading state and progress overlay
      if (typeof window.hideDownloadLoadingState === 'function') {
        window.hideDownloadLoadingState();
      }

      // Build summary message
      let summaryMessage = '';
      if (completed.length > 0 && failed.length === 0) {
        summaryMessage = `✅ Successfully downloaded ${completed.length} invoice${completed.length > 1 ? 's' : ''} in ${durationSec}s`;
      } else if (completed.length > 0 && failed.length > 0) {
        summaryMessage = `⚠️ Downloaded ${completed.length} invoice${completed.length > 1 ? 's' : ''}, ${failed.length} failed`;
      } else if (completed.length === 0 && failed.length > 0) {
        summaryMessage = `❌ All ${failed.length} downloads failed. Check your internet connection.`;
      } else {
        summaryMessage = '❓ No downloads completed';
      }

      console.log('  📊 ' + summaryMessage);

      // Notify popup of completion
      notifyDownloadComplete(completed.length, failed.length, completed.length + failed.length);

      // Record session in history
      const sessionDuration = Date.now() - startTime;
      const sessionData = {
        marketplace: detectMarketplace(),
        successful: completed.length,
        failed: failed.length,
        skipped: 0,
        duration: sessionDuration,
        sessionType: 'batch_download',
        downloads: completed.map(c => ({
          orderId: c.item.orderId,
          filename: c.item.filename,
          success: true
        })),
        errors: failed.map(f => ({
          orderId: f.item.orderId,
          error: f.error?.message || 'Unknown error'
        }))
      };

      chrome.runtime.sendMessage({
        action: 'recordSession',
        sessionData: sessionData
      });

      if (failed.length > 0) {
        notifyDownloadFailed(failed.length, failed.map(f => ({
          orderId: f.item.orderId,
          filename: f.item.filename,
          error: f.error?.message || 'Unknown error'
        })));
        notifyDownloadStatus(`${completed.length} downloaded, ${failed.length} failed`);
      } else {
        notifyDownloadStatus(`All ${completed.length} invoices downloaded successfully!`);
      }

      // Export session summary for parser consumption
      const sessionSummaryData = {
        sessionId: `session_${Date.now()}`,
        marketplace: detectMarketplace(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        successful: completed.length,
        failed: failed.length,
        total: completed.length + failed.length,
        downloads: completed.map(c => ({
          orderId: c.item.orderId,
          filename: c.item.filename,
          path: generateOrganizedFilename(c.item.orderId, null, c.item.index),
          downloaded: new Date().toISOString(),
          success: true,
          marketplace: detectMarketplace()
        })),
        errors: failed.map(f => ({
          orderId: f.item.orderId,
          error: f.error?.message || 'Unknown error',
          timestamp: new Date().toISOString()
        }))
      };

      chrome.runtime.sendMessage({
        action: 'exportSessionSummary',
        sessionData: sessionSummaryData
      });

      // Show completion notification
      notificationManager.notifyDownloadComplete(completed.length, failed.length, detectMarketplace());

      notifyComplete(completed.length);
    };

    // downloadItems are already prepared - just add to queue
    console.log('🔍 QUEUE DEBUG: Adding pre-collected download items to queue');
    console.log('  Items to add:', downloadItems.length);

    downloadQueue.add(downloadItems);

    // Show stop button if pagination manager is available
    if (typeof window.PaginationManager !== 'undefined' && window.PaginationManager.currentInstance) {
      window.PaginationManager.currentInstance.showStopButton();
    }

    await downloadQueue.start();

  } catch (error) {
    console.error('❌ Download error:', error);
    notifyError(error.message);
  }
}

/**
 * Start downloads from a completed pagination state
 */
async function startDownloadsFromState(state) {
  console.log(`📦 Starting downloads for ${state.downloadItems.length} items`);

  if (!state.downloadItems?.length) {
    console.error('❌ No items to download');
    await PaginationManager.clearState();
    return;
  }

  // Update popup with the real total count now that we know it
  notifyDownloadProgress(0, state.downloadItems.length, 'Preparing downloads...');

  try {
    // Create bandwidth manager for adaptive settings
    const bandwidthManager = new BandwidthManager();

    // Get adaptive settings based on current bandwidth
    const adaptiveSettings = await bandwidthManager.getAdaptiveSettings({
      maxConcurrent: 3,
      delayBetween: 1000,
      throttleRate: 8
    });

    console.log(`📊 Using adaptive settings: ${adaptiveSettings.profile} profile (${adaptiveSettings.maxConcurrent} concurrent, ${adaptiveSettings.delayBetween}ms delay)`);

    // Create download queue with adaptive settings
    window.downloadQueue = new DownloadQueue({
      maxConcurrent: adaptiveSettings.maxConcurrent,
      delayBetween: adaptiveSettings.delayBetween,
      throttleRate: adaptiveSettings.throttleRate,
      pauseOnError: false,     // Don't pause on errors
      retryFailed: true,       // Retry failed downloads
      maxRetries: 2,           // Retry up to 2 times
      retryDelay: 3000         // 3 second delay between retries
    });

    const startTime = Date.now();

    // Set up queue event handlers
    downloadQueue.onProgress = (stats) => {
      const current = stats.completed + stats.failed;
      notifyDownloadProgress(
        current,
        stats.total,
        `Downloaded ${stats.completed}/${stats.total} invoices...`
      );

      // Show notification progress
      if (typeof notificationManager !== 'undefined') {
        notificationManager.notifyDownloadProgress(current, stats.total, detectMarketplace());
      }
    };

    downloadQueue.onItemComplete = (item, status, result) => {
      if (status === 'success') {
        console.log(`✅ Downloaded: ${item.filename}`);
      } else {
        console.error(`❌ Failed: ${item.filename}`, result);
      }
    };

    downloadQueue.onComplete = (completed, failed) => {
      const duration = Date.now() - startTime;
      const durationSec = (duration / 1000).toFixed(1);

      console.log(`✅ DOWNLOAD COMPLETE: ${completed.length} successful, ${failed.length} failed`);
      console.log(`  ⏱️  Total time: ${durationSec}s`);

      // Hide loading state and progress overlay
      if (typeof window.hideDownloadLoadingState === 'function') {
        window.hideDownloadLoadingState();
      }

      // Build summary message
      let summaryMessage = '';
      if (completed.length > 0 && failed.length === 0) {
        summaryMessage = `✅ Successfully downloaded ${completed.length} invoice${completed.length > 1 ? 's' : ''} in ${durationSec}s`;
      } else if (completed.length > 0 && failed.length > 0) {
        summaryMessage = `⚠️ Downloaded ${completed.length} invoice${completed.length > 1 ? 's' : ''}, ${failed.length} failed in ${durationSec}s`;
      } else if (failed.length > 0) {
        summaryMessage = `❌ All ${failed.length} downloads failed in ${durationSec}s`;
      }

      // Notify popup of completion
      notifyDownloadComplete(completed.length, failed.length, completed.length + failed.length);

      // Send final notification
      if (summaryMessage) {
        notifyDownloadProgress(completed.length + failed.length, state.downloadItems.length, summaryMessage);
        if (typeof notificationManager !== 'undefined') {
          notificationManager.notifyDownloadComplete(completed.length, failed.length, duration, detectMarketplace());
        }
      }

      console.log('🧹 Clearing pagination state after downloads complete');
      PaginationManager.clearState();
    };

    // Add items to queue and start
    console.log('🔍 QUEUE DEBUG: Adding state download items to queue');
    console.log('  Items to add:', state.downloadItems.length);

    downloadQueue.add(state.downloadItems);
    await downloadQueue.start();

    console.log('✅ All downloads complete');
    await PaginationManager.clearState();

  } catch (error) {
    console.error('❌ Download error:', error);
    notifyError(error.message);
    // Keep state for potential retry
  }
}

// ===== INITIALIZATION =====

// ===== DIAGNOSTIC FUNCTION FOR URL ANALYSIS =====
window.diagnoseDownloadItems = async function() {
  console.log('🔍 DIAGNOSTIC: Download Items URLs');

  try {
    const state = await PaginationManager.loadState();
    if (!state || !state.downloadItems) {
      console.log('❌ No download items found in state');
      return;
    }

    console.log('📊 Total items:', state.downloadItems.length);

    // Check first 5 items
    state.downloadItems.slice(0, 5).forEach((item, i) => {
      const url = item.url || item.invoiceUrl;
      console.log(`\n📋 Item ${i + 1}:`);
      console.log('  URL:', url);
      console.log('  Is popover?', url?.includes('popover'));
      console.log('  Is direct PDF?', url?.includes('/documents/download/') && url?.endsWith('/invoice.pdf'));
      console.log('  Is invoice page?', url?.includes('/your-orders/invoice') && !url?.includes('popover'));
      console.log('  Is CSS summary?', url?.includes('/gp/css/summary/print'));
      console.log('  Filename:', item.filename);
      console.log('  Order ID:', item.orderId);
    });

    // Summary statistics
    const popoverCount = state.downloadItems.filter(item => (item.url || item.invoiceUrl)?.includes('popover')).length;
    const directPdfCount = state.downloadItems.filter(item => {
      const url = item.url || item.invoiceUrl;
      return url?.includes('/documents/download/') && url?.endsWith('/invoice.pdf');
    }).length;
    const invoicePageCount = state.downloadItems.filter(item => {
      const url = item.url || item.invoiceUrl;
      return url?.includes('/your-orders/invoice') && !url?.includes('popover');
    }).length;
    const cssSummaryCount = state.downloadItems.filter(item => (item.url || item.invoiceUrl)?.includes('/gp/css/summary/print')).length;

    console.log('\n📈 SUMMARY:');
    console.log('  Popover URLs:', popoverCount);
    console.log('  Direct PDFs:', directPdfCount);
    console.log('  Invoice pages:', invoicePageCount);
    console.log('  CSS summaries:', cssSummaryCount);

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  }
};

console.log('🚀 Amazon Invoice Extractor - Content Script Loading...');
console.log('  URL:', window.location.href);
console.log('  Timestamp:', Date.now());
console.log('  💡 Run diagnoseDownloadItems() in console to analyze URLs');

  // ===== STATE MACHINE: Check pagination state BEFORE any UI setup =====
  console.log('  About to call PaginationManager.loadState()...');
  const state = await PaginationManager.loadState();

  // DEBUG: Log the actual state
  console.log('🔍 STATE CHECK:', {
    hasState: !!state,
    isComplete: state?.isComplete,
    isRunning: state?.isRunning,
    itemCount: state?.downloadItems?.length,
    currentPage: state?.currentPage,
    totalPages: state?.totalPages
  });


  if (state?.isComplete && state.downloadItems?.length > 0) {
    console.log('🎉 PHASE 3: Pagination complete, sending downloads to background');
    console.log('  Download items:', state.downloadItems.length);
    console.log('  Pagination state details:', {
      isComplete: state.isComplete,
      isRunning: state.isRunning,
      currentPage: state.currentPage,
      totalPages: state.totalPages,
      downloadItemsLength: state.downloadItems?.length || 0,
      collectedOrderIdsLength: state.collectedOrderIds?.length || 0,
      timestamp: state.timestamp ? new Date(state.timestamp).toISOString() : 'none'
    });

    // Load date parameters from pendingDownload state
    const pendingDownload = await new Promise(resolve => {
      chrome.storage.local.get('pendingDownload', (data) => resolve(data.pendingDownload));
    });

    const marketplace = detectMarketplace();
    console.log('  Marketplace:', marketplace);

    // 🆕 USE DATES FROM PAGINATIONSTATE (which persists across page reloads)
    const startDate = state.startDate || pendingDownload?.startDate;
    const endDate = state.endDate || pendingDownload?.endDate;
    const dateRangeType = state.dateRangeType || pendingDownload?.dateRangeType;

    console.log('  Date parameters from paginationState:', {
      startDate: startDate,
      endDate: endDate,
      dateRangeType: dateRangeType,
      source: state.startDate ? 'paginationState' : 'pendingDownload'
    });

    console.log('📤 Sending message to background service worker...');

    // Handle empty results with better messaging BEFORE sending to background
    if (state.downloadItems.length === 0) {
      console.log('📭 No invoices found in selected date range');

      const dateRange = pendingDownload ?
        `${pendingDownload.startDate || 'unknown'} to ${pendingDownload.endDate || 'unknown'}` :
        'selected date range';

      // Show helpful empty results message
      chrome.runtime.sendMessage({
        action: 'showResults',
        title: 'No Invoices Found',
        message: `No invoices were found in your selected date range (${dateRange}).`,
        suggestion: 'Try expanding your date range or check if you have orders in this marketplace.',
        type: 'empty'
      });

      // Clear the state since we're done
      await PaginationManager.clearState();

      return;
    }

    console.log('🔍 SENDING TO BACKGROUND - Debug Check:');
    console.log('  startDate being sent:', startDate);        // ✅ NEW
    console.log('  endDate being sent:', endDate);            // ✅ NEW
    console.log('  dateRangeType being sent:', dateRangeType);// ✅ NEW
    console.log('  Source:', state.startDate ? 'paginationState' : 'pendingDownload');

    chrome.runtime.sendMessage({
      type: 'startDownloads',
      downloadItems: state.downloadItems,
      marketplace: marketplace,
      concurrent: 3,
      startDate: startDate,        // ✅ NEW - uses persisted dates
      endDate: endDate,            // ✅ NEW - uses persisted dates
      dateRangeType: dateRangeType // ✅ NEW - uses persisted dates
    }).then(response => {
      console.log('✅ Background acknowledged:', response);

      // Notify user that downloads started (normal case)
      chrome.runtime.sendMessage({
        action: 'showProgress',
        title: 'Starting Downloads',
        message: `Processing ${state.downloadItems.length} invoices...`,
        progress: 0
      });

    }).catch(error => {
      console.error('❌ Failed to start downloads:', error);
      alert(`Error: Could not start downloads. ${error.message}`);
    });

    // Update popup status
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_PROGRESS',
      data: {
        phase: 'downloading',
        current: 0,
        total: state.downloadItems.length,
        currentFile: 'Starting...'
      }
    }).catch(err => console.log('Popup may be closed'));

    // Clear state immediately
    await PaginationManager.clearState();

    // Done - user can close tab now
    notificationManager.showCompletion(
      'Downloads Started',
      `Processing ${state.downloadItems.length} invoices. You can close this tab.`
    );

    return; // Exit - background handles rest
  }

  if (state?.isRunning) {
    console.log('📄 PHASE 2: Resuming pagination');
    await resumePagination(state);
    return; // Stop here, downloads will start after reload
  }

  console.log('🆕 PHASE 1: Fresh start, waiting for user');
  // Continue with normal UI setup

  // Check for any pending operations using unified handler
  const resumeHandled = await handlePageResume();

  // Always register message listeners, even when handling resume operations
  // The popup still needs to communicate with content scripts during resume
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log('📨 Content script received message:', request.action);

    try {
      if (request.action === "ping") {
        console.log('🏓 Ping received, sending pong');
        sendResponse({ pong: true, utilitiesReady: true, timestamp: Date.now() });
        return true;
      }

      if (request.action === "getAccountType") {
        console.log('🔍 Detecting account type...');
        const isBusinessAccount = detectAccountType();
        console.log('  Account type detected:', isBusinessAccount ? 'Business' : 'Consumer');
        sendResponse({ isBusinessAccount: isBusinessAccount, detected: true });
        return true;
      }

      if (request.action === "startDownload") {
        console.log('📥 Download requested');
        console.log('  Start date:', request.startDate);
        console.log('  End date:', request.endDate);
        console.log('  Account type:', request.accountType);
        console.log('  Date range type:', request.dateRangeType);

        startDownloadProcess(request.startDate, request.endDate, request.accountType, request.dateRangeType);
        sendResponse({ success: true, message: 'Download started' });
        return true;
      }

      if (request.action === "checkAndDownloadPDF") {
        console.log('📄 Check and download PDF requested');
        sendResponse({ success: true });
        return true;
      }

      if (request.action === "getOrderCount") {
        console.log('🔢 Getting order count...');
        const orderCount = getOrderCount();
        console.log('  Found', orderCount, 'orders');
        sendResponse({ count: orderCount });
        return true;
      }

      if (request.action === "getContentState") {
        console.log('📊 Getting content script state...');

        // Check if we have pagination state
        PaginationManager.loadState().then(state => {
          if (state) {
            sendResponse({
              hasState: true,
              isRunning: state.isRunning,
              isComplete: state.isComplete,
              currentPage: state.currentPage,
              totalPages: state.totalPages,
              collectedItems: state.downloadItems?.length || 0,
              marketplace: detectMarketplace(),
              url: window.location.href
            });
          } else {
            sendResponse({ hasState: false });
          }
        }).catch(error => {
          console.error('❌ Error getting state:', error);
          sendResponse({ hasState: false, error: error.message });
        });

        return true; // Will respond asynchronously
      }

      if (request.action === "extractAndDownloadPDF") {
        console.log('🔍 EXTRACTING PDF from invoice page for:', request.filename);
        console.log('📋 Order ID:', request.orderId);

        // Try multiple selectors for PDF download links on Amazon invoice pages
        const pdfSelectors = [
          'a[href*="pdf"]',
          'a[href*="download"]',
          'a[href*="print"]',
          'a[download]',
          'button[onclick*="pdf"]',
          'button[onclick*="download"]',
          // Amazon specific selectors
          '.a-button[href*="pdf"]',
          '.download-button',
          '[data-action="download"]'
        ];

        let pdfLink = null;
        let pdfUrl = null;

        for (const selector of pdfSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const href = element.href || element.getAttribute('onclick')?.match(/['"]([^'"]*pdf[^'"]*)['"]/i)?.[1];
            if (href && (href.toLowerCase().endsWith('.pdf') || href.includes('/documents/download/'))) {
              console.log('✅ Found PDF link via selector:', selector, 'URL:', href);
              pdfLink = element;
              pdfUrl = href;
              break;
            }
          }
          if (pdfLink) break;
        }

        if (!pdfUrl) {
          console.log('❌ No PDF URL found with selectors, searching page content...');
          // Try to find PDF URL in page content or script tags
          const pageContent = document.body.innerHTML;
          const pdfMatch = pageContent.match(/https?:\/\/[^"'\s]*documents\/download[^"'\s]*\.pdf[^"'\s]*/i) ||
                          pageContent.match(/https?:\/\/[^"'\s]*\.pdf[^"'\s]*(?=\s|$|")/i);
          if (pdfMatch) {
            pdfUrl = pdfMatch[0];
            console.log('✅ Found PDF URL in page content:', pdfUrl);

            // Additional validation - make sure it's a real PDF URL
            if (!pdfUrl.includes('/documents/download/') && !pdfUrl.includes('amazon.')) {
              console.warn('⚠️ Found PDF URL but it may not be a direct download:', pdfUrl);
              pdfUrl = null;
            }
          } else {
            console.log('❌ No valid PDF URL found anywhere on page');
          }
        }

        if (pdfUrl) {
          console.log('✅ FOUND PDF URL:', pdfUrl);
          console.log('📤 Sending downloadPDF message to background...');

          // Download the PDF
          chrome.runtime.sendMessage({
            action: 'downloadPDF',
            url: pdfUrl,
            filename: request.filename,
            orderId: request.orderId,
            marketplace: 'DE'
          }, (response) => {
            if (response && response.success) {
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: response?.error || 'Download failed' });
            }
          });
        } else {
          console.error('❌ No PDF link found on invoice page');
          sendResponse({ success: false, error: 'No PDF link found' });
        }

        return true;
      }

      if (request.action === "cancelCollection") {
        console.log('🛑 Cancelling collection...');

        // Cancel pagination if running
        if (typeof getPaginationManager === 'function') {
          const pm = await getPaginationManager();
          if (pm && pm.state?.isRunning) {
            pm.cancel();
            console.log('✅ Pagination cancelled');

            // Notify popup
            chrome.runtime.sendMessage({
              action: 'collectionCancelled'
            }).catch(() => {});
          }
        }

        sendResponse({ success: true });
        return true;
      }

      console.log('❓ Unknown action received:', request.action);
      sendResponse({ error: 'Unknown action', action: request.action });
      return true;

    } catch (error) {
      console.error('❌ Error handling message:', error);
      sendResponse({ error: error.message, stack: error.stack });
      return true;
    }
  });

  // Note: Notification functions are now exported from helpers.js (loaded first)

  console.log('✅ Message listeners registered successfully');
  console.log('🎯 Content script fully initialized and ready');
}

})();
