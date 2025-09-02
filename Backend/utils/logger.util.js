const fs = require('fs');
const path = require('path');
const util = require('util');

class EnhancedLogger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
    
    // Log levels
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    
    this.currentLevel = this.levels[process.env.LOG_LEVEL?.toUpperCase()] ?? this.levels.INFO;
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING !== 'false';
    this.enableConsoleLogging = process.env.ENABLE_CONSOLE_LOGGING !== 'false';
  }

  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error.message);
    }
  }

  formatLogEntry(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      pid,
      message,
      ...metadata
    };

    // Format for console (human readable)
    const consoleFormat = `[${timestamp}] [${level.toUpperCase()}] [PID:${pid}] ${message}${
      Object.keys(metadata).length > 0 ? '\n' + util.inspect(metadata, { colors: true, depth: 3 }) : ''
    }`;

    // Format for file (JSON)
    const fileFormat = JSON.stringify(logEntry) + '\n';

    return { consoleFormat, fileFormat, logEntry };
  }

  writeToFile(level, content) {
    if (!this.enableFileLogging) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const filename = `${level.toLowerCase()}-${today}.log`;
      const filepath = path.join(this.logDir, filename);
      
      fs.appendFileSync(filepath, content);
      
      // Also write to combined log
      const combinedPath = path.join(this.logDir, `combined-${today}.log`);
      fs.appendFileSync(combinedPath, content);
      
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  shouldLog(level) {
    return this.levels[level.toUpperCase()] <= this.currentLevel;
  }

  log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) return;

    const { consoleFormat, fileFormat } = this.formatLogEntry(level, message, metadata);

    // Console logging with colors
    if (this.enableConsoleLogging) {
      const colors = {
        ERROR: '\x1b[31m', // Red
        WARN: '\x1b[33m',  // Yellow
        INFO: '\x1b[36m',  // Cyan
        DEBUG: '\x1b[90m'  // Gray
      };
      const reset = '\x1b[0m';
      const color = colors[level.toUpperCase()] || '';
      
      console.log(`${color}${consoleFormat}${reset}`);
    }

    // File logging
    this.writeToFile(level, fileFormat);
  }

  error(message, error = null, metadata = {}) {
    const enhancedMetadata = { ...metadata };
    
    if (error) {
      enhancedMetadata.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode,
        status: error.status
      };
    }

    this.log('ERROR', message, enhancedMetadata);
  }

  warn(message, metadata = {}) {
    this.log('WARN', message, metadata);
  }

  info(message, metadata = {}) {
    this.log('INFO', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('DEBUG', message, metadata);
  }

  // Payment-specific logging methods
  paymentEvent(event, paymentData, metadata = {}) {
    this.info(`Payment Event: ${event}`, {
      paymentId: paymentData.paymentId,
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: paymentData.status,
      ...metadata
    });
  }

  hblApiCall(method, url, requestData, responseData, duration, metadata = {}) {
    const sanitizedRequest = { ...requestData };
    delete sanitizedRequest.PASSWORD; // Remove sensitive data

    this.info('HBL API Call', {
      method,
      url,
      request: sanitizedRequest,
      response: {
        isSuccess: responseData?.IsSuccess,
        responseCode: responseData?.ResponseCode,
        responseMessage: responseData?.ResponseMessage,
        hasSessionId: !!(responseData?.Data?.SESSION_ID)
      },
      duration: `${duration}ms`,
      ...metadata
    });
  }

  // Security event logging
  securityEvent(event, details, metadata = {}) {
    this.warn(`Security Event: ${event}`, {
      event,
      details,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  // Performance logging
  performance(operation, duration, metadata = {}) {
    const level = duration > 5000 ? 'WARN' : 'INFO';
    this.log(level, `Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      slow: duration > 5000,
      ...metadata
    });
  }

  // Request logging middleware
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      const requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
      
      req.requestId = requestId;
      req.startTime = start;

      // Log incoming request
      this.info('Incoming Request', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        userId: req.user?.id
      });

      // Override res.json to log responses
      const originalJson = res.json;
      res.json = function(data) {
        const duration = Date.now() - start;
        
        global.logger.info('Request Completed', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          responseSize: JSON.stringify(data).length
        });

        return originalJson.call(this, data);
      };

      next();
    };
  }

  // Audit logging for sensitive operations
  audit(action, user, details, metadata = {}) {
    this.info(`Audit: ${action}`, {
      action,
      user: {
        id: user?.id,
        email: user?.email,
        role: user?.role
      },
      details,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  // Log rotation (daily)
  rotateLogs() {
    if (!this.enableFileLogging) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const files = fs.readdirSync(this.logDir);
      
      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        const fileDate = stats.mtime.toISOString().split('T')[0];
        
        // Archive logs older than 7 days
        const daysDiff = Math.floor((new Date() - new Date(fileDate)) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 7) {
          const archiveDir = path.join(this.logDir, 'archive');
          if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir);
          }
          
          const archivePath = path.join(archiveDir, file);
          fs.renameSync(filePath, archivePath);
          
          this.info('Log file archived', { 
            originalPath: filePath, 
            archivePath,
            age: `${daysDiff} days`
          });
        }
      });
    } catch (error) {
      console.error('Log rotation failed:', error.message);
    }
  }

  // Get recent logs for debugging
  getRecentLogs(hours = 24, level = 'INFO') {
    if (!this.enableFileLogging) {
      return { error: 'File logging is disabled' };
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `combined-${today}.log`);
      
      if (!fs.existsSync(logFile)) {
        return { logs: [], message: 'No logs found for today' };
      }

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const recentLogs = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(log => log && new Date(log.timestamp) > cutoffTime)
        .filter(log => this.levels[log.level] <= this.levels[level.toUpperCase()])
        .slice(-1000); // Limit to last 1000 entries

      return {
        logs: recentLogs,
        count: recentLogs.length,
        timeRange: `${hours} hours`,
        level
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Get error statistics
  getErrorStats(hours = 24) {
    try {
      const recentLogs = this.getRecentLogs(hours, 'ERROR');
      
      if (recentLogs.error) {
        return recentLogs;
      }

      const errorStats = {
        totalErrors: recentLogs.logs.length,
        errorsByService: {},
        errorsByCode: {},
        errorsByHour: {},
        topErrors: []
      };

      recentLogs.logs.forEach(log => {
        // Group by service
        const service = log.service || 'unknown';
        errorStats.errorsByService[service] = (errorStats.errorsByService[service] || 0) + 1;

        // Group by error code
        const code = log.error?.code || log.errorCode || 'unknown';
        errorStats.errorsByCode[code] = (errorStats.errorsByCode[code] || 0) + 1;

        // Group by hour
        const hour = new Date(log.timestamp).getHours();
        errorStats.errorsByHour[hour] = (errorStats.errorsByHour[hour] || 0) + 1;
      });

      // Get top error messages
      const errorMessages = {};
      recentLogs.logs.forEach(log => {
        const message = log.message;
        errorMessages[message] = (errorMessages[message] || 0) + 1;
      });

      errorStats.topErrors = Object.entries(errorMessages)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([message, count]) => ({ message, count }));

      return errorStats;
    } catch (error) {
      return { error: error.message };
    }
  }
}

// Create global logger instance
const logger = new EnhancedLogger();

// Set up log rotation schedule (daily at midnight)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    logger.rotateLogs();
  }, 24 * 60 * 60 * 1000); // 24 hours
}

module.exports = logger;