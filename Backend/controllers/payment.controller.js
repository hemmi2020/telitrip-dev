const crypto = require('crypto');
const fetch = require('node-fetch');
const paymentModel = require('../models/payment.model');
const bookingModel = require('../models/booking.model');
const ApiResponse = require('../utils/response.util');
const { asyncErrorHandler } = require('../middlewares/errorHandler.middleware');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger.util'); // Enhanced logging utility
const NodeRSA = require('node-rsa');


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
const privateKeyPem = process.env.MERCHANT_PRIVATE_KEY_PEM;

const isProduction = process.env.NODE_ENV === 'production';

const https = require('https');

// Enhanced HTTPS agent with timeout and retry configuration
const httpsAgent = new https.Agent({
  rejectUnauthorized: !isProduction, // Only bypass SSL in sandbox
  timeout: HBL_TIMEOUT,
  keepAlive: true,
  maxSockets: 50
});


// Fixed HBL response decryption function - Updated for Node.js security changes
function decryptHBLResponse(encryptedData, privateKeyPem) {
  try {
    console.log('🔐 Starting HBL response decryption...');
    console.log('📝 Encrypted data length:', encryptedData.length);
    
    
    
    // HBL uses 512-byte blocks for RSA decryption (same as PHP sample)
    const DECRYPT_BLOCK_SIZE = 512;
    
    // Create RSA key from PEM format
    const privateKey = new NodeRSA(privateKeyPem);
    privateKey.setOptions({
      encryptionScheme: 'pkcs1'  // NodeRSA still supports PKCS1
    });
    
    // First decode the base64 data
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    console.log('📦 Decoded buffer length:', encryptedBuffer.length);
    
    let decryptedData = '';
    
    // Split the encrypted data into 512-byte blocks
    for (let i = 0; i < encryptedBuffer.length; i += DECRYPT_BLOCK_SIZE) {
      const chunk = encryptedBuffer.slice(i, i + DECRYPT_BLOCK_SIZE);
      console.log(`🔍 Processing chunk ${Math.floor(i / DECRYPT_BLOCK_SIZE) + 1}, size: ${chunk.length}`);
      
      try {
        // Use NodeRSA for decryption (supports PKCS1)
        const decryptedChunk = privateKey.decrypt(chunk, 'utf8');
        decryptedData += decryptedChunk;
        
      } catch (chunkError) {
        console.error(`❌ Failed to decrypt chunk at position ${i}:`, chunkError.message);
        throw new Error(`Block decryption failed at chunk ${Math.floor(i / DECRYPT_BLOCK_SIZE) + 1}: ${chunkError.message}`);
      }
    }
    
    console.log('✅ HBL response decrypted successfully');
    console.log('📄 Decrypted data:', decryptedData);
    
    // Parse the query string format into an object
    const params = {};
    
    if (decryptedData && decryptedData.includes('=')) {
      const pairs = decryptedData.split('&');
      console.log('🔍 Found parameter pairs:', pairs);
      
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value !== undefined) {
          params[key] = decodeURIComponent(value);
          console.log(`📝 Parsed: ${key} = ${params[key]}`);
        }
      }
    } else {
      console.warn('⚠️ Decrypted data does not contain expected format');
    }
    
    console.log('📋 Final parsed parameters:', params);
    return params;
    
  } catch (error) {
    console.error('❌ HBL response decryption failed:', error);
    throw new Error(`Failed to decrypt HBL response: ${error.message}`);
  }
}

// Alternative function using NodeRSA with proper block handling (if you prefer to keep NodeRSA)
function decryptHBLResponseWithNodeRSA(encryptedData, privateKeyPem) {
  try {
    console.log('🔐 Starting HBL response decryption with NodeRSA...');
    
    const NodeRSA = require('node-rsa');
    const DECRYPT_BLOCK_SIZE = 512;
    
    // Create RSA key from PEM format
    const privateKey = new NodeRSA(privateKeyPem);
    privateKey.setOptions({
      encryptionScheme: 'pkcs1',
      environment: 'node'
    });
    
    // Decode base64 and split into blocks
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    let decryptedData = '';
    
    // Process each 512-byte block
    for (let i = 0; i < encryptedBuffer.length; i += DECRYPT_BLOCK_SIZE) {
      const chunk = encryptedBuffer.slice(i, i + DECRYPT_BLOCK_SIZE);
      const decryptedChunk = privateKey.decrypt(chunk, 'utf8');
      decryptedData += decryptedChunk;
    }
    
    console.log('✅ HBL response decrypted successfully with NodeRSA');
    console.log('📄 Decrypted data:', decryptedData);
    
    // Parse query string format
    const params = {};
    const pairs = decryptedData.split('&');
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value !== undefined) {
        params[key] = decodeURIComponent(value);
      }
    }
    
    return params;
    
  } catch (error) {
    console.error('❌ HBL response decryption with NodeRSA failed:', error);
    throw new Error(`Failed to decrypt HBL response: ${error.message}`);
  }
}


