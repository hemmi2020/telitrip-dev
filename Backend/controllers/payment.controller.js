const crypto = require('crypto');
const fetch = require('node-fetch');
const paymentModel = require('../models/payment.model');
const bookingModel = require('../models/booking.model');
const ApiResponse = require('../utils/response.util');
const { asyncErrorHandler } = require('../middlewares/errorHandler.middleware');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger.util'); // Enhanced logging utility

// HBLPay Configuration
const HBLPAY_USER_ID = process.env.HBLPAY_USER_ID || 'teliadmin';
const HBLPAY_PASSWORD = process.env.HBLPAY_PASSWORD || 'd6n26Yd4m!';
const HBL_PUBLIC_KEY = process.env.HBL_PUBLIC_KEY_PEM;
const HBL_SANDBOX_URL = process.env.HBL_SANDBOX_API_URL || 'https://testpaymentapi.hbl.com/hblpay/api/checkout';
const HBL_PRODUCTION_URL = process.env.HBL_PRODUCTION_API_URL;
const HBL_SANDBOX_REDIRECT = process.env.HBL_SANDBOX_REDIRECT_URL || 'https://testpaymentapi.hbl.com/hblpay/site/index.html#/checkout?data=';
const HBL_PRODUCTION_REDIRECT = process.env.HBL_PRODUCTION_REDIRECT_URL;
const HBL_CHANNEL = 'HBLPay_Teli_Website';
const HBL_TYPE_ID = '0';
const HBL_TIMEOUT = parseInt(process.env.HBL_TIMEOUT) || 30000; // 30 seconds
const HBL_RETRY_ATTEMPTS = parseInt(process.env.HBL_RETRY_ATTEMPTS) || 3;

const isProduction = process.env.NODE_ENV === 'production';

const https = require('https');

// Enhanced HTTPS agent with timeout and retry configuration
const httpsAgent = new https.Agent({
  rejectUnauthorized: !isProduction, // Only bypass SSL in sandbox
  timeout: HBL_TIMEOUT,
  keepAlive: true,
  maxSockets: 50
});

// Enhanced error logging utility
class PaymentLogger {
  static log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'HBLPay',
      message,
      ...metadata
    };

    if (logger && typeof logger[level] === 'function') {
      logger[level](message, metadata);
    } else {
      console[level === 'error' ? 'error' : 'log'](`[${level.toUpperCase()}] HBLPay: ${message}`, metadata);
    }
  }

  static error(message, error, metadata = {}) {
    this.log('error', message, {
      error: {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        name: error?.name
      },
      ...metadata
    });
  }

  static info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  static warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  static debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }
}

// Enhanced payment success handler with detailed logging
const handlePaymentSuccess = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    PaymentLogger.info('Payment success callback received', {
      requestId,
      query: req.query,
      body: req.body,
      headers: {
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer
      }
    });

    const { sessionId, orderId, responseCode, responseMessage } = req.query;

    if (!sessionId) {
      PaymentLogger.error('Missing session ID in success callback', new Error('No sessionId'), {
        query: req.query,
        requestId
      });
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reason=missing_session`);
    }

    // Find payment by session ID
    const payment = await paymentModel.findOne({ sessionId });
    if (!payment) {
      PaymentLogger.error('Payment not found for session', new Error('Payment not found'), {
        sessionId,
        requestId
      });
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reason=payment_not_found`);
    }

    // Update payment status
    await payment.updateOne({
      status: 'completed',
      completedAt: new Date(),
      gatewayResponse: {
        ...payment.gatewayResponse,
        successCallback: {
          responseCode,
          responseMessage,
          timestamp: new Date(),
          requestId
        }
      },
      updatedAt: new Date()
    });

    PaymentLogger.info('Payment completed successfully', {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      sessionId,
      responseTime: `${Date.now() - startTime}ms`,
      requestId
    });

    // Send notification
    try {
      await notificationService.sendPaymentSuccessNotification(payment);
    } catch (notificationError) {
      PaymentLogger.warn('Failed to send success notification', {
        error: notificationError.message,
        paymentId: payment.paymentId,
        requestId
      });
    }

    // Redirect to success page
    const successUrl = `${process.env.FRONTEND_URL}/payment/success?paymentId=${payment.paymentId}&orderId=${payment.orderId}`;
    return res.redirect(successUrl);

  } catch (error) {
    PaymentLogger.error('Error handling payment success', error, {
      requestId,
      responseTime: `${Date.now() - startTime}ms`
    });
    return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reason=processing_error`);
  }
});

// Enhanced payment failure handler
const handlePaymentFailure = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    PaymentLogger.info('Payment failure callback received', {
      requestId,
      query: req.query,
      body: req.body
    });

    const { sessionId, orderId, responseCode, responseMessage } = req.query;

    if (!sessionId) {
      PaymentLogger.error('Missing session ID in failure callback', new Error('No sessionId'), {
        query: req.query,
        requestId
      });
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reason=missing_session`);
    }

    // Find and update payment
    const payment = await paymentModel.findOne({ sessionId });
    if (payment) {
      await payment.updateOne({
        status: 'failed',
        failureReason: `GATEWAY_FAILURE_${responseCode}`,
        errorDetails: {
          code: responseCode,
          message: responseMessage,
          timestamp: new Date(),
          requestId
        },
        gatewayResponse: {
          ...payment.gatewayResponse,
          failureCallback: {
            responseCode,
            responseMessage,
            timestamp: new Date(),
            requestId
          }
        },
        updatedAt: new Date()
      });

      PaymentLogger.info('Payment failure recorded', {
        paymentId: payment.paymentId,
        responseCode,
        responseMessage,
        requestId
      });
    } else {
      PaymentLogger.warn('Payment not found for failed session', {
        sessionId,
        responseCode,
        responseMessage,
        requestId
      });
    }

    // Redirect to failure page with details
    const failureUrl = `${process.env.FRONTEND_URL}/payment/failure?orderId=${orderId}&code=${responseCode}&message=${encodeURIComponent(responseMessage)}`;
    return res.redirect(failureUrl);

  } catch (error) {
    PaymentLogger.error('Error handling payment failure', error, {
      requestId,
      responseTime: `${Date.now() - startTime}ms`
    });
    return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reason=processing_error`);
  }
});

// Enhanced payment cancellation handler
const handlePaymentCancel = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();

  try {
    PaymentLogger.info('Payment cancellation received', {
      requestId,
      query: req.query,
      body: req.body
    });

    const { sessionId, orderId } = req.query;

    if (sessionId) {
      const payment = await paymentModel.findOne({ sessionId });
      if (payment) {
        await payment.updateOne({
          status: 'cancelled',
          cancelledAt: new Date(),
          gatewayResponse: {
            ...payment.gatewayResponse,
            cancelCallback: {
              timestamp: new Date(),
              requestId
            }
          },
          updatedAt: new Date()
        });

        PaymentLogger.info('Payment cancelled', {
          paymentId: payment.paymentId,
          orderId: payment.orderId,
          requestId
        });
      }
    }

    const cancelUrl = `${process.env.FRONTEND_URL}/payment/cancel?orderId=${orderId}`;
    return res.redirect(cancelUrl);

  } catch (error) {
    PaymentLogger.error('Error handling payment cancellation', error, { requestId });
    return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reason=processing_error`);
  }
});

