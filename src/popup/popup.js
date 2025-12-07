// ============================================
// ACCOUNTING PERIOD SELECTOR FUNCTIONS
// ============================================

/**
 * Determine the accounting period range type from dates
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 * @returns {string} Range type identifier
 */
function determineAccountingPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.getMonth(); // 0-11
  const endMonth = end.getMonth();

  // Check for accounting quarters
  if (startMonth === 7 && endMonth === 9) {  // Aug (7) to Oct (9)
    return 'Q1_Aug_Oct';
  }
  if (startMonth === 10 && endMonth === 0) {  // Nov (10) to Jan (0)
    return 'Q2_Nov_Jan';
  }
  if (startMonth === 1 && endMonth === 3) {   // Feb (1) to Apr (3)
    return 'Q3_Feb_Apr';
  }
  if (startMonth === 4 && endMonth === 6) {   // May (4) to Jul (6)
    return 'Q4_May_Jul';
  }

  // Fall back to custom
  return 'Custom';
}

/**
 * Calculate date range for accounting periods
 * @param {string} quarter - 'q1', 'q2', 'q3', 'q4', or 'custom'
 * @returns {object|null} {startDate, endDate, rangeType} or null for custom
 */
function getAccountingPeriodDates(quarter) {
  // Get selected year from the year selector
  const yearSelect = document.getElementById('yearSelect');
  const selectedYear = yearSelect ? parseInt(yearSelect.value) : new Date().getFullYear();

  let startDate, endDate, rangeType;

  switch(quarter) {
    case 'q1': // Aug-Oct
      startDate = `${selectedYear}-08-01`;
      endDate = `${selectedYear}-10-31`;
      rangeType = 'Q1_Aug_Oct';
      break;

    case 'q2': // Nov-Jan (spans year boundary)
      startDate = `${selectedYear}-11-01`;
      endDate = `${selectedYear + 1}-01-31`;
      rangeType = 'Q2_Nov_Jan';
      break;

    case 'q3': // Feb-Apr
      startDate = `${selectedYear}-02-01`;
      endDate = `${selectedYear}-04-30`;
      rangeType = 'Q3_Feb_Apr';
      break;

    case 'q4': // May-Jul
      startDate = `${selectedYear}-05-01`;
      endDate = `${selectedYear}-07-31`;
      rangeType = 'Q4_May_Jul';
      break;

    case 'custom':
      return null; // User will select manually

    default:
      return null;
  }

  return { startDate, endDate, rangeType };
}

function initializeAccountingPeriodSelector(startDateInput, endDateInput) {
  // Initialize with Q1 as default
  const dates = getAccountingPeriodDates('q1');
  if (dates) {
    startDateInput.value = dates.startDate;
    endDateInput.value = dates.endDate;
    startDateInput.disabled = true; // Disable inputs for preset mode
    endDateInput.disabled = true;
    window.setCurrentDateRangeType(dates.rangeType);
    updateDateSummary(new Date(dates.startDate), new Date(dates.endDate));

    // Mark Q1 button as active by default
    const q1Button = document.querySelector('.preset-btn[data-preset="q1"]');
    if (q1Button) {
      q1Button.classList.add('active');
    }
  }

  // Handle year selector changes
  const yearSelect = document.getElementById('yearSelect');
  if (yearSelect) {
    yearSelect.addEventListener('change', () => {
      console.log('📅 Year changed to:', yearSelect.value);
      // If a preset button is currently active, recalculate its dates
      const activeButton = document.querySelector('.preset-btn.active');
      if (activeButton && activeButton.dataset.preset !== 'custom') {
        const preset = activeButton.dataset.preset;
        const dates = getAccountingPeriodDates(preset);
        if (dates) {
          document.getElementById('startDate').value = dates.startDate;
          document.getElementById('endDate').value = dates.endDate;
          updateDateSummary(new Date(dates.startDate), new Date(dates.endDate));
        }
      }
    });
  }

  // Handle preset button clicks
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;

      // Remove active class from all buttons
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));

      if (preset === 'custom') {
        // Activate custom mode - show date inputs
        btn.classList.add('active');
        document.getElementById('startDate').disabled = false;
        document.getElementById('endDate').disabled = false;

        // Show custom date inputs
        const customDates = document.querySelector('.custom-dates');
        if (customDates) {
          customDates.style.display = 'flex';
        }

        console.log('📅 Custom date range selected');
        window.setCurrentDateRangeType('Custom');
        return;
      }

      // Hide custom date inputs when selecting presets
      const customDates = document.querySelector('.custom-dates');
      if (customDates) {
        customDates.style.display = 'none';
      }

      // Get accounting period dates
      const dates = getAccountingPeriodDates(preset);
      if (dates) {
        // Set the date inputs
        document.getElementById('startDate').value = dates.startDate;
        document.getElementById('endDate').value = dates.endDate;

        // Disable manual editing for preset dates
        document.getElementById('startDate').disabled = true;
        document.getElementById('endDate').disabled = true;

        // Mark button as active
        btn.classList.add('active');

        // Update current date range type for storage
        window.setCurrentDateRangeType(dates.rangeType);

        console.log(`📊 ${dates.rangeType} selected:`, dates);
        updateDateSummary(new Date(dates.startDate), new Date(dates.endDate));
      }
    });
  });

  startDateInput.addEventListener('change', updateCustomDateSummary);
  endDateInput.addEventListener('change', updateCustomDateSummary);
}

