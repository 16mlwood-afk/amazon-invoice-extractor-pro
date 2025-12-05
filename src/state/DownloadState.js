if (!window.amazonInvoiceDownloader) {
  window.amazonInvoiceDownloader = {};
}

class DownloadState {
  constructor() {
    this._state = {
      accountType: null, // 'business' | 'consumer'
      dateRange: { start: null, end: null },
      progress: { current: 0, total: 0 },
      status: 'idle', // 'idle' | 'running' | 'paused' | 'complete' | 'error'
      errors: [],
      marketplace: null,
      currentPage: 1
    };
    this._listeners = [];
    this._maxErrors = 50;
  }

  // Getters with validation

  get accountType() {
    return this._state.accountType;
  }

  get isBusinessAccount() {
    return this._state.accountType === 'business';
  }

  get dateRange() {
    return { ...this._state.dateRange }; // Return copy to prevent mutation
  }

  get progress() {
    return { ...this._state.progress };
  }

  get progressPercentage() {
    const { current, total } = this._state.progress;
    return total > 0 ? Math.round((current / total) * 100) : 0;
  }

  get status() {
    return this._state.status;
  }

  get errors() {
    return [...this._state.errors]; // Return copy
  }

  get marketplace() {
    return this._state.marketplace;
  }

  get currentPage() {
    return this._state.currentPage;
  }

  // Setters with validation

  setAccountType(type) {
    if (!['business', 'consumer'].includes(type)) {
      throw new Error(`Invalid account type: ${type}. Must be 'business' or 'consumer'`);
    }
    this._updateState({ accountType: type });
  }

  setDateRange(start, end) {
    const normalizedStart = this._normalizeDate(new Date(start));
    const normalizedEnd = this._normalizeDate(new Date(end));

    if (isNaN(normalizedStart.getTime()) || isNaN(normalizedEnd.getTime())) {
      throw new Error('Invalid date provided');
    }

    if (normalizedStart > normalizedEnd) {
      throw new Error('Start date must be before or equal to end date');
    }

    this._updateState({
      dateRange: { start: normalizedStart, end: normalizedEnd }
    });
  }

  setMarketplace(marketplace) {
    const validMarketplaces = ['us', 'uk', 'de', 'fr', 'nl', 'it'];
    if (!validMarketplaces.includes(marketplace)) {
      console.warn(`Unknown marketplace: ${marketplace}`);
    }
    this._updateState({ marketplace });
  }

  setStatus(status) {
    const validStatuses = ['idle', 'running', 'paused', 'complete', 'error'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    this._updateState({ status });
  }

  incrementProgress(amount = 1) {
    if (amount < 0) {
      throw new Error('Progress increment must be positive');
    }
    const newCurrent = this._state.progress.current + amount;
    this._updateState({
      progress: { ...this._state.progress, current: newCurrent }
    });

    // Auto-notify progress to popup
    this._notifyProgress();
  }

  setTotal(total) {
    if (total < 0) {
      throw new Error('Total must be non-negative');
    }
    this._updateState({
      progress: { ...this._state.progress, total }
    });
  }

  setCurrentPage(page) {
    if (page < 1) {
      throw new Error('Page number must be positive');
    }
    this._updateState({ currentPage: page });
  }

  incrementPage() {
    this.setCurrentPage(this._state.currentPage + 1);
  }

  addError(error, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: error.message || error,
      type: error.type || 'unknown',
      context: context,
      stack: error.stack || new Error().stack
    };

    const newErrors = [errorRecord, ...this._state.errors];
    if (newErrors.length > this._maxErrors) {
      newErrors.splice(this._maxErrors);
    }

    this._updateState({ errors: newErrors });

    // Auto-set status to error if we're running
    if (this._state.status === 'running') {
      this.setStatus('error');
    }
  }

  // Observable pattern for state changes

  onChange(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  // State management

  reset() {
    this._state = {
      accountType: null,
      dateRange: { start: null, end: null },
      progress: { current: 0, total: 0 },
      status: 'idle',
      errors: [],
      marketplace: null,
      currentPage: 1
    };
    this._notifyChange();
  }

  isReady() {
    return !!(this._state.accountType && this._state.dateRange.start && this._state.dateRange.end);
  }

  canStartDownload() {
    return this._state.status === 'idle' && this.isReady();
  }

  isRunning() {
    return this._state.status === 'running';
  }

  isComplete() {
    return this._state.status === 'complete';
  }

  hasErrors() {
    return this._state.errors.length > 0;
  }

  // Private methods

  _updateState(updates) {
    this._state = { ...this._state, ...updates };
    this._notifyChange();
  }

  _notifyChange() {
    this._listeners.forEach(listener => {
      try {
        listener(this._state);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  _notifyProgress() {
    try {
      // Only send progress updates if chrome API is available
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "updateProgress",
          progress: this.progressPercentage,
          current: this._state.progress.current,
          total: this._state.progress.total
        });
      }
    } catch (error) {
      console.error('Failed to send progress update:', error);
    }
  }

  _normalizeDate(date) {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  }

  // Serialization for debugging/logging

  toJSON() {
    return {
      ...this._state,
      progressPercentage: this.progressPercentage,
      isReady: this.isReady(),
      canStartDownload: this.canStartDownload()
    };
  }

  toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }
}

// Create global instance
window.amazonInvoiceDownloader.downloadState = new DownloadState();

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js (for tests)
  module.exports = DownloadState;
} else {
  // Browser (for extension)
  window.amazonInvoiceDownloader.DownloadState = DownloadState;
}

// Optional: Add debugging listener
if (window.location.hostname.includes('localhost') || window.location.search.includes('debug')) {
  window.amazonInvoiceDownloader.downloadState.onChange((state) => {
    console.log('State changed:', state);
  });
}