// Enhanced payment status checker with detailed logging
const getPaymentStatus = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();

  try {
    const { paymentId } = req.params;
    const userId = req.user?.id;

    PaymentLogger.info('Payment status check requested', {
      paymentId,
      userId,
      requestId
    });

    if (!paymentId) {
      return ApiResponse.error(res, 'Payment ID is required', 400);
    }

    const payment = await paymentModel.findOne({ paymentId }).populate('bookingId');

    if (!payment) {
      PaymentLogger.warn('Payment not found for status check', {
        paymentId,
        userId,
        requestId
      });
      return ApiResponse.error(res, 'Payment not found', 404);
    }

    // Verify ownership
    if (payment.userId.toString() !== userId.toString()) {
      PaymentLogger.warn('Unauthorized payment status check', {
        paymentId,
        requestUserId: userId,
        paymentUserId: payment.userId,
        requestId
      });
      return ApiResponse.error(res, 'Unauthorized access', 403);
    }

    // Check if payment has expired
    if (payment.status === 'pending' && payment.expiresAt < new Date()) {
      await payment.updateOne({
        status: 'expired',
        expiredAt: new Date(),
        updatedAt: new Date()
      });

      PaymentLogger.info('Payment marked as expired', {
        paymentId,
        expiresAt: payment.expiresAt,
        requestId
      });

      payment.status = 'expired';
    }

    PaymentLogger.info('Payment status retrieved', {
      paymentId,
      status: payment.status,
      amount: payment.amount,
      requestId
    });

    return ApiResponse.success(res, {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      expiresAt: payment.expiresAt,
      sessionId: payment.sessionId,
      booking: payment.bookingId
    }, 'Payment status retrieved successfully');

  } catch (error) {
    PaymentLogger.error('Error retrieving payment status', error, { requestId });
    return ApiResponse.error(res, 'Failed to retrieve payment status', 500);
  }
});

