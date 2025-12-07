// ===== HEALTH CHECK & DIAGNOSTICS =====
// Pre-flight checks before starting downloads

class HealthChecker {
  constructor() {
    this.checks = {};
    this.results = {};
  }

  // Run all health checks
  async runAllChecks(context = {}) {
    console.log('🏥 Running health checks...');

    const checks = [
      this.checkMarketplaceAccess(context),
      this.checkAuthentication(context),
      this.checkPermissions(),
      this.checkStorageSpace(),
      this.checkNetworkConnection(),
      this.checkDownloadPathWritable(),
      this.checkExtensionVersion(),
      this.checkBrowserCompatibility()
    ];

    const results = await Promise.all(checks);
    this.results = Object.fromEntries(results.map(r => [r.name, r]));

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    console.log(`🏥 Health check complete: ${passed}/${total} checks passed`);

    return {
      passed: passed === total,
      results: this.results,
      summary: `${passed}/${total} checks passed`
    };
  }

  // Check marketplace access
  async checkMarketplaceAccess(context = {}) {
    const marketplace = context.marketplace || 'amazon.com';

    try {
      // Try to access the marketplace URL
      const response = await fetch(`https://${marketplace}`, {
        method: 'HEAD',
        mode: 'no-cors'
      });

      // In no-cors mode, we can't read the response, but we can check if it didn't throw
      return {
        name: 'marketplace',
        passed: true,
        message: `${marketplace} is accessible`,
        details: `Successfully connected to ${marketplace}`
      };
    } catch (error) {
      return {
        name: 'marketplace',
        passed: false,
        message: `Cannot access ${marketplace}`,
        details: error.message,
        fix: `Check your internet connection and ensure ${marketplace} is not blocked`
      };
    }
  }

