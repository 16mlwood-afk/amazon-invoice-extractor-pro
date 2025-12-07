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
      delayBetween: 1500,  // Legacy compatibility
      paginationDelay: 1500,
      rateLimit: 8,        // Legacy compatibility
      skipDuplicates: true,
      skipFileDuplicates: true,
      skipDriveDuplicates: true,
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

      // Notifications (legacy compatibility)
      showProgress: true,
      showCompletion: true,
      showErrors: true,
      enableSound: false,

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

  // Migrate legacy settings from old storage format
  static async migrateLegacySettings() {
    try {
      const legacySettings = await chrome.storage.local.get('userSettings');
      if (legacySettings.userSettings) {
        const migrated = this.convertLegacyToNew(legacySettings.userSettings);
        await this.saveSettings(migrated);
        // Remove old settings after successful migration
        await chrome.storage.local.remove('userSettings');
        console.log('✅ Settings migrated from legacy format');
        return { success: true, migrated: true };
      }
      return { success: true, migrated: false };
    } catch (error) {
      console.error('❌ Settings migration failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Convert legacy settings to new format
  static convertLegacyToNew(legacySettings) {
    const newSettings = { ...this.getDefaultSettings() };

    // Map legacy settings to new format
    if (legacySettings.hasOwnProperty('showNotifications')) {
      newSettings.showNotifications = legacySettings.showNotifications;
    }
    if (legacySettings.hasOwnProperty('autoOpenFolder')) {
      newSettings.autoOpenFolder = legacySettings.autoOpenFolder;
    }
    if (legacySettings.hasOwnProperty('soundNotifications')) {
      newSettings.enableSound = legacySettings.soundNotifications;
    }
    if (legacySettings.hasOwnProperty('accountType')) {
      newSettings.accountType = legacySettings.accountType;
    }
    if (legacySettings.hasOwnProperty('maxConcurrent')) {
      newSettings.maxConcurrent = legacySettings.maxConcurrent;
    }
    if (legacySettings.hasOwnProperty('downloadDelay')) {
      newSettings.delayBetween = legacySettings.downloadDelay;
    }
    if (legacySettings.hasOwnProperty('paginationDelay')) {
      newSettings.paginationDelay = legacySettings.paginationDelay;
    }
    if (legacySettings.hasOwnProperty('skipDuplicates')) {
      newSettings.skipDuplicates = legacySettings.skipDuplicates;
    }
    if (legacySettings.hasOwnProperty('folderStructure')) {
      newSettings.folderStructure = legacySettings.folderStructure;
    }
    if (legacySettings.hasOwnProperty('baseFolder')) {
      newSettings.baseFolder = legacySettings.baseFolder;
    }
    if (legacySettings.hasOwnProperty('filenameFormat')) {
      newSettings.filenameFormat = legacySettings.filenameFormat;
    }
    if (legacySettings.hasOwnProperty('saveMetadata')) {
      newSettings.saveMetadata = legacySettings.saveMetadata;
    }

    return newSettings;
  }

  // Instance methods for compatibility
  constructor() {
    this.settings = null;
    this.loadSettings();
  }

  async loadSettings() {
    this.settings = await OptionsManager.loadSettings();
    return this.settings;
  }

  async saveSettings() {
    return OptionsManager.saveSettings(this.settings);
  }

  getSettings() {
    return this.settings;
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    return this.saveSettings();
  }

  async resetSettings() {
    this.settings = { ...OptionsManager.getDefaultSettings() };
    return this.saveSettings();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptionsManager;
}

// Make available globally for legacy usage (window for pages, self for service workers)
if (typeof self !== 'undefined') {
  self.OptionsManager = OptionsManager;
}