// Enhanced webhook handler for HBL callbacks
const handleWebhook = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    PaymentLogger.info('Webhook received', {
      requestId,
      headers: req.headers,
      body: req.body,
      query: req.query,
      method: req.method,
      url: req.url
    });

    // Verify webhook signature if configured
    const webhookSecret = process.env.HBL_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-hbl-signature'];
      if (!signature) {
        PaymentLogger.error('Missing webhook signature', new Error('No signature'), { requestId });
        return res.status(401).json({ error: 'Missing signature' });
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        PaymentLogger.error('Invalid webhook signature', new Error('Signature mismatch'), {
          received: signature,
          expected: expectedSignature,
          requestId
        });
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Process webhook data
    const { sessionId, status, responseCode, responseMessage, transactionId } = req.body;

    if (!sessionId) {
      PaymentLogger.error('Missing session ID in webhook', new Error('No sessionId'), {
        body: req.body,
        requestId
      });
      return res.status(400).json({ error: 'Missing session ID' });
    }

    const payment = await paymentModel.findOne({ sessionId });
    if (!payment) {
      PaymentLogger.warn('Payment not found for webhook', {
        sessionId,
        requestId
      });
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update payment based on webhook status
    const updateData = {
      gatewayResponse: {
        ...payment.gatewayResponse,
        webhook: {
          status,
          responseCode,
          responseMessage,
          transactionId,
          timestamp: new Date(),
          requestId
        }
      },
      updatedAt: new Date()
    };

    if (status === 'SUCCESS') {
      updateData.status = 'completed';
      updateData.completedAt = new Date();
      updateData.transactionId = transactionId;
    } else if (status === 'FAILED') {
      updateData.status = 'failed';
      updateData.failureReason = `WEBHOOK_FAILURE_${responseCode}`;
      updateData.errorDetails = {
        code: responseCode,
        message: responseMessage,
        transactionId
      };
    }

    await payment.updateOne(updateData);

    PaymentLogger.info('Webhook processed successfully', {
      paymentId: payment.paymentId,
      status,
      responseCode,
      transactionId,
      responseTime: `${Date.now() - startTime}ms`,
      requestId
    });

    return res.status(200).json({
      message: 'Webhook processed successfully',
      paymentId: payment.paymentId,
      status: payment.status
    });

  } catch (error) {
    PaymentLogger.error('Webhook processing failed', error, {
      requestId,
      responseTime: `${Date.now() - startTime}ms`
    });
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Health check endpoint with HBL connectivity test
const healthCheck = asyncErrorHandler(async (req, res) => {
  const startTime = Date.now();
  const checks = {};

  try {
    // Check database connectivity
    try {
      await paymentModel.findOne().limit(1);
      checks.database = { status: 'healthy', responseTime: Date.now() - startTime };
    } catch (error) {
      checks.database = { status: 'unhealthy', error: error.message };
    }

    // Check HBL API connectivity
    try {
      const testStartTime = Date.now();
      const response = await withTimeout(
        fetch(isProduction ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL, {
          method: 'HEAD',
          agent: httpsAgent,
          timeout: 5000
        }),
        5000,
        'HBL Health Check'
      );

      checks.hblApi = {
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: Date.now() - testStartTime,
        httpStatus: response.status
      };
    } catch (error) {
      checks.hblApi = {
        status: 'unhealthy',
        error: error.message,
        code: error.code
      };
    }

    // Check configuration
    const configValidation = HBLPayValidator.validateHBLConfiguration();
    checks.configuration = {
      status: configValidation.isValid ? 'healthy' : 'unhealthy',
      errors: configValidation.errors
    };

    const overallStatus = Object.values(checks).every(check => check.status === 'healthy') ? 'healthy' : 'degraded';

    PaymentLogger.info('Health check completed', {
      overallStatus,
      checks,
      responseTime: `${Date.now() - startTime}ms`
    });

    return res.status(overallStatus === 'healthy' ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      environment: isProduction ? 'production' : 'sandbox'
    });

  } catch (error) {
    PaymentLogger.error('Health check failed', error);
    return res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced test configuration endpoint
const getTestConfiguration = asyncErrorHandler(async (req, res) => {
  try {
    PaymentLogger.info('Test configuration requested', {
      userId: req.user?.id,
      userAgent: req.headers['user-agent']
    });

    const config = {
      environment: isProduction ? 'production' : 'sandbox',
      timeout: HBL_TIMEOUT,
      retryAttempts: HBL_RETRY_ATTEMPTS,
      configuration: {
        userId: HBLPAY_USER_ID ? 'Set' : 'Not Set',
        password: HBLPAY_PASSWORD ? 'Set' : 'Not Set',
        publicKey: HBL_PUBLIC_KEY ? 'Set' : 'Not Set',
        sandboxUrl: HBL_SANDBOX_URL,
        redirectUrl: HBL_SANDBOX_REDIRECT
      },
      testCards: [
        {
          type: 'Visa Non-3D',
          number: '4000000000000101',
          expiry: '05/2023',
          cvv: '111',
          description: 'Standard Visa card without 3D Secure'
        },
        {
          type: 'Visa 3D',
          number: '4000000000000002',
          expiry: '05/2023',
          cvv: '111',
          passcode: '1234',
          description: 'Visa card with 3D Secure authentication'
        },
        {
          type: 'Master Non-3D',
          number: '5200000000000114',
          expiry: '05/2023',
          cvv: '111',
          description: 'Standard MasterCard without 3D Secure'
        },
        {
          type: 'Master 3D',
          number: '5200000000000007',
          expiry: '05/2023',
          cvv: '111',
          passcode: '1234',
          description: 'MasterCard with 3D Secure authentication'
        }
      ],
      testAmounts: {
        success: [100, 500, 1000, 5000],
        decline: [1, 2, 3, 4],
        error: [9999, 8888, 7777],
        description: 'Use success amounts for testing successful payments'
      },
      testUrls: {
        otpViewer: 'https://testpaymentapi.hbl.com/OTPViewer/Home/Email',
        sandbox: HBL_SANDBOX_URL,
        sandboxRedirect: HBL_SANDBOX_REDIRECT
      },
      troubleshooting: {
        commonIssues: [
          'Ensure exact test card numbers are used',
          'Check browser console for CSP violations',
          'Clear browser cache if page loads slowly',
          'Use incognito mode to test',
          'Verify IP whitelisting with HBL'
        ],
        supportContact: 'Contact HBL technical support for environment issues'
      }
    };

    return ApiResponse.success(res, config, 'Test configuration retrieved');
  } catch (error) {
    PaymentLogger.error('Error retrieving test configuration', error);
    return ApiResponse.error(res, 'Failed to retrieve test configuration', 500);
  }
});

// Payment retry mechanism
const retryPayment = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();

  try {
    const { paymentId } = req.params;
    const userId = req.user?.id;

    PaymentLogger.info('Payment retry requested', {
      paymentId,
      userId,
      requestId
    });

    const payment = await paymentModel.findOne({ paymentId });

    if (!payment) {
      return ApiResponse.error(res, 'Payment not found', 404);
    }

    if (payment.userId.toString() !== userId.toString()) {
      PaymentLogger.warn('Unauthorized payment retry attempt', {
        paymentId,
        requestUserId: userId,
        paymentUserId: payment.userId,
        requestId
      });
      return ApiResponse.error(res, 'Unauthorized access', 403);
    }

    if (payment.status === 'completed') {
      return ApiResponse.error(res, 'Payment already completed', 409);
    }

    if (payment.status === 'pending' && payment.expiresAt > new Date()) {
      return ApiResponse.error(res, 'Payment is still active', 409);
    }

    // Create new payment record for retry
    const newPaymentId = generatePaymentId();
    const newOrderId = generateOrderId();

    const retryPayment = new paymentModel({
      ...payment.toObject(),
      _id: undefined,
      paymentId: newPaymentId,
      orderId: newOrderId,
      status: 'pending',
      sessionId: undefined,
      retryOf: payment._id,
      retryCount: (payment.retryCount || 0) + 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      requestId
    });

    await retryPayment.save();

    PaymentLogger.info('Payment retry record created', {
      originalPaymentId: paymentId,
      newPaymentId,
      retryCount: retryPayment.retryCount,
      requestId
    });

    // Build new HBL request
    const hblRequest = buildHBLPayRequest({
      amount: payment.amount,
      currency: payment.currency,
      orderId: newOrderId,
      bookingData: payment.bookingDetails,
      userData: payment.userDetails
    }, userId);

    const hblResponse = await RetryHandler.executeWithRetry(
      () => callHBLPayAPI(hblRequest),
      'HBL Pay Retry'
    );

    if (!hblResponse.IsSuccess || !hblResponse.Data?.SESSION_ID) {
      await retryPayment.updateOne({
        status: 'failed',
        failureReason: 'RETRY_FAILED',
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });

      return ApiResponse.error(res, 'Payment retry failed', 502);
    }

    const sessionId = hblResponse.Data.SESSION_ID;
    await retryPayment.updateOne({
      sessionId,
      status: 'initiated',
      gatewayResponse: hblResponse,
      updatedAt: new Date()
    });

    const redirectUrl = `${isProduction ? HBL_PRODUCTION_REDIRECT : HBL_SANDBOX_REDIRECT}${sessionId}`;

    PaymentLogger.info('Payment retry successful', {
      originalPaymentId: paymentId,
      newPaymentId,
      sessionId,
      requestId
    });

    return ApiResponse.success(res, {
      paymentId: newPaymentId,
      sessionId,
      redirectUrl,
      orderId: newOrderId,
      retryCount: retryPayment.retryCount
    }, 'Payment retry initiated successfully');

  } catch (error) {
    PaymentLogger.error('Payment retry failed', error, { requestId });
    return ApiResponse.error(res, 'Payment retry failed', 500);
  }
});

// Enhanced error analysis endpoint
const getPaymentErrors = asyncErrorHandler(async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.id;

    const payment = await paymentModel.findOne({ paymentId });

    if (!payment) {
      return ApiResponse.error(res, 'Payment not found', 404);
    }

    if (payment.userId.toString() !== userId.toString()) {
      return ApiResponse.error(res, 'Unauthorized access', 403);
    }

    const errorAnalysis = {
      paymentId: payment.paymentId,
      status: payment.status,
      failureReason: payment.failureReason,
      errorDetails: payment.errorDetails,
      gatewayResponse: payment.gatewayResponse,
      retryCount: payment.retryCount || 0,
      troubleshooting: []
    };

    // Add troubleshooting suggestions based on error
    if (payment.failureReason) {
      const suggestions = getTroubleshootingSuggestions(payment.failureReason, payment.errorDetails);
      errorAnalysis.troubleshooting = suggestions;
    }

    PaymentLogger.info('Error analysis retrieved', {
      paymentId,
      status: payment.status,
      failureReason: payment.failureReason
    });

    return ApiResponse.success(res, errorAnalysis, 'Error analysis retrieved successfully');

  } catch (error) {
    PaymentLogger.error('Error retrieving error analysis', error);
    return ApiResponse.error(res, 'Failed to retrieve error analysis', 500);
  }
});

// Troubleshooting suggestions based on error patterns
function getTroubleshootingSuggestions(failureReason, errorDetails) {
  const suggestions = [];

  if (failureReason?.includes('TIMEOUT')) {
    suggestions.push('The payment gateway is responding slowly. Try again in a few minutes.');
    suggestions.push('Check your internet connection stability.');
  }

  if (failureReason?.includes('CONNECTION')) {
    suggestions.push('Payment gateway is temporarily unavailable.');
    suggestions.push('Contact support if the issue persists.');
  }

  if (failureReason?.includes('VALIDATION')) {
    suggestions.push('Check that all required fields are properly filled.');
    suggestions.push('Verify the booking ID is valid.');
  }

  if (errorDetails?.code === '188') {
    suggestions.push('Merchant credentials issue - contact technical support.');
  }

  if (errorDetails?.code === '11008') {
    suggestions.push('Use the correct test card numbers provided in documentation.');
    suggestions.push('For 3D secure cards, use passcode: 1234');
  }

  if (failureReason?.includes('CSP') || failureReason?.includes('CONTENT_SECURITY_POLICY')) {
    suggestions.push('Browser security settings are blocking payment page resources.');
    suggestions.push('Try using incognito mode or a different browser.');
    suggestions.push('Clear browser cache and cookies.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Try using the recommended test card numbers.');
    suggestions.push('Ensure you are in the sandbox environment.');
    suggestions.push('Contact support if the issue continues.');
  }

  return suggestions;
}

