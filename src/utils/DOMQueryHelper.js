if (!window.amazonInvoiceDownloader) {
  window.amazonInvoiceDownloader = {};
}

class DOMQueryHelper {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 5000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 2000,
      ...config
    };
  }

  /**
   * Safely query DOM elements with fallback selectors and retries
   * @param {string} primarySelector - Primary CSS selector to try
   * @param {Object} options - Options for fallback selectors and behavior
   * @returns {NodeList|Array} - Found elements or empty array
   */
  async querySelectorAll(primarySelector, options = {}) {
    const {
      fallbackSelectors = [],
      required = true,
      timeout = this.config.timeout,
      retryAttempts = this.config.retryAttempts
    } = options;

    const allSelectors = [primarySelector, ...fallbackSelectors];

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      for (const selector of allSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            if (selector !== primarySelector) {
              console.log(`Fallback selector worked: ${selector} (instead of ${primarySelector})`);
            }
            return elements;
          }
        } catch (error) {
          console.warn(`Error querying selector "${selector}":`, error);
        }
      }

      // Wait before retrying
      if (attempt < retryAttempts - 1) {
        await this._delay(this.config.retryDelay);
      }
    }

    if (required) {
      throw new Error(`Required selector not found after ${retryAttempts} attempts: ${primarySelector}`);
    }

    return [];
  }

  /**
   * Safely query a single DOM element
   * @param {string} primarySelector - Primary CSS selector to try
   * @param {Object} options - Options for fallback selectors and behavior
   * @returns {Element|null} - Found element or null
   */
  async querySelector(primarySelector, options = {}) {
    const elements = await this.querySelectorAll(primarySelector, { ...options, required: false });
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Synchronous version of safeQuerySelector for simpler use cases
   * @param {string} primarySelector - Primary CSS selector to try
   * @param {Object} options - Options for fallback selectors and behavior
   * @returns {Element|null} - Found element or null
   */
  safeQuerySelector(primarySelector, options = {}) {
    const {
      fallbackSelectors = [],
      required = false,
      throwOnError = false
    } = options;

    const allSelectors = [primarySelector, ...fallbackSelectors];

    for (const selector of allSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
      } catch (error) {
        console.warn(`Error querying selector "${selector}":`, error);
      }
    }

    if (required && throwOnError) {
      throw new Error(`Required selector not found: ${primarySelector}`);
    }

    return null;
  }

  /**
   * Wait for elements to appear with timeout
   * @param {string} selector - CSS selector to wait for
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<NodeList>} - Promise resolving to found elements
   */
  async waitForElements(selector, timeout = this.config.timeout) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkElements = () => {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            resolve(elements);
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for elements: ${selector}`));
            return;
          }

          setTimeout(checkElements, 100);
        } catch (error) {
          reject(error);
        }
      };

      checkElements();
    });
  }

  /**
   * Extract text content safely
   * @param {Element} element - DOM element
   * @param {string} defaultValue - Default value if element is null
   * @returns {string} - Text content or default value
   */
  getTextContent(element, defaultValue = 'Not found') {
    return element ? element.textContent.trim() : defaultValue;
  }

  /**
   * Extract attribute value safely
   * @param {Element} element - DOM element
   * @param {string} attribute - Attribute name
   * @param {string} defaultValue - Default value if attribute doesn't exist
   * @returns {string} - Attribute value or default value
   */
  getAttribute(element, attribute, defaultValue = '') {
    return element ? element.getAttribute(attribute) || defaultValue : defaultValue;
  }

  /**
   * Create a full URL from a relative href
   * @param {string} href - Relative or absolute href
   * @returns {string} - Full URL
   */
  createFullUrl(href) {
    try {
      return new URL(href, window.location.origin).href;
    } catch (error) {
      console.error('Error creating full URL:', error);
      return href;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export to global namespace
window.amazonInvoiceDownloader.DOMQueryHelper = DOMQueryHelper;

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js (for tests)
  module.exports = DOMQueryHelper;
} else {
  // Browser (for extension)
  window.amazonInvoiceDownloader.DOMQueryHelper = DOMQueryHelper;
}
