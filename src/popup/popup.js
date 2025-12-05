// ============================================
// STATE MANAGEMENT SYSTEM
// ============================================

// State constants
const UI_STATES = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  SUCCESS: 'success',
  ERROR: 'error'
};

// Phase icons for different download stages
const PHASE_ICONS = {
  idle: '📋',
  collecting: '🔍',
  preparing: '⚙️',
  downloading: '⬇️',
  complete: '✅',
  error: '❌'
};

let currentState = UI_STATES.IDLE;
let orderCount = 0;
let currentDateRangeType = 'last-month'; // Default
let currentDownloadCount = 0;
let totalDownloadCount = 0;
let failedDownloads = [];
let downloadStartTime = null;
let downloadEndTime = null;
let downloadItems = new Map(); // Track download items by ID

// ============================================
// UI HELPER FUNCTIONS
// ============================================

/**
 * Update progress UI
 */
function updateProgressUI(current, total, successful, failed) {

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

}

/**
 * Show completion UI
 */
function showCompletionUI(successful, failed, total) {
  console.log('🎉 Showing completion:', { successful, failed, total });
  
  // Update success state with results
  setUIState(UI_STATES.SUCCESS, {
    successCount: successful,
    failedCount: failed
  });
  
  // Show toast message
  if (failed === 0 && successful === 0) {
    showToast('⚠️ No invoices found in selected date range', 'warning');
    setUIState(UI_STATES.IDLE);
  } else if (failed === 0) {
    showToast(`✅ Successfully downloaded ${successful} invoices!`, 'success');
  } else if (successful === 0) {
    showToast(`❌ All ${failed} downloads failed`, 'error');
    setUIState(UI_STATES.ERROR, {
      errorCount: failed,
      errors: [`${failed} download(s) failed`]
    });
  } else {
    showToast(`⚠️ ${successful} succeeded, ${failed} failed`, 'warning');
  }
  
  // Re-enable button
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download Invoices';
  }
}

/**
 * Show toast message
 */
function showToast(message, type = 'info') {
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
}

// ============================================
// STATE TRANSITION FUNCTIONS
// ============================================

// Update state icon based on current phase
function updateStateIcon(state, phase = null) {
  const stateIcon = document.querySelector(`.status-${state} .state-icon`);
  if (stateIcon) {
    if (state === UI_STATES.DOWNLOADING && phase) {
      stateIcon.textContent = PHASE_ICONS[phase] || PHASE_ICONS.downloading;
    } else {
      stateIcon.textContent = PHASE_ICONS[state] || '📋';
    }
  }
}

// State transition functions
function setUIState(state, data = {}) {
  console.log('🎨 Switching to state:', state);

  // Hide all states
  document.querySelectorAll('.status-state').forEach(el => {
    el.classList.remove('active');
  });

  // Show target state
  const targetState = document.querySelector(`.status-${state}`);
  if (targetState) {
    targetState.classList.add('active');
    currentState = state;
    console.log('✅ State switched to:', state);
  } else {
    console.error('❌ State element not found:', `.status-${state}`);
  }

  // Update state-specific icon
  updateStateIcon(state, data.phase);

  // Update state-specific data
  switch (state) {
    case UI_STATES.IDLE:
      updateIdleState(data);
      break;
    case UI_STATES.DOWNLOADING:
      updateDownloadingState(data);
      break;
    case UI_STATES.SUCCESS:
      updateSuccessState(data);
      break;
    case UI_STATES.ERROR:
      updateErrorState(data);
      break;
  }
}

function updateIdleState(data = {}) {
  if (data.orderCount !== undefined) {
    orderCount = data.orderCount;
    document.getElementById('orderCount').textContent = orderCount;
    showSkeletonLoading(false); // Ensure skeleton is hidden when we have data
  }
  updateStateIcon(UI_STATES.IDLE);
}

function updateDownloadingState(data = {}) {
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
    const timeRemaining = calculateTimeRemaining(data.current, data.total, downloadStartTime);
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
  updateStateIcon(UI_STATES.DOWNLOADING, phase);
}