// module.exports = {
//   createPayment,
//   handlePaymentSuccess,
//   handlePaymentFailure,
//   handlePaymentCancel,
//   getPaymentStatus,
//   handleWebhook,
//   healthCheck,
//   getTestConfiguration,
//   retryPayment,
//   getPaymentErrors,
//   static error(message, error, metadata = {}) {
//     this.log('error', message, {
//       error: {
//         message: error?.message,
//         stack: error?.stack,
//         code: error?.code,
//         name: error?.name
//       },
//       ...metadata
//     });
//   },

//   static info(message, metadata = {}) {
//     this.log('info', message, metadata);
//   },

//   static warn(message, metadata = {}) {
//     this.log('warn', message, metadata);
//   },

//   static debug(message, metadata = {}) {
//     this.log('debug', message, metadata);
//   }
// }

// Comprehensive field validation
class HBLPayValidator {
  static validatePaymentRequest(data) {
    const errors = [];
    const warnings = [];

    // Required field validation
    const required = {
      amount: 'Payment amount',
      currency: 'Currency code',
      bookingId: 'Booking ID',
      userData: 'User data'
    };

    for (const [field, label] of Object.entries(required)) {
      if (!data[field]) {
        errors.push(`${label} is required`);
      }
    }

    // Amount validation
    if (data.amount) {
      const amount = parseFloat(data.amount);
      if (isNaN(amount) || amount <= 0) {
        errors.push('Amount must be a positive number');
      }
      if (amount > 1000000) {
        warnings.push('Amount exceeds typical transaction limit');
      }
      if (amount < 1) {
        warnings.push('Amount is below minimum transaction limit');
      }
    }

    // Currency validation
    if (data.currency && !['PKR', 'USD'].includes(data.currency.toUpperCase())) {
      errors.push('Currency must be PKR or USD');
    }

    // User data validation
    if (data.userData) {
      const userRequired = ['email', 'phone'];
      for (const field of userRequired) {
        if (!data.userData[field]) {
          errors.push(`User ${field} is required`);
        }
      }

      // Email format validation
      if (data.userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.userData.email)) {
        errors.push('Invalid email format');
      }

      // Phone validation (Pakistani format)
      if (data.userData.phone && !/^(\+92|0)?[0-9]{10,11}$/.test(data.userData.phone.replace(/\s|-/g, ''))) {
        warnings.push('Phone number format may not be valid for Pakistani numbers');
      }
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }

  static validateHBLConfiguration() {
    const errors = [];
    const config = {
      userId: HBLPAY_USER_ID,
      password: HBLPAY_PASSWORD,
      publicKey: HBL_PUBLIC_KEY,
      sandboxUrl: HBL_SANDBOX_URL,
      redirectUrl: HBL_SANDBOX_REDIRECT
    };

    if (!config.userId || config.userId === 'your_hbl_user_id') {
      errors.push('HBL User ID not configured');
    }

    if (!config.password || config.password === 'your_hbl_password') {
      errors.push('HBL Password not configured');
    }

    if (!config.publicKey || !config.publicKey.includes('BEGIN PUBLIC KEY')) {
      errors.push('HBL Public Key not configured or invalid format');
    }

    if (!config.sandboxUrl || !config.sandboxUrl.includes('testpaymentapi.hbl.com')) {
      errors.push('HBL Sandbox URL not configured correctly');
    }

    return { errors, isValid: errors.length === 0, config };
  }
}

// Enhanced retry mechanism with exponential backoff
class RetryHandler {
  static async executeWithRetry(operation, context, maxAttempts = HBL_RETRY_ATTEMPTS) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        PaymentLogger.debug(`Attempt ${attempt}/${maxAttempts} for ${context}`, {
          attempt,
          maxAttempts,
          context
        });

        const result = await operation();

        if (attempt > 1) {
          PaymentLogger.info(`Operation succeeded on attempt ${attempt}`, { context, attempt });
        }

        return result;
      } catch (error) {
        lastError = error;

        PaymentLogger.warn(`Attempt ${attempt} failed for ${context}`, {
          attempt,
          error: error.message,
          context
        });

        if (attempt === maxAttempts) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    PaymentLogger.error(`All ${maxAttempts} attempts failed for ${context}`, lastError, { context });
    throw lastError;
  }
}

// Enhanced timeout wrapper
function withTimeout(promise, timeoutMs = HBL_TIMEOUT, context = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(`Operation timed out after ${timeoutMs}ms`);
        error.code = 'TIMEOUT';
        error.context = context;
        reject(error);
      }, timeoutMs);
    })
  ]);
}

// Generate unique IDs with better entropy
function generatePaymentId() {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(4).toString('hex');
  return `PAY_${timestamp}_${randomBytes}`;
}

function generateOrderId() {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(3).toString('hex');
  return `ORD_${timestamp}_${randomBytes}`;
}

// Enhanced RSA encryption with error handling
function encryptHBLData(data, publicKey) {
  if (!publicKey) {
    const error = new Error('HBL public key not configured');
    error.code = 'MISSING_PUBLIC_KEY';
    throw error;
  }

  try {
    PaymentLogger.debug('Encrypting HBL data', {
      dataLength: data.length,
      publicKeyLength: publicKey.length
    });

    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt({
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    }, buffer);

    const result = encrypted.toString('base64');
    PaymentLogger.debug('Data encrypted successfully', {
      originalLength: data.length,
      encryptedLength: result.length
    });

    return result;
  } catch (error) {
    PaymentLogger.error('RSA encryption failed', error, {
      dataLength: data.length,
      publicKeyProvided: !!publicKey
    });

    const enhancedError = new Error('Failed to encrypt data for HBL');
    enhancedError.code = 'ENCRYPTION_FAILED';
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

// Enhanced parameter encryption with validation
function encryptRequestParameters(obj, publicKey) {
  try {
    const result = {};
    const encryptedFields = [];

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'USER_ID') {
        result[key] = value;
      } else if (value === null || value === undefined) {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'object' ? encryptHBLData(JSON.stringify(item), publicKey) : encryptHBLData(String(item), publicKey)
        );
        encryptedFields.push(key);
      } else if (typeof value === 'object') {
        result[key] = encryptHBLData(JSON.stringify(value), publicKey);
        encryptedFields.push(key);
      } else {
        result[key] = encryptHBLData(String(value), publicKey);
        encryptedFields.push(key);
      }
    }

    PaymentLogger.debug('Parameters encrypted', {
      totalFields: Object.keys(obj).length,
      encryptedFields: encryptedFields.length,
      unencryptedFields: ['USER_ID']
    });

    return result;
  } catch (error) {
    PaymentLogger.error('Parameter encryption failed', error);
    throw error;
  }
}