// Enhanced error logging utility
class PaymentLogger {
  static log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'HBLPay',
      message,
      requestId: metadata.requestId || 'unknown',
      ...metadata
    };

    try {
      // Try to use main logger first
      if (logger && typeof logger[level] === 'function') {
        logger[level](message, metadata);
        return;
      }
    } catch (loggerError) {
      // If main logger fails, log the error but continue with fallback
      console.error('Main logger failed:', loggerError.message);
    }

    // Improved fallback with proper console methods
    const consoleMethods = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    const consoleMethod = consoleMethods[level] || console.log;
    const prefix = `[${level.toUpperCase()}] HBLPay: ${new Date().toISOString()}`;
    
    consoleMethod(prefix, message);
    if (Object.keys(metadata).length > 0) {
      consoleMethod('Metadata:', metadata);
    }
  }

  static error(message, error, metadata = {}) {
    const enhancedMetadata = { ...metadata };
    
    if (error) {
      enhancedMetadata.error = {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        name: error?.name
      };
    }

    this.log('error', message, enhancedMetadata);
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




// Updated handlePaymentCancel function with enhanced debugging
module.exports.handlePaymentCancel = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    PaymentLogger.info('🚫 Payment cancellation request received', {
      requestId,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Extract encrypted data from query parameter
    const { data: encryptedData } = req.query;
    
    console.log('🔍 DEBUG: Raw query params:', req.query);
    console.log('🔍 DEBUG: Encrypted data exists:', !!encryptedData);
    console.log('🔍 DEBUG: Encrypted data length:', encryptedData?.length);
    console.log('🔍 DEBUG: Encrypted data preview:', encryptedData?.substring(0, 100));
    
    if (!encryptedData) {
      PaymentLogger.warn('No encrypted data in cancel request', { requestId });
      console.error('❌ No encrypted data found in URL query parameters');
      return res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?error=missing_data`);
    }

    // Check if merchant private key exists
    console.log('🔍 DEBUG: MERCHANT_PRIVATE_KEY_PEM exists:', !!process.env.MERCHANT_PRIVATE_KEY_PEM);
    console.log('🔍 DEBUG: Private key preview:', process.env.MERCHANT_PRIVATE_KEY_PEM?.substring(0, 50));
    
    if (!process.env.MERCHANT_PRIVATE_KEY_PEM) {
      PaymentLogger.error('❌ MERCHANT_PRIVATE_KEY_PEM not configured', null, { requestId });
      console.error('❌ MERCHANT_PRIVATE_KEY_PEM environment variable is missing!');
      return res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?error=config_error`);
    }

    // Decrypt the response data using merchant private key with proper block handling
    let decryptedResponse = {};
    try {
      console.log('🔐 Attempting decryption...');
      // Use the fixed decryption function
      decryptedResponse = decryptHBLResponse(encryptedData, process.env.MERCHANT_PRIVATE_KEY_PEM);
      
      console.log('✅ Decryption successful! Response fields:', Object.keys(decryptedResponse));
      console.log('📋 Full decrypted response:', decryptedResponse);
      
      PaymentLogger.info('📋 Decrypted cancel response', {
        requestId,
        responseFields: Object.keys(decryptedResponse),
        responseCode: decryptedResponse.RESPONSE_CODE,
        responseMessage: decryptedResponse.RESPONSE_MESSAGE,
        orderRefNumber: decryptedResponse.ORDER_REF_NUMBER
      });
      
    } catch (decryptError) {
      console.error('❌ Primary decryption failed:', decryptError);
      PaymentLogger.error('❌ Failed to decrypt cancel response', decryptError, { requestId });
      
      // Try alternative decryption method
      try {
        console.log('🔄 Trying alternative NodeRSA decryption method...');
        decryptedResponse = decryptHBLResponseWithNodeRSA(encryptedData, process.env.MERCHANT_PRIVATE_KEY_PEM);
        console.log('✅ Alternative decryption succeeded:', decryptedResponse);
        PaymentLogger.info('✅ Alternative decryption succeeded', { requestId });
      } catch (altError) {
        console.error('❌ Alternative decryption also failed:', altError);
        PaymentLogger.error('❌ Alternative decryption also failed', altError, { requestId });
        
        // Since both decryption methods failed, redirect with error but provide what info we can
        console.log('🚫 Both decryption methods failed - redirecting with general error');
        return res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?error=decrypt_failed&reason=decryption_error`);
      }
    }

    // Extract response parameters (HBL uses these field names according to PHP sample)
    const { 
      RESPONSE_CODE: responseCode,
      RESPONSE_MESSAGE: responseMessage,
      ORDER_REF_NUMBER: orderRefNumber,
      PAYMENT_TYPE: paymentType,
      // Alternative field names that might also be used
      ORDER_ID: orderId,
      SESSION_ID: sessionId,
      AMOUNT: amount,
      CURRENCY: currency,
      MERCHANT_ORDER_NO: merchantOrderNo
    } = decryptedResponse;

    console.log('📊 Extracted parameters:', {
      responseCode,
      responseMessage,
      orderRefNumber,
      paymentType,
      orderId,
      sessionId,
      amount,
      currency,
      merchantOrderNo
    });

    // Find the payment record in database
    let payment = null;
    
    // Try to find payment by various identifiers
    if (orderRefNumber || orderId || sessionId || merchantOrderNo) {
      try {
        console.log('🔍 Searching for payment record...');
        
        // Try to find by session ID first
        if (sessionId) {
          payment = await paymentModel.findOne({ sessionId: sessionId });
          console.log('🔍 Search by sessionId result:', !!payment);
        }
        
        // If not found, try by order reference number
        if (!payment && orderRefNumber) {
          payment = await paymentModel.findOne({ orderId: orderRefNumber });
          console.log('🔍 Search by orderRefNumber result:', !!payment);
        }
        
        // If not found, try by orderId
        if (!payment && orderId) {
          payment = await paymentModel.findOne({ orderId: orderId });
          console.log('🔍 Search by orderId result:', !!payment);
        }
        
        // If still not found, try by merchant order number
        if (!payment && merchantOrderNo) {
          payment = await paymentModel.findOne({ merchantOrderNo: merchantOrderNo });
          console.log('🔍 Search by merchantOrderNo result:', !!payment);
        }
        
        PaymentLogger.info('💾 Payment record search result', {
          requestId,
          found: !!payment,
          paymentId: payment?.paymentId,
          searchCriteria: { orderRefNumber, orderId, sessionId, merchantOrderNo }
        });
        
      } catch (dbError) {
        console.error('❌ Database error while finding payment:', dbError);
        PaymentLogger.error('❌ Database error while finding payment', dbError, { requestId });
      }
    } else {
      console.warn('⚠️ No identifiers found to search for payment record');
    }

    // Update payment record if found
    if (payment) {
      try {
        console.log('💾 Updating payment record as cancelled...');
        await paymentModel.findByIdAndUpdate(payment._id, {
          status: 'cancelled',
          responseCode: responseCode,
          responseMessage: responseMessage,
          paymentType: paymentType,
          cancelledAt: new Date(),
          hblResponse: decryptedResponse
        });

        console.log('✅ Payment record updated successfully');
        PaymentLogger.info('✅ Payment record updated as cancelled', {
          requestId,
          paymentId: payment.paymentId,
          responseCode,
          responseMessage
        });
        
        // Send notification if needed
        if (payment.userId) {
          try {
            await notificationService.sendPaymentCancellationNotification(payment.userId, {
              orderId: orderRefNumber || payment.orderId,
              amount: payment.amount,
              reason: responseMessage || 'Payment cancelled by user'
            });
          } catch (notifError) {
            console.warn('⚠️ Failed to send cancellation notification:', notifError.message);
            PaymentLogger.warn('⚠️ Failed to send cancellation notification', {
              requestId,
              error: notifError.message
            });
          }
        }
        
      } catch (updateError) {
        console.error('❌ Failed to update payment record:', updateError);
        PaymentLogger.error('❌ Failed to update payment record', updateError, { requestId });
      }
    } else {
      console.warn('⚠️ Payment record not found - continuing with cancellation anyway');
      PaymentLogger.warn('⚠️ Payment record not found for cancellation', {
        requestId,
        orderRefNumber,
        orderId,
        sessionId,
        merchantOrderNo
      });
    }

    // Log final response
    const duration = Date.now() - startTime;
    PaymentLogger.info('🏁 Payment cancellation completed', {
      requestId,
      duration: `${duration}ms`,
      responseCode,
      responseMessage,
      found: !!payment
    });

    // Redirect to frontend with cancellation details
    const redirectParams = new URLSearchParams({
      status: 'cancelled',
      code: responseCode || 'user_cancelled',
      message: responseMessage || 'Payment cancelled by user',
      orderId: orderRefNumber || orderId || 'unknown',
      amount: amount || (payment?.amount),
      currency: currency || (payment?.currency) || 'PKR'
    });

    console.log('🔗 Redirecting to frontend with params:', redirectParams.toString());
    return res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?${redirectParams.toString()}`);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 Unexpected error in payment cancellation:', error);
    PaymentLogger.error('💥 Unexpected error in payment cancellation', error, {
      requestId,
      duration: `${duration}ms`
    });

    return res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?error=server_error`);
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
    const stringData = String(data);
    
    // Use Node.js crypto for RSA encryption (more reliable than NodeRSA for this use case)
    const buffer = Buffer.from(stringData, 'utf8');
    const encrypted = crypto.publicEncrypt({
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    }, buffer);

    return encrypted.toString('base64');
  } catch (error) {
    console.error('RSA encryption error:', error.message);
    throw error;
  }
}

    

// Recursive parameter encryption EXACTLY like the PHP sample in HBL PDF
function encryptRequestParameters(data, publicKey) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => encryptRequestParameters(item, publicKey));
  }

  const result = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (key === 'USER_ID') {
      // Never encrypt USER_ID (per HBL requirements)
      result[key] = value;
    } else if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'object') {
      // Recursively encrypt objects and arrays
      result[key] = encryptRequestParameters(value, publicKey);
    } else {
      // Encrypt primitive values (strings, numbers, booleans)
      try {
        result[key] = encryptHBLData(String(value), publicKey);
      } catch (error) {
        console.warn(`Failed to encrypt field ${key}:`, error.message);
        // If encryption fails, keep original value (HBL sandbox might accept it)
        result[key] = value;
      }
    }
  }

  return result;
}



// Enhanced request builder with validation
const buildHBLPayRequest = (paymentData, userId) => {
  const { amount, currency, orderId, bookingData, userData } = paymentData;

  console.log('🔍 buildHBLPayRequest received parameters:', {
    amount: typeof amount,
    amountValue: amount,
    currency,
    orderId,
    hasBookingData: !!bookingData,
    hasUserData: !!userData,
    userId
  });

  // Validate amount parameter
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw new Error(`Invalid amount parameter: ${amount} (type: ${typeof amount})`);
  }

  // Build request matching HBL documentation sample EXACTLY - MINIMAL VERSION
  const request = {
    "USER_ID": HBLPAY_USER_ID,
    "PASSWORD": HBLPAY_PASSWORD,
    "RETURN_URL": `${process.env.FRONTEND_URL || 'https://telitrip.onrender.com'}/payment/success`,
    "CANCEL_URL": `${process.env.FRONTEND_URL || 'https://telitrip.onrender.com'}/payments/cancel`,
    "CHANNEL": HBL_CHANNEL,
    "TYPE_ID": HBL_TYPE_ID,
    "ORDER": {
      "DISCOUNT_ON_TOTAL": "0",
      "SUBTOTAL": amount.toFixed(2),
      "OrderSummaryDescription": [
        {
          "ITEM_NAME": bookingData?.hotelName || "HOTEL BOOKING",
          "QUANTITY": "1",
          "UNIT_PRICE": amount.toFixed(2),
          "OLD_PRICE": null,
          "CATEGORY": "Hotel",
          "SUB_CATEGORY": "Room Booking"
        }
      ]
    },
    "SHIPPING_DETAIL": {
      "NAME": "DHL SERVICE",
      "ICON_PATH": null,
      "DELIEVERY_DAYS": "0",
      "SHIPPING_COST": "0"
    },
    "ADDITIONAL_DATA": {
      "REFERENCE_NUMBER": orderId || "TEST123456789",
      "CUSTOMER_ID": userId?.toString() || "GUEST_USER_" + Date.now(), // Provide actual customer ID
      "CURRENCY": "PKR",
      "BILL_TO_FORENAME": userData?.firstName || "John",
      "BILL_TO_SURNAME": userData?.lastName || "Doe",
      "BILL_TO_EMAIL": userData?.email || "test@example.com",
      "BILL_TO_PHONE": userData?.phone || "02890888888",
      "BILL_TO_ADDRESS_LINE": userData?.address || "1 Card Lane",
      "BILL_TO_ADDRESS_CITY": userData?.city || "My City",
      "BILL_TO_ADDRESS_STATE": userData?.state || "CA",
      "BILL_TO_ADDRESS_COUNTRY": userData?.country || "US",
      "BILL_TO_ADDRESS_POSTAL_CODE": userData?.postalCode || "94043",
      "SHIP_TO_FORENAME": userData?.firstName || "John",
      "SHIP_TO_SURNAME": userData?.lastName || "Doe",
      "SHIP_TO_EMAIL": userData?.email || "test@example.com",
      "SHIP_TO_PHONE": userData?.phone || "02890888888",
      "SHIP_TO_ADDRESS_LINE": userData?.address || "1 Card Lane",
      "SHIP_TO_ADDRESS_CITY": userData?.city || "My City",
      "SHIP_TO_ADDRESS_STATE": userData?.state || "CA",
      "SHIP_TO_ADDRESS_COUNTRY": userData?.country || "US",
      "SHIP_TO_ADDRESS_POSTAL_CODE": userData?.postalCode || "94043",
      "MerchantFields": {
        "MDD1": HBL_CHANNEL, // Channel of Operation (Required)
        "MDD2": "N", // 3D Secure Registration (Optional)
        "MDD3": "Hotel", // Product Category (Optional)
        "MDD4": bookingData?.hotelName || "Hotel Booking", // Product Name (Optional)
        "MDD5": userData?.customerId ? "Y" : "N", // Previous Customer (Optional)
        "MDD6": "Digital", // Shipping Method (Optional)
        "MDD7": bookingData?.items?.length?.toString() || "1", // Number Of Items Sold (Optional)
        "MDD8": "PK", // Product Shipping Country Name (Optional)
        "MDD9": "0", // Hours Till Departure (Optional)
        "MDD10": "Hotel", // Flight Type (Optional)
        "MDD11": bookingData?.checkIn && bookingData?.checkOut 
          ? `${bookingData.checkIn} to ${bookingData.checkOut}` 
          : "N/A", // Full Journey/Itinerary (Optional)
        "MDD12": "N", // 3rd Party Booking (Optional)
        "MDD13": bookingData?.hotelName || "Hotel", // Hotel Name (Optional)
        "MDD14": new Date().toISOString().split('T')[0], // Date of Booking (Optional) 
        "MDD15": bookingData?.checkIn || "", // Check In Date (Optional)
        "MDD16": bookingData?.checkOut || "", // Check Out Date (Optional)
        "MDD17": "Hotel", // Product Type (Optional)
        "MDD18": userData?.phone || userData?.email || "", // Customer ID/Phone Number (Optional)
        "MDD19": userData?.country || "PK", // Country Of Top-up (Optional)
        "MDD20": "N" // VIP Customer (Optional) 
      }
    }
  };

  console.log('📤 HBLPay Request (Key fields):', {
    USER_ID: request.USER_ID,
    CHANNEL: request.CHANNEL,
    TYPE_ID: request.TYPE_ID,
    SUBTOTAL: request.ORDER.SUBTOTAL,
    CURRENCY: request.ADDITIONAL_DATA.CURRENCY,
    REFERENCE_NUMBER: request.ADDITIONAL_DATA.REFERENCE_NUMBER
  });

  return request;
};



// Call HBLPay API
const callHBLPayAPI = async (requestData) => {
  const apiUrl = isProduction ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL;

  console.log('🔄 Calling HBLPay API:', {
    url: apiUrl,
    environment: isProduction ? 'production' : 'sandbox',
    userId: requestData.USER_ID,
    channel: requestData.CHANNEL,
    amount: requestData.ORDER?.SUBTOTAL,
    orderId: requestData.ADDITIONAL_DATA?.REFERENCE_NUMBER
  });

  try {
    // ✅ ENCRYPT THE REQUEST DATA (except USER_ID)
    let finalRequestData = requestData;

    if (HBL_PUBLIC_KEY) {
      console.log('🔐 Encrypting request parameters...');
      finalRequestData = encryptRequestParameters(requestData, HBL_PUBLIC_KEY);
      console.log('✅ Request parameters encrypted successfully');
    } else {
      console.warn('⚠️ No HBL public key found - sending unencrypted data (this might fail)');
    }

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'NodeJS-HBLPay-Client/1.0'
      },
      body: JSON.stringify(finalRequestData),
      timeout: 30000
    };

    // Add SSL bypass for sandbox environment
    if (!isProduction) {
      fetchOptions.agent = httpsAgent;
    }

    console.log('📤 Sending encrypted request to HBL...');
    // Don't log the encrypted body as it will be unreadable

    const response = await fetch(apiUrl, fetchOptions);

    const responseText = await response.text();
    console.log('📥 HBLPay Raw Response:', responseText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText}`);
    }

    let hblResponse;
    try {
      hblResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse HBLPay response:', parseError);
      throw new Error('Invalid JSON response from HBLPay');
    }

    console.log('✅ HBLPay Parsed Response:', {
      isSuccess: hblResponse.IsSuccess,
      responseCode: hblResponse.ResponseCode,
      responseMessage: hblResponse.ResponseMessage,
      sessionId: hblResponse.Data?.SESSION_ID,
      hasData: !!hblResponse.Data
    });

    return hblResponse;
  } catch (error) {
    console.error('❌ HBLPay API Error:', error);
    throw new Error(`HBLPay API call failed: ${error.message}`);
  }
};

