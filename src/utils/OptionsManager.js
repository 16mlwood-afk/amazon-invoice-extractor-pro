// ============================================
// OPTIONS MANAGER
// Handles loading, saving, and accessing extension settings
// ============================================

class OptionsManager {
  // Default settings configuration
  static getDefaultSettings() {
    return {
      // General Settings
      showNotifications: true,
      autoOpenFolder: false,
      soundNotifications: false,
      accountType: 'auto',

      // Download Settings
      maxConcurrent: 3,
      downloadDelay: 1000,
      paginationDelay: 1500,
      skipDuplicates: true,
      retryFailed: true,
      maxRetries: 3,

      // 🆕 NEW: Storage Settings
      downloadMode: 'both',           // 'local_only', 'drive_only', 'both'
      errorHandling: 'skip',          // 'skip', 'retry', 'stop'
      retryAttempts: 3,

      // Organization Settings
      folderStructure: 'by-year-month',
      baseFolder: 'Amazon_Invoices',
      filenameFormat: 'default',

      // Advanced Settings
      adaptiveBandwidth: true,
      bandwidthLimit: 0,
      saveMetadata: true,
      trackHistory: true,
      verboseLogging: false,
      debugMode: false
    };
  }

  // 🆕 NEW: Static helper methods for new download mode settings
  static async shouldDownloadLocally() {
    const settings = await this.loadSettings();
    return settings.downloadMode === 'local_only' || settings.downloadMode === 'both';
  }

  static async shouldUploadToDrive() {
    const settings = await this.loadSettings();
    return settings.downloadMode === 'drive_only' || settings.downloadMode === 'both';
  }

  static async getErrorHandling() {
    const settings = await this.loadSettings();
    return {
      strategy: settings.errorHandling,
      retryAttempts: settings.retryAttempts
    };
  }

  // Helper method to load settings (for static methods)
  static async loadSettings() {
    const defaultSettings = this.getDefaultSettings();
    return new Promise((resolve) => {
      chrome.storage.local.get(defaultSettings, (data) => {
        resolve(data);
      });
    });
  }

  // Save settings to chrome storage
  static async saveSettings(settings) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(settings, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Get a specific setting value
  static async getSetting(key) {
    const settings = await this.loadSettings();
    return settings[key];
  }

  // Set a specific setting value
  static async setSetting(key, value) {
    const settings = await this.loadSettings();
    settings[key] = value;
    return this.saveSettings(settings);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptionsManager;
}

// Make available globally for legacy usage (window for pages, self for service workers)
if (typeof window !== 'undefined') {
  window.OptionsManager = OptionsManager;
}
if (typeof self !== 'undefined') {
  self.OptionsManager = OptionsManager;
}