// Enhanced HBL API call with comprehensive error handling
async function callHBLPayAPI(requestData) {
  const context = 'HBL_API_CALL';
  const startTime = Date.now();

  try {
    PaymentLogger.info('Initiating HBL Pay API call', {
      url: isProduction ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL,
      environment: isProduction ? 'production' : 'sandbox',
      orderId: requestData.ORDER_ID || 'unknown',
      amount: requestData.AMOUNT || 'unknown'
    });

    const operation = async () => {
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Teli-HBLPay-Integration/1.0',
          'X-Request-ID': crypto.randomUUID()
        },
        body: JSON.stringify(requestData),
        agent: httpsAgent,
        timeout: HBL_TIMEOUT
      };

      PaymentLogger.debug('Sending request to HBL', {
        url: isProduction ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL,
        headers: fetchOptions.headers,
        bodySize: fetchOptions.body.length
      });

      const response = await withTimeout(
        fetch(isProduction ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL, fetchOptions),
        HBL_TIMEOUT,
        'HBL API Request'
      );

      const responseTime = Date.now() - startTime;

      PaymentLogger.info('HBL API response received', {
        status: response.status,
        statusText: response.statusText,
        responseTime: `${responseTime}ms`,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`HBL API returned ${response.status}: ${response.statusText}`);
        error.code = 'HBL_API_ERROR';
        error.status = response.status;
        error.statusText = response.statusText;
        error.responseBody = errorText;

        PaymentLogger.error('HBL API error response', error, {
          status: response.status,
          responseBody: errorText,
          responseTime: `${responseTime}ms`
        });

        throw error;
      }

      const responseData = await response.json();

      PaymentLogger.info('HBL API response parsed', {
        isSuccess: responseData.IsSuccess,
        responseCode: responseData.ResponseCode,
        responseMessage: responseData.ResponseMessage,
        hasSessionId: !!(responseData.Data?.SESSION_ID),
        responseTime: `${responseTime}ms`
      });

      return responseData;
    };

    return await RetryHandler.executeWithRetry(operation, context);

  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (error.code === 'TIMEOUT') {
      PaymentLogger.error('HBL API timeout', error, {
        timeout: HBL_TIMEOUT,
        responseTime: `${responseTime}ms`,
        context
      });
    } else if (error.code === 'ECONNREFUSED') {
      PaymentLogger.error('HBL API connection refused', error, {
        url: isProduction ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL,
        context
      });
    } else if (error.code === 'ENOTFOUND') {
      PaymentLogger.error('HBL API DNS resolution failed', error, { context });
    } else {
      PaymentLogger.error('HBL API call failed', error, {
        responseTime: `${responseTime}ms`,
        context
      });
    }

    throw error;
  }
}

// Enhanced request builder with validation
function buildHBLPayRequest(paymentData, userId) {
  try {
    PaymentLogger.debug('Building HBL Pay request', {
      amount: paymentData.amount,
      currency: paymentData.currency,
      orderId: paymentData.orderId,
      userId
    });

    // Validate required data
    const validation = HBLPayValidator.validatePaymentRequest(paymentData);
    if (!validation.isValid) {
      const error = new Error(`Validation failed: ${validation.errors.join(', ')}`);
      error.code = 'VALIDATION_ERROR';
      error.errors = validation.errors;
      throw error;
    }

    if (validation.warnings.length > 0) {
      PaymentLogger.warn('Validation warnings', { warnings: validation.warnings });
    }

    const requestParams = {
      USER_ID: HBLPAY_USER_ID,
      PASSWORD: HBLPAY_PASSWORD,
      CHANNEL: HBL_CHANNEL,
      TYPE_ID: HBL_TYPE_ID,
      AMOUNT: paymentData.amount.toString(),
      CURRENCY: paymentData.currency.toUpperCase(),
      ORDER_ID: paymentData.orderId,
      SUCCESS_URL: `${process.env.BACKEND_URL}/api/v1/payments/success`,
      FAILURE_URL: `${process.env.BACKEND_URL}/api/v1/payments/failure`,
      CANCEL_URL: `${process.env.BACKEND_URL}/api/v1/payments/cancel`,
      CUSTOMER_EMAIL_ADDRESS: paymentData.userData.email,
      BILL_TO_FORENAME: paymentData.userData.firstName || paymentData.userData.name?.split(' ')[0] || 'Customer',
      BILL_TO_SURNAME: paymentData.userData.lastName || paymentData.userData.name?.split(' ').slice(1).join(' ') || 'User',
      BILL_TO_ADDRESS_LINE1: paymentData.userData.address || 'N/A',
      BILL_TO_ADDRESS_CITY: paymentData.userData.city || 'Karachi',
      BILL_TO_ADDRESS_STATE: paymentData.userData.state || 'Sindh',
      BILL_TO_ADDRESS_COUNTRY: 'PK',
      BILL_TO_ADDRESS_POSTAL_CODE: paymentData.userData.postalCode || '00000',
      BILL_TO_PHONE: paymentData.userData.phone,
      MERCHANT_DATA: JSON.stringify({
        bookingId: paymentData.bookingData._id,
        userId: userId,
        timestamp: new Date().toISOString(),
        source: 'teli_website'
      })
    };

    // Log request parameters (without sensitive data)
    const logParams = { ...requestParams };
    delete logParams.PASSWORD;
    PaymentLogger.debug('HBL request parameters prepared', logParams);

    // Encrypt parameters
    const encryptedParams = encryptRequestParameters(requestParams, HBL_PUBLIC_KEY);

    PaymentLogger.info('HBL Pay request built successfully', {
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      encryptedFieldCount: Object.keys(encryptedParams).length - 1 // -1 for USER_ID
    });

    return encryptedParams;

  } catch (error) {
    PaymentLogger.error('Failed to build HBL Pay request', error, {
      userId,
      orderId: paymentData.orderId,
      amount: paymentData.amount
    });
    throw error;
  }
}