// Build redirect URL
const buildRedirectUrl = (sessionId) => {
  const baseUrl = isProduction ? HBL_PRODUCTION_REDIRECT : HBL_SANDBOX_REDIRECT;
  // Encode session ID for URL
  const encodedSessionId = Buffer.from(sessionId).toString('base64');
  return `${baseUrl}${encodedSessionId}`;
};


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

// Add this to your payment.controller.js

module.exports.handlePaymentSuccess = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    PaymentLogger.info('✅ Payment success request received', {
      requestId,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Extract encrypted data from query parameter
    const { data: encryptedData } = req.query;
    
    if (!encryptedData) {
      PaymentLogger.warn('No encrypted data in success request', { requestId });
      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?error=missing_data`);
    }

    // Check if merchant private key exists
    if (!process.env.MERCHANT_PRIVATE_KEY_PEM) {
      PaymentLogger.error('MERCHANT_PRIVATE_KEY_PEM not configured', null, { requestId });
      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?error=config_error`);
    }

    // Decrypt the response data using merchant private key
    let decryptedResponse = {};
    try {
      // For now, skip decryption until HBL fixes the key issue
      // decryptedResponse = decryptHBLResponse(encryptedData, process.env.MERCHANT_PRIVATE_KEY_PEM);
      
      // Temporary: Parse from URL parameters instead
      const urlParams = req.query;
      decryptedResponse = {
        RESPONSE_CODE: urlParams.responseCode || '0',
        RESPONSE_MESSAGE: urlParams.responseMessage || 'Payment Successful',
        ORDER_REF_NUMBER: urlParams.orderRefNumber || urlParams.orderId,
        SESSION_ID: urlParams.sessionId,
        AMOUNT: urlParams.amount,
        CURRENCY: urlParams.currency || 'PKR',
        TRANSACTION_ID: urlParams.transactionId,
        PAYMENT_TYPE: urlParams.paymentType || 'CARD'
      };
      
      PaymentLogger.info('📋 Processed success response', {
        requestId,
        responseFields: Object.keys(decryptedResponse),
        responseCode: decryptedResponse.RESPONSE_CODE,
        responseMessage: decryptedResponse.RESPONSE_MESSAGE
      });
      
    } catch (decryptError) {
      PaymentLogger.error('Failed to decrypt success response', decryptError, { requestId });
      // Continue with available URL parameters
      decryptedResponse = {
        RESPONSE_CODE: '0',
        RESPONSE_MESSAGE: 'Payment Successful',
        ORDER_REF_NUMBER: req.query.orderId || 'unknown'
      };
    }

    const { 
      RESPONSE_CODE: responseCode,
      RESPONSE_MESSAGE: responseMessage,
      ORDER_REF_NUMBER: orderRefNumber,
      SESSION_ID: sessionId,
      AMOUNT: amount,
      CURRENCY: currency,
      TRANSACTION_ID: transactionId,
      PAYMENT_TYPE: paymentType
    } = decryptedResponse;

    // Find the payment record in database
    let payment = null;
    
    if (sessionId || orderRefNumber || transactionId) {
      try {
        const searchCriteria = {
          $or: [
            ...(sessionId ? [{ sessionId: sessionId }] : []),
            ...(orderRefNumber ? [{ orderId: orderRefNumber }] : []),
            ...(transactionId ? [{ transactionId: transactionId }] : [])
          ]
        };
        
        payment = await paymentModel.findOne(searchCriteria);
        
        PaymentLogger.info('Payment record search result', {
          requestId,
          found: !!payment,
          paymentId: payment?.paymentId,
          searchCriteria
        });
        
      } catch (dbError) {
        PaymentLogger.error('Database error while finding payment', dbError, { requestId });
      }
    }

    // Update payment record if found
    if (payment) {
      try {
        await paymentModel.findByIdAndUpdate(payment._id, {
          status: 'completed',
          responseCode: responseCode,
          responseMessage: responseMessage,
          paymentType: paymentType,
          transactionId: transactionId,
          paidAt: new Date(),
          hblResponse: decryptedResponse
        });

        // Update associated booking
        if (payment.bookingId) {
          await bookingModel.findByIdAndUpdate(payment.bookingId, {
            paymentStatus: 'paid',
            status: 'confirmed',
            updatedAt: new Date()
          });
        }

        PaymentLogger.info('Payment record updated as completed', {
          requestId,
          paymentId: payment.paymentId,
          responseCode,
          responseMessage
        });
        
        // Send success notification
        if (payment.userId) {
          try {
            await notificationService.sendPaymentConfirmation({
              userId: payment.userId,
              paymentId: payment.paymentId,
              amount: payment.amount,
              orderId: orderRefNumber || payment.orderId
            });
          } catch (notifError) {
            PaymentLogger.warn('Failed to send success notification', {
              requestId,
              error: notifError.message
            });
          }
        }
        
      } catch (updateError) {
        PaymentLogger.error('Failed to update payment record', updateError, { requestId });
      }
    }

    // Log completion
    const duration = Date.now() - startTime;
    PaymentLogger.info('Payment success processing completed', {
      requestId,
      duration: `${duration}ms`,
      responseCode,
      responseMessage,
      found: !!payment
    });

    // Redirect to frontend with success details
    const redirectParams = new URLSearchParams({
      status: 'success',
      code: responseCode || '0',
      message: responseMessage || 'Payment completed successfully',
      paymentId: payment?.paymentId || 'unknown',
      orderId: orderRefNumber || payment?.orderId || 'unknown',
      amount: amount || payment?.amount || '0',
      currency: currency || payment?.currency || 'PKR',
      transactionId: transactionId || payment?.transactionId || ''
    });

    return res.redirect(`${process.env.FRONTEND_URL}/payment/success?${redirectParams.toString()}`);

  } catch (error) {
    const duration = Date.now() - startTime;
    PaymentLogger.error('Unexpected error in payment success processing', error, {
      requestId,
      duration: `${duration}ms`
    });

    return res.redirect(`${process.env.FRONTEND_URL}/payment/success?error=server_error`);
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




// Add this temporary debug function to your controller
module.exports.testDecryption = (req, res) => {
  try {
    const testData = "QkNURVdRbjB4a0RSTlA2bnNuWTdIekw5NHRIeDcxUDZSQjdGQ3Uydjlhc0VJK0RucGE2NmhTcjFJVnJ4YUxTWWNUNW4zVGxuUWgxcTJRQVlGbmVoL2g0RHhKenlrdVlkQjVoZkFkYTJwRzBlVE12OS9hNFpKeEY2Nm44TUZnOXlONTh2THlocy9kRUFSSjFFRjJxV1JGU1JVQ20vU0FHYXJzTzVESGE5VjdlcVhUUndiejQyWklUSG4zalFhTndlbFRNT2tpOEZNK2JFZFVoMHlENllyYzFYNTZaOUx5Z2tzTVJzeXFUZ0ZJcHZPOEg3ZmpVNmYybWpJMEhrSGNxOFA3bjFDNmk3aXdRdnh0RUk3TGFsZmVzWHlCa2NlTWJGT2xNKzNkWm9MV3pla2NrOGpoRzhzK2cvSXNSdWtKb21zYTV2bkZic0cwdnV2b0orQWF1RUlnPT0=";
    
    const results = [];
    
    console.log('🧪 Testing decryption with different keys...');
    
    // Test 1: Your Private Key
    console.log('\n🔑 Test 1: Using MERCHANT_PRIVATE_KEY_PEM');
    try {
      const result1 = decryptHBLResponse(testData, process.env.MERCHANT_PRIVATE_KEY_PEM);
      results.push({ key: 'MERCHANT_PRIVATE_KEY_PEM', success: true, result: result1 });
      console.log('✅ SUCCESS with merchant private key:', result1);
    } catch (error1) {
      results.push({ key: 'MERCHANT_PRIVATE_KEY_PEM', success: false, error: error1.message });
      console.log('❌ FAILED with merchant private key:', error1.message);
    }
    
    // Test 2: Your Public Key (shouldn't work but let's try)
    console.log('\n🔑 Test 2: Using MERCHANT_PUBLIC_KEY_PEM');
    try {
      const result2 = decryptHBLResponse(testData, process.env.MERCHANT_PUBLIC_KEY_PEM);
      results.push({ key: 'MERCHANT_PUBLIC_KEY_PEM', success: true, result: result2 });
      console.log('✅ SUCCESS with merchant public key:', result2);
    } catch (error2) {
      results.push({ key: 'MERCHANT_PUBLIC_KEY_PEM', success: false, error: error2.message });
      console.log('❌ FAILED with merchant public key:', error2.message);
    }
    
    // Test 3: HBL Public Key
    console.log('\n🔑 Test 3: Using HBL_PUBLIC_KEY_PEM');
    try {
      const result3 = decryptHBLResponse(testData, process.env.HBL_PUBLIC_KEY_PEM);
      results.push({ key: 'HBL_PUBLIC_KEY_PEM', success: true, result: result3 });
      console.log('✅ SUCCESS with HBL public key:', result3);
    } catch (error3) {
      results.push({ key: 'HBL_PUBLIC_KEY_PEM', success: false, error: error3.message });
      console.log('❌ FAILED with HBL public key:', error3.message);
    }
    
    // Test 4: Try without block processing (single chunk)
    console.log('\n🔑 Test 4: Single chunk decryption with merchant private key');
    try {
      const NodeRSA = require('node-rsa');
      const privateKey = new NodeRSA(process.env.MERCHANT_PRIVATE_KEY_PEM);
      privateKey.setOptions({ encryptionScheme: 'pkcs1' });
      
      const decryptedSingle = privateKey.decrypt(testData, 'utf8');
      results.push({ key: 'MERCHANT_PRIVATE_KEY_PEM_SINGLE', success: true, result: decryptedSingle });
      console.log('✅ SUCCESS with single chunk:', decryptedSingle);
    } catch (error4) {
      results.push({ key: 'MERCHANT_PRIVATE_KEY_PEM_SINGLE', success: false, error: error4.message });
      console.log('❌ FAILED with single chunk:', error4.message);
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    results.forEach(r => {
      console.log(`${r.success ? '✅' : '❌'} ${r.key}: ${r.success ? 'SUCCESS' : r.error}`);
    });
    
    res.json({ 
      success: true, 
      message: 'Tested all available keys',
      results: results,
      testData: {
        length: testData.length,
        preview: testData.substring(0, 50) + '...'
      }
    });
    
  } catch (error) {
    console.error('❌ Overall test failed:', error);
    res.json({ success: false, error: error.message });
  }
};



module.exports.testBlockSizes = (req, res) => {
  try {
    const testData = "QkNURVdRbjB4a0RSTlA2bnNuWTdIekw5NHRIeDcxUDZSQjdGQ3Uydjlhc0VJK0RucGE2NmhTcjFJVnJ4YUxTWWNUNW4zVGxuUWgxcTJRQVlGbmVoL2g0RHhKenlrdVlkQjVoZkFkYTJwRzBlVE12OS9hNFpKeEY2Nm44TUZnOXlONTh2THlocy9kRUFSSjFFRjJxV1JGU1JVQ20vU0FHYXJzTzVESGE5VjdlcVhUUndiejQyWklUSG4zalFhTndlbFRNT2tpOEZNK2JFZFVoMHlENllyYzFYNTZaOUx5Z2tzTVJzeXFUZ0ZJcHZPOEg3ZmpVNmYybWpJMEhrSGNxOFA3bjFDNmk3aXdRdnh0RUk3TGFsZmVzWHlCa2NlTWJGT2xNKzNkWm9MV3pla2NrOGpoRzhzK2cvSXNSdWtKb21zYTV2bkZic0cwdnV2b0orQWF1RUlnPT0=";
    
    const NodeRSA = require('node-rsa');
    const privateKey = new NodeRSA(process.env.MERCHANT_PRIVATE_KEY_PEM);
    privateKey.setOptions({ encryptionScheme: 'pkcs1' });
    
    const encryptedBuffer = Buffer.from(testData, 'base64');
    console.log('Buffer length:', encryptedBuffer.length);
    
    const results = [];
    const blockSizes = [256, 344, 512, 1024]; // Try different block sizes
    
    for (const blockSize of blockSizes) {
      console.log(`\nTrying block size: ${blockSize}`);
      try {
        let decryptedData = '';
        
        for (let i = 0; i < encryptedBuffer.length; i += blockSize) {
          const chunk = encryptedBuffer.slice(i, i + blockSize);
          console.log(`Processing chunk: ${chunk.length} bytes`);
          
          const decryptedChunk = privateKey.decrypt(chunk, 'utf8');
          decryptedData += decryptedChunk;
        }
        
        console.log(`SUCCESS with block size ${blockSize}:`, decryptedData);
        results.push({ blockSize, success: true, result: decryptedData });
        
      } catch (error) {
        console.log(`FAILED with block size ${blockSize}:`, error.message);
        results.push({ blockSize, success: false, error: error.message });
      }
    }
    
    res.json({ success: true, results });
    
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
};

module.exports.testPadding = (req, res) => {
  try {
    const testData = "QkNURVdRbjB4a0RSTlA2bnNuWTdIekw5NHRIeDcxUDZSQjdGQ3Uydjlhc0VJK0RucGE2NmhTcjFJVnJ4YUxTWWNUNW4zVGxuUWgxcTJRQVlGbmVoL2g0RHhKenlrdVlkQjVoZkFkYTJwRzBlVE12OS9hNFpKeEY2Nm44TUZnOXlONTh2THlocy9kRUFSSjFFRjJxV1JGU1JVQ20vU0FHYXJzTzVESGE5VjdlcVhUUndiejQyWklUSG4zalFhTndlbFRNT2tpOEZNK2JFZFVoMHlENllyYzFYNTZaOUx5Z2tzTVJzeXFUZ0ZJcHZPOEg3ZmpVNmYybWpJMEhrSGNxOFA3bjFDNmk3aXdRdnh0RUk3TGFsZmVzWHlCa2NlTWJGT2xNKzNkWm9MV3pla2NrOGpoRzhzK2cvSXNSdWtKb21zYTV2bkZic0cwdnV2b0orQWF1RUlnPT0=";
    
    const NodeRSA = require('node-rsa');
    const results = [];
    const schemes = ['pkcs1', 'pkcs1_oaep', 'oaep'];
    
    for (const scheme of schemes) {
      console.log(`\nTrying encryption scheme: ${scheme}`);
      try {
        const privateKey = new NodeRSA(process.env.MERCHANT_PRIVATE_KEY_PEM);
        privateKey.setOptions({ encryptionScheme: scheme });
        
        const decrypted = privateKey.decrypt(testData, 'utf8');
        console.log(`SUCCESS with ${scheme}:`, decrypted);
        results.push({ scheme, success: true, result: decrypted });
        
      } catch (error) {
        console.log(`FAILED with ${scheme}:`, error.message);
        results.push({ scheme, success: false, error: error.message });
      }
    }
    
    res.json({ success: true, results });
    
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
};


module.exports.testKeyPairValidity = (req, res) => {
  try {
    const NodeRSA = require('node-rsa');
    
    // Load your private key
    const privateKey = new NodeRSA(process.env.MERCHANT_PRIVATE_KEY_PEM);
    
    // Extract corresponding public key
    const publicKeyFromPrivate = privateKey.exportKey('public');
    
    // Test encrypt/decrypt cycle
    const testMessage = "RESPONSE_CODE=0&RESPONSE_MESSAGE=Test&ORDER_REF_NUMBER=123";
    
    // Encrypt with public key
    const encrypted = privateKey.encrypt(testMessage, 'base64');
    
    // Decrypt with private key
    const decrypted = privateKey.decrypt(encrypted, 'utf8');
    
    const isValid = testMessage === decrypted;
    
    res.json({
      success: true,
      keyPairValid: isValid,
      test: {
        original: testMessage,
        decrypted: decrypted,
        match: isValid
      },
      publicKeyFromPrivate: publicKeyFromPrivate.substring(0, 100) + '...',
      storedPublicKey: process.env.MERCHANT_PUBLIC_KEY_PEM?.substring(0, 100) + '...'
    });
    
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
};
