// ===== LOGGER =====
// Structured logging utility for consistent debugging and monitoring

class Logger {
  constructor(context = 'Unknown') {
    this.context = context;
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      OFF: 4
    };

    // Get log level from storage or default to INFO
    this.currentLevel = this.levels.INFO;
    this.loadLogLevel();
  }

  async loadLogLevel() {
    try {
      const settings = await this.getSettings();
      const levelName = settings?.logging?.level || 'INFO';
      this.currentLevel = this.levels[levelName.toUpperCase()] || this.levels.INFO;
    } catch (error) {
      // Keep default level if settings can't be loaded
    }
  }

  async getSettings() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['settings'], (result) => {
          resolve(result.settings || {});
        });
      } else {
        resolve({});
      }
    });
  }

  shouldLog(level) {
    return this.levels[level.toUpperCase()] >= this.currentLevel;
  }

  formatMessage(level, message, data = null, emoji = '') {
    const timestamp = new Date().toISOString();
    const context = this.context;
    const prefix = emoji ? `${emoji} ` : '';

    let formatted = `[${timestamp}] [${level}] [${context}] ${prefix}${message}`;

    if (data) {
      if (typeof data === 'object') {
        formatted += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        formatted += ` ${data}`;
      }
    }

    return formatted;
  }

  debug(message, data = null) {
    if (!this.shouldLog('DEBUG')) return;
    console.debug(this.formatMessage('DEBUG', message, data, '🔍'));
  }

  info(message, data = null) {
    if (!this.shouldLog('INFO')) return;
    console.log(this.formatMessage('INFO', message, data, 'ℹ️'));
  }

  warn(message, data = null) {
    if (!this.shouldLog('WARN')) return;
    console.warn(this.formatMessage('WARN', message, data, '⚠️'));
  }

  error(message, error = null, data = null) {
    if (!this.shouldLog('ERROR')) return;

    let errorData = data;
    if (error) {
      if (error instanceof Error) {
        errorData = {
          message: error.message,
          stack: error.stack,
          name: error.name,
          ...data
        };
      } else {
        errorData = { error, ...data };
      }
    }

    console.error(this.formatMessage('ERROR', message, errorData, '❌'));
  }

  // Specialized logging methods for common operations
  operation(operation, details = {}) {
    this.info(`Operation: ${operation}`, {
      operation,
      ...details,
      timestamp: Date.now()
    });
  }

  performance(operation, duration, details = {}) {
    this.info(`Performance: ${operation} completed in ${duration}ms`, {
      operation,
      duration,
      ...details
    });
  }

  apiCall(endpoint, method = 'GET', status = null, duration = null, details = {}) {
    const message = `API: ${method} ${endpoint}`;
    const data = {
      endpoint,
      method,
      status,
      duration,
      ...details
    };

    if (status && status >= 400) {
      this.error(message, null, data);
    } else {
      this.info(message, data);
    }
  }

  download(file, url, size = null, duration = null, success = true, details = {}) {
    const message = `Download: ${file}`;
    const data = {
      file,
      url,
      size,
      duration,
      success,
      ...details
    };

    if (success) {
      this.info(message, data);
    } else {
      this.error(message, null, data);
    }
  }

  userAction(action, details = {}) {
    this.info(`User Action: ${action}`, {
      action,
      ...details,
      timestamp: Date.now()
    });
  }

  // Create child logger with extended context
  child(additionalContext) {
    const newContext = `${this.context}:${additionalContext}`;
    const childLogger = new Logger(newContext);
    childLogger.currentLevel = this.currentLevel;
    return childLogger;
  }

  // Set log level dynamically
  setLevel(levelName) {
    const level = this.levels[levelName.toUpperCase()];
    if (level !== undefined) {
      this.currentLevel = level;
      this.info(`Log level changed to ${levelName}`);
    }
  }
}

// Create default logger instance
const logger = new Logger('System');

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Logger, logger };
} else if (typeof self !== 'undefined') {
  self.Logger = Logger;
  self.logger = logger;
}