  // Check user authentication
  async checkAuthentication(context = {}) {
    // This is a simplified check - in a real implementation,
    // you'd check for Amazon login cookies or session state
    try {
      // Check if we're on an Amazon domain and look for signs of login
      // Skip DOM checks in service worker context
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return {
          name: 'authentication',
          passed: null, // Unknown in service worker context
          message: 'Authentication check not available in service worker'
        };
      }

      const hasAmazonCookies = document.cookie.includes('amazon');
      const hasSessionIndicators = document.querySelector('[data-customer-id]') ||
                                   document.querySelector('.nav-line-1') ||
                                   window.location.href.includes('signin');

      if (hasSessionIndicators && !window.location.href.includes('signin')) {
        return {
          name: 'authentication',
          passed: true,
          message: 'User appears to be logged in',
          details: 'Found session indicators on the page'
        };
      } else {
        return {
          name: 'authentication',
          passed: false,
          message: 'User may not be logged in',
          details: 'No clear session indicators found',
          fix: 'Please log in to your Amazon account before downloading invoices'
        };
      }
    } catch (error) {
      return {
        name: 'authentication',
        passed: false,
        message: 'Cannot check authentication status',
        details: error.message,
        fix: 'Try refreshing the page and ensuring you are logged in'
      };
    }
  }

  // Check extension permissions
  async checkPermissions() {
    return new Promise((resolve) => {
      chrome.permissions.contains({
        permissions: ['downloads', 'storage', 'activeTab', 'notifications']
      }, (hasPermissions) => {
        if (hasPermissions) {
          resolve({
            name: 'permissions',
            passed: true,
            message: 'All required permissions granted',
            details: 'Extension has access to downloads, storage, tabs, and notifications'
          });
        } else {
          resolve({
            name: 'permissions',
            passed: false,
            message: 'Missing required permissions',
            details: 'Some permissions are not granted',
            fix: 'Please check extension permissions in browser settings'
          });
        }
      });
    });
  }

  // Check available storage space
  async checkStorageSpace() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const availableBytes = estimate.quota - estimate.usage;
        const availableGB = (availableBytes / (1024 * 1024 * 1024)).toFixed(2);

        // Warn if less than 1GB available
        if (availableBytes < 1024 * 1024 * 1024) {
          return {
            name: 'storage',
            passed: false,
            message: `Low disk space: ${availableGB}GB available`,
            details: `Only ${availableGB}GB of storage space available`,
            fix: 'Free up disk space before downloading large numbers of invoices'
          };
        } else {
          return {
            name: 'storage',
            passed: true,
            message: `Sufficient storage: ${availableGB}GB available`,
            details: `${availableGB}GB of storage space available`
          };
        }
      } else {
        // Fallback - assume storage is OK
        return {
          name: 'storage',
          passed: true,
          message: 'Storage check not available',
          details: 'Cannot determine available storage space'
        };
      }
    } catch (error) {
      return {
        name: 'storage',
        passed: false,
        message: 'Cannot check storage space',
        details: error.message,
        fix: 'Try refreshing the page or check your browser settings'
      };
    }
  }

  // Check network connection
  async checkNetworkConnection() {
    try {
      if (!navigator.onLine) {
        return {
          name: 'network',
          passed: false,
          message: 'No internet connection',
          details: 'Browser reports no internet connection',
          fix: 'Check your internet connection and try again'
        };
      }

      // Test connection with a quick request
      const startTime = Date.now();
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      const responseTime = Date.now() - startTime;

      if (responseTime > 5000) {
        return {
          name: 'network',
          passed: false,
          message: 'Slow internet connection',
          details: `Connection test took ${responseTime}ms`,
          fix: 'Your internet connection may be slow, downloads might take longer'
        };
      } else {
        return {
          name: 'network',
          passed: true,
          message: `Network OK (${responseTime}ms)`,
          details: `Connection test completed in ${responseTime}ms`
        };
      }
    } catch (error) {
      return {
        name: 'network',
        passed: false,
        message: 'Network connection issue',
        details: error.message,
        fix: 'Check your internet connection and firewall settings'
      };
    }
  }

  // Check download path writability
  async checkDownloadPathWritable() {
    return new Promise((resolve) => {
      // Try to download a tiny test file
      const testData = 'test';
      const testBlob = new Blob([testData], { type: 'text/plain' });

      chrome.downloads.download({
        url: URL.createObjectURL(testBlob),
        filename: 'amazon_invoice_test.tmp',
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          resolve({
            name: 'downloadPath',
            passed: false,
            message: 'Cannot write to download directory',
            details: chrome.runtime.lastError.message,
            fix: 'Check download folder permissions and available space'
          });
        } else {
          // Clean up the test file
          chrome.downloads.erase({ id: downloadId });

          resolve({
            name: 'downloadPath',
            passed: true,
            message: 'Download directory is writable',
            details: 'Successfully tested write access to download folder'
          });
        }
      });
    });
  }

  // Check extension version
  checkExtensionVersion() {
    const manifest = chrome.runtime.getManifest();
    const version = manifest.version;

    // This is a simple check - in production you might check for updates
    return {
      name: 'extensionVersion',
      passed: true,
      message: `Extension v${version}`,
      details: `Amazon Invoice Extractor version ${version} is running`
    };
  }

  // Check browser compatibility
  checkBrowserCompatibility() {
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSupported = isChrome || isEdge;

    if (isSupported) {
      return {
        name: 'browserCompatibility',
        passed: true,
        message: 'Browser is supported',
        details: `Running on ${isChrome ? 'Chrome' : 'Edge'} - fully supported`
      };
    } else {
      return {
        name: 'browserCompatibility',
        passed: false,
        message: 'Browser may not be fully supported',
        details: 'Extension is designed for Chrome and Edge',
        fix: 'Try using Google Chrome or Microsoft Edge for best experience'
      };
    }
  }

  // Get issues that need fixing
  getIssues() {
    return Object.values(this.results)
      .filter(result => !result.passed)
      .map(result => ({
        issue: result.name,
        message: result.message,
        fix: result.fix
      }));
  }

  // Get summary
  getSummary() {
    const total = Object.keys(this.results).length;
    const passed = Object.values(this.results).filter(r => r.passed).length;
    const failed = total - passed;

    return {
      total,
      passed,
      failed,
      healthy: failed === 0,
      issues: this.getIssues()
    };
  }

  // Run quick check (subset of checks for speed)
  async runQuickCheck(context = {}) {
    console.log('🏥 Running quick health check...');

    const quickChecks = [
      this.checkNetworkConnection(),
      this.checkPermissions(),
      this.checkAuthentication(context)
    ];

    const results = await Promise.all(quickChecks);
    const quickResults = Object.fromEntries(results.map(r => [r.name, r]));

    const summary = {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      healthy: results.every(r => r.passed),
      issues: results.filter(r => !r.passed).map(r => ({
        issue: r.name,
        message: r.message,
        fix: r.fix
      }))
    };

    console.log(`🏥 Quick check complete: ${summary.passed}/${summary.total} checks passed`);

    return {
      results: quickResults,
      summary
    };
  }
}

// Singleton instance
// Class exported for instantiation in background script

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HealthChecker;
}
