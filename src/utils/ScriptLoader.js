if (!window.amazonInvoiceDownloader) {
  window.amazonInvoiceDownloader = {};
}

class ScriptLoader {
  constructor(errorHandler = null) {
    this.loadedScripts = new Set();
    this.pendingLoads = new Map();
    this.errorHandler = errorHandler || window.amazonInvoiceDownloader.errorHandler;
  }

  /**
   * Wait for a script to be loaded with promise-based polling and exponential backoff
   * @param {string} scriptName - Name of the script to wait for
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} - True if loaded successfully
   */
  async waitForScript(scriptName, options = {}) {
    const {
      checkInterval = 100,
      maxAttempts = 10,
      exponentialBackoff = true,
      timeout = 10000
    } = options;

    // If already loaded, return immediately
    if (this.loadedScripts.has(scriptName)) {
      console.log(`${scriptName} already loaded`);
      return true;
    }

    // If currently loading, wait for existing promise
    if (this.pendingLoads.has(scriptName)) {
      console.log(`Waiting for existing ${scriptName} load promise`);
      return this.pendingLoads.get(scriptName);
    }

    // Create new load promise with timeout
    const loadPromise = Promise.race([
      this._pollForScript(scriptName, checkInterval, maxAttempts, exponentialBackoff),
      this._createTimeoutPromise(timeout, scriptName)
    ]);

    this.pendingLoads.set(scriptName, loadPromise);

    try {
      const result = await loadPromise;
      if (result) {
        this.loadedScripts.add(scriptName);
        console.log(`${scriptName} loaded successfully`);
      }
      return result;
    } catch (error) {
      console.error(`${scriptName} failed to load:`, error);
      if (this.errorHandler) {
        this.errorHandler.handleError('SCRIPT_LOAD_FAILED', {
          scriptName,
          error: error.message
        });
      }
      return false;
    } finally {
      this.pendingLoads.delete(scriptName);
    }
  }

  /**
   * Ensure script is loaded, requesting injection if necessary
   * @param {string} scriptName - Name of the script to ensure is loaded
   * @returns {Promise<boolean>} - True if loaded successfully
   */
  async ensureScriptLoaded(scriptName) {
    const loaded = await this.waitForScript(scriptName, { maxAttempts: 3 });

    if (!loaded) {
      console.log(`Requesting ${scriptName} injection...`);

      // Ask background script to inject
      try {
        await chrome.runtime.sendMessage({
          action: "injectScript",
          scriptName: scriptName
        });

        // Wait again after injection
        return this.waitForScript(scriptName, {
          maxAttempts: 10,
          checkInterval: 200,
          exponentialBackoff: false
        });
      } catch (error) {
        console.error(`Failed to inject ${scriptName}:`, error);
        return false;
      }
    }

    return loaded;
  }

  /**
   * Poll for script availability
   * @private
   */
  async _pollForScript(scriptName, interval, maxAttempts, useBackoff) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check if script is loaded
      if (this._isScriptLoaded(scriptName)) {
        console.log(`${scriptName} loaded after ${attempt + 1} attempts`);
        return true;
      }

      // Calculate wait time (with optional exponential backoff)
      const waitTime = useBackoff
        ? interval * Math.pow(2, attempt)
        : interval;

      console.log(`Waiting for ${scriptName} (attempt ${attempt + 1}/${maxAttempts})`);

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    throw new Error(`${scriptName} failed to load after ${maxAttempts} attempts`);
  }

  /**
   * Check if a specific script is loaded
   * @private
   */
  _isScriptLoaded(scriptName) {
    switch (scriptName) {
      case 'nonBusinessInvoices':
        return !!window.nonBusinessInvoices;
      case 'businessInvoices':
        return !!window.amazonInvoiceDownloader?.initBusinessDownload;
      case 'taxInvoices':
        return !!window.taxInvoices;
      case 'DOMQueryHelper':
        return !!window.amazonInvoiceDownloader?.DOMQueryHelper;
      case 'ErrorHandler':
        return !!window.amazonInvoiceDownloader?.errorHandler;
      default:
        return false;
    }
  }

  /**
   * Create a timeout promise
   * @private
   */
  _createTimeoutPromise(timeout, scriptName) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout waiting for ${scriptName} to load`));
      }, timeout);
    });
  }

  /**
   * Get list of currently loaded scripts
   * @returns {Array<string>} - Array of loaded script names
   */
  getLoadedScripts() {
    return Array.from(this.loadedScripts);
  }

  /**
   * Check if a script is currently being loaded
   * @param {string} scriptName - Name of the script
   * @returns {boolean} - True if currently loading
   */
  isLoading(scriptName) {
    return this.pendingLoads.has(scriptName);
  }

  /**
   * Force reload a script (for debugging)
   * @param {string} scriptName - Name of the script
   */
  forceReload(scriptName) {
    this.loadedScripts.delete(scriptName);
    console.log(`Forced reload for ${scriptName}`);
  }
}

// Create global instance
window.amazonInvoiceDownloader.scriptLoader = new ScriptLoader();

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js (for tests)
  module.exports = ScriptLoader;
} else {
  // Browser (for extension)
  window.amazonInvoiceDownloader.ScriptLoader = ScriptLoader;
}
