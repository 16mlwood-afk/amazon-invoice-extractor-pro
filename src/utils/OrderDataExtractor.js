/**
 * Order Data Extractor Module
 * Handles extraction of order data, dates, and invoice URLs from Amazon order elements
 */

class OrderDataExtractor {
  /**
   * Extract first order date from order element (helper function)
   * @param {Element} orderElement - The order DOM element
   * @returns {Date|null} Extracted date or null
   */
  extractFirstOrderDate(orderElement) {
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
   * Extract order date from text using various date patterns
   * @param {Element} orderElement - The order DOM element
   * @returns {string|null} Extracted date string or null
   */
  extractOrderDateFromText(orderElement) {
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
   * Extract order ID from order element
   * @param {Element} orderElement - The order DOM element
   * @returns {string|null} Order ID
   */
  extractOrderId(orderElement) {
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
   * @param {Element} orderElement - The order DOM element
   * @returns {string|null} Invoice URL
   */
  extractBusinessInvoiceUrl(orderElement) {
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
   * @param {Element} orderElement - The order DOM element
   * @returns {string|null} Invoice URL
   */
  extractConsumerInvoiceUrl(orderElement) {
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

  /**
   * Extract complete order data from DOM element
   * @param {Element} orderElement - The order DOM element
   * @param {string} accountType - 'business' or 'nonbusiness'
   * @param {number} index - Index in the current page
   * @returns {Object|null} Order data object or null if extraction failed
   */
  extractOrderData(orderElement, accountType, index) {
    try {
      // Extract order ID
      const orderId = this.extractOrderId(orderElement);
      if (!orderId) {
        console.warn('⚠️ Could not extract order ID from element');
        return null;
      }

      // Extract order date
      const orderDate = this.extractOrderDate(orderElement);

      // Extract invoice URL based on account type
      let invoiceUrl = null;
      if (accountType === 'business') {
        invoiceUrl = this.extractBusinessInvoiceUrl(orderElement);
      } else {
        invoiceUrl = this.extractConsumerInvoiceUrl(orderElement);
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
   * Extract order date using the appropriate method
   * @param {Element} orderElement - The order DOM element
   * @returns {string|null} Order date
   */
  extractOrderDate(orderElement) {
    // Try the text extraction method first
    const dateFromText = this.extractOrderDateFromText(orderElement);
    if (dateFromText) {
      return dateFromText;
    }

    // Fallback to first order date extraction
    const firstOrderDate = this.extractFirstOrderDate(orderElement);
    if (firstOrderDate) {
      return firstOrderDate.toISOString().split('T')[0];
    }

    return null;
  }
}

// Export for use in content scripts
// Class exported for instantiation in background script

// Class exported for instantiation in appropriate contexts

// Instantiate OrderDataExtractor and make it globally available
window.orderDataExtractor = new OrderDataExtractor();