// Enhanced payment creation with comprehensive error handling
const createPayment = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    PaymentLogger.info('Payment creation initiated', {
      requestId,
      userId: req.user?.id,
      body: { ...req.body, cardDetails: '[REDACTED]' }
    });

    // Validate HBL configuration first
    const configValidation = HBLPayValidator.validateHBLConfiguration();
    if (!configValidation.isValid) {
      PaymentLogger.error('HBL configuration validation failed', new Error('Configuration invalid'), {
        errors: configValidation.errors,
        requestId
      });
      return ApiResponse.error(res, `Configuration error: ${configValidation.errors.join(', ')}`, 500);
    }

    const { amount, currency = 'PKR', bookingId, orderId, userData, bookingData } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return ApiResponse.error(res, 'User authentication required', 401);
    }

    // Validate booking ID format
    if (!bookingId || !/^[0-9a-fA-F]{24}$/.test(bookingId)) {
      PaymentLogger.warn('Invalid booking ID format', {
        bookingId,
        userId,
        requestId
      });
      return ApiResponse.error(res, 'Invalid booking ID format', 400);
    }

    // Fetch and validate booking
    let bookingRecord;
    try {
      bookingRecord = await bookingModel.findById(bookingId);
      if (!bookingRecord) {
        PaymentLogger.warn('Booking not found', {
          bookingId,
          userId,
          requestId
        });
        return ApiResponse.error(res, 'Booking not found', 404);
      }

      if (bookingRecord.userId.toString() !== userId.toString()) {
        PaymentLogger.warn('Unauthorized booking access attempt', {
          bookingId,
          requestUserId: userId,
          bookingUserId: bookingRecord.userId,
          requestId
        });
        return ApiResponse.error(res, 'Unauthorized access to booking', 403);
      }
    } catch (error) {
      PaymentLogger.error('Error fetching booking', error, {
        bookingId,
        userId,
        requestId
      });
      return ApiResponse.error(res, 'Error validating booking', 500);
    }

    const finalOrderId = orderId || generateOrderId();
    const paymentId = generatePaymentId();
    const paymentAmount = parseFloat(amount);

    // Enhanced amount validation
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      PaymentLogger.error('Invalid payment amount', new Error('Amount validation failed'), {
        originalAmount: amount,
        convertedAmount: paymentAmount,
        requestId
      });
      return ApiResponse.error(res, `Invalid payment amount: ${amount}`, 400);
    }

    // Check for duplicate payment attempts
    const existingPayment = await paymentModel.findOne({
      bookingId: bookingRecord._id,
      status: { $in: ['pending', 'completed'] }
    });

    if (existingPayment) {
      PaymentLogger.warn('Duplicate payment attempt detected', {
        existingPaymentId: existingPayment.paymentId,
        existingStatus: existingPayment.status,
        bookingId,
        requestId
      });

      if (existingPayment.status === 'completed') {
        return ApiResponse.error(res, 'Payment already completed for this booking', 409);
      }

      if (existingPayment.status === 'pending' && existingPayment.expiresAt > new Date()) {
        return ApiResponse.error(res, 'Payment already in progress for this booking', 409);
      }
    }

    // Create payment record with enhanced metadata
    const payment = new paymentModel({
      paymentId,
      userId,
      bookingId: bookingRecord._id,
      amount: paymentAmount,
      currency: currency.toUpperCase(),
      status: 'pending',
      paymentMethod: 'HBLPay',
      orderId: finalOrderId,
      userDetails: userData,
      bookingDetails: bookingData,
      requestId,
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        environment: isProduction ? 'production' : 'sandbox',
        createdAt: new Date()
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });

    await payment.save();

    PaymentLogger.info('Payment record created', {
      paymentId,
      orderId: finalOrderId,
      amount: paymentAmount,
      currency,
      requestId
    });

    // Build and validate HBL request
    let hblRequest;
    try {
      hblRequest = buildHBLPayRequest({
        amount: paymentAmount,
        currency: currency.toUpperCase(),
        orderId: finalOrderId,
        bookingData: bookingRecord,
        userData: userData
      }, userId);
    } catch (error) {
      await payment.updateOne({
        status: 'failed',
        failureReason: 'REQUEST_BUILD_FAILED',
        errorDetails: {
          code: error.code,
          message: error.message,
          errors: error.errors
        },
        updatedAt: new Date()
      });

      PaymentLogger.error('Failed to build HBL request', error, {
        paymentId,
        requestId
      });

      return ApiResponse.error(res, `Payment setup failed: ${error.message}`, 400);
    }

    // Call HBL API with retry mechanism
    let hblResponse;
    try {
      hblResponse = await RetryHandler.executeWithRetry(
        () => callHBLPayAPI(hblRequest),
        'HBL Pay API Call'
      );
    } catch (error) {
      await payment.updateOne({
        status: 'failed',
        failureReason: 'API_CALL_FAILED',
        errorDetails: {
          code: error.code,
          message: error.message,
          stack: error.stack
        },
        gatewayResponse: error.responseBody ? JSON.parse(error.responseBody) : null,
        updatedAt: new Date()
      });

      PaymentLogger.error('HBL API call failed after retries', error, {
        paymentId,
        requestId,
        attempts: HBL_RETRY_ATTEMPTS
      });

      // Return user-friendly error messages
      if (error.code === 'TIMEOUT') {
        return ApiResponse.error(res, 'Payment gateway is currently slow. Please try again.', 504);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return ApiResponse.error(res, 'Payment gateway is temporarily unavailable. Please try again later.', 503);
      } else {
        return ApiResponse.error(res, 'Payment processing failed. Please try again.', 502);
      }
    }

    // Validate HBL response format
    if (!hblResponse || typeof hblResponse !== 'object') {
      await payment.updateOne({
        status: 'failed',
        failureReason: 'INVALID_RESPONSE_FORMAT',
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });

      PaymentLogger.error('Invalid HBL response format', new Error('Response format invalid'), {
        responseType: typeof hblResponse,
        response: hblResponse,
        paymentId,
        requestId
      });

      return ApiResponse.error(res, 'Invalid response from payment gateway', 502);
    }

    // Check HBL response success
    if (!hblResponse.IsSuccess) {
      const errorCode = hblResponse.ResponseCode || 'UNKNOWN';
      const errorMessage = hblResponse.ResponseMessage || 'Unknown error';

      await payment.updateOne({
        status: 'failed',
        failureReason: `HBL_ERROR_${errorCode}`,
        errorDetails: {
          code: errorCode,
          message: errorMessage,
          fullResponse: hblResponse
        },
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });

      PaymentLogger.error('HBL Pay request failed', new Error(`HBL Error ${errorCode}`), {
        responseCode: errorCode,
        responseMessage: errorMessage,
        fullResponse: hblResponse,
        paymentId,
        requestId
      });

      // Map common HBL error codes to user-friendly messages
      const errorMessages = {
        '188': 'Invalid merchant credentials. Please contact support.',
        '1': 'System error occurred. Please try again later.',
        '11008': 'Invalid verification code. Please check and try again.',
        '11004': 'Verification code expired. Please request a new one.',
        '9000': 'General error occurred. Please try again.'
      };

      const userMessage = errorMessages[errorCode] || `Payment failed: ${errorMessage}`;
      return ApiResponse.error(res, userMessage, 402);
    }

    // Validate SESSION_ID presence
    if (!hblResponse.Data || !hblResponse.Data.SESSION_ID) {
      await payment.updateOne({
        status: 'failed',
        failureReason: 'NO_SESSION_ID',
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });

      PaymentLogger.error('Missing SESSION_ID in HBL response', new Error('No SESSION_ID'), {
        responseData: hblResponse.Data,
        fullResponse: hblResponse,
        paymentId,
        requestId
      });

      return ApiResponse.error(res, 'Failed to create payment session', 502);
    }

    const sessionId = hblResponse.Data.SESSION_ID;

    // Update payment with session info
    await payment.updateOne({
      sessionId,
      gatewayResponse: hblResponse,
      status: 'initiated',
      updatedAt: new Date()
    });

    // Build redirect URL with fallback mechanism
    const baseRedirectUrl = isProduction ? HBL_PRODUCTION_REDIRECT : HBL_SANDBOX_REDIRECT;
    const redirectUrl = `${baseRedirectUrl}${sessionId}`;

    const responseTime = Date.now() - startTime;

    PaymentLogger.info('Payment creation completed successfully', {
      paymentId,
      sessionId,
      orderId: finalOrderId,
      amount: paymentAmount,
      currency,
      redirectUrl,
      responseTime: `${responseTime}ms`,
      requestId
    });

    return ApiResponse.success(res, {
      paymentId,
      sessionId,
      redirectUrl,
      orderId: finalOrderId,
      amount: paymentAmount,
      currency: currency.toUpperCase(),
      expiresAt: payment.expiresAt,
      environment: isProduction ? 'production' : 'sandbox',
      fallbackUrl: `${process.env.FRONTEND_URL}/payment/fallback?sessionId=${sessionId}`
    }, 'Payment session created successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;

    PaymentLogger.error('Payment creation failed', error, {
      userId: req.user?.id,
      requestId,
      responseTime: `${responseTime}ms`,
      errorCode: error.code
    });

    // Return appropriate error based on type
    if (error.code === 'VALIDATION_ERROR') {
      return ApiResponse.error(res, error.message, 400);
    } else if (error.code === 'MISSING_PUBLIC_KEY' || error.code === 'ENCRYPTION_FAILED') {
      return ApiResponse.error(res, 'Payment system configuration error. Please contact support.', 500);
    } else {
      return ApiResponse.error(res, 'Payment creation failed. Please try again.', 500);
    }
  }
});

