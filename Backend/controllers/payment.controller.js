const crypto = require('crypto');
const fetch = require('node-fetch');
const paymentModel = require('../models/payment.model');
const bookingModel = require('../models/booking.model');
const ApiResponse = require('../utils/response.util');
const { asyncErrorHandler } = require('../middlewares/errorHandler.middleware');
const notificationService = require('../services/notification.service');

// HBLPay Configuration
const HBLPAY_USER_ID = process.env.HBLPAY_USER_ID;
const HBLPAY_PASSWORD = process.env.HBLPAY_PASSWORD;
const HBL_PUBLIC_KEY = process.env.HBL_PUBLIC_KEY_PEM;
const HBL_SANDBOX_URL = process.env.HBL_SANDBOX_API_URL;
const HBL_PRODUCTION_URL = process.env.HBL_PRODUCTION_API_URL;
const HBL_SANDBOX_REDIRECT = process.env.HBL_SANDBOX_REDIRECT_URL;
const HBL_PRODUCTION_REDIRECT = process.env.HBL_PRODUCTION_REDIRECT_URL;
const HBL_CHANNEL = process.env.HBL_CHANNEL || 'HBLPay_Teli_Website';
const HBL_TYPE_ID = process.env.HBL_TYPE_ID || 'ECOM';

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';

// ✅ FIXED: Generate payment ID that matches the schema validation pattern
function generatePaymentId() {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8).toLowerCase(); // ✅ Force lowercase
  return `PAY_${timestamp}_${randomStr}`;
}

// ✅ FIXED: Generate order ID
function generateOrderId() {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 6).toLowerCase();
  return `ORD_${timestamp}_${randomStr}`;
}

// RSA Encryption function for sensitive data
function encryptSensitiveData(data) {
  if (!HBL_PUBLIC_KEY) {
    throw new Error('HBL public key not configured');
  }
  
  try {
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt({
      key: HBL_PUBLIC_KEY,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    }, buffer);
    return encrypted.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

// Build HBLPay request payload
const buildHBLPayRequest = (paymentData, userId) => {
  const { amount, currency, bookingData, userData, orderId } = paymentData;

  // Build return URLs
  const returnUrl = isProduction 
    ? `${process.env.FRONTEND_URL}/payment/success`
    : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success`;
  
  const cancelUrl = isProduction
    ? `${process.env.FRONTEND_URL}/payment/cancel` 
    : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/cancel`;

  return {
    USER_ID: HBLPAY_USER_ID,
    PASSWORD: HBLPAY_PASSWORD,
    RETURN_URL: returnUrl,
    CANCEL_URL: cancelUrl,
    CHANNEL: HBL_CHANNEL,
    TYPE_ID: HBL_TYPE_ID,
    ORDER: {
      DISCOUNT_ON_TOTAL: "0",
      SUBTOTAL: amount.toFixed(2),
      OrderSummaryDescription: bookingData.items.map(item => 
        `${item.name} x${item.quantity}`
      ).join(', ')
    },
    SHIPPING_DETAIL: {
      NAME: `${userData.firstName} ${userData.lastName}`,
      ICON_PATH: null,
      DELIVERY_DAYS: "1",
      SHIPPING_COST: "0"
    },
    ADDITIONAL_DATA: {
      REFERENCE_NUMBER: orderId,
      CUSTOMER_ID: userId.toString(),
      CURRENCY: currency,
      BILL_TO_FORENAME: userData.firstName,
      BILL_TO_SURNAME: userData.lastName,
      BILL_TO_EMAIL: userData.email,
      BILL_TO_PHONE: userData.phone,
      BILL_TO_ADDRESS_LINE1: userData.address,
      BILL_TO_ADDRESS_CITY: userData.city,
      BILL_TO_ADDRESS_STATE: userData.state,
      BILL_TO_ADDRESS_COUNTRY: userData.country,
      BILL_TO_ADDRESS_POSTAL_CODE: userData.postalCode || '',
      SHIP_TO_FORENAME: userData.firstName,
      SHIP_TO_SURNAME: userData.lastName,
      SHIP_TO_EMAIL: userData.email,
      SHIP_TO_PHONE: userData.phone,
      SHIP_TO_ADDRESS_LINE1: userData.address,
      SHIP_TO_ADDRESS_CITY: userData.city,
      SHIP_TO_ADDRESS_STATE: userData.state,
      SHIP_TO_ADDRESS_COUNTRY: userData.country,
      SHIP_TO_ADDRESS_POSTAL_CODE: userData.postalCode || '',
      // Merchant Defined Data for HBL
      MDD1: userData.firstName,
      MDD2: userData.lastName,
      MDD3: userData.email,
      MDD4: userData.phone,
      MDD5: userData.address,
      MDD6: userData.city,
      MDD7: userData.state,
      MDD8: userData.country,
      MDD9: currency,
      MDD10: bookingData.items.length.toString(),
      MDD11: bookingData.checkIn || '',
      MDD12: bookingData.checkOut || '',
      MDD13: 'Hotel Booking',
      MDD14: orderId,
      MDD15: bookingData.checkIn || '',
      MDD16: bookingData.checkOut || '',
      MDD17: 'Hotel',
      MDD18: userData.phone || userData.email || '',
      MDD19: 'PK',
      MDD20: 'N'
    }
  };
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
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Telitrip-HBLPay-Integration/1.0'
      },
      body: JSON.stringify(requestData),
      timeout: 30000
    });

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
      sessionId: hblResponse.SESSION_ID,
      status: hblResponse.STATUS || 'Unknown',
      hasSessionId: !!hblResponse.SESSION_ID
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
  return `${baseUrl}${sessionId}`;
};


