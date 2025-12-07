/**
 * Profile Manager - Chrome Profile-based Account Identification
 * Each Chrome profile gets a unique account identifier for folder organization
 */

class ProfileManager {
  constructor() {
    this.storageKey = 'accountSettings';
  }

  /**
   * Get the account identifier for this Chrome profile
   * Returns user-set name or auto-generated ID
   */
  async getAccountIdentifier() {
    const settings = await chrome.storage.local.get(this.storageKey);
    const accountSettings = settings[this.storageKey] || {};

    console.log('🔍 ProfileManager.getAccountIdentifier() - Raw settings:', accountSettings);

    // Return custom name if set
    if (accountSettings.accountName) {
      console.log('✅ Using custom account name:', accountSettings.accountName);
      return accountSettings.accountName;
    }

    // Return or generate profile ID
    if (accountSettings.profileId) {
      console.log('📋 Using profile ID:', accountSettings.profileId);
      return accountSettings.profileId;
    }

    // First run - generate new ID
    const newId = `Profile_${this._generateShortId()}`;
    console.log('🆕 Generated new profile ID:', newId);
    await this.setProfileId(newId);
    return newId;
  }

  /**
   * Set custom account name for this profile
   */
  async setAccountName(name) {
    console.log('🔄 ProfileManager.setAccountName() called with:', name);

    if (!name || typeof name !== 'string') {
      throw new Error('Invalid account name');
    }

    // Sanitize: only alphanumeric, underscores, hyphens
    const sanitized = name
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 50);

    console.log('🧹 Sanitized account name:', sanitized);

    if (sanitized.length === 0) {
      throw new Error('Account name cannot be empty after sanitization');
    }

    const settings = await chrome.storage.local.get(this.storageKey);
    const accountSettings = settings[this.storageKey] || {};

    console.log('📋 Current account settings before update:', accountSettings);

    accountSettings.accountName = sanitized;
    accountSettings.lastUpdated = Date.now();

    console.log('💾 Saving account settings:', accountSettings);

    await chrome.storage.local.set({ [this.storageKey]: accountSettings });

    console.log('✅ Account name updated and saved:', sanitized);
    return sanitized;
  }

  /**
   * Set/update the auto-generated profile ID
   */
  async setProfileId(id) {
    const settings = await chrome.storage.local.get(this.storageKey);
    const accountSettings = settings[this.storageKey] || {};

    accountSettings.profileId = id;
    accountSettings.created = accountSettings.created || Date.now();

    await chrome.storage.local.set({ [this.storageKey]: accountSettings });
  }

  /**
   * Get full account settings
   */
  async getAccountSettings() {
    const settings = await chrome.storage.local.get(this.storageKey);
    return settings[this.storageKey] || {};
  }

  /**
   * Check if account name has been customized
   */
  async isCustomized() {
    const settings = await this.getAccountSettings();
    return !!settings.accountName;
  }


  /**
   * Generate short unique ID
   */
  _generateShortId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `${timestamp}${random}`;
  }
}

// Export for Service Worker
if (typeof self !== 'undefined') {
  self.ProfileManager = ProfileManager;
}

console.log('✅ PROFILE-MANAGER.JS LOADED');