// ===== FILE ORGANIZATION SYSTEM =====
// Flexible output structure with user-configurable templates

class FileOrganizer {
  constructor() {
    this.templates = {
      // Folder structure templates
      folders: {
        flat: '',
        byYear: '{year}/',
        byYearMonth: '{year}/{month}/',
        byQuarter: '{year}/Q{quarter}/',
        byMarketplace: '{marketplace}/{year}/{month}/',
        byAccount: '{accountName}/{year}/{month}/',
        custom: '{customPath}/'
      },

      // Filename templates
      filenames: {
        default: 'Invoice_{orderId}.pdf',
        dated: '{year}-{month}-{day}_Invoice_{orderId}.pdf',
        detailed: '{year}{month}{day}_{marketplace}_{orderId}.pdf',
        sequential: 'Invoice_{index:04d}_{orderId}.pdf',
        timestamp: '{timestamp}_Invoice_{orderId}.pdf',
        marketplace: '{marketplace}_{orderId}_{year}{month}{day}.pdf'
      }
    };

    // Default user preferences
    this.userPrefs = {
      folderStructure: 'byYearMonth',
      filenameFormat: 'dated',
      baseFolder: 'Amazon_Invoices',
      customPath: '',
      accountName: 'Personal',
      marketplace: this.detectMarketplace(),
      includeTimestamp: false,
      sanitizeFilenames: true
    };

    // Load saved preferences
    this.loadPreferences();
  }

  // Load user preferences from storage
  async loadPreferences() {
    return new Promise((resolve) => {
      chrome.storage.local.get('fileOrganizerPrefs', (data) => {
        if (data.fileOrganizerPrefs) {
          this.userPrefs = { ...this.userPrefs, ...data.fileOrganizerPrefs };
        }
        resolve(this.userPrefs);
      });
    });
  }

  // Save user preferences to storage
  async savePreferences() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ fileOrganizerPrefs: this.userPrefs }, () => {
        resolve();
      });
    });
  }

  // Set user preferences
  setPreferences(prefs) {
    this.userPrefs = { ...this.userPrefs, ...prefs };
    this.savePreferences();
  }

  // Get available folder templates
  getFolderTemplates() {
    return Object.keys(this.templates.folders);
  }

  // Get available filename templates
  getFilenameTemplates() {
    return Object.keys(this.templates.filenames);
  }

  // Generate full path for a download item
  generatePath(item, context = {}) {
    // Generate filename first so it can be used in folder template
    const filename = this.generateFilename(item, context);
    const folderPath = this.generateFolderPath(item, { ...context, filename });
    return `${folderPath}${filename}`;
  }

  // Generate folder path based on template
  generateFolderPath(item, context = {}) {
    const template = this.templates.folders[this.userPrefs.folderStructure];
    if (!template) {
      console.warn(`Unknown folder template: ${this.userPrefs.folderStructure}`);
      return this.templates.folders.flat;
    }

    const data = this.buildTemplateData(item, context);
    return this.interpolateTemplate(template, data);
  }

  // Generate filename based on template
  generateFilename(item, context = {}) {
    const template = this.templates.filenames[this.userPrefs.filenameFormat];
    if (!template) {
      console.warn(`Unknown filename template: ${this.userPrefs.filenameFormat}`);
      return this.templates.filenames.default;
    }

    const data = this.buildTemplateData(item, context);
    let filename = this.interpolateTemplate(template, data);

    // Sanitize filename if enabled
    if (this.userPrefs.sanitizeFilenames) {
      filename = this.sanitizeFilename(filename);
    }

    return filename;
  }

  // Build template data object
  buildTemplateData(item, context = {}) {
    const now = new Date();
    const orderDate = item.orderDate ? new Date(item.orderDate) : now;

    const data = {
      // Order data
      orderId: item.orderId || 'unknown',
      index: item.index !== undefined ? item.index : 0,

      // Date data
      year: orderDate.getFullYear().toString(),
      month: String(orderDate.getMonth() + 1).padStart(2, '0'),
      day: String(orderDate.getDate()).padStart(2, '0'),
      quarter: Math.floor((orderDate.getMonth() + 3) / 3).toString(),

      // Timestamp data
      timestamp: now.toISOString().replace(/[:.]/g, '-').slice(0, -5),
      unix: Math.floor(now.getTime() / 1000).toString(),

      // Marketplace data
      marketplace: this.userPrefs.marketplace || context.marketplace || 'amazon',

      // User preferences
      accountName: this.userPrefs.accountName,
      baseFolder: this.userPrefs.baseFolder,
      customPath: this.userPrefs.customPath,

      // Context data
      ...context
    };

    return data;
  }

  // Interpolate template with data
  interpolateTemplate(template, data) {
    return template.replace(/{(\w+)(?::(\w+))?}/g, (match, key, format) => {
      let value = data[key];

      if (value === undefined) {
        console.warn(`Template variable '${key}' not found in data`);
        return match;
      }

      // Apply formatting
      if (format) {
        switch (format) {
          case '04d':
            value = String(value).padStart(4, '0');
            break;
          case '02d':
            value = String(value).padStart(2, '0');
            break;
          case 'upper':
            value = String(value).toUpperCase();
            break;
          case 'lower':
            value = String(value).toLowerCase();
            break;
        }
      }

      return value;
    });
  }

  // Sanitize filename for filesystem compatibility
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')  // Remove invalid characters
      .replace(/^\.+/, '')                      // Remove leading dots
      .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, '_$1')  // Reserved names
      .slice(0, 255);                          // Limit length
  }

  // Detect current marketplace
  detectMarketplace() {
    const url = window.location?.href || '';
    if (url.includes('amazon.de')) return 'DE';
    if (url.includes('amazon.fr')) return 'FR';
    if (url.includes('amazon.nl')) return 'NL';
    if (url.includes('amazon.co.uk')) return 'UK';
    if (url.includes('amazon.it')) return 'IT';
    return 'COM';
  }

  // Preview path for a given item and settings
  previewPath(item, folderTemplate, filenameTemplate, context = {}) {
    const originalPrefs = { ...this.userPrefs };
    this.userPrefs.folderStructure = folderTemplate;
    this.userPrefs.filenameFormat = filenameTemplate;

    const path = this.generatePath(item, context);

    this.userPrefs = originalPrefs;
    return path;
  }

  // Validate template
  validateTemplate(template) {
    try {
      // Check for basic syntax
      const result = this.interpolateTemplate(template, {});
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Add custom template
  addCustomTemplate(type, name, template) {
    if (!this.templates[type]) {
      this.templates[type] = {};
    }

    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.error}`);
    }

    this.templates[type][name] = template;
  }

  // Get template preview data
  getPreviewData() {
    return {
      sampleItem: {
        orderId: '405-1234567-8901234',
        orderDate: new Date().toISOString(),
        index: 1
      },
      sampleContext: {
        marketplace: this.detectMarketplace(),
        accountName: this.userPrefs.accountName
      }
    };
  }
}

// Singleton instance
// Class exported for instantiation in background script

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileOrganizer;
}