function updateSuccessState(data = {}) {
  // Set end time for calculating total duration
  downloadEndTime = Date.now();

  const successCount = data.successCount !== undefined ? data.successCount : currentDownloadCount;
  const failedCount = data.failedCount || failedDownloads.length;
  const totalTime = downloadStartTime && downloadEndTime ? downloadEndTime - downloadStartTime : 0;

  // Update summary card stats
  const successCountEl = document.getElementById('successCount');
  const failedCountEl = document.getElementById('failedCount');
  const totalTimeEl = document.getElementById('totalTime');
  
  if (successCountEl) successCountEl.textContent = successCount;
  if (failedCountEl) failedCountEl.textContent = failedCount;
  if (totalTimeEl) totalTimeEl.textContent = formatDuration(totalTime);

  updateStateIcon(UI_STATES.SUCCESS);

  // Trigger success animation on the summary icon
  const summaryIcon = document.querySelector('.summary-icon');
  if (summaryIcon) {
    summaryIcon.style.animation = 'none';
    setTimeout(() => {
      summaryIcon.style.animation = 'success-pulse 0.6s ease';
    }, 10);
  }
}

// Format duration in milliseconds to readable format
function formatDuration(ms) {
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
}

function updateErrorState(data = {}) {
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
    showErrorSummary(data.failedDownloads);
  }

  updateStateIcon(UI_STATES.ERROR);
}

// Enhanced error summary display
function showErrorSummary(failedItems) {
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
}

// ============================================
// ADVANCED OPTIONS
// ============================================

function initializeAdvancedOptions() {
  const includeDigitalCheckbox = document.getElementById('includeDigital');
  const concurrentSelect = document.getElementById('concurrent');

  if (!includeDigitalCheckbox || !concurrentSelect) return;

  // Load saved options
  chrome.storage.sync.get(['includeDigital', 'concurrentDownloads'], function(data) {
    if (data.includeDigital !== undefined) {
      includeDigitalCheckbox.checked = data.includeDigital;
    }
    if (data.concurrentDownloads !== undefined) {
      concurrentSelect.value = data.concurrentDownloads;
    }
  });

  // Save options when changed
  includeDigitalCheckbox.addEventListener('change', function() {
    chrome.storage.sync.set({ includeDigital: this.checked });
  });

  concurrentSelect.addEventListener('change', function() {
    chrome.storage.sync.set({ concurrentDownloads: parseInt(this.value) });
  });
}

function getAdvancedOptions() {
  const includeDigital = document.getElementById('includeDigital');
  const concurrent = document.getElementById('concurrent');
  
  return {
    includeDigital: includeDigital ? includeDigital.checked : false,
    concurrentDownloads: concurrent ? parseInt(concurrent.value) : 3
  };
}

// ============================================
// DOWNLOAD PREVIEW
// ============================================

function addDownloadItem(id, filename, status = 'pending') {
  const downloadList = document.getElementById('downloadList');
  const previewContainer = document.getElementById('downloadPreview');

  if (!downloadList) return;

  const item = document.createElement('div');
  item.className = `download-item ${status}`;
  item.id = `download-${id}`;
  item.innerHTML = `
    <span class="file-icon">${getFileIcon(filename)}</span>
    <span class="file-name">${filename}</span>
    <span class="file-status ${status}">${getStatusText(status)}</span>
  `;

  downloadList.appendChild(item);
  downloadItems.set(id, { element: item, filename, status });

  if (previewContainer && previewContainer.style.display === 'none') {
    previewContainer.style.display = 'block';
  }
}

function updateDownloadItem(id, status) {
  const item = downloadItems.get(id);
  if (item) {
    item.element.className = `download-item ${status}`;
    const statusElement = item.element.querySelector('.file-status');
    if (statusElement) {
      statusElement.className = `file-status ${status}`;
      statusElement.textContent = getStatusText(status);
    }
    item.status = status;
  }
}

function clearDownloadPreview() {
  const downloadList = document.getElementById('downloadList');
  const previewContainer = document.getElementById('downloadPreview');

  if (downloadList) {
    downloadList.innerHTML = '';
  }
  downloadItems.clear();
  
  if (previewContainer) {
    previewContainer.style.display = 'none';
  }
}

