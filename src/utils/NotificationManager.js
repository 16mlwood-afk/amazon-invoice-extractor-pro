// ===== NOTIFICATION SYSTEM =====
// Non-intrusive notifications for download progress and completion

class NotificationManager {
  constructor() {
    this.notifications = new Map();
    this.settings = {
      showProgress: true,
      showCompletion: true,
      showErrors: true,
      autoCloseDelay: 5000,
      enableSound: false
    };

    this.loadSettings();
    this.isBackgroundScript = typeof chrome !== 'undefined' && chrome.notifications && typeof chrome.notifications.create === 'function';
  }

  // Load notification settings
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('notificationSettings', (data) => {
        if (data.notificationSettings) {
          this.settings = { ...this.settings, ...data.notificationSettings };
        }
        resolve(this.settings);
      });
    });
  }

  // Save notification settings
  async saveSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ notificationSettings: this.settings }, () => {
        resolve();
      });
    });
  }

  // Update settings
  setSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  // Show progress notification
  async showProgress(title, message, progress = -1) {
    if (!this.settings.showProgress) return;

    const notificationId = `progress_${Date.now()}`;

    const options = {
      type: 'progress',
      title: title,
      message: message,
      iconUrl: chrome.runtime.getURL('images/icon128.PNG'),
      progress: Math.max(0, Math.min(100, progress)),
      requireInteraction: false
    };

    try {
      if (this.isBackgroundScript) {
        // Background script - use chrome.notifications directly
        await this.createNotification(notificationId, options);
        this.notifications.set(notificationId, { type: 'progress', created: Date.now() });

        // Auto-clear progress notifications after 30 seconds
        setTimeout(() => {
          this.clearNotification(notificationId);
        }, 30000);
      } else {
        // Content script - send message to background script
        await this.sendNotificationToBackground('showProgress', options);
      }

    } catch (error) {
      console.warn('Failed to show progress notification:', error);
    }
  }

  // Show completion notification
  async showCompletion(title, message, buttons = []) {
    if (!this.settings.showCompletion) return;

    const notificationId = `completion_${Date.now()}`;

    const options = {
      type: 'basic',
      title: title,
      message: message,
      iconUrl: chrome.runtime.getURL('images/icon128.PNG'),
      requireInteraction: true
    };

    if (buttons.length > 0) {
      options.buttons = buttons.map(btn => ({ title: btn.title }));
    }

    try {
      if (this.isBackgroundScript) {
        // Background script - use chrome.notifications directly
        await this.createNotification(notificationId, options);
        this.notifications.set(notificationId, {
          type: 'completion',
          created: Date.now(),
          buttons: buttons
        });

        // Play sound if enabled
        if (this.settings.enableSound) {
          this.playNotificationSound();
        }
      } else {
        // Content script - send message to background script
        options.buttons = buttons; // Include full button objects for background script
        await this.sendNotificationToBackground('showCompletion', options);
      }

    } catch (error) {
      console.warn('Failed to show completion notification:', error);
    }
  }

  // Show error notification
  async showError(title, message) {
    if (!this.settings.showErrors) return;

    const notificationId = `error_${Date.now()}`;

    const options = {
      type: 'basic',
      title: title,
      message: message,
      iconUrl: chrome.runtime.getURL('images/icon128.PNG'),
      requireInteraction: true
    };

    try {
      if (this.isBackgroundScript) {
        // Background script - use chrome.notifications directly
        await this.createNotification(notificationId, options);
        this.notifications.set(notificationId, { type: 'error', created: Date.now() });

        // Play error sound if enabled
        if (this.settings.enableSound) {
          this.playErrorSound();
        }
      } else {
        // Content script - send message to background script
        await this.sendNotificationToBackground('showError', options);
      }

    } catch (error) {
      console.warn('Failed to show error notification:', error);
    }
  }

  // Send notification request to background script
  async sendNotificationToBackground(action, options) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: action,
        ...options
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error('Notification request failed'));
        }
      });
    });
  }

  // Create notification with fallback (background script only)
  async createNotification(notificationId, options) {
    return new Promise((resolve, reject) => {
      chrome.notifications.create(notificationId, options, (createdId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(createdId);
        }
      });
    });
  }

  // Clear specific notification
  clearNotification(notificationId) {
    chrome.notifications.clear(notificationId, (wasCleared) => {
      if (wasCleared) {
        this.notifications.delete(notificationId);
      }
    });
  }

  // Clear all notifications
  clearAllNotifications() {
    chrome.notifications.getAll((notifications) => {
      Object.keys(notifications).forEach(id => {
        this.clearNotification(id);
      });
    });
  }

  // Handle notification clicks
  setupNotificationListeners() {
    chrome.notifications.onClicked.addListener((notificationId) => {
      const notification = this.notifications.get(notificationId);
      if (notification) {
        this.handleNotificationClick(notificationId, notification);
      }
    });

    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      const notification = this.notifications.get(notificationId);
      if (notification && notification.buttons && notification.buttons[buttonIndex]) {
        const button = notification.buttons[buttonIndex];
        if (button.action) {
          button.action();
        }
      }
    });

    chrome.notifications.onClosed.addListener((notificationId, byUser) => {
      this.notifications.delete(notificationId);
    });
  }

  // Handle notification click
  handleNotificationClick(notificationId, notification) {
    // Focus the extension popup or open downloads folder
    chrome.windows.getCurrent((window) => {
      if (window) {
        chrome.windows.update(window.id, { focused: true });
      }
    });

    // Open downloads folder for completion notifications
    if (notification.type === 'completion') {
      chrome.downloads.showDefaultFolder();
    }

    this.clearNotification(notificationId);
  }

  // Update progress notification
  async updateProgress(notificationId, progress, message = null) {
    if (!this.notifications.has(notificationId) && !this.isBackgroundScript) {
      // For content scripts, send update request to background
      try {
        await this.sendNotificationToBackground('updateProgressNotification', {
          progress: Math.max(0, Math.min(100, progress)),
          message: message
        });
      } catch (error) {
        console.warn('Failed to update progress notification:', error);
      }
      return;
    }

    // Background script - update directly
    if (!this.notifications.has(notificationId)) return;

    const options = {
      progress: Math.max(0, Math.min(100, progress))
    };

    if (message) {
      options.message = message;
    }

    chrome.notifications.update(notificationId, options);
  }

  // Play notification sound
  playNotificationSound() {
    // Skip sound in service worker context (no audio access)
    if (typeof window === 'undefined') {
      return;
    }

    // Create a simple beep sound using Web Audio API
    try {
      const audioContext = new (self.AudioContext || self.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }

  // Play error sound
  playErrorSound() {
    // Skip sound in service worker context (no audio access)
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const audioContext = new (self.AudioContext || self.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play error sound:', error);
    }
  }

  // Show download start notification
  notifyDownloadStart(totalInvoices, marketplace = 'Amazon') {
    this.showProgress(
      'Bison Invoice Manager',
      `Starting download of ${totalInvoices} invoices from ${marketplace}...`,
      0
    );
  }

  // Update download progress
  notifyDownloadProgress(current, total, marketplace = 'Amazon') {
    const progress = total > 0 ? Math.round((current / total) * 100) : 0;
    const notificationId = 'progress_download';

    if (!this.notifications.has(notificationId)) {
      this.showProgress(
        'Downloading Invoices',
        `Processing ${current} of ${total} invoices...`,
        progress
      );
    } else {
      this.updateProgress(
        notificationId,
        progress,
        `Processing ${current} of ${total} invoices from ${marketplace}...`
      );
    }
  }

  // Show download completion
  notifyDownloadComplete(successful, failed, marketplace = 'Amazon') {
    const title = failed > 0 ? 'Download Completed with Errors' : 'Download Completed Successfully';
    const message = failed > 0
      ? `${successful} invoices downloaded, ${failed} failed from ${marketplace}`
      : `All ${successful} invoices downloaded successfully from ${marketplace}`;

    const buttons = [];
    if (failed > 0) {
      buttons.push({
        title: 'Retry Failed',
        action: () => {
          // This would need to be implemented to retry failed downloads
          console.log('Retry failed downloads clicked');
        }
      });
    }

    buttons.push({
      title: 'View Files',
      action: () => {
        chrome.downloads.showDefaultFolder();
      }
    });

    this.showCompletion(title, message, buttons);
  }

  // Show download error
  notifyDownloadError(error, marketplace = 'Amazon') {
    this.showError(
      'Download Failed',
      `Failed to download invoices from ${marketplace}: ${error}`
    );
  }

  // Show pagination progress
  notifyPaginationProgress(currentPage, totalPages, collectedOrders = 0) {
    const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
    const notificationId = 'progress_pagination';

    if (!this.notifications.has(notificationId)) {
      this.showProgress(
        'Collecting Orders',
        `Processing page ${currentPage} of ${totalPages}...`,
        progress
      );
      // Manually set the notification ID for future updates
      setTimeout(() => {
        // Find the most recent progress notification and update our map
        const recentProgress = Array.from(this.notifications.entries())
          .filter(([id, n]) => n.type === 'progress')
          .sort((a, b) => b[1].created - a[1].created)[0];
        if (recentProgress && recentProgress[0] !== notificationId) {
          this.notifications.set(notificationId, recentProgress[1]);
          this.notifications.delete(recentProgress[0]);
        }
      }, 100);
    } else {
      this.updateProgress(
        notificationId,
        progress,
        `Processing page ${currentPage} of ${totalPages}...`
      );
    }
  }

  // Show multi-marketplace progress
  notifyMultiMarketplaceProgress(currentMarketplace, totalMarketplaces, completedInvoices) {
    this.showProgress(
      'Multi-Marketplace Download',
      `Processing ${currentMarketplace} (${completedInvoices} invoices so far)...`,
      Math.round((parseInt(currentMarketplace) / totalMarketplaces) * 100)
    );
  }

  // Check if notifications are supported and permitted
  async checkPermission() {
    return new Promise((resolve) => {
      chrome.permissions.contains({ permissions: ['notifications'] }, (hasPermission) => {
        resolve(hasPermission);
      });
    });
  }

  // Request notification permission
  async requestPermission() {
    return new Promise((resolve) => {
      chrome.permissions.request({ permissions: ['notifications'] }, (granted) => {
        resolve(granted);
      });
    });
  }
}

// Class exported for instantiation in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationManager;
}
