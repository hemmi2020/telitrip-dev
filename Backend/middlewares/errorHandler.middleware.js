const logger = require('../utils/logger.util');
const ApiResponse = require('../utils/response.util');

// Enhanced async error handler with detailed logging
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    const requestId = req.requestId || require('crypto').randomUUID();
    req.requestId = requestId;

    Promise.resolve(fn(req, res, next))
      .catch((error) => {
        logger.error('Async operation failed', error, {
          requestId,
          method: req.method,
          url: req.url,
          userId: req.user?.id,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        });
        next(error);
      });
  };
};

// Enhanced global error handler
const globalErrorHandler = (error, req, res, next) => {
  const requestId = req.requestId || require('crypto').randomUUID();

  // Log the error with full context
  logger.error('Global error handler triggered', error, {
    requestId,
    method: req.method,
    url: req.url,
    body: req.body,
    query: req.query,
    params: req.params,
    userId: req.user?.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    stack: error.stack
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values(error.errors).map(err => err.message);
    return ApiResponse.error(res, `Validation failed: ${validationErrors.join(', ')}`, 400);
  }

  if (error.name === 'CastError') {
    return ApiResponse.error(res, 'Invalid ID format provided', 400);
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return ApiResponse.error(res, `${field} already exists`, 409);
  }

  if (error.name === 'JsonWebTokenError') {
    return ApiResponse.error(res, 'Invalid authentication token', 401);
  }

  if (error.name === 'TokenExpiredError') {
    return ApiResponse.error(res, 'Authentication token expired', 401);
  }

  // HBL-specific errors
  if (error.code === 'HBL_API_ERROR') {
    const statusCode = error.status >= 500 ? 502 : 400;
    return ApiResponse.error(res, `Payment gateway error: ${error.message}`, statusCode);
  }

  if (error.code === 'TIMEOUT') {
    return ApiResponse.error(res, 'Request timed out. Please try again.', 504);
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return ApiResponse.error(res, 'Service temporarily unavailable. Please try again later.', 503);
  }

  // Rate limiting errors
  if (error.statusCode === 429) {
    return ApiResponse.error(res, 'Too many requests. Please try again later.', 429);
  }

  // Default error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  const message = isDevelopment ? error.message : 'Internal server error occurred';
  const details = isDevelopment ? { stack: error.stack, code: error.code } : undefined;

  return ApiResponse.error(res, message, 500, details);
};

// Request validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Request validation failed', {
        requestId: req.requestId,
        url: req.url,
        method: req.method,
        errors: validationErrors,
        body: req.body
      });

      return ApiResponse.error(res, 'Validation failed', 400, { errors: validationErrors });
    }

    req.validatedBody = value;
    next();
  };
};

// Rate limiting with enhanced logging
const rateLimitHandler = (req, res, next) => {
  const requestId = req.requestId;
  
  logger.warn('Rate limit exceeded', {
    requestId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    url: req.url,
    method: req.method,
    userId: req.user?.id
  });

  return ApiResponse.error(res, 'Too many requests. Please try again later.', 429, {
    retryAfter: '15 minutes',
    requestId
  });
};

// CSP Error handler and fallback mechanism
// In your errorHandler.middleware.js, replace the cspErrorHandler function with:
const cspErrorHandler = (req, res, next) => {
  // Check if this is a payment-related route
  const isPaymentRoute = req.url.includes('/payment') || 
                        req.url.includes('/hblpay') || 
                        req.url.includes('/callback') ||
                        req.url.includes('/return');

  if (isPaymentRoute) {
    // Disable CSP completely for payment routes
    res.removeHeader('Content-Security-Policy');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    console.log('🚨 CSP DISABLED for payment route:', req.url);
  } else {
    // Keep basic CSP for other routes
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' *; script-src 'self' 'unsafe-inline' 'unsafe-eval' *; style-src 'self' 'unsafe-inline' *; img-src 'self' data: *;");
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};

// Payment-specific middleware
const paymentRequestValidator = (req, res, next) => {
  const requestId = req.requestId || require('crypto').randomUUID();
  req.requestId = requestId;

  try {
    const { amount, currency, bookingId } = req.body;

    // Basic validation
    const errors = [];

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      errors.push('Valid amount is required');
    }

    if (!currency || !['PKR', 'USD'].includes(currency.toUpperCase())) {
      errors.push('Currency must be PKR or USD');
    }

    if (!bookingId || !/^[0-9a-fA-F]{24}$/.test(bookingId)) {
      errors.push('Valid booking ID is required');
    }

    if (errors.length > 0) {
      logger.warn('Payment request validation failed', {
        requestId,
        errors,
        body: req.body,
        userId: req.user?.id
      });

      return ApiResponse.error(res, 'Invalid payment request', 400, { errors });
    }

    // Log successful validation
    logger.debug('Payment request validated', {
      requestId,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      bookingId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Payment validation middleware error', error, {
      requestId,
      body: req.body
    });
    return ApiResponse.error(res, 'Validation error occurred', 500);
  }
};

