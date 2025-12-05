if (!window.amazonInvoiceDownloader) {
  window.amazonInvoiceDownloader = {};
}

class ErrorHandler {
  constructor() {
    this.errorMessages = {
      // DOM and parsing errors
      'NO_CONFIG': 'Marketplace not supported',
      'NO_ORDERS_FOUND': 'No orders found on this page',
      'DOM_QUERY_FAILED': 'Failed to read page content',
      'ELEMENT_NOT_FOUND': 'Required page element not found',
      'PARSING_FAILED': 'Failed to parse page data',

      // Download errors
      'DOWNLOAD_FAILED': 'Failed to download invoice',
      'NETWORK_ERROR': 'Network error occurred',
      'PDF_NOT_FOUND': 'Invoice PDF not found',

      // Script loading errors
      'SCRIPT_LOAD_FAILED': 'Failed to load required script',
      'SCRIPT_TIMEOUT': 'Script loading timed out',

      // State and configuration errors
      'INVALID_STATE': 'Invalid application state',
      'CONFIG_ERROR': 'Configuration error',

      // General errors
      'UNKNOWN_ERROR': 'An unexpected error occurred',
      'USER_CANCELLED': 'Operation cancelled by user'
    };

    this.errorHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Handle an error with centralized logic
   * @param {string} errorType - Type of error from errorMessages
   * @param {Object} context - Additional context for debugging
   * @returns {Object} - Error result object
   */
  handleError(errorType, context = {}) {
    const userMessage = this.errorMessages[errorType] || 'An unexpected error occurred';
    const errorRecord = {
      timestamp: new Date().toISOString(),
      type: errorType,
      message: userMessage,
      context: context,
      stack: context && context.error ? context.error.stack : new Error().stack
    };

    // Log to console with full context
    console.error(`[${errorType}]`, {
      message: userMessage,
      context: context,
      suggestion: this._getSuggestion(errorType, context)
    });

    // Store in history for debugging
    this.errorHistory.unshift(errorRecord);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.pop();
    }

    // Send to background script for user notification
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          action: "downloadError",
          errorType,
          message: userMessage,
          details: this._getSuggestion(errorType, context),
          context
        });
      } catch (error) {
        // Silently ignore chrome runtime communication errors
        console.warn('Failed to send error to chrome runtime:', error.message);
      }
    }

    return {
      error: errorType,
      message: userMessage,
      suggestion: this._getSuggestion(errorType, context)
    };
  }

  /**
   * Wrap a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {string} errorType - Error type if function throws
   * @param {Object} context - Additional context
   * @returns {Function} - Wrapped function
   */
  wrapFunction(fn, errorType = 'UNKNOWN_ERROR', context = {}) {
    return async (...args) => {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        return this.handleError(errorType, { ...context, error });
      }
    };
  }

  /**
   * Safe execution with fallback
   * @param {Function} primaryFn - Primary function to try
   * @param {Function} fallbackFn - Fallback function
   * @param {string} errorType - Error type for primary function failure
   * @returns {*} - Result of primary or fallback function
   */
  async tryWithFallback(primaryFn, fallbackFn, errorType = 'UNKNOWN_ERROR') {
    try {
      return await primaryFn();
    } catch (error) {
      console.warn('Primary function failed, trying fallback:', error);
      this.handleError(errorType, { error, attemptingFallback: true });
      return await fallbackFn();
    }
  }

  /**
   * Get user-friendly suggestion for error
   * @param {string} errorType - Error type
   * @param {Object} context - Error context
   * @returns {string} - Suggestion text
   */
  _getSuggestion(errorType, context) {
    const suggestions = {
      'NO_CONFIG': 'This marketplace is not supported. Please check if you\'re on an Amazon order history page.',
      'NO_ORDERS_FOUND': 'Try refreshing the page or navigating to a different page. Make sure you\'re logged in.',
      'DOM_QUERY_FAILED': 'The page structure may have changed. Try refreshing or contact support.',
      'SCRIPT_LOAD_FAILED': 'Try refreshing the page. If the problem persists, restart your browser.',
      'DOWNLOAD_FAILED': 'Check your internet connection and try again.',
      'NETWORK_ERROR': 'Check your internet connection and try again.',
      'PDF_NOT_FOUND': 'The invoice may not be available for this order.'
    };

    return suggestions[errorType] || 'Please try again or contact support if the problem persists.';
  }

  /**
   * Get error history for debugging
   * @param {number} limit - Maximum number of errors to return
   * @returns {Array} - Recent errors
   */
  getErrorHistory(limit = 10) {
    return this.errorHistory.slice(0, limit);
  }

  /**
   * Clear error history
   */
  clearErrorHistory() {
    this.errorHistory = [];
  }

  /**
   * Check if there are recent errors of a specific type
   * @param {string} errorType - Error type to check
   * @param {number} withinMinutes - Check within last N minutes
   * @returns {boolean} - True if errors found
   */
  hasRecentErrors(errorType, withinMinutes = 5) {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
    return this.errorHistory.some(error =>
      error.type === errorType &&
      new Date(error.timestamp) > cutoff
    );
  }
}

// Create global instance
window.amazonInvoiceDownloader.errorHandler = new ErrorHandler();

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js (for tests)
  module.exports = ErrorHandler;
} else {
  // Browser (for extension)
  window.amazonInvoiceDownloader.ErrorHandler = ErrorHandler;
}
