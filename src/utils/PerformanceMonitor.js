// ===== PERFORMANCE MONITOR =====
// Comprehensive performance monitoring and metrics collection

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
    this.counters = new Map();
    this.histograms = new Map();
    this.logger = null;

    // Initialize logger if available
    this.initLogger();
  }

  async initLogger() {
    try {
      if (typeof Logger !== 'undefined') {
        this.logger = new Logger('PerformanceMonitor');
      } else if (typeof require !== 'undefined') {
        const { logger } = require('./Logger.js');
        this.logger = logger;
      }
    } catch (error) {
      // Logger not available, continue without it
    }
  }

  // Timer operations
  startTimer(name, metadata = {}) {
    const startTime = performance.now();
    this.timers.set(name, {
      startTime,
      metadata,
      checkpoints: []
    });

    if (this.logger) {
      this.logger.debug(`Timer started: ${name}`, { metadata });
    }

    return name;
  }

  addCheckpoint(timerName, checkpointName) {
    const timer = this.timers.get(timerName);
    if (!timer) {
      if (this.logger) {
        this.logger.warn(`Timer not found for checkpoint: ${timerName}`);
      }
      return;
    }

    const checkpointTime = performance.now();
    const elapsed = checkpointTime - timer.startTime;

    timer.checkpoints.push({
      name: checkpointName,
      time: checkpointTime,
      elapsed: elapsed
    });

    if (this.logger) {
      this.logger.debug(`Checkpoint: ${timerName} -> ${checkpointName}`, {
        elapsed: `${elapsed.toFixed(2)}ms`,
        totalElapsed: `${(performance.now() - timer.startTime).toFixed(2)}ms`
      });
    }
  }

  endTimer(timerName, additionalMetadata = {}) {
    const timer = this.timers.get(timerName);
    if (!timer) {
      if (this.logger) {
        this.logger.warn(`Timer not found: ${timerName}`);
      }
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - timer.startTime;

    const metric = {
      name: timerName,
      startTime: timer.startTime,
      endTime: endTime,
      duration: duration,
      checkpoints: timer.checkpoints,
      metadata: { ...timer.metadata, ...additionalMetadata }
    };

    // Store metric
    this.recordMetric(timerName, duration, metric);

    // Remove timer
    this.timers.delete(timerName);

    if (this.logger) {
      this.logger.performance(timerName, duration, {
        checkpoints: timer.checkpoints.length,
        metadata: metric.metadata
      });
    }

    return metric;
  }

  // Counter operations
  incrementCounter(name, value = 1, metadata = {}) {
    const current = this.counters.get(name) || 0;
    const newValue = current + value;
    this.counters.set(name, newValue);

    if (this.logger) {
      this.logger.debug(`Counter incremented: ${name}`, {
        previous: current,
        current: newValue,
        increment: value,
        ...metadata
      });
    }

    return newValue;
  }

  getCounter(name) {
    return this.counters.get(name) || 0;
  }

  resetCounter(name) {
    const previous = this.counters.get(name) || 0;
    this.counters.delete(name);

    if (this.logger) {
      this.logger.debug(`Counter reset: ${name}`, { previous });
    }

    return previous;
  }

  // Histogram operations (for tracking distributions)
  recordHistogram(name, value, metadata = {}) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }

    const histogram = this.histograms.get(name);
    histogram.push({
      value,
      timestamp: Date.now(),
      metadata
    });

    // Keep only last 1000 entries to prevent memory issues
    if (histogram.length > 1000) {
      histogram.shift();
    }

    if (this.logger) {
      this.logger.debug(`Histogram recorded: ${name}`, {
        value,
        count: histogram.length,
        ...metadata
      });
    }
  }

  getHistogramStats(name) {
    const histogram = this.histograms.get(name);
    if (!histogram || histogram.length === 0) {
      return null;
    }

    const values = histogram.map(h => h.value);
    const sorted = [...values].sort((a, b) => a - b);

    return {
      name,
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      latest: values[values.length - 1]
    };
  }

  // Metric recording
  recordMetric(name, value, data = {}) {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      ...data
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name);
    metrics.push(metric);

    // Keep only last 100 metrics per type
    if (metrics.length > 100) {
      metrics.shift();
    }

    if (this.logger) {
      this.logger.debug(`Metric recorded: ${name}`, { value, ...data });
    }

    return metric;
  }

  // Specialized performance tracking methods
  trackDownload(url, filename, size, startTime, endTime, success = true) {
    const duration = endTime - startTime;
    const timerName = `download_${filename}`;

    this.endTimer(timerName, {
      url,
      filename,
      size,
      success,
      startTime,
      endTime
    });

    this.recordHistogram('download_duration', duration, {
      url,
      filename,
      success
    });

    if (success) {
      this.incrementCounter('downloads_successful');
    } else {
      this.incrementCounter('downloads_failed');
    }

    return {
      duration,
      success,
      filename,
      size
    };
  }

  trackApiCall(endpoint, method, status, duration) {
    this.recordHistogram('api_call_duration', duration, {
      endpoint,
      method,
      status
    });

    if (status >= 200 && status < 300) {
      this.incrementCounter('api_calls_successful');
    } else if (status >= 400) {
      this.incrementCounter('api_calls_failed');
    }

    return {
      endpoint,
      method,
      status,
      duration
    };
  }

  trackMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const memInfo = performance.memory;
      this.recordMetric('memory_used', memInfo.usedJSHeapSize, {
        total: memInfo.totalJSHeapSize,
        limit: memInfo.jsHeapSizeLimit
      });

      const usagePercent = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100;
      this.recordMetric('memory_usage_percent', usagePercent);
    }
  }

  // Reporting methods
  getMetricsSummary() {
    const summary = {
      counters: {},
      histograms: {},
      recentMetrics: {},
      timers: {
        active: Array.from(this.timers.keys())
      }
    };

    // Counters
    for (const [name, value] of this.counters) {
      summary.counters[name] = value;
    }

    // Histogram stats
    for (const name of this.histograms.keys()) {
      summary.histograms[name] = this.getHistogramStats(name);
    }

    // Recent metrics (last 10 per type)
    for (const [name, metrics] of this.metrics) {
      summary.recentMetrics[name] = metrics.slice(-10);
    }

    return summary;
  }

  // Export data for debugging/analysis
  exportData() {
    return {
      metrics: Array.from(this.metrics.entries()),
      counters: Array.from(this.counters.entries()),
      histograms: Array.from(this.histograms.entries()),
      activeTimers: Array.from(this.timers.entries()),
      summary: this.getMetricsSummary(),
      exportTime: Date.now()
    };
  }

  // Clear all data
  clear() {
    this.metrics.clear();
    this.timers.clear();
    this.counters.clear();
    this.histograms.clear();

    if (this.logger) {
      this.logger.info('Performance monitor data cleared');
    }
  }
}

// Class exported for instantiation in appropriate contexts