// Network timeout middleware
const timeoutHandler = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const requestId = req.requestId;

    // Set timeout for the request
    req.setTimeout(timeoutMs, () => {
      logger.error('Request timeout', new Error('Request timeout'), {
        requestId,
        timeout: timeoutMs,
        url: req.url,
        method: req.method,
        userId: req.user?.id
      });

      if (!res.headersSent) {
        return ApiResponse.error(res, 'Request timeout', 504, {
          timeout: `${timeoutMs}ms`,
          requestId
        });
      }
    });

    next();
  };
};

// Circuit breaker pattern for HBL API
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 300000; // 5 minutes
    
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.recentRequests = [];
  }

  async execute(operation, context = 'operation') {
    const now = Date.now();

    // Clean old requests
    this.recentRequests = this.recentRequests.filter(
      req => now - req.timestamp < this.monitoringPeriod
    );

    // Check circuit state
    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker moving to HALF_OPEN', { context });
      } else {
        const error = new Error('Circuit breaker is OPEN');
        error.code = 'CIRCUIT_BREAKER_OPEN';
        logger.warn('Circuit breaker blocked request', {
          context,
          state: this.state,
          failures: this.failures,
          timeSinceLastFailure: now - this.lastFailureTime
        });
        throw error;
      }
    }

    try {
      const result = await operation();
      
      // Success - reset failure count
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        logger.info('Circuit breaker reset to CLOSED', { context });
      }

      this.recentRequests.push({ timestamp: now, success: true });
      return result;

    } catch (error) {
      this.failures++;
      this.lastFailureTime = now;
      this.recentRequests.push({ timestamp: now, success: false, error: error.message });

      logger.error('Circuit breaker registered failure', error, {
        context,
        failures: this.failures,
        threshold: this.failureThreshold,
        state: this.state
      });

      // Open circuit if threshold reached
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        logger.error('Circuit breaker opened', new Error('Failure threshold reached'), {
          context,
          failures: this.failures,
          threshold: this.failureThreshold
        });
      }

      throw error;
    }
  }

  getStats() {
    const now = Date.now();
    const recentSuccesses = this.recentRequests.filter(req => req.success).length;
    const recentFailures = this.recentRequests.filter(req => !req.success).length;
    const successRate = this.recentRequests.length > 0 
      ? (recentSuccesses / this.recentRequests.length) * 100 
      : 100;

    return {
      state: this.state,
      failures: this.failures,
      successRate: Math.round(successRate * 100) / 100,
      recentRequests: this.recentRequests.length,
      recentSuccesses,
      recentFailures,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: this.lastFailureTime ? now - this.lastFailureTime : null
    };
  }
}

// Create global circuit breaker for HBL API
const hblCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  monitoringPeriod: 300000 // 5 minutes
});