function updateDateSummary(startDate, endDate) {
  const dateRangeSummary = document.getElementById('dateRangeSummary');
  if (!dateRangeSummary) return;

  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  const formattedStart = startDate.toLocaleDateString('en-US', options);
  const formattedEnd = endDate.toLocaleDateString('en-US', options);
  dateRangeSummary.textContent = `${formattedStart} - ${formattedEnd}`;
}

function updateCustomDateSummary() {
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    updateDateSummary(start, end);

    // Update the current date range type for custom dates
    window.setCurrentDateRangeType('Custom');
  } else {
    const dateRangeSummary = document.getElementById('dateRangeSummary');
    if (dateRangeSummary) {
      dateRangeSummary.textContent = 'Please select dates...';
    }
  }
}

function updateAccountTypeUI(isBusinessAccount) {
  if (accountTypeSelect) {
    accountTypeSelect.value = isBusinessAccount ? 'business' : 'nonbusiness';
    accountTypeSelect.disabled = true;
  }
}

// ============================================
// MULTI-MARKETPLACE SUPPORT
// ============================================

// Multi-marketplace download queue
let marketplaceQueue = [];

/**
 * Handle multi-marketplace download
 */
async function startMultiMarketplaceDownload() {
  // Get selected marketplaces from UI
  const selectedMarketplaces = getSelectedMarketplaces(); // ['DE', 'FR', 'IT']

  if (selectedMarketplaces.length === 0) {
    showToast('Please select at least one marketplace', 'error');
    return;
  }

  console.log(`🌍 Starting multi-marketplace download: ${selectedMarketplaces.join(', ')}`);

  marketplaceQueue = [...selectedMarketplaces];

  // Process queue
  await processMarketplaceQueue();
}

/**
 * Process marketplace queue sequentially
 */
async function processMarketplaceQueue() {
  if (marketplaceQueue.length === 0) {
    showToast('✅ All marketplaces complete!', 'success');
    return;
  }

  const currentMarket = marketplaceQueue[0];
  const remaining = marketplaceQueue.length;

  console.log(`📍 Processing ${currentMarket} (${remaining} remaining)...`);

  showToast(`Downloading ${currentMarket}... (${remaining} markets left)`, 'info');

  // Open marketplace in new tab
  const marketUrl = getMarketplaceUrl(currentMarket);
  const tab = await chrome.tabs.create({ url: marketUrl, active: false });

  // Wait for download to complete (listen for completion message)
  await waitForMarketplaceComplete(tab.id);

  // Remove from queue
  marketplaceQueue.shift();

  // Close tab
  await chrome.tabs.remove(tab.id);

  // Process next
  await processMarketplaceQueue();
}

/**
 * Get marketplace URL
 */
function getMarketplaceUrl(marketCode) {
  const urls = {
    'DE': 'https://www.amazon.de/your-orders/orders',
    'FR': 'https://www.amazon.fr/your-orders/orders',
    'IT': 'https://www.amazon.it/your-orders/orders',
    'ES': 'https://www.amazon.es/your-orders/orders',
    'UK': 'https://www.amazon.co.uk/your-orders/orders'
  };
  return urls[marketCode];
}

