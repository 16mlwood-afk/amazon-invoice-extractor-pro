/**
 * Session Manager Module
 * Handles session numbering and formatting for different marketplaces
 */

class SessionManager {
  constructor() {
    this.sessionCounters = {};
  }

  /**
   * Get the next session number for a marketplace
   * @param {string} marketplace - The marketplace code (e.g., 'DE', 'UK')
   * @returns {Promise<number>} The next session number
   */
  async getNextSessionNumber(marketplace) {
    const result = await chrome.storage.local.get(['sessionCounters']);
    const counters = result.sessionCounters || {};

    // Get current counter for this marketplace, default to 0
    const currentCount = counters[marketplace] || 0;
    const nextCount = currentCount + 1;

    // Save the incremented counter
    counters[marketplace] = nextCount;
    await chrome.storage.local.set({ sessionCounters: counters });

    console.log(`🔢 Session number for ${marketplace}: ${nextCount}`);
    return nextCount;
  }

  /**
   * Format session number with leading zeros
   * @param {number} sessionNum - The session number
   * @returns {string} Formatted session (e.g., "001", "042", "999")
   */
  formatSessionNumber(sessionNum) {
    return String(sessionNum).padStart(3, '0');
  }

  /**
   * Get current session counters for all marketplaces
   * @returns {Promise<Object>} Session counters object
   */
  async getSessionCounters() {
    const result = await chrome.storage.local.get(['sessionCounters']);
    return result.sessionCounters || {};
  }

  /**
   * Reset session counter for a specific marketplace
   * @param {string} marketplace - The marketplace code
   * @returns {Promise<void>}
   */
  async resetSessionCounter(marketplace) {
    const result = await chrome.storage.local.get(['sessionCounters']);
    const counters = result.sessionCounters || {};
    counters[marketplace] = 0;
    await chrome.storage.local.set({ sessionCounters: counters });
    console.log(`🔄 Reset session counter for ${marketplace}`);
  }

  /**
   * Reset all session counters
   * @returns {Promise<void>}
   */
  async resetAllSessionCounters() {
    await chrome.storage.local.set({ sessionCounters: {} });
    console.log('🔄 Reset all session counters');
  }
}

// Class exported for instantiation in background script