// Fallback mechanism for payment page
const paymentFallbackHandler = (req, res, next) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Payment Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1"> 
          <style>
              body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
              .error { color: #e74c3c; }
              .retry-btn { 
                  background: #3498db; 
                  color: white; 
                  padding: 10px 20px; 
                  border: none; 
                  border-radius: 5px; 
                  cursor: pointer;
                  text-decoration: none;
                  display: inline-block;
                  margin: 20px;
              }
          </style>
      </head>
      <body>
          <h1 class="error">Payment Session Invalid</h1>
          <p>The payment session is missing or invalid.</p>
          <a href="${process.env.FRONTEND_URL}" class="retry-btn">Return to Home</a>
      </body>
      </html>
    `);
  }

  // Create fallback payment page
  const fallbackHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Payment Processing</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 40px;
                background: #f8f9fa;
                text-align: center;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                padding: 40px; 
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .loading { 
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .retry-btn, .manual-btn { 
                background: #3498db; 
                color: white; 
                padding: 12px 24px; 
                border: none; 
                border-radius: 5px; 
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                margin: 10px;
                font-size: 16px;
            }
            .manual-btn { background: #e67e22; }
            .error { color: #e74c3c; margin: 20px 0; }
            .status { margin: 20px 0; padding: 15px; border-radius: 5px; }
            .status.loading { background: #ebf3fd; border: 1px solid #3498db; }
            .status.error { background: #fdebea; border: 1px solid #e74c3c; }
            .status.success { background: #eafaf1; border: 1px solid #27ae60; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Payment Processing</h1>
            <div id="status" class="status loading">
                <div class="loading"></div>
                <p>Attempting to redirect to HBL Pay...</p>
            </div>
            
            <div id="fallback-options" style="display: none;">
                <h3>Having trouble accessing the payment page?</h3>
                <p>If the automatic redirect doesn't work, you can:</p>
                <a href="https://testpaymentapi.hbl.com/hblpay/site/index.html#/checkout?data=${sessionId}" 
                   class="manual-btn" target="_blank">Open Payment Page Manually</a>
                <a href="${process.env.FRONTEND_URL}/payment/cancel" class="retry-btn">Cancel Payment</a>
                
                <div class="error">
                    <h4>Common Issues:</h4>
                    <ul style="text-align: left; display: inline-block;">
                        <li>Browser blocking external content (try incognito mode)</li>
                        <li>Ad blockers interfering (temporarily disable)</li>
                        <li>Network connectivity issues</li>
                        <li>HBL testing environment maintenance</li>
                    </ul>
                </div>
            </div>
        </div>

        <script>
            // Automatic redirect with fallback
            setTimeout(() => {
                try {
                    window.location.href = 'https://testpaymentapi.hbl.com/hblpay/site/index.html#/checkout?data=${sessionId}';
                } catch (error) {
                    console.error('Redirect failed:', error);
                    document.getElementById('status').className = 'status error';
                    document.getElementById('status').innerHTML = 
                        '<p class="error">Automatic redirect failed</p>';
                    document.getElementById('fallback-options').style.display = 'block';
                }
            }, 2000);

            // Show fallback options after delay
            setTimeout(() => {
                document.getElementById('fallback-options').style.display = 'block';
            }, 8000);

            // Monitor page visibility to detect successful redirect
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    // User likely redirected successfully
                    localStorage.setItem('hbl_redirect_attempted', Date.now());
                }
            });

            // Check if returning from failed redirect
            if (localStorage.getItem('hbl_redirect_attempted')) {
                const attemptTime = parseInt(localStorage.getItem('hbl_redirect_attempted'));
                if (Date.now() - attemptTime < 60000) { // Within 1 minute
                    document.getElementById('status').className = 'status error';
                    document.getElementById('status').innerHTML = 
                        '<p class="error">Payment page encountered an issue</p>';
                    document.getElementById('fallback-options').style.display = 'block';
                }
                localStorage.removeItem('hbl_redirect_attempted');
            }
        </script>
    </body>
    </html>
  `;

  res.send(fallbackHtml);
};

// Enhanced monitoring middleware
const monitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.requestId || require('crypto').randomUUID();
  req.requestId = requestId;

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Log performance metrics
    logger.performance(`${req.method} ${req.url}`, duration, {
      requestId,
      statusCode: res.statusCode,
      userId: req.user?.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    // Alert on slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        requestId,
        url: req.url,
        method: req.method,
        duration: `${duration}ms`,
        userId: req.user?.id
      });
    }

    return originalEnd.apply(this, args);
  };

  next();
};

// Health check for circuit breaker
const circuitBreakerHealthCheck = (req, res, next) => {
  const stats = hblCircuitBreaker.getStats();
  
  if (stats.state === 'OPEN') {
    logger.warn('Circuit breaker is OPEN - blocking request', {
      requestId: req.requestId,
      url: req.url,
      stats
    });

    return ApiResponse.error(res, 'Payment service temporarily unavailable due to repeated failures', 503, {
      circuitBreakerState: stats.state,
      estimatedRecoveryTime: stats.lastFailureTime + 60000, // 1 minute from last failure
      requestId: req.requestId
    });
  }

  req.circuitBreakerStats = stats;
  next();
};

// Error recovery middleware
const errorRecoveryHandler = (error, req, res, next) => {
  const requestId = req.requestId;

  // Attempt error recovery based on error type
  if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
    logger.warn('Connection error detected - attempting recovery', {
      requestId,
      errorCode: error.code,
      url: req.url
    });

    // For payment creation requests, offer retry option
    if (req.url.includes('/payments/create')) {
      return ApiResponse.error(res, 'Connection issue detected. Please retry your payment.', 503, {
        retryable: true,
        retryAfter: 30,
        requestId,
        troubleshooting: [
          'Check your internet connection',
          'Try again in 30 seconds',
          'Contact support if issue persists'
        ]
      });
    }
  }

  // Pass to global error handler
  next(error);
};

module.exports = {
  asyncErrorHandler,
  globalErrorHandler,
  validateRequest,
  rateLimitHandler,
  cspErrorHandler,
  paymentRequestValidator,
  timeoutHandler,
  monitoringMiddleware,
  circuitBreakerHealthCheck,
  errorRecoveryHandler,
  paymentFallbackHandler,
  hblCircuitBreaker
};