/**
 * Get selected marketplaces from UI checkboxes
 */
function getSelectedMarketplaces() {
  const checkboxes = document.querySelectorAll('.marketplace-checkbox:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Wait for marketplace download to complete
 */
function waitForMarketplaceComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (message, sender) => {
      if (sender.tab && sender.tab.id === tabId && message.action === 'downloadComplete') {
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Timeout after 30 minutes (1800000ms) as fallback
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve();
    }, 1800000);
  });
}

// ============================================
// MAIN POPUP INITIALIZATION
// ============================================

// Order count functionality (keeping local since it's specific to popup initialization)
function getOrderCount() {
  window.showSkeletonLoading(true);

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      window.showSkeletonLoading(false);
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {action: "getOrderCount"}, function(response) {
      window.showSkeletonLoading(false);

      if (!chrome.runtime.lastError && response && response.count !== undefined) {
        window.setOrderCount(response.count);
        window.setUIState(window.UI_STATES.IDLE, { orderCount: response.count });
      } else {
        window.setUIState(window.UI_STATES.IDLE, { orderCount: '--' });
      }
    });
  });
}


// ============================================
// MAIN INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('🔄 DOMContentLoaded fired in popup.js');

  window.initializePopup();

  const activatedState = {
    licenseValid: true,
    plan: 'internal'
  };

  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const yearSelect = document.getElementById('yearSelect');
  const downloadBtn = document.getElementById('downloadBtn');
  const dateRangeSummary = document.getElementById('dateRangeSummary');
  const accountTypeSelect = document.getElementById('accountType');
  const retryBtn = document.getElementById('retryBtn');
  const openFolderBtn = document.getElementById('openFolderBtn');
  const downloadMoreBtn = document.getElementById('downloadMoreBtn');
  const optionsLink = document.getElementById('optionsLink');
  const historyLink = document.getElementById('historyLink');

  console.log('🔍 Element check:', {
    startDateInput: !!startDateInput,
    endDateInput: !!endDateInput,
    downloadBtn: !!downloadBtn,
    yearSelect: !!yearSelect
  });

  if (!startDateInput || !endDateInput || !downloadBtn) {
    console.error('❌ Required elements not found:', {
      startDateInput: !!startDateInput,
      endDateInput: !!endDateInput,
      downloadBtn: !!downloadBtn
    });
    return;
  }

  console.log('✅ All required elements found');

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const today = new Date().toISOString().split('T')[0];
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

  startDateInput.min = oneYearAgoStr;
  startDateInput.max = today;
  endDateInput.min = oneYearAgoStr;
  endDateInput.max = today;

  window.initializeAdvancedOptions();

  // Initialize accounting period date selector
  initializeAccountingPeriodSelector(startDateInput, endDateInput);

  downloadBtn.addEventListener('click', function() {
    console.log('🔵 DOWNLOAD BUTTON CLICKED - Event listener fired');

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const accountType = accountTypeSelect ? accountTypeSelect.value : 'nonbusiness';
    const uploadToDrive = document.getElementById('uploadToDrive').checked;

    console.log('📅 Date range:', startDate, 'to', endDate);

    if (!startDate) {
      window.showStatus('Please select a start date.', 'error');
      console.log('❌ No start date');
      return;
    }

    if (!endDate) {
      window.showStatus('Please select an end date.', 'error');
      console.log('❌ No end date');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      window.showStatus('Start date must be before or equal to end date.', 'error');
      console.log('❌ Invalid date range');
      return;
    }

    console.log('✅ Validation passed, proceeding...');
    console.log('🎬 Setting UI to DOWNLOADING state');

    window.setUIState(window.UI_STATES.DOWNLOADING, {
      current: 0,
      total: null,
      currentFile: 'Collecting orders...'
    });

    console.log('✅ UI state set');
    downloadBtn.disabled = true;

    // Determine the correct accounting period range type
    const dateRangeType = determineAccountingPeriod(startDate, endDate);

    chrome.storage.local.set({
      pendingDownload: {
        startDate: startDate,
        endDate: endDate,
        accountType: accountType,
        dateRangeType: dateRangeType,
        timestamp: Date.now(),
        shouldAutoStart: false
      }
    }, function() {
      console.log('✅ pendingDownload state saved');



      // 🆕 NOW SEND MESSAGE TO CONTENT SCRIPT

      console.log('📨 Sending startDownload message to content script');



      chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {

        if (tabs.length === 0) {

          console.error('❌ No active tab found');

          window.showToast('Error: No active tab found', 'error');

          window.setUIState('idle');

          return;

        }



        const tab = tabs[0];

        console.log('📍 Target tab:', tab.id, tab.url);



        try {

          const response = await chrome.tabs.sendMessage(tab.id, {

            action: 'startDownload',

            startDate: startDate,

            endDate: endDate,

            accountType: accountType,

            dateRangeType: dateRangeType,  // ← Now uses accounting periods

            uploadToDrive: uploadToDrive

          });



          console.log('📬 Response received from content script:', response);



          if (response && response.success) {

            console.log('✅ Download started successfully');

            window.showToast('Download started!', 'success');

          } else {

            console.error('❌ Download failed to start:', response);

            window.showToast('Failed to start download', 'error');

            window.setUIState('idle');

          }

        } catch (error) {

          console.error('❌ Error sending message to content script:', error);

          window.showToast(`Error: ${error.message}`, 'error');

          window.setUIState('idle');

        }

      });
    });
  });

  // Event handlers for footer links
  if (historyLink) {
    historyLink.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
    });
  }

  if (optionsLink) {
    optionsLink.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', function() {
      chrome.runtime.sendMessage({action: "openDownloadFolder"}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error opening folder:', chrome.runtime.lastError);
        }
      });
    });
  }

  if (downloadMoreBtn) {
    downloadMoreBtn.addEventListener('click', function() {
      window.setUIState(window.UI_STATES.IDLE, { orderCount: window.orderCount });
      downloadBtn.disabled = false;
      getOrderCount();
    });
  }

  const downloadMoreBtnError = document.getElementById('downloadMoreBtnError');
  if (downloadMoreBtnError) {
    downloadMoreBtnError.addEventListener('click', function() {
      window.setUIState(window.UI_STATES.IDLE, { orderCount: window.orderCount });
      downloadBtn.disabled = false;
      getOrderCount();
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', window.retryFailed);
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Message received in popup:', message);

    if (message.action === 'updateAccountType') {
      updateAccountTypeUI(message.isBusinessAccount);
    }

    if (message.action === 'downloadProgress') {
      console.log('📊 Progress update:', message);

      // Update UI immediately
      window.updateProgressUI(
        message.current,
        message.total,
        message.successful,
        message.failed
      );

      // Switch to downloading state if not already
      if (message.total > 0 && message.current < message.total) {
        window.setUIState('downloading');
      }
    }

    if (message.action === 'downloadComplete') {
      console.log('✅ Download complete:', message.results);

      // Check if Google Drive upload was requested
      chrome.storage.local.get(['pendingDownload'], function(result) {
        const pendingDownload = result.pendingDownload;

        if (pendingDownload && pendingDownload.uploadToDrive) {
          console.log('☁️ Starting Google Drive upload...');

          // Send message to background script to upload to Google Drive
          chrome.runtime.sendMessage({
            action: 'uploadToGoogleDrive',
            sessionPath: message.results.sessionPath || 'Amazon_Invoices',
            metadata: {
              ...message.results,
              marketplace: pendingDownload.marketplace || 'Unknown',
              downloadedItems: message.results.downloadedItems || []
            }
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.error('❌ Google Drive upload request failed:', chrome.runtime.lastError);
              window.showToast('Download complete, but Google Drive upload failed', 'warning');
            } else if (response && response.success) {
              console.log('✅ Google Drive upload initiated');
              window.showToast(`Download complete! ${response.uploadedCount} files uploaded to Google Drive`, 'success');
            } else {
              console.error('❌ Google Drive upload failed:', response);
              window.showToast('Download complete, but Google Drive upload failed', 'warning');
            }
          });
        }
      });

      window.showCompletionUI(
        message.results.successful,
        message.results.failed,
        message.results.total
      );
    }

    if (message.action === 'downloadError') {
      console.error('❌ Download error received:', message.error);
      window.showToast('❌ Error: ' + (message.error || 'Unknown error'), 'error');
      window.setUIState(window.UI_STATES.ERROR);

      const downloadBtn = document.getElementById('downloadBtn');
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download Invoices';
      }
    }

    return true;
  });
});