function getFileIcon(filename) {
  if (filename.toLowerCase().includes('pdf')) {
    return '📄';
  } else if (filename.toLowerCase().includes('jpg') || filename.toLowerCase().includes('jpeg')) {
    return '🖼️';
  } else if (filename.toLowerCase().includes('zip')) {
    return '📦';
  }
  return '📄';
}

function getStatusText(status) {
  switch (status) {
    case 'pending': return 'Waiting';
    case 'downloading': return 'Downloading';
    case 'completed': return 'Done';
    case 'failed': return 'Failed';
    default: return status;
  }
}

// ============================================
// RETRY FUNCTIONALITY
// ============================================

function retryFailed() {
  const failedDownloads = JSON.parse(localStorage.getItem('failedDownloads') || '[]');

  if (failedDownloads.length > 0) {
    console.log('Retrying failed downloads:', failedDownloads);

    setUIState(UI_STATES.DOWNLOADING, {
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
        setUIState(UI_STATES.ERROR, {
          errorCount: failedDownloads.length,
          errors: ['Failed to retry downloads']
        });
      } else {
        localStorage.removeItem('failedDownloads');
      }
    });
  }
}

// ============================================
// ORDER COUNT
// ============================================

function getOrderCount() {
  showSkeletonLoading(true);

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      showSkeletonLoading(false);
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {action: "getOrderCount"}, function(response) {
      showSkeletonLoading(false);

      if (!chrome.runtime.lastError && response && response.count !== undefined) {
        orderCount = response.count;
        setUIState(UI_STATES.IDLE, { orderCount: orderCount });
      } else {
        setUIState(UI_STATES.IDLE, { orderCount: '--' });
      }
    });
  });
}

function showSkeletonLoading(show) {
  const orderCountText = document.getElementById('orderCountText');
  const loadingSkeleton = document.getElementById('loadingSkeleton');

  if (orderCountText) {
    orderCountText.style.display = show ? 'none' : 'block';
  }
  if (loadingSkeleton) {
    loadingSkeleton.style.display = show ? 'block' : 'none';
  }
}

// ============================================
// PROGRESS TRACKING
// ============================================

function updateProgress(percentage) {
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.style.width = percentage + '%';
  }
}

function updateDownloadProgress(current, total, statusMessage = null) {
  currentDownloadCount = current;
  totalDownloadCount = total;

  if (downloadStartTime === null && current > 0) {
    downloadStartTime = Date.now();
  }

  updateDownloadingState({
    current: current,
    total: total,
    currentFile: statusMessage || '--'
  });
}

function calculateTimeRemaining(current, total, startTime) {
  if (!startTime || current === 0 || total === 0) {
    return null;
  }

  const elapsed = Date.now() - startTime;
  const rate = current / elapsed;
  const remaining = (total - current) / rate;

  return formatTime(remaining);
}

function formatTime(ms) {
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
}

function updateDownloadStatus(message) {
  if (currentState === UI_STATES.DOWNLOADING) {
    setUIState(UI_STATES.DOWNLOADING, {
      current: currentDownloadCount,
      total: totalDownloadCount,
      currentFile: message
    });
  }
}

function showStatus(message, type = 'info') {
  showToast(message, type);
}

// ============================================
// POPUP STATE SYNCHRONIZATION
// ============================================

function showInProgressUI(state) {
  console.log('🔄 Showing IN PROGRESS UI');

  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.style.display = 'none';
  }

  const statusDiv = document.getElementById('status') || createStatusDiv();
  statusDiv.innerHTML = `
    <div style="padding: 16px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
      <h3 style="margin: 0 0 8px 0; color: #856404;">
        🔄 Collection In Progress
      </h3>
      <p style="margin: 4px 0; color: #856404;">
        Page ${state.currentPage || '?'} of ${state.totalPages || '?'}
      </p>
      <p style="margin: 4px 0; color: #856404;">
        Found ${state.collectedItems || 0} invoices
      </p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #856404;">
        💡 Please wait in the Amazon tab...
      </p>
      <button id="cancel-from-popup" style="
        margin-top: 12px; width: 100%;
        background: #dc3545; color: white;
        border: none; padding: 10px; border-radius: 6px;
        cursor: pointer; font-size: 14px;">
        Cancel Collection
      </button>
    </div>
  `;

  const cancelBtn = document.getElementById('cancel-from-popup');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelCollection' });
          window.close();
        }
      });
    });
  }

  disableFormInputs();
}