// Create HBLPay payment session
module.exports.initiateHBLPayPayment = asyncErrorHandler(async (req, res) => {
  const { bookingData, userData, amount, currency = 'PKR', orderId, bookingId } = req.body;
  const userId = req.user._id;

  console.log('🚀 Initiating HBLPay payment:', {
    userId: userId.toString(),
    amount: amount,
    amountType: typeof amount,
    currency,
    orderId: orderId || 'auto-generated',
    bookingId,
    userEmail: userData?.email
  });

  // Enhanced validation
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    console.error('❌ Invalid amount:', { amount, type: typeof amount });
    return ApiResponse.error(res, `Invalid payment amount: ${amount} (must be a positive number)`, 400);
  }

  if (!userData || !userData.email || !userData.firstName) {
    return ApiResponse.error(res, 'Invalid user data - email and name required', 400);
  }

  if (!bookingData || !bookingData.items || bookingData.items.length === 0) {
    return ApiResponse.error(res, 'Invalid booking data - items required', 400);
  }

  if (!bookingId) {
    return ApiResponse.error(res, 'Booking ID is required for payment processing', 400);
  }

  // Verify booking exists and belongs to user
  let bookingRecord = null;
  try {
    bookingRecord = await bookingModel.findOne({
      $or: [
        { _id: bookingId },
        { bookingId: bookingId }
      ],
      userId: userId
    });

    if (!bookingRecord) {
      return ApiResponse.error(res, 'Booking not found or does not belong to user', 404);
    }

    if (bookingRecord.paymentStatus === 'paid') {
      return ApiResponse.error(res, 'This booking is already paid', 400);
    }
  } catch (error) {
    console.error('Error validating booking:', error);
    return ApiResponse.error(res, 'Invalid booking ID format', 400);
  }

  try {
    const finalOrderId = orderId || generateOrderId();
    const paymentId = generatePaymentId();
    const paymentAmount = parseFloat(amount);

    // Validate converted amount
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return ApiResponse.error(res, `Invalid payment amount after conversion: ${paymentAmount}`, 400);
    }

    // Create payment record
    const payment = new paymentModel({
      paymentId,
      userId,
      bookingId: bookingRecord._id,
      amount: paymentAmount,
      currency,
      status: 'pending',
      paymentMethod: 'HBLPay',
      orderId: finalOrderId,
      userDetails: userData,
      bookingDetails: bookingData,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });

    await payment.save();
    console.log('💾 Payment record created:', paymentId);

    // Build request with correctly structured parameters
    const hblRequest = buildHBLPayRequest({
      amount: paymentAmount,
      currency: currency,
      orderId: finalOrderId,
      bookingData: bookingData,
      userData: userData
    }, userId);

    // Call HBLPay API
    const hblResponse = await callHBLPayAPI(hblRequest);

    // Check response format and success
    if (!hblResponse.IsSuccess) {
      await payment.updateOne({
        status: 'failed',
        failureReason: `${hblResponse.ResponseCode}: ${hblResponse.ResponseMessage}`,
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });

      console.error('❌ HBLPay request failed:', {
        responseCode: hblResponse.ResponseCode,
        responseMessage: hblResponse.ResponseMessage
      });

      return ApiResponse.error(res,
        `Payment gateway error: ${hblResponse.ResponseMessage} (Code: ${hblResponse.ResponseCode})`,
        502
      );
    }

    // Check for SESSION_ID in response data
    if (!hblResponse.Data || !hblResponse.Data.SESSION_ID) {
      await payment.updateOne({
        status: 'failed',
        failureReason: 'NO_SESSION_ID',
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });

      console.error('❌ No SESSION_ID in HBLPay response:', hblResponse);
      return ApiResponse.error(res, 'Failed to create payment session - No SESSION_ID received', 502);
    }

    const sessionId = hblResponse.Data.SESSION_ID;

    // Update payment with session ID
    await payment.updateOne({
      sessionId: sessionId,
      transactionId: sessionId,
      gatewayResponse: hblResponse,
      updatedAt: new Date()
    });

    // Build redirect URL
    const paymentUrl = buildRedirectUrl(sessionId);

    console.log('✅ Payment session created successfully:', {
      paymentId,
      sessionId: sessionId,
      paymentUrl,
      bookingId: bookingRecord._id
    });

    return ApiResponse.success(res, {
      sessionId: sessionId,
      paymentUrl,
      paymentId,
      orderId: finalOrderId,
      amount: paymentAmount,
      currency,
      expiresAt: payment.expiresAt,
      bookingId: bookingRecord._id
    }, 'Payment session created successfully');

  } catch (error) {
    console.error('❌ Payment initiation error:', error);
    return ApiResponse.error(res, error.message || 'Failed to initiate payment', 500);
  }
});

