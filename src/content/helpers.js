// ===== HELPERS.JS =====
// Utility functions for Amazon Invoice Extractor

(function() {
  // ===== HELPERS.JS - MUST LOAD FIRST =====
  // Note: This script must load before others to export functions
  // Injection prevention is handled by content-main.js

// ===== DATE FILTERING HELPERS =====

function parseAmazonDate(dateText) {
  try {
    dateText = dateText.trim();
    dateText = dateText.replace(/^(Order placed:|Commande passée le|Bestellung aufgegeben am|Pedido realizado el)/i, '').trim();

    const date = new Date(dateText);
    if (isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('❌ Error parsing date:', dateText, error);
    return null;
  }
}

function extractOrderDate(orderElement) {
  const selectors = [
    // EU consumer accounts (FR, DE, IT, NL, etc.) - Most specific first
    '.a-size-base.a-color-secondary.aok-break-word',
    '.a-size-base.a-color-secondary',

    // Other marketplaces
    '.order-info .a-span3',
    '.order-date',
    '.date-placed',
    '.a-color-secondary.value',
    '.order-info .a-size-base.a-color-secondary',
    '[data-order-date]'
  ];

  for (const selector of selectors) {
    const element = orderElement.querySelector(selector);
    if (element) {
      const dateText = element.textContent || element.getAttribute('data-order-date');
      if (dateText) {
        const parsedDate = parseAmazonDate(dateText);
        if (parsedDate) return parsedDate;
      }
    }
  }

  return null;
}

// ===== ACCOUNT TYPE DETECTION =====

function detectAccountType() {
  const bodyText = document.body.innerText.toLowerCase();
  if (bodyText.includes('business prime') || bodyText.includes('geschäftskunde')) {
    return true;
  }

  const businessIndicators = ['a[href*="ref_=abn_logo"]', '[data-business-account]'];
  for (const selector of businessIndicators) {
    if (document.querySelector(selector)) return true;
  }

  return window.location.href.includes('/business/');
}

// ===== MARKETPLACE DETECTION =====

function detectMarketplace() {
  const url = window.location?.href || '';
  if (url.includes('amazon.de')) return 'DE';
  if (url.includes('amazon.fr')) return 'FR';
  if (url.includes('amazon.nl')) return 'NL';
  if (url.includes('amazon.co.uk')) return 'UK';
  if (url.includes('amazon.it')) return 'IT';
  return 'COM';
}

// ===== ORDER COUNTING =====

function getOrderCount() {
  const orderSelectors = [
    '.order-card',
    '.order',
    '[data-order-id]',
    '.a-box-group.order'
  ];

  for (const selector of orderSelectors) {
    const orders = document.querySelectorAll(selector);
    if (orders.length > 0) {
      return orders.length;
    }
  }

  return 0;
}

// ===== UTILITY FUNCTIONS =====

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ===== NOTIFICATION UTILITY FUNCTIONS =====

function notifyProgress(percent) {
  chrome.runtime.sendMessage({ action: 'updateProgress', progress: percent });
}

function notifyDownloadProgress(current, total, message = null) {
  chrome.runtime.sendMessage({
    action: 'updateDownloadProgress',
    current: current,
    total: total,
    message: message
  });
}

function notifyDownloadStatus(message) {
  chrome.runtime.sendMessage({
    action: 'updateDownloadStatus',
    message: message
  });
}

function notifyDownloadFailed(failedCount, failedDownloads) {
  chrome.runtime.sendMessage({
    action: 'downloadFailed',
    failedCount: failedCount,
    failedDownloads: failedDownloads
  });
}

function notifyDownloadComplete(successful, failed, total) {
  chrome.runtime.sendMessage({
    action: 'downloadComplete',
    successCount: successful,
    failedCount: failed,
    totalCount: total
  });
}

function notifyComplete(count) {
  chrome.runtime.sendMessage({ action: 'downloadComplete', count: count });
}

function notifyInfo(message) {
  chrome.runtime.sendMessage({
    action: 'downloadInfo',
    message: message
  });
}

function notifyError(msg) {
  chrome.runtime.sendMessage({ action: 'downloadError', error: msg });
}

// ===== DATE NORMALIZATION UTILITIES =====

/**
 * Normalize date to UTC midnight (removes time component and timezone issues)
 * @param {Date|string} date - Date object or date string
 * @returns {Date} Normalized UTC date at midnight
 */
function normalizeDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  ));
}

/**
 * Check if a date is valid
 * @param {Date} d - Date to validate
 * @returns {boolean} True if valid date
 */
function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

// Export functions to global scope for use by other modules
window.parseAmazonDate = parseAmazonDate;
window.extractOrderDate = extractOrderDate;
window.detectAccountType = detectAccountType;
window.detectMarketplace = detectMarketplace;
window.getOrderCount = getOrderCount;
window.sleep = sleep;
window.notifyProgress = notifyProgress;
window.notifyDownloadProgress = notifyDownloadProgress;
window.notifyDownloadStatus = notifyDownloadStatus;
window.notifyDownloadFailed = notifyDownloadFailed;
window.notifyDownloadComplete = notifyDownloadComplete;
window.notifyComplete = notifyComplete;
window.notifyInfo = notifyInfo;
window.notifyError = notifyError;
window.normalizeDate = normalizeDate;
window.isValidDate = isValidDate;

// Global function to hide loading state when downloads complete
window.hideDownloadLoadingState = function() {
  try {
    // Hide loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }

    // Hide progress overlay after a short delay to show completion
    setTimeout(() => {
      const progressOverlay = document.getElementById('amazon-invoice-progress-overlay');
      if (progressOverlay) {
        progressOverlay.style.display = 'none';
        progressOverlay.remove();
      }
    }, 2000); // Show completion for 2 seconds before hiding

  } catch (error) {
    console.warn('⚠️ Error hiding download loading state:', error);
  }
};
})();