function showCompletedUI(state) {
  console.log('✅ Showing COMPLETED UI');

  const statusDiv = document.getElementById('status') || createStatusDiv();
  statusDiv.innerHTML = `
    <div style="padding: 16px; background: #d4edda; border-radius: 8px; border: 1px solid #28a745;">
      <h3 style="margin: 0 0 8px 0; color: #155724;">
        ✅ Collection Complete
      </h3>
      <p style="margin: 4px 0; color: #155724;">
        Collected ${state.collectedItems || 0} invoices
      </p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #155724;">
        💡 Downloads are processing in the background
      </p>
    </div>
  `;

  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.style.display = 'none';
  }
}

function showReadyUI() {
  console.log('🆕 Showing READY UI');

  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.style.display = 'block';
  }

  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.innerHTML = '';
  }

  enableFormInputs();
}

function createStatusDiv() {
  const div = document.createElement('div');
  div.id = 'status';

  const container = document.querySelector('.popup-container') || document.body;
  container.insertBefore(div, container.firstChild);

  return div;
}

function disableFormInputs() {
  const inputs = document.querySelectorAll('input, select, button');
  inputs.forEach(input => {
    if (input.id !== 'cancel-from-popup') {
      input.disabled = true;
    }
  });
}

function enableFormInputs() {
  const inputs = document.querySelectorAll('input, select, button');
  inputs.forEach(input => input.disabled = false);
}

