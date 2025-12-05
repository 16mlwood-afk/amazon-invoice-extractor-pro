if (!window.amazonInvoiceDownloader) {
  window.amazonInvoiceDownloader = {};
}

console.log('Content script loaded via programmatic injection');

// Configuratie voor verschillende marketplaces
const marketplaceConfig = {
    'nl': {
      domain: 'amazon.nl',
      invoiceText: ['Factuur', 'Invoice'],
      orderText: 'Bestelling',
      dateSelector: '.a-column.a-span3 .a-size-base.a-color-secondary, .a-column.a-span4 .a-size-base.a-color-secondary',
      orderNumberSelector: '.yohtmlc-order-id .a-color-secondary[dir="ltr"]',
      invoiceLinkSelector: '.yohtmlc-order-level-connections a[href*="/gp/shared-cs/ajax/invoice/invoice.html"]',
      monthNames: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
    },
    'de': {
      domain: 'amazon.de',
      invoiceText: ['Rechnung', 'Rechnungskorrektur', 'Invoice'],
      orderText: 'Bestellnr.',
      dateSelector: '.a-column.a-span3 .a-size-base.a-color-secondary, .a-column.a-span4 .a-size-base.a-color-secondary',
      orderNumberSelector: '.yohtmlc-order-id .a-color-secondary[dir="ltr"]',
      invoiceLinkSelector: '.yohtmlc-order-level-connections a.a-link-normal[href*="/gp/css/summary/print.html"], .yohtmlc-order-level-connections a.a-link-normal[href*="/gp/shared-cs/ajax/invoice/invoice.html"]',
      monthNames: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    },
    'fr': {
      domain: 'amazon.fr',
      invoiceText: ['Facture', 'Invoice'],
      orderText: 'Commande',
      dateSelector: '.a-column.a-span4 .a-size-base.a-color-secondary',
      orderNumberSelector: '.yohtmlc-order-id .a-color-secondary[dir="ltr"]',
      invoiceLinkSelector: '.yohtmlc-order-level-connections a[href*="/gp/shared-cs/ajax/invoice/invoice.html"]',
      monthNames: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    },
    'uk': {
      domain: 'amazon.co.uk',
      invoiceText: 'Invoice',
      orderText: 'Order',
      dateSelector: '.order-info .a-column:nth-child(1) .value, .a-column.a-span3 .a-size-base.a-color-secondary',
      orderNumberSelector: '.yohtmlc-order-id .a-color-secondary[dir="ltr"]',
      invoiceLinkSelector: '.yohtmlc-order-level-connections a[href*="/gp/shared-cs/ajax/invoice/invoice.html"]',
      monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    },
    'it': {
      domain: 'amazon.it',
      invoiceText: ['Fattura', 'Invoice'],
      orderText: 'Ordine',
      dateSelector: '.a-column.a-span4 .a-size-base.a-color-secondary',
      orderNumberSelector: '.yohtmlc-order-id .a-color-secondary[dir="ltr"]',
      invoiceLinkSelector: '.yohtmlc-order-level-connections a[href*="/gp/shared-cs/ajax/invoice/invoice.html"]',
      monthNames: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
    },
    'us': {
      domain: 'amazon.com',
      invoiceText: 'View invoice',
      orderText: 'Order',
      dateSelector: '.a-column.a-span3 .a-size-base.a-color-secondary',
      orderNumberSelector: '.yohtmlc-order-id .a-color-secondary[dir="ltr"]',
      invoiceLinkSelector: '.yohtmlc-order-level-connections a[href*="/gp/css/summary/print.html"][href*="orderID"]',
      monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    }
  };
  // START_OBFUSCATE
  function detectMarketplace() {
    const hostname = window.location.hostname;
    if (hostname.includes('amazon.nl')) return 'nl';
    if (hostname.includes('amazon.de')) return 'de';
    if (hostname.includes('amazon.fr')) return 'fr';
    if (hostname.includes('amazon.co.uk')) return 'uk';
    if (hostname.includes('amazon.it')) return 'it';
    if (hostname.includes('amazon.com')) return 'us';
    return 'unknown';
  }
  
  function waitForElements(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkElements = () => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          resolve(elements);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for elements: ${selector}`));
        } else {
          setTimeout(checkElements, 100);
        }
      };
      checkElements();
    });
  }
  
  function updateProgress(current, total) {
    if (typeof current === 'number' && typeof total === 'number' && total > 0) {
      const percentage = Math.round((current / total) * 100);
      chrome.runtime.sendMessage({
        action: "updateProgress",
        progress: percentage
      });
    } else {
      console.error('Invalid values for updateProgress:', { current, total });
    }
  }
  
  function goToNextPage() {
    const nextButton = document.querySelector('.a-pagination .a-last a');
    if (nextButton) {
      nextButton.click();
      return true;
    }
    return false;
  }
  
  function parseDate(dateString, monthNames) {
    if (!dateString || dateString === 'Not found') return null;

    // Voor Engelse datumformaat "16 July 2024"
    const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const englishMatch = dateString.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (englishMatch) {
      const day = parseInt(englishMatch[1], 10);
      const month = englishMonths.indexOf(englishMatch[2]);
      const year = parseInt(englishMatch[3], 10);
      if (month !== -1) {
        return new Date(year, month, day);
      }
    }

    // Check if monthNames is valid
    if (!monthNames || !Array.isArray(monthNames)) {
      return null;
    }

    // Voor Nederlandse datumformaat "31 december 2021"
    const dutchMatch = dateString.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (dutchMatch) {
      const day = parseInt(dutchMatch[1], 10);
      const month = monthNames.findIndex(name => name.toLowerCase() === dutchMatch[2].toLowerCase());
      const year = parseInt(dutchMatch[3], 10);
      if (month !== -1) {
        return new Date(year, month, day);
      }
    }

    // Voor Duitse datumformaat "31. Dezember 2021"
    const germanMatch = dateString.match(/(\d{1,2})\.\s+(\w+)\s+(\d{4})/);
    if (germanMatch) {
      const day = parseInt(germanMatch[1], 10);
      const month = monthNames.findIndex(name => name.toLowerCase() === germanMatch[2].toLowerCase());
      const year = parseInt(germanMatch[3], 10);
      if (month !== -1) {
        return new Date(year, month, day);
      }
    }

    // Voor andere formaten (behoud bestaande logica)
    const parts = dateString.split(' ');
    if (parts.length === 3) {
      const monthIndex = monthNames.findIndex(name => name.toLowerCase() === parts[1].toLowerCase());
      const day = parseInt(parts[0].replace(',', ''), 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && monthIndex !== -1 && !isNaN(year)) {
        return new Date(year, monthIndex, day);
      }
    }

    console.error('Invalid date format:', dateString);
    return null;
  }
// END_OBFUSCATE
  // Instead of using export, assign to chrome.extension.getBackgroundPage()
  Object.assign(window.amazonInvoiceDownloader, {
    marketplaceConfig,
    detectMarketplace,
    waitForElements,
    updateProgress,
    goToNextPage,
    parseDate
  });