// Create HBLPay payment session
module.exports.initiateHBLPayPayment = asyncErrorHandler(async (req, res) => {
  const { bookingData, userData, amount, currency = 'PKR', orderId, bookingId } = req.body;
  const userId = req.user._id;

  console.log('🚀 Initiating HBLPay payment:', {
    userId: userId.toString(),
    amount,
    currency,
    orderId: orderId || 'auto-generated',
    bookingId, // ✅ Log the bookingId
    userEmail: userData?.email
  });

  // ✅ ENHANCED VALIDATION
  if (!amount || amount <= 0) {
    return ApiResponse.error(res, 'Invalid payment amount', 400);
  }

  if (!userData || !userData.email || !userData.firstName) {
    return ApiResponse.error(res, 'Invalid user data - email and name required', 400);
  }

  if (!bookingData || !bookingData.items || bookingData.items.length === 0) {
    return ApiResponse.error(res, 'Invalid booking data - items required', 400);
  }

  // 🔥 ADD BOOKING VALIDATION
  if (!bookingId) {
    return ApiResponse.error(res, 'Booking ID is required for payment processing', 400);
  }

  // Verify booking exists and belongs to user
  let bookingRecord = null;
  if (bookingId) {
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
  }

  try {
    // Generate order ID if not provided
    const finalOrderId = orderId || generateOrderId();
    
    // ✅ IMPROVED PAYMENT ID GENERATION (ensure it matches your schema validation)
    const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // ✅ FIXED: Create payment record with bookingId
    const payment = new paymentModel({
      paymentId,
      userId,
      bookingId: bookingRecord?._id, // ✅ Include the booking ID
      amount,
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

    // Build HBLPay request
    const hblRequest = buildHBLPayRequest({
      bookingData,
      userData,
      amount,
      currency,
      orderId: finalOrderId
    }, userId);

    // Call HBLPay API
    const hblResponse = await callHBLPayAPI(hblRequest);

    // Check for SESSION_ID
    if (!hblResponse.SESSION_ID) {
      await payment.updateOne({
        status: 'failed',
        failureReason: 'NO_SESSION_ID',
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });
      
      console.error('❌ No SESSION_ID in HBLPay response:', hblResponse);
      return ApiResponse.error(res, 'Failed to create payment session - No SESSION_ID received', 502);
    }

    // Update payment with session ID
    await payment.updateOne({
      sessionId: hblResponse.SESSION_ID,
      transactionId: hblResponse.SESSION_ID,
      gatewayResponse: hblResponse,
      updatedAt: new Date()
    });

    // Build redirect URL
    const paymentUrl = buildRedirectUrl(hblResponse.SESSION_ID);

    console.log('✅ Payment session created successfully:', {
      paymentId,
      sessionId: hblResponse.SESSION_ID,
      paymentUrl,
      bookingId: bookingRecord?._id
    });

    return ApiResponse.success(res, {
      sessionId: hblResponse.SESSION_ID,
      paymentUrl,
      paymentId,
      orderId: finalOrderId,
      amount,
      currency,
      expiresAt: payment.expiresAt,
      bookingId: bookingRecord?._id
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
    // Process webhook (similar to callback but for server-to-server notifications)
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
        // Update payment status based on webhook
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

// Process refund (placeholder - requires HBLPay refund API)
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

    // TODO: Implement HBLPay refund API call
    // For now, just update the payment record
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