async function initializePopup() {
  console.log('🎬 Popup initializing...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      console.log('⚠️ No active tab found');
      return;
    }

    if (!tab.url?.includes('amazon.')) {
      console.log('ℹ️ Not on Amazon page');
      return;
    }

    console.log('🔍 Querying content script state...');

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getContentState'
    });

    console.log('📊 Content script state:', response);

    if (response?.hasState) {
      if (response.isRunning) {
        showInProgressUI(response);
      } else if (response.isComplete) {
        showCompletedUI(response);
      } else {
        showReadyUI();
      }
    } else {
      showReadyUI();
    }

  } catch (error) {
    console.log('ℹ️ Could not get content state (expected if no content script):', error);
    showReadyUI();
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  initializePopup();

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

  if (!startDateInput || !endDateInput || !downloadBtn) {
    console.error('Required elements not found');
    return;
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const today = new Date().toISOString().split('T')[0];
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

  startDateInput.min = oneYearAgoStr;
  startDateInput.max = today;
  endDateInput.min = oneYearAgoStr;
  endDateInput.max = today;

  // Initialize accounting period date selector
  initializeAccountingPeriodSelector();

  initializeAdvancedOptions();

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

  function initializeAccountingPeriodSelector() {
    // Initialize with Q1 as default
    const dates = getAccountingPeriodDates('q1');
    if (dates) {
      startDateInput.value = dates.startDate;
      endDateInput.value = dates.endDate;
      startDateInput.disabled = true; // Disable inputs for preset mode
      endDateInput.disabled = true;
      currentDateRangeType = dates.rangeType;
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
          currentDateRangeType = 'Custom';
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
          currentDateRangeType = dates.rangeType;

          console.log(`📊 ${dates.rangeType} selected:`, dates);
          updateDateSummary(new Date(dates.startDate), new Date(dates.endDate));
        }
      });
    });

    startDateInput.addEventListener('change', updateCustomDateSummary);
    endDateInput.addEventListener('change', updateCustomDateSummary);
  }

  function updateDateSummary(startDate, endDate) {
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
      currentDateRangeType = 'Custom';
    } else if (dateRangeSummary) {
      dateRangeSummary.textContent = 'Please select dates...';
    }
  }

  setUIState(UI_STATES.IDLE, { orderCount: '--' });
  getOrderCount();

  downloadBtn.addEventListener('click', function() {
    console.log('🔵 DOWNLOAD BUTTON CLICKED');

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const accountType = accountTypeSelect ? accountTypeSelect.value : 'nonbusiness';

    console.log('📅 Date range:', startDate, 'to', endDate);

    if (!startDate) {
      showStatus('Please select a start date.', 'error');
      console.log('❌ No start date');
      return;
    }

    if (!endDate) {
      showStatus('Please select an end date.', 'error');
      console.log('❌ No end date');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showStatus('Start date must be before or equal to end date.', 'error');
      console.log('❌ Invalid date range');
      return;
    }

    console.log('✅ Validation passed, proceeding...');
    console.log('🎬 Setting UI to DOWNLOADING state');

    setUIState(UI_STATES.DOWNLOADING, {
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

          showToast('Error: No active tab found', 'error');

          setUIState('idle');

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

            dateRangeType: dateRangeType  // ← Now uses accounting periods

          });



          console.log('📬 Response received from content script:', response);



          if (response && response.success) {

            console.log('✅ Download started successfully');

            showToast('Download started!', 'success');

          } else {

            console.error('❌ Download failed to start:', response);

            showToast('Failed to start download', 'error');

            setUIState('idle');

          }

        } catch (error) {

          console.error('❌ Error sending message to content script:', error);

          showToast(`Error: ${error.message}`, 'error');

          setUIState('idle');

        }

      });
    });
  });

  function checkContentScriptLoaded(callback, attempts = 0) {
    const maxAttempts = 5;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        console.error('No active tab found');
        callback(false);
        return;
      }
      
      const currentUrl = tabs[0].url;

      const supportedDomains = [
        'amazon.com', 'amazon.de', 'amazon.nl', 'amazon.fr',
        'amazon.co.uk', 'amazon.it', 'amazon.es', 'amazon.ca', 'amazon.jp',
        'sellercentral.amazon.com', 'sellercentral.amazon.de', 'sellercentral.amazon.nl',
        'sellercentral.amazon.fr', 'sellercentral.amazon.co.uk', 'sellercentral.amazon.it',
        'sellercentral.amazon.es', 'sellercentral.amazon.ca', 'sellercentral.amazon.jp'
      ];

      const isSupportedDomain = supportedDomains.some(domain => currentUrl.includes(domain));

      if (!isSupportedDomain) {
        console.error('Not on a supported Amazon page');
        callback(false);
        return;
      }
      
      chrome.runtime.sendMessage({action: "checkContentScriptLoaded"}, function(response) {
        if (chrome.runtime.lastError) {
          if (attempts < maxAttempts) {
            setTimeout(() => checkContentScriptLoaded(callback, attempts + 1), 1000);
          } else {
            callback(false);
          }
        } else if (!response || !response.loaded) {
          if (attempts < maxAttempts) {
            setTimeout(() => checkContentScriptLoaded(callback, attempts + 1), 1000);
          } else {
            callback(false);
          }
        } else {
          callback(true);
        }
      });
    });
  }

  function startRegularDownload(startDate, endDate, accountType) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) return;
      
      const currentTab = tabs[0];
      const currentUrl = currentTab.url;

      const isOnOrdersPage = currentUrl.includes('order-history') ||
                            currentUrl.includes('your-orders') ||
                            currentUrl.includes('orders');

      if (!isOnOrdersPage) {
        const marketplace = extractMarketplaceFromUrl(currentUrl);
        const year = endDate.substring(0, 4);
        const ordersUrl = `https://www.${marketplace}/your-orders/orders` +
          `?timeFilter=year-${year}` +
          `&startDate=${startDate}` +
          `&endDate=${endDate}`;

        console.log('🔗 Navigating to filtered orders page:', ordersUrl);

        chrome.tabs.update(currentTab.id, { url: ordersUrl }, function() {
          setTimeout(() => {
            proceedWithDownload(currentTab.id, startDate, endDate, accountType);
          }, 3000);
        });
      } else {
        proceedWithDownload(currentTab.id, startDate, endDate, accountType);
      }
    });
  }

  function proceedWithDownload(tabId, startDate, endDate, accountType) {
    console.log('📤 Preparing to send download message...');
    console.log('   Tab ID:', tabId);
    console.log('   Dates:', startDate, 'to', endDate);
    console.log('   Account type:', accountType);

    // Calculate the accounting period range type
    const dateRangeType = determineAccountingPeriod(startDate, endDate);
    console.log('   Date range type:', dateRangeType);

    const advancedOptions = getAdvancedOptions();
    console.log('   Advanced options:', advancedOptions);

    chrome.tabs.sendMessage(tabId, {action: "getAccountType"}, function(accountResponse) {
      if (!chrome.runtime.lastError && accountResponse && accountResponse.isBusinessAccount !== undefined) {
        updateAccountTypeUI(accountResponse.isBusinessAccount);
        accountType = accountResponse.isBusinessAccount ? 'business' : 'nonbusiness';
      }

      console.log('📨 Sending startDownload message to content script');

      chrome.tabs.sendMessage(tabId, {
        action: "startDownload",
        startDate: startDate,
        endDate: endDate,
        accountType: accountType,
        dateRangeType: dateRangeType,  // ← Now uses calculated accounting periods
        advancedOptions: advancedOptions
      }, function(response) {
        console.log('📬 Response received from content script:', response);
        if (chrome.runtime.lastError) {
          console.error('❌ Error:', chrome.runtime.lastError);
          showStatus('If the download did not start. Please try again.', 'error');
          downloadBtn.disabled = false;
          setUIState(UI_STATES.IDLE);
        } else if (response && response.success) {
          console.log('✅ Download started successfully');
          updateDownloadStatus('Download started...');
        } else {
          console.error('❌ Download failed to start:', response);
          showStatus('Download failed to start. Please try again.', 'error');
          downloadBtn.disabled = false;
          setUIState(UI_STATES.IDLE);
        }
      });
    });
  }

  function extractMarketplaceFromUrl(url) {
    if (url.includes('amazon.fr')) return 'amazon.fr';
    if (url.includes('amazon.de')) return 'amazon.de';
    if (url.includes('amazon.co.uk')) return 'amazon.co.uk';
    if (url.includes('amazon.it')) return 'amazon.it';
    if (url.includes('amazon.es')) return 'amazon.es';
    if (url.includes('amazon.nl')) return 'amazon.nl';
    if (url.includes('amazon.ca')) return 'amazon.ca';
    if (url.includes('amazon.jp')) return 'amazon.co.jp';
    return 'amazon.com';
  }

  function updateAccountTypeUI(isBusinessAccount) {
    if (accountTypeSelect) {
      accountTypeSelect.value = isBusinessAccount ? 'business' : 'nonbusiness';
      accountTypeSelect.disabled = true;
    }
  }

  updateAccountTypeUI(true);

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
      setUIState(UI_STATES.IDLE, { orderCount: orderCount });
      downloadBtn.disabled = false;
      getOrderCount();
    });
  }

  const downloadMoreBtnError = document.getElementById('downloadMoreBtnError');
  if (downloadMoreBtnError) {
    downloadMoreBtnError.addEventListener('click', function() {
      setUIState(UI_STATES.IDLE, { orderCount: orderCount });
      downloadBtn.disabled = false;
      getOrderCount();
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', retryFailed);
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
      updateProgressUI(
        message.current,
        message.total,
        message.successful,
        message.failed
      );

      // Switch to downloading state if not already
      if (message.total > 0 && message.current < message.total) {
        setUIState('downloading');
      }
    }

    if (message.action === 'downloadComplete') {
      console.log('✅ Download complete:', message.results);
      showCompletionUI(
        message.results.successful,
        message.results.failed,
        message.results.total
      );
    }

    if (message.action === 'downloadError') {
      console.error('❌ Download error received:', message.error);
      showToast('❌ Error: ' + (message.error || 'Unknown error'), 'error');
      setUIState(UI_STATES.ERROR);
      
      const downloadBtn = document.getElementById('downloadBtn');
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download Invoices';
      }
    }
    
    return true;
  });
});