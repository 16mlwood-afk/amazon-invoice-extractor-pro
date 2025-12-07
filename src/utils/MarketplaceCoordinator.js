// ===== MULTI-MARKETPLACE COORDINATOR =====
// Download from multiple Amazon marketplaces

class MarketplaceCoordinator {
  constructor() {
    this.marketplaces = [
      { domain: 'amazon.com', name: 'US', enabled: true, currency: 'USD', language: 'en_US' },
      { domain: 'amazon.fr', name: 'France', enabled: true, currency: 'EUR', language: 'fr_FR' },
      { domain: 'amazon.de', name: 'Germany', enabled: true, currency: 'EUR', language: 'de_DE' },
      { domain: 'amazon.co.uk', name: 'UK', enabled: true, currency: 'GBP', language: 'en_GB' },
      { domain: 'amazon.nl', name: 'Netherlands', enabled: false, currency: 'EUR', language: 'nl_NL' },
      { domain: 'amazon.it', name: 'Italy', enabled: false, currency: 'EUR', language: 'it_IT' },
      { domain: 'amazon.es', name: 'Spain', enabled: false, currency: 'EUR', language: 'es_ES' },
      { domain: 'amazon.ca', name: 'Canada', enabled: false, currency: 'CAD', language: 'en_CA' },
      { domain: 'amazon.jp', name: 'Japan', enabled: false, currency: 'JPY', language: 'ja_JP' }
    ];

    this.results = {};
    this.isRunning = false;
    this.onProgress = null;
    this.onComplete = null;
    this.onMarketplaceComplete = null;
  }

  // Get available marketplaces
  getMarketplaces() {
    return this.marketplaces;
  }

  // Enable/disable marketplace
  setMarketplaceEnabled(domain, enabled) {
    const marketplace = this.marketplaces.find(m => m.domain === domain);
    if (marketplace) {
      marketplace.enabled = enabled;
    }
  }

  // Get enabled marketplaces
  getEnabledMarketplaces() {
    return this.marketplaces.filter(m => m.enabled);
  }

  // Start coordinated download across all enabled marketplaces
  async startCoordinatedDownload(dateRange, accountType = 'business') {
    if (this.isRunning) {
      throw new Error('Coordinator is already running');
    }

    this.isRunning = true;
    this.results = {};
    const enabledMarketplaces = this.getEnabledMarketplaces();

    console.log(`🌍 Starting coordinated download across ${enabledMarketplaces.length} marketplaces`);
    console.log('Enabled marketplaces:', enabledMarketplaces.map(m => m.name).join(', '));

    try {
      for (let i = 0; i < enabledMarketplaces.length; i++) {
        const marketplace = enabledMarketplaces[i];

        if (this.onProgress) {
          this.onProgress({
            current: i + 1,
            total: enabledMarketplaces.length,
            marketplace: marketplace.name,
            status: 'starting'
          });
        }

        try {
          const result = await this.downloadFromMarketplace(marketplace, dateRange, accountType);
          this.results[marketplace.name] = {
            success: true,
            ...result,
            marketplace: marketplace
          };

          console.log(`✅ Completed ${marketplace.name}: ${result.downloaded || 0} invoices`);

          if (this.onMarketplaceComplete) {
            this.onMarketplaceComplete(marketplace.name, result, null);
          }

        } catch (error) {
          console.error(`❌ Failed ${marketplace.name}:`, error);
          this.results[marketplace.name] = {
            success: false,
            error: error.message,
            marketplace: marketplace
          };

          if (this.onMarketplaceComplete) {
            this.onMarketplaceComplete(marketplace.name, null, error);
          }
        }
      }

      const summary = this.generateSummary();
      console.log('🎯 Coordinated download complete:', summary);

      if (this.onComplete) {
        this.onComplete(summary, this.results);
      }

      return summary;

    } finally {
      this.isRunning = false;
    }
  }

  // Download from a specific marketplace
  async downloadFromMarketplace(marketplace, dateRange, accountType) {
    console.log(`🏪 Starting download from ${marketplace.name} (${marketplace.domain})`);

    // Open marketplace tab
    const tab = await this.openMarketplaceTab(marketplace.domain);

    try {
      // Navigate to orders page
      await this.navigateToOrdersPage(tab.id, marketplace);

      // Wait for page to load
      await this.waitForOrdersPage(tab.id, marketplace);

      // Inject and run content script
      const contentScriptResult = await this.injectContentScript(tab.id);

      // Start download process
      const downloadResult = await this.startDownloadProcess(tab.id, dateRange, accountType, marketplace);

      return {
        downloaded: downloadResult.downloaded || 0,
        failed: downloadResult.failed || 0,
        total: (downloadResult.downloaded || 0) + (downloadResult.failed || 0),
        tabId: tab.id
      };

    } finally {
      // Close tab after delay to allow downloads to complete
      setTimeout(() => {
        chrome.tabs.remove(tab.id, () => {
          console.log(`🗑️ Closed ${marketplace.name} tab`);
        });
      }, 5000);
    }
  }

