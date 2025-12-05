// ===== DOWNLOAD HISTORY DASHBOARD =====
// Track acquisition over time with session history and statistics

class HistoryManager {
  constructor() {
    this.storageKey = 'downloadHistory';
    this.maxSessions = 100; // Keep last 100 sessions
    this.history = {
      sessions: [],
      stats: {
        totalInvoices: 0,
        totalSessions: 0,
        successRate: 0,
        averageSessionSize: 0,
        lastDownload: null,
        totalDownloadTime: 0,
        marketplaces: new Set(),
        dateRange: { earliest: null, latest: null }
      }
    };

    this.loadHistory();
  }

  // Load history from storage
  async loadHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.storageKey, (data) => {
        if (data[this.storageKey]) {
          this.history = data[this.storageKey];
          // Convert marketplaces back to Set
          this.history.stats.marketplaces = new Set(this.history.stats.marketplaces || []);
        }
        resolve(this.history);
      });
    });
  }

  // Save history to storage
  async saveHistory() {
    return new Promise((resolve) => {
      // Convert Set to Array for storage
      const dataToSave = {
        ...this.history,
        stats: {
          ...this.history.stats,
          marketplaces: Array.from(this.history.stats.marketplaces)
        }
      };

      chrome.storage.local.set({ [this.storageKey]: dataToSave }, () => {
        resolve();
      });
    });
  }

  // Record a new download session
  async recordSession(sessionData) {
    const session = {
      id: this.generateSessionId(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      timestamp: new Date().toISOString(),
      marketplace: sessionData.marketplace || 'unknown',
      invoicesDownloaded: sessionData.successful || 0,
      failed: sessionData.failed || 0,
      skipped: sessionData.skipped || 0,
      total: (sessionData.successful || 0) + (sessionData.failed || 0) + (sessionData.skipped || 0),
      duration: sessionData.duration || 0,
      status: sessionData.failed > 0 ? 'completed_with_errors' : 'completed',
      sessionType: sessionData.sessionType || 'single_marketplace',
      downloads: sessionData.downloads || [],
      errors: sessionData.errors || []
    };

    // Add to history
    this.history.sessions.unshift(session);

    // Trim to max sessions
    if (this.history.sessions.length > this.maxSessions) {
      this.history.sessions = this.history.sessions.slice(0, this.maxSessions);
    }

    // Update statistics
    this.updateStats(session);

    // Save to storage
    await this.saveHistory();

    console.log(`📊 Session recorded: ${session.invoicesDownloaded} invoices, ${session.duration}ms`);
    return session;
  }

  // Update global statistics
  updateStats(session) {
    const stats = this.history.stats;

    // Basic counts
    stats.totalSessions += 1;
    stats.totalInvoices += session.total;
    stats.lastDownload = session.timestamp;

    // Marketplaces
    stats.marketplaces.add(session.marketplace);

    // Date range
    const sessionDate = new Date(session.timestamp);
    if (!stats.dateRange.earliest || sessionDate < new Date(stats.dateRange.earliest)) {
      stats.dateRange.earliest = session.timestamp;
    }
    if (!stats.dateRange.latest || sessionDate > new Date(stats.dateRange.latest)) {
      stats.dateRange.latest = session.timestamp;
    }

    // Duration tracking
    stats.totalDownloadTime += session.duration;

    // Success rate calculation
    const totalSuccessful = this.history.sessions.reduce((sum, s) => sum + s.invoicesDownloaded, 0);
    const totalAttempted = this.history.sessions.reduce((sum, s) => sum + s.total, 0);
    stats.successRate = totalAttempted > 0 ? (totalSuccessful / totalAttempted * 100) : 0;

    // Average session size
    stats.averageSessionSize = stats.totalInvoices / stats.totalSessions;
  }

  // Get session history with optional filtering
  getSessions(filter = {}) {
    let sessions = [...this.history.sessions];

    // Apply filters
    if (filter.marketplace) {
      sessions = sessions.filter(s => s.marketplace === filter.marketplace);
    }

    if (filter.status) {
      sessions = sessions.filter(s => s.status === filter.status);
    }

    if (filter.dateFrom) {
      const fromDate = new Date(filter.dateFrom);
      sessions = sessions.filter(s => new Date(s.timestamp) >= fromDate);
    }

    if (filter.dateTo) {
      const toDate = new Date(filter.dateTo);
      sessions = sessions.filter(s => new Date(s.timestamp) <= toDate);
    }

    if (filter.limit) {
      sessions = sessions.slice(0, filter.limit);
    }

    return sessions;
  }

  // Get dashboard statistics
  getDashboardStats() {
    const stats = { ...this.history.stats };

    // Calculate additional derived stats
    const sessions = this.history.sessions;

    // Recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentSessions = sessions.filter(s => new Date(s.timestamp) >= weekAgo);

    stats.recentActivity = {
      sessions: recentSessions.length,
      invoices: recentSessions.reduce((sum, s) => sum + s.invoicesDownloaded, 0),
      successRate: this.calculateSuccessRate(recentSessions)
    };

    // Marketplace breakdown
    stats.marketplaceBreakdown = {};
    sessions.forEach(session => {
      if (!stats.marketplaceBreakdown[session.marketplace]) {
        stats.marketplaceBreakdown[session.marketplace] = {
          sessions: 0,
          invoices: 0,
          successRate: 0
        };
      }
      stats.marketplaceBreakdown[session.marketplace].sessions += 1;
      stats.marketplaceBreakdown[session.marketplace].invoices += session.invoicesDownloaded;
    });

    // Calculate success rates per marketplace
    Object.keys(stats.marketplaceBreakdown).forEach(marketplace => {
      const mpSessions = sessions.filter(s => s.marketplace === marketplace);
      stats.marketplaceBreakdown[marketplace].successRate = this.calculateSuccessRate(mpSessions);
    });

    return stats;
  }

  // Calculate success rate for a set of sessions
  calculateSuccessRate(sessions) {
    if (sessions.length === 0) return 0;

    const totalSuccessful = sessions.reduce((sum, s) => sum + s.invoicesDownloaded, 0);
    const totalAttempted = sessions.reduce((sum, s) => sum + s.total, 0);

    return totalAttempted > 0 ? Math.round((totalSuccessful / totalAttempted) * 100 * 10) / 10 : 0;
  }

  // Get session details
  getSession(sessionId) {
    return this.history.sessions.find(s => s.id === sessionId);
  }

  // Delete a session
  async deleteSession(sessionId) {
    const index = this.history.sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      this.history.sessions.splice(index, 1);
      await this.saveHistory();
      return true;
    }
    return false;
  }

  // Clear all history
  async clearHistory() {
    this.history = {
      sessions: [],
      stats: {
        totalInvoices: 0,
        totalSessions: 0,
        successRate: 0,
        averageSessionSize: 0,
        lastDownload: null,
        totalDownloadTime: 0,
        marketplaces: new Set(),
        dateRange: { earliest: null, latest: null }
      }
    };

    await this.saveHistory();
  }

  // Export history data
  exportHistory() {
    return {
      exportDate: new Date().toISOString(),
      version: '1.0',
      ...this.history,
      stats: {
        ...this.history.stats,
        marketplaces: Array.from(this.history.stats.marketplaces)
      }
    };
  }

  // Import history data
  async importHistory(importData) {
    try {
      this.history = {
        ...importData,
        stats: {
          ...importData.stats,
          marketplaces: new Set(importData.stats.marketplaces || [])
        }
      };
      await this.saveHistory();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Generate unique session ID
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${timestamp}_${random}`;
  }

  // Format duration for display
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Get summary for display
  getDisplaySummary() {
    const stats = this.getDashboardStats();
    const recent = stats.recentActivity;

    return {
      totalInvoices: stats.totalInvoices.toLocaleString(),
      totalSessions: stats.totalSessions,
      successRate: `${stats.successRate}%`,
      averageSessionSize: Math.round(stats.averageSessionSize * 10) / 10,
      lastDownload: stats.lastDownload ? new Date(stats.lastDownload).toLocaleDateString() : 'Never',
      recentActivity: `${recent.sessions} sessions, ${recent.invoices} invoices`,
      marketplaces: Array.from(stats.marketplaces).sort(),
      marketplaceStats: stats.marketplaceBreakdown
    };
  }
}

// Singleton instance
const historyManager = new HistoryManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryManager;
}