// Handle payment return/callback
module.exports.handlePaymentReturn = asyncErrorHandler(async (req, res) => {
  const callbackData = { ...req.query, ...req.body };

  console.log('📥 Payment callback received:', {
    method: req.method,
    query: req.query,
    body: req.body,
    sessionId: callbackData.SESSION_ID
  });

  try {
    const { SESSION_ID, PAYMENT_STATUS, REFERENCE_NUMBER, AMOUNT } = callbackData;

    if (!SESSION_ID) {
      console.error('❌ No SESSION_ID in callback');
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=missing_session_id`);
    }

    // Find payment by session ID
    const payment = await paymentModel.findOne({
      $or: [
        { sessionId: SESSION_ID },
        { transactionId: SESSION_ID },
        { paymentId: REFERENCE_NUMBER }
      ]
    });

    if (!payment) {
      console.error('❌ Payment not found for session:', SESSION_ID);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=payment_not_found`);
    }

    console.log('💳 Processing payment callback:', {
      paymentId: payment.paymentId,
      currentStatus: payment.status,
      callbackStatus: PAYMENT_STATUS,
      amount: AMOUNT
    });

    // Update payment based on status
    if (PAYMENT_STATUS === 'SUCCESS' || PAYMENT_STATUS === 'COMPLETED') {
      await payment.updateOne({
        status: 'completed',
        paidAt: new Date(),
        gatewayResponse: callbackData,
        updatedAt: new Date()
      });

      // Update booking if exists
      if (payment.bookingId) {
        await bookingModel.findByIdAndUpdate(payment.bookingId, {
          paymentStatus: 'paid',
          status: 'confirmed',
          updatedAt: new Date()
        });
      }

      console.log('✅ Payment completed successfully:', payment.paymentId);

      // Send success notification
      try {
        await notificationService.sendPaymentConfirmation(payment);
      } catch (notifError) {
        console.warn('⚠️ Failed to send notification:', notifError.message);
      }

      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?sessionId=${SESSION_ID}&paymentId=${payment.paymentId}`);

    } else if (PAYMENT_STATUS === 'FAILED' || PAYMENT_STATUS === 'DECLINED') {
      await payment.updateOne({
        status: 'failed',
        failureReason: PAYMENT_STATUS,
        gatewayResponse: callbackData,
        updatedAt: new Date()
      });

      console.log('❌ Payment failed:', payment.paymentId);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?sessionId=${SESSION_ID}&reason=${PAYMENT_STATUS}`);

    } else if (PAYMENT_STATUS === 'CANCELLED') {
      await payment.updateOne({
        status: 'cancelled',
        gatewayResponse: callbackData,
        updatedAt: new Date()
      });

      console.log('⚠️ Payment cancelled:', payment.paymentId);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/cancelled?sessionId=${SESSION_ID}`);

    } else {
      // Unknown status
      console.warn('⚠️ Unknown payment status:', PAYMENT_STATUS);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/pending?sessionId=${SESSION_ID}&status=${PAYMENT_STATUS}`);
    }

  } catch (error) {
    console.error('❌ Payment callback error:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=callback_error`);
  }
});

// Handle webhook notifications
module.exports.handleWebhook = asyncErrorHandler(async (req, res) => {
  const webhookData = req.body;

  console.log('🔔 Webhook received:', webhookData);

  try {
    const { SESSION_ID, PAYMENT_STATUS, REFERENCE_NUMBER } = webhookData;

    if (SESSION_ID) {
      const payment = await paymentModel.findOne({
        $or: [
          { sessionId: SESSION_ID },
          { transactionId: SESSION_ID },
          { paymentId: REFERENCE_NUMBER }
        ]
      });

      if (payment && payment.status === 'pending') {
        if (PAYMENT_STATUS === 'SUCCESS' || PAYMENT_STATUS === 'COMPLETED') {
          await payment.updateOne({
            status: 'completed',
            paidAt: new Date(),
            gatewayResponse: webhookData,
            updatedAt: new Date()
          });

          console.log('✅ Payment updated via webhook:', payment.paymentId);
        }
      }
    }

    return ApiResponse.success(res, { received: true }, 'Webhook processed');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return ApiResponse.error(res, 'Webhook processing failed', 500);
  }
});

// Verify payment status
module.exports.verifyPayment = asyncErrorHandler(async (req, res) => {
  const { sessionId, paymentId } = req.params;
  const userId = req.user._id;

  try {
    const payment = await paymentModel.findOne({
      $and: [
        { userId },
        {
          $or: [
            { sessionId },
            { paymentId },
            { transactionId: sessionId }
          ]
        }
      ]
    });

    if (!payment) {
      return ApiResponse.error(res, 'Payment not found', 404);
    }

    return ApiResponse.success(res, {
      paymentId: payment.paymentId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt
    }, 'Payment status retrieved');

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    return ApiResponse.error(res, 'Failed to verify payment', 500);
  }
});

// Get payment history
module.exports.getPaymentHistory = asyncErrorHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, status } = req.query;

  try {
    const query = { userId };
    if (status) {
      query.status = status;
    }

    const payments = await paymentModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-gatewayResponse -userDetails');

    const total = await paymentModel.countDocuments(query);

    return ApiResponse.success(res, {
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Payment history retrieved');

  } catch (error) {
    console.error('❌ Payment history error:', error);
    return ApiResponse.error(res, 'Failed to get payment history', 500);
  }
});

// Get payment details
module.exports.getPaymentDetails = asyncErrorHandler(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user._id;

  try {
    const payment = await paymentModel.findOne({
      paymentId,
      userId
    }).select('-gatewayResponse');

    if (!payment) {
      return ApiResponse.error(res, 'Payment not found', 404);
    }

    return ApiResponse.success(res, payment, 'Payment details retrieved');

  } catch (error) {
    console.error('❌ Payment details error:', error);
    return ApiResponse.error(res, 'Failed to get payment details', 500);
  }
});

// Process refund
module.exports.processRefund = asyncErrorHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { amount, reason } = req.body;
  const userId = req.user._id;

  try {
    const payment = await paymentModel.findOne({
      paymentId,
      userId,
      status: 'completed'
    });

    if (!payment) {
      return ApiResponse.error(res, 'Payment not found or not eligible for refund', 404);
    }

    if (amount > payment.amount) {
      return ApiResponse.error(res, 'Refund amount cannot exceed payment amount', 400);
    }

    // Update the payment record
    await payment.updateOne({
      status: 'refunded',
      refundAmount: amount,
      refundReason: reason,
      refundedAt: new Date(),
      updatedAt: new Date()
    });

    console.log('💰 Refund processed:', {
      paymentId,
      refundAmount: amount,
      reason
    });

    return ApiResponse.success(res, {
      paymentId,
      refundAmount: amount,
      status: 'refunded'
    }, 'Refund processed successfully');

  } catch (error) {
    console.error('❌ Refund error:', error);
    return ApiResponse.error(res, 'Failed to process refund', 500);
  }
});

// Add validation function
function validateConfiguration() {
  const required = {
    HBLPAY_USER_ID,
    HBLPAY_PASSWORD,
    HBL_SANDBOX_URL: HBL_SANDBOX_URL || HBL_PRODUCTION_URL,
    HBL_SANDBOX_REDIRECT: HBL_SANDBOX_REDIRECT || HBL_PRODUCTION_REDIRECT
  };

  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
  }
}

// Health check
module.exports.healthCheck = asyncErrorHandler(async (req, res) => {
  try {
    validateConfiguration();

    return ApiResponse.success(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      gateway: 'HBLPay',
      version: '1.0.0',
      configuration: {
        userId: !!HBLPAY_USER_ID,
        password: !!HBLPAY_PASSWORD,
        publicKey: !!HBL_PUBLIC_KEY,
        apiUrl: isProduction ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL,
        redirectUrl: isProduction ? HBL_PRODUCTION_REDIRECT : HBL_SANDBOX_REDIRECT
      }
    }, 'Payment gateway is healthy');
  } catch (error) {
    return ApiResponse.error(res, 'Payment gateway configuration error: ' + error.message, 503);
  }
});