  // Open marketplace tab
  async openMarketplaceTab(domain) {
    try {
      const url = `https://${domain}`;
      const tab = await chrome.tabs.create({ url: url, active: false });
      console.log(`📄 Opened tab for ${domain} (ID: ${tab.id})`);
      return tab;
    } catch (error) {
      throw new Error(`Failed to open ${domain}: ${error.message}`);
    }
  }

  // Navigate to orders page
  async navigateToOrdersPage(tabId, marketplace) {
    try {
      const ordersUrl = this.getOrdersUrl(marketplace);
      await chrome.tabs.update(tabId, { url: ordersUrl });
      console.log(`🧭 Navigated to orders page: ${ordersUrl}`);
    } catch (error) {
      throw new Error(`Failed to navigate to orders: ${error.message}`);
    }
  }

  // Get orders URL for marketplace
  getOrdersUrl(marketplace) {
    const baseUrls = {
      'amazon.com': 'https://www.amazon.com/gp/your-account/order-history',
      'amazon.fr': 'https://www.amazon.fr/gp/your-account/order-history',
      'amazon.de': 'https://www.amazon.de/gp/your-account/order-history',
      'amazon.co.uk': 'https://www.amazon.co.uk/gp/your-account/order-history',
      'amazon.nl': 'https://www.amazon.nl/gp/your-account/order-history',
      'amazon.it': 'https://www.amazon.it/gp/your-account/order-history',
      'amazon.es': 'https://www.amazon.es/gp/your-account/order-history',
      'amazon.ca': 'https://www.amazon.ca/gp/your-account/order-history',
      'amazon.jp': 'https://www.amazon.co.jp/gp/your-account/order-history'
    };

    return baseUrls[marketplace.domain] || `https://${marketplace.domain}/gp/your-account/order-history`;
  }

  // Wait for orders page to load
  async waitForOrdersPage(tabId, marketplace) {
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();

    const checkLoaded = async () => {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'checkOrdersPageLoaded' });
        // If we got here, message was received - page is loaded
        return response;
      } catch (error) {
        // Content script not ready yet
        if (Date.now() - startTime < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return checkLoaded();
        } else {
          throw new Error('Orders page failed to load within timeout');
        }
      }
    };

    return checkLoaded();
  }

  // Inject content script
  async injectContentScript(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to inject content script: ${chrome.runtime.lastError.message}`));
        } else {
          console.log('💉 Content script injected');
          resolve();
        }
      });
    });
  }

  // Start download process for marketplace
  async startDownloadProcess(tabId, dateRange, accountType, marketplace) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, {
        action: 'startCoordinatedDownload',
        dateRange: dateRange,
        accountType: accountType,
        marketplace: marketplace
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Download failed: ${chrome.runtime.lastError.message}`));
        } else if (response && response.success) {
          console.log(`🚀 Download started for ${marketplace.name}`);
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Download failed to start'));
        }
      });
    });
  }

  // Generate summary report
  generateSummary() {
    const summary = {
      totalMarketplaces: Object.keys(this.results).length,
      successfulMarketplaces: 0,
      failedMarketplaces: 0,
      totalDownloaded: 0,
      totalFailed: 0,
      marketplaceResults: {}
    };

    for (const [name, result] of Object.entries(this.results)) {
      summary.marketplaceResults[name] = {
        success: result.success,
        downloaded: result.downloaded || 0,
        failed: result.failed || 0
      };

      if (result.success) {
        summary.successfulMarketplaces++;
        summary.totalDownloaded += result.downloaded || 0;
      } else {
        summary.failedMarketplaces++;
      }

      summary.totalFailed += result.failed || 0;
    }

    return summary;
  }

  // Stop all operations
  stop() {
    this.isRunning = false;
    console.log('🛑 Marketplace coordinator stopped');
  }

  // Save marketplace preferences
  async savePreferences() {
    const prefs = {
      marketplaces: this.marketplaces.map(m => ({
        domain: m.domain,
        enabled: m.enabled
      }))
    };

    return new Promise((resolve) => {
      chrome.storage.local.set({ marketplacePrefs: prefs }, () => {
        resolve();
      });
    });
  }

  // Load marketplace preferences
  async loadPreferences() {
    return new Promise((resolve) => {
      chrome.storage.local.get('marketplacePrefs', (data) => {
        if (data.marketplacePrefs && data.marketplacePrefs.marketplaces) {
          data.marketplacePrefs.marketplaces.forEach(pref => {
            const marketplace = this.marketplaces.find(m => m.domain === pref.domain);
            if (marketplace) {
              marketplace.enabled = pref.enabled;
            }
          });
        }
        resolve();
      });
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarketplaceCoordinator;
}
