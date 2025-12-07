// ===== BANDWIDTH MANAGEMENT =====
// Adapt download behavior based on network conditions

class BandwidthManager {
  constructor() {
    this.currentProfile = 'normal';
    this.failureRate = 0;
    this.recentFailures = [];
    this.lastAdjustment = Date.now();
    this.monitoring = false;

    // Network profiles with different settings
    this.profiles = {
      excellent: {
        maxConcurrent: 10,
        delayBetween: 500,
        throttleRate: 20,
        description: 'Excellent connection - high throughput'
      },
      good: {
        maxConcurrent: 5,
        delayBetween: 800,
        throttleRate: 12,
        description: 'Good connection - balanced performance'
      },
      normal: {
        maxConcurrent: 3,
        delayBetween: 1500,
        throttleRate: 8,
        description: 'Normal connection - conservative settings'
      },
      poor: {
        maxConcurrent: 2,
        delayBetween: 2500,
        throttleRate: 5,
        description: 'Poor connection - slow and steady'
      },
      terrible: {
        maxConcurrent: 1,
        delayBetween: 5000,
        throttleRate: 2,
        description: 'Very poor connection - minimal load'
      }
    };

    this.startMonitoring();
  }

  // Start monitoring network conditions
  startMonitoring() {
    if (this.monitoring) return;

    this.monitoring = true;
    console.log('📊 Started bandwidth monitoring');

    // Monitor network changes
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', () => {
        this.adjustForNetworkConditions();
      });
    }

    // Periodic reassessment
    setInterval(() => {
      this.adjustForNetworkConditions();
    }, 30000); // Check every 30 seconds

    // Initial assessment
    this.adjustForNetworkConditions();
  }

  // Stop monitoring
  stopMonitoring() {
    this.monitoring = false;
    console.log('📊 Stopped bandwidth monitoring');
  }

  // Get current network profile
  getCurrentProfile() {
    return {
      profile: this.currentProfile,
      settings: this.profiles[this.currentProfile],
      failureRate: this.failureRate,
      lastAdjustment: new Date(this.lastAdjustment).toISOString()
    };
  }

  // Adjust settings based on network conditions
  async adjustForNetworkConditions() {
    const newProfile = await this.assessNetworkConditions();

    if (newProfile !== this.currentProfile) {
      console.log(`📊 Network profile changed: ${this.currentProfile} → ${newProfile}`);
      this.currentProfile = newProfile;
      this.lastAdjustment = Date.now();

      // Notify listeners of the change
      this.onProfileChange && this.onProfileChange(newProfile, this.profiles[newProfile]);
    }
  }

  // Assess current network conditions
  async assessNetworkConditions() {
    const conditions = {
      connectionType: this.getConnectionType(),
      effectiveType: this.getEffectiveType(),
      downlink: this.getDownlinkSpeed(),
      rtt: this.getRTT(),
      failureRate: this.calculateFailureRate(),
      signalStrength: await this.measureConnectionQuality()
    };

    // Determine profile based on conditions
    if (conditions.failureRate > 0.3) {
      return 'terrible'; // High failure rate
    }

    if (conditions.effectiveType === '4g' && conditions.downlink > 10) {
      return 'excellent';
    }

    if (conditions.effectiveType === '4g' || (conditions.effectiveType === '3g' && conditions.downlink > 2)) {
      return 'good';
    }

    if (conditions.effectiveType === '3g' || conditions.effectiveType === '2g') {
      return 'poor';
    }

    if (conditions.connectionType === 'cellular' || conditions.rtt > 500) {
      return 'poor';
    }

    return 'normal'; // Default fallback
  }

  // Get connection type
  getConnectionType() {
    if ('connection' in navigator) {
      return navigator.connection.type || 'unknown';
    }
    return 'unknown';
  }

  // Get effective connection type
  getEffectiveType() {
    if ('connection' in navigator) {
      return navigator.connection.effectiveType || 'unknown';
    }
    return 'unknown';
  }

  // Get downlink speed (Mbps)
  getDownlinkSpeed() {
    if ('connection' in navigator) {
      return navigator.connection.downlink || 0;
    }
    return 0;
  }

  // Get round-trip time (ms)
  getRTT() {
    if ('connection' in navigator) {
      return navigator.connection.rtt || 0;
    }
    return 0;
  }

  // Calculate recent failure rate
  calculateFailureRate() {
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; // 5 minutes

    // Clean old failures
    this.recentFailures = this.recentFailures.filter(failure =>
      now - failure.timestamp < recentWindow
    );

    const totalAttempts = Math.max(this.recentFailures.length + 10, 20); // Assume at least some successes
    this.failureRate = this.recentFailures.length / totalAttempts;

    return this.failureRate;
  }

  // Record a download failure
  recordFailure() {
    this.recentFailures.push({
      timestamp: Date.now()
    });

    // Keep only recent failures
    const cutoff = Date.now() - (10 * 60 * 1000); // 10 minutes
    this.recentFailures = this.recentFailures.filter(f => f.timestamp > cutoff);
  }

  // Record a download success
  recordSuccess() {
    // Success implicitly reduces failure rate over time
    // We don't need to store successes explicitly
  }

  // Measure connection quality with a test request
  async measureConnectionQuality() {
    try {
      const startTime = Date.now();

      // Test with a small request to a reliable endpoint
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });

      const responseTime = Date.now() - startTime;

      // Classify response time
      if (responseTime < 200) return 'excellent';
      if (responseTime < 500) return 'good';
      if (responseTime < 1000) return 'fair';
      if (responseTime < 2000) return 'poor';
      return 'terrible';

    } catch (error) {
      return 'terrible'; // If the request fails, connection is poor
    }
  }

  // Pause downloads if network is struggling
  async pauseIfNeeded() {
    if (this.failureRate > 0.3) {
      console.log(`📊 High failure rate (${(this.failureRate * 100).toFixed(1)}%) - pausing downloads`);
      return true; // Signal to pause
    }

    if (this.currentProfile === 'terrible') {
      console.log('📊 Terrible connection - pausing downloads');
      return true;
    }

    return false; // Continue downloading
  }

  // Get adaptive settings for current conditions
  getAdaptiveSettings(baseSettings = {}) {
    const profile = this.profiles[this.currentProfile];

    return {
      maxConcurrent: Math.min(baseSettings.maxConcurrent || 5, profile.maxConcurrent),
      delayBetween: Math.max(baseSettings.delayBetween || 1000, profile.delayBetween),
      throttleRate: Math.min(baseSettings.throttleRate || 10, profile.throttleRate),
      profile: this.currentProfile,
      description: profile.description
    };
  }

  // Force a specific profile (for testing or manual override)
  setProfile(profileName) {
    if (this.profiles[profileName]) {
      console.log(`📊 Manually set profile: ${profileName}`);
      this.currentProfile = profileName;
      this.lastAdjustment = Date.now();
      this.onProfileChange && this.onProfileChange(profileName, this.profiles[profileName]);
    }
  }

  // Get network diagnostics
  async getDiagnostics() {
    const conditions = await this.assessNetworkConditions();
    const profile = this.profiles[this.currentProfile];

    return {
      currentProfile: this.currentProfile,
      profileSettings: profile,
      networkConditions: {
        connectionType: this.getConnectionType(),
        effectiveType: this.getEffectiveType(),
        downlink: this.getDownlinkSpeed(),
        rtt: this.getRTT(),
        signalStrength: await this.measureConnectionQuality()
      },
      performanceMetrics: {
        failureRate: this.failureRate,
        recentFailures: this.recentFailures.length,
        lastAdjustment: new Date(this.lastAdjustment).toISOString()
      },
      recommendations: this.getRecommendations()
    };
  }

  // Get recommendations for current conditions
  getRecommendations() {
    const recommendations = [];

    if (this.failureRate > 0.2) {
      recommendations.push('High failure rate detected - consider reducing concurrent downloads');
    }

    if (this.currentProfile === 'terrible') {
      recommendations.push('Connection is very poor - downloads may be slow');
    }

    if (this.getEffectiveType() === '2g') {
      recommendations.push('2G connection detected - expect very slow downloads');
    }

    if (recommendations.length === 0) {
      recommendations.push('Network conditions are good for downloading');
    }

    return recommendations;
  }

  // Reset failure tracking
  resetFailureTracking() {
    this.recentFailures = [];
    this.failureRate = 0;
    console.log('📊 Reset failure tracking');
  }

  // Set profile change callback
  onProfileChange(callback) {
    this.onProfileChange = callback;
  }
}

// Singleton instance
// Class exported for instantiation in background script

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BandwidthManager;
}
