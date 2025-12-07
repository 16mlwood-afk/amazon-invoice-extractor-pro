// ============================================
// OPTIONS PAGE MANAGEMENT
// ============================================

// Import OptionsManager from utils
importScripts('../utils/OptionsManager.js');

// OptionsPageManager class for UI management
class OptionsPageManager {
  constructor() {
    // Skip initialization in service worker context
    if (typeof document === 'undefined' || !document.addEventListener) {
      console.log('⚠️ OptionsPageManager: Skipping DOM initialization (service worker context)');
      return;
    }

    this.currentSection = 'general';
    this.saveTimeout = null;
    this.defaultSettings = OptionsManager.getDefaultSettings();
    this.init();
  }

  // Initialize the options page
  init() {
    this.bindEvents();
    this.loadSettings();
    this.updatePreviews();
    this.showSection(this.currentSection);
  }

  // Bind all event listeners
  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');
        this.showSection(section);
      });
    });

    // Form inputs
    this.bindFormInputs();

    // Buttons
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistory());
    document.getElementById('resetSettingsBtn').addEventListener('click', () => this.resetSettings());

    // Range sliders
    document.getElementById('maxConcurrent').addEventListener('input', (e) => {
      document.getElementById('maxConcurrentValue').textContent = e.target.value;
    });
  }

  // Bind form input events for auto-save
  bindFormInputs() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('change', () => this.scheduleAutoSave());
      input.addEventListener('input', () => this.scheduleAutoSave());
    });
  }

  // Schedule auto-save with debouncing
  scheduleAutoSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSettings(true);
    }, 1000);
  }

  // Show specific settings section
  showSection(sectionId) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.settings-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');

    // Update header
    this.updateSectionHeader(sectionId);

    this.currentSection = sectionId;
  }

  // Update section header based on active section
  updateSectionHeader(sectionId) {
    const titles = {
      'general': { title: 'General Settings', description: 'Configure general behavior and preferences' },
      'downloads': { title: 'Download Settings', description: 'Control download performance and behavior' },
      'organization': { title: 'File Organization', description: 'Customize how files are organized and named' },
      'advanced': { title: 'Advanced Settings', description: 'Advanced configuration options' }
    };

    const header = titles[sectionId] || titles.general;
    document.getElementById('section-title').textContent = header.title;
    document.getElementById('section-description').textContent = header.description;
  }

  // Load settings from chrome storage
  async loadSettings() {
    try {
      const data = await OptionsManager.loadSettings();

      // Apply settings to form
      Object.keys(data).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
          if (element.type === 'checkbox') {
            element.checked = data[key];
          } else if (element.type === 'range') {
            element.value = data[key];
            // Update range value display
            if (key === 'maxConcurrent') {
              document.getElementById('maxConcurrentValue').textContent = data[key];
            }
          } else {
            element.value = data[key];
          }
        }
      });

      // Update UI elements that depend on settings
      this.updatePreviews();
      this.showStatus('Settings loaded', 'success', 2000);
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showStatus('Error loading settings', 'error');
    }
  }

  // Save settings to chrome storage
  saveSettings(autoSave = false) {
    const settings = {};

    // Collect all form values
    Object.keys(this.defaultSettings).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'checkbox') {
          settings[key] = element.checked;
        } else {
          settings[key] = element.value;
        }
      }
    });

    // Add loading state
    const saveBtn = document.getElementById('saveSettingsBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.classList.add('loading');
    saveBtn.disabled = true;

    chrome.storage.local.set(settings, () => {
      // Remove loading state
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;

      if (chrome.runtime.lastError) {
        console.error('Error saving settings:', chrome.runtime.lastError);
        this.showStatus('Error saving settings', 'error');
        return;
      }

      // Update previews after save
      this.updatePreviews();

      if (!autoSave) {
        this.showStatus('Settings saved successfully!', 'success', 3000);
      }
    });
  }

  // Update live previews based on settings
  updatePreviews() {
    this.updateFolderPreview();
    this.updateFilenamePreview();
  }

  // Update folder structure preview
  updateFolderPreview() {
    const folderStructure = document.getElementById('folderStructure').value;
    const baseFolder = document.getElementById('baseFolder').value;

    let preview = '';
    switch (folderStructure) {
      case 'flat':
        preview = `${baseFolder}/Invoice_12345.pdf`;
        break;
      case 'by-year':
        preview = `${baseFolder}/2025/Invoice_12345.pdf`;
        break;
      case 'by-year-month':
        preview = `${baseFolder}/2025/11/Invoice_12345.pdf`;
        break;
      case 'by-quarter':
        preview = `${baseFolder}/2025/Q4/Invoice_12345.pdf`;
        break;
      case 'by-marketplace':
        preview = `${baseFolder}/Amazon.com/Invoice_12345.pdf`;
        break;
      default:
        preview = `${baseFolder}/2025/11/Invoice_12345.pdf`;
    }

    document.getElementById('folderPreview').textContent = `Example: ${preview}`;
  }

  // Update filename format preview
  updateFilenamePreview() {
    const filenameFormat = document.getElementById('filenameFormat').value;
    const baseFolder = document.getElementById('baseFolder').value;
    const folderStructure = document.getElementById('folderStructure').value;

    let folderPath = '';
    switch (folderStructure) {
      case 'flat':
        folderPath = baseFolder;
        break;
      case 'by-year':
        folderPath = `${baseFolder}/2025`;
        break;
      case 'by-year-month':
        folderPath = `${baseFolder}/2025/11`;
        break;
      case 'by-quarter':
        folderPath = `${baseFolder}/2025/Q4`;
        break;
      case 'by-marketplace':
        folderPath = `${baseFolder}/Amazon.com`;
        break;
      default:
        folderPath = `${baseFolder}/2025/11`;
    }

    let filename = '';
    switch (filenameFormat) {
      case 'default':
        filename = 'Invoice_123456789.pdf';
        break;
      case 'dated':
        filename = '2025-11-15_Invoice_123456789.pdf';
        break;
      case 'detailed':
        filename = 'Amazon.com_20251115_123456789.pdf';
        break;
      case 'timestamp':
        filename = '1731628800000_Invoice_123456789.pdf';
        break;
      default:
        filename = 'Invoice_123456789.pdf';
    }

    document.getElementById('filenamePreview').textContent = `Example: ${filename}`;
  }

  // Clear download history
  clearHistory() {
    if (!confirm('Are you sure you want to clear all download history? This action cannot be undone.')) {
      return;
    }

    const btn = document.getElementById('clearHistoryBtn');
    const originalText = btn.innerHTML;
    btn.classList.add('loading');
    btn.disabled = true;

    chrome.storage.local.remove(['downloadHistory', 'downloadedInvoices'], () => {
      btn.classList.remove('loading');
      btn.disabled = false;

      if (chrome.runtime.lastError) {
        console.error('Error clearing history:', chrome.runtime.lastError);
        this.showStatus('Error clearing history', 'error');
        return;
      }

      this.showStatus('Download history cleared successfully', 'success', 3000);
    });
  }

  // Reset all settings to defaults
  resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to their default values?')) {
      return;
    }

    // Apply default values to form
    Object.keys(this.defaultSettings).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = this.defaultSettings[key];
        } else if (element.type === 'range') {
          element.value = this.defaultSettings[key];
          if (key === 'maxConcurrent') {
            document.getElementById('maxConcurrentValue').textContent = this.defaultSettings[key];
          }
        } else {
          element.value = this.defaultSettings[key];
        }
      }
    });

    // Save defaults
    this.saveSettings();
    this.updatePreviews();
  }

  // Show status message
  showStatus(message, type = 'info', duration = 5000) {
    const statusEl = document.getElementById('saveStatus');
    statusEl.textContent = message;
    statusEl.className = `save-status ${type} visible`;

    if (duration > 0) {
      setTimeout(() => {
        statusEl.classList.remove('visible');
      }, duration);
    }
  }

  // Export settings for backup
  exportSettings() {
    chrome.storage.local.get(null, (data) => {
      const settingsBlob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(settingsBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `amazon-invoice-extractor-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showStatus('Settings exported successfully', 'success', 3000);
    });
  }

  // Import settings from file
  importSettings(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);

        // Validate settings structure
        const validKeys = Object.keys(this.defaultSettings);
        const filteredSettings = {};

        Object.keys(settings).forEach(key => {
          if (validKeys.includes(key)) {
            filteredSettings[key] = settings[key];
          }
        });

        chrome.storage.local.set(filteredSettings, () => {
          if (chrome.runtime.lastError) {
            this.showStatus('Error importing settings', 'error');
            return;
          }

          this.loadSettings();
          this.showStatus('Settings imported successfully', 'success', 3000);
        });
      } catch (error) {
        this.showStatus('Invalid settings file', 'error');
      }
    };
    reader.readAsText(file);
  }

}

// Initialize when DOM is ready (only if DOM is available)
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    new OptionsPageManager();
  });

  // Handle keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+S to save settings
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      document.getElementById('saveSettingsBtn').click();
    }
  });
}
