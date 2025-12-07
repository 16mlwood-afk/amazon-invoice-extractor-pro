/**
 * Content Script Manager Module
 * Handles content script injection, checking, and management
 */

class ContentScriptManager {
  constructor() {
    this.contentScripts = [
      'helpers.js',
      'download-manager.js',
      'pagination-manager.js',
      'order-scraper.js',
      'content-main.js'
    ];
  }

  /**
   * Execute content scripts manually on active tab
   * @returns {Promise<void>}
   */
  async executeContentScript() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tabs.length === 0) {
      console.error('Geen actieve tab gevonden');
      throw new Error('Geen actieve tab gevonden');
    }

    const tabId = tabs[0].id;

    for (const script of this.contentScripts) {
      console.log(`💉 Injecting: ${script}`);

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: [script]
        });
        console.log(`${script} handmatig uitgevoerd`);
      } catch (error) {
        console.error(`Fout bij het uitvoeren van ${script}:`, error);
        throw error;
      }
    }

    console.log('Alle content scripts handmatig uitgevoerd');
  }

  /**
   * Check if content scripts are loaded and responding
   * @param {number} tabId - Optional tab ID, uses active tab if not provided
   * @returns {Promise<Object>} Load status
   */
  async checkContentScriptLoaded(tabId) {
    let tab;

    if (!tabId) {
      // Get active tab if not provided
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs.length === 0) {
        throw new Error("Geen actieve tab gevonden");
      }
      tab = tabs[0];
      tabId = tab.id;
    } else {
      // Get tab info if tabId provided
      tab = await chrome.tabs.get(tabId);
    }

    try {
      console.log('🔍 Checking if content scripts are loaded...');

      // Content scripts are declared in manifest.json and should auto-load
      // Just ping them to see if they're ready
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: "ping" });

        if (response && response.pong) {
          console.log('✅ Content scripts are loaded and responding');
          return { loaded: true };
        }
      } catch (pingError) {
        console.log('📡 Content scripts not responding yet - they may still be loading');
      }

      // Content scripts are declared in manifest and should load automatically
      // They might just need more time to initialize
      console.log('⏳ Content scripts declared in manifest - waiting for initialization...');
      return { loaded: false, error: 'Content scripts not ready yet' };

    } catch (error) {
      console.error('❌ Error checking content scripts:', error);
      return { loaded: false, error: error.message };
    }
  }

  /**
   * Inject content scripts manually (legacy method, now using manifest)
   * @param {number} tabId - Tab ID to inject scripts into
   * @param {string} url - URL of the tab
   * @returns {Promise<boolean>} Success status
   */
  async injectContentScripts(tabId, url) {
    console.log('💉 Injecting content script for tab:', tabId);

    try {
      if (!url) {
        const tab = await chrome.tabs.get(tabId);
        url = tab.url;
      }

      if (!url) throw new Error('No URL');

      console.log('📄 URL:', url);

      // Inject sequentially to ensure proper loading order
      let index = 0;

      const injectNext = () => {
        if (index >= this.contentScripts.length) {
          console.log('✅ All content scripts injected successfully');
          return Promise.resolve(true);
        }

        const script = this.contentScripts[index];
        console.log(`💉 Injecting: ${script}`);

        return chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: [script]
        }).then((results) => {
          if (chrome.runtime.lastError) {
            console.error(`❌ Failed to inject ${script}:`, chrome.runtime.lastError);
            throw chrome.runtime.lastError;
          } else {
            console.log(`✅ Successfully injected: ${script}`);
            index++;
            return injectNext(); // Inject next script
          }
        });
      };

      await injectNext();
      console.log('✅ Content script injected');
      return true;

    } catch (error) {
      console.error('❌ Injection error:', error);
      throw error;
    }
  }

  /**
   * Get Amazon domain from URL
   * @param {string} url - Amazon URL
   * @returns {string} Domain name
   */
  getAmazonDomain(url) {
    return url.includes('.de') ? 'amazon.de' : 'amazon.nl';
  }

  /**
   * Send message to content script
   * @param {number} tabId - Tab ID
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} Response from content script
   */
  async sendMessageToContentScript(tabId, message) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      console.error('❌ Error sending message to content script:', error);
      throw error;
    }
  }
}

// Export for use in background script
const contentScriptManager = new ContentScriptManager();

// Make globally available
self.contentScriptManager = contentScriptManager;