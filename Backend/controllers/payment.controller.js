const crypto = require('crypto');
const paymentModel = require('../models/payment.model').default;
const bookingModel = require('../models/booking.model');
const ApiResponse = require('../utils/response.util');
const { asyncErrorHandler } = require('../middlewares/errorHandler.middleware');
const notificationService = require('../services/notification.service');

// HBLPay Configuration
const HBLPAY_USER_ID = process.env.HBLPAY_USER_ID; // Not HBL_MERCHANT_ID
const HBLPAY_PASSWORD = process.env.HBLPAY_PASSWORD;
const HBL_PUBLIC_KEY = process.env.HBL_PUBLIC_KEY_PEM;
const HBL_SANDBOX_URL = process.env.HBL_SANDBOX_API_URL;
const HBL_PRODUCTION_URL = process.env.HBL_PRODUCTION_API_URL;
const HBL_SANDBOX_REDIRECT = process.env.HBL_SANDBOX_REDIRECT_URL;
const HBL_PRODUCTION_REDIRECT = process.env.HBL_PRODUCTION_REDIRECT_URL;

// RSA Encryption function for sensitive data - CORRECTED
function encryptSensitiveData(data) {
  try {
    // HBLPay requires RSA 4096 encryption with PKCS1 padding
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

// Create payment session
module.exports.createPaymentSession = asyncErrorHandler(async (req, res) => {
  const { amount, bookingId, currency = 'PKR' } = req.body;
  const userId = req.user._id;

  // Validate booking exists and belongs to user
  const booking = await bookingModel.findOne({
    $or: [{ _id: bookingId }, { bookingId: bookingId }],
    userId
  }).populate('userId', 'fullname email phone');

  if (!booking) {
    return ApiResponse.notFound(res, 'Booking not found');
  }

  if (booking.paymentStatus === 'paid') {
    return ApiResponse.badRequest(res, 'Booking is already paid');
  }

  // Generate unique payment ID
  const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Create payment record
  const payment = await paymentModel.create({
    userId,
    bookingId: booking._id,
    paymentId,
    amount,
    currency,
    method: 'HBLPay',
    status: 'pending'
  });

  // Prepare HBLPay request data according to PDF specifications
  const paymentData = {
    // AUTHENTICATION FIELDS (Required)
    USER_ID: HBLPAY_USER_ID,
    PASSWORD: HBLPAY_PASSWORD,
    RETURN_URL: `${process.env.FRONTEND_URL}/payment/success?paymentId=${paymentId}`,
    CANCEL_URL: `${process.env.FRONTEND_URL}/payment/cancel?paymentId=${paymentId}`,
    CHANNEL: process.env.HBL_CHANNEL || 'HOTEL_WEB',
    TYPE_ID: process.env.HBL_TYPE_ID || 'ECOM',

    // ORDER SUMMARY (Required) - FIXED: Nested under ORDER
    ORDER: {
      DISCOUNT_ON_TOTAL: 0,
      SUBTOTAL: amount,
      OrderSummaryDescription: [
        {
          ITEM_NAME: `Hotel Booking - ${booking.hotelName || 'Hotel Reservation'}`,
          QUANTITY: 1,
          UNIT_PRICE: amount,
          OLD_PRICE: null,
          CATEGORY: 'Hotel',
          SUB_CATEGORY: 'Accommodation'
        }
      ]
    },

    // SHIPPING DETAIL (Optional but recommended)
    SHIPPING_DETAIL: {
      NAME: 'Digital Service',
      ICON_PATH: null,
      DELIEVERY_DAYS: 0,
      SHIPPING_COST: 0
    },


    // ADDITIONAL DATA (Required) - FIXED: Nested under ADDITIONAL_DATA
    ADDITIONAL_DATA: {
      REFERENCE_NUMBER: paymentId,
      CUSTOMER_ID: booking.userId?._id?.toString() || null,
      CURRENCY: currency,
      BILL_TO_FORENAME: booking.userId?.fullname?.firstname || '',
      BILL_TO_SURNAME: booking.userId?.fullname?.lastname || '',
      BILL_TO_EMAIL: booking.userId?.email || 'guest@example.com',
      BILL_TO_PHONE: booking.userId?.phone || '000000000',
      BILL_TO_ADDRESS_LINE: 'N/A',
      BILL_TO_ADDRESS_CITY: 'Karachi',
      BILL_TO_ADDRESS_STATE: 'Sindh',
      BILL_TO_ADDRESS_COUNTRY: 'PK',
      BILL_TO_ADDRESS_POSTAL_CODE: '74000',

      // Copy billing to shipping
      SHIP_TO_FORENAME: booking.userId?.fullname?.firstname || '',
      SHIP_TO_SURNAME: booking.userId?.fullname?.lastname || '',
      SHIP_TO_EMAIL: booking.userId?.email || 'guest@example.com',
      SHIP_TO_PHONE: booking.userId?.phone || '000000000',
      SHIP_TO_ADDRESS_LINE: 'N/A',
      SHIP_TO_ADDRESS_CITY: 'Karachi',
      SHIP_TO_ADDRESS_STATE: 'Sindh',
      SHIP_TO_ADDRESS_COUNTRY: 'PK',
      SHIP_TO_ADDRESS_POSTAL_CODE: '74000',

      // MERCHANT DEFINED DATA (Optional) - FIXED: Nested under MerchantFields
      MerchantFields: {
        MDD1: process.env.HBL_CHANNEL || 'HOTEL_WEB',
        MDD2: 'N',  // 3D Secure Registration
        MDD3: 'Hotel',  // Product Category
        MDD4: 'Hotel Booking',  // Product Name
        MDD5: booking.userId ? 'Y' : 'N',  // Previous Customer
        MDD6: 'Digital',  // Shipping Method
        MDD7: '1',  // Number Of Items Sold
        MDD8: 'PK',  // Product Shipping Country Name
        MDD9: '0',  // Hours Till Departure
        MDD10: 'Hotel',  // Flight Type (using for product type)
        MDD11: `${booking.checkIn} to ${booking.checkOut}`,  // Full Journey
        MDD12: 'N',  // 3rd Party Booking
        MDD13: booking.hotelName || 'Hotel Reservation',  // Hotel Name
        MDD14: new Date().toISOString().split('T')[0],  // Date of Booking
        MDD15: booking.checkIn ? booking.checkIn.toISOString().split('T')[0] : '',  // Check In Date
        MDD16: booking.checkOut ? booking.checkOut.toISOString().split('T')[0] : '',  // Check Out Date
        MDD17: 'Hotel',  // Product Type
        MDD18: booking.userId?.phone || booking.userId?.email || '',  // Customer ID
        MDD19: 'PK',  // Country Of Top-up
        MDD20: 'N'   // VIP Customer
      }
    }
  };

  try {
    console.log('Sending payment request to HBLPay:', {
      url: process.env.NODE_ENV === 'production' ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL,
      USER_ID: HBLPAY_USER_ID,
      amount: amount,
      orderId: orderId
    });


    // Call HBLPay API
    const response = await fetch(
      process.env.NODE_ENV === 'production' ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(paymentData)
      }
    );

    const responseText = await response.text();
    console.log('HBLPay Raw Response:', responseText);

    let hblResponse;
    try {
      hblResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse HBLPay response:', parseError);
      return ApiResponse.error(res, 'Invalid response from payment gateway', 500);
    }

    // Check for SESSION_ID in response (according to PDF)
    if (hblResponse.SESSION_ID) {
      // Update payment with session ID
      payment.sessionId = hblResponse.SESSION_ID;
      payment.transactionId = hblResponse.SESSION_ID;
      await payment.save();

      // Build redirect URL
      const redirectUrl = (process.env.NODE_ENV === 'production' ?
        HBL_PRODUCTION_REDIRECT : HBL_SANDBOX_REDIRECT) + hblResponse.SESSION_ID;

      return ApiResponse.success(res, {
        sessionId: hblResponse.SESSION_ID,
        paymentUrl: redirectUrl,
        paymentId: payment.paymentId,
        orderId: orderId,
        amount: amount,
        currency: currency
      }, 'Payment session created successfully');

    } else {
      console.error('No SESSION_ID in HBLPay response:', hblResponse);
      return ApiResponse.error(res, 'Failed to create payment session - No SESSION_ID received', 500);
    }

  } catch (error) {
    console.error('HBLPay API Error:', error);
    return ApiResponse.error(res, `Payment gateway error: ${error.message}`, 500);
  }
});

// Handle payment return/callback - NEW FUNCTION NEEDED
module.exports.handlePaymentReturn = asyncErrorHandler(async (req, res) => {
  const { SESSION_ID, PAYMENT_STATUS, REFERENCE_NUMBER } = req.query;

  console.log('HBLPay return callback:', req.query, req.body);

  try {
    // Find payment by session ID or reference number
    let payment = await paymentModel.findOne({
      $or: [
        { sessionId: SESSION_ID },
        { paymentId: REFERENCE_NUMBER },
        { transactionId: SESSION_ID }
      ]
    }).populate('bookingId');

    if (!payment) {
      console.error('Payment not found for SESSION_ID:', SESSION_ID);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?message=Payment not found`);
    }

    // Update payment status based on HBLPay response
    if (PAYMENT_STATUS === 'SUCCESS' || PAYMENT_STATUS === 'COMPLETED') {
      await payment.markAsCompleted({
        sessionId: SESSION_ID,
        paymentStatus: PAYMENT_STATUS,
        gatewayResponse: req.query || req.body
      });

      // Update booking payment status
      if (payment.bookingId) {
        await bookingModel.findByIdAndUpdate(payment.bookingId._id, {
          paymentStatus: 'paid',
          paidAt: new Date()
        });
      }

      // Send confirmation notification
      try {
        await notificationService.sendPaymentConfirmation(payment);
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }

      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?paymentId=${payment.paymentId}`);
    } else {
      // Payment failed
      await payment.markAsFailed('PAYMENT_FAILED', PAYMENT_STATUS || 'Unknown error', req.query || req.body);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?paymentId=${payment.paymentId}`);
    }

  } catch (error) {
    console.error('Payment callback error:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/payment/error?message=Processing error`);
  }
});


// Verify payment status - CORRECTED
module.exports.verifyPayment = asyncErrorHandler(async (req, res) => {
  const { sessionId, paymentId } = req.body;
  const userId = req.user._id;

  const payment = await paymentModel.findOne({
    $and: [
      { userId },
      {
        $or: [
          { sessionId },
          { paymentId }
        ]
      }
    ]
  }).populate('bookingId');

  if (!payment) {
    return ApiResponse.notFound(res, 'Payment not found');
  }

  return ApiResponse.success(res, {
    paymentId: payment.paymentId,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    createdAt: payment.createdAt,
    completedAt: payment.completedAt,
    booking: payment.bookingId
  }, 'Payment status retrieved');
});

// Get payment history
module.exports.getPaymentHistory = asyncErrorHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, status } = req.query;

  const query = { userId };
  if (status) query.status = status;

  const payments = await paymentModel.find(query)
    .populate('bookingId', 'bookingId hotelName checkIn checkOut')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await paymentModel.countDocuments(query);

  return ApiResponse.success(res, {
    payments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Payment history retrieved successfully');
});

// Get payment details
module.exports.getPaymentDetails = asyncErrorHandler(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user._id;

  const payment = await paymentModel
    .findOne({ paymentId, userId })
    .populate('bookingId');

  if (!payment) {
    return ApiResponse.notFound(res, 'Payment not found');
  }

  return ApiResponse.success(res, payment, 'Payment details retrieved');
});

// Process refund
module.exports.processRefund = asyncErrorHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  const payment = await paymentModel
    .findOne({ paymentId, userId })
    .populate('bookingId');

  if (!payment) {
    return ApiResponse.notFound(res, 'Payment not found');
  }

  if (payment.status !== 'completed') {
    return ApiResponse.badRequest(res, 'Only completed payments can be refunded');
  }

  if (payment.refundAmount > 0) {
    return ApiResponse.badRequest(res, 'Payment already refunded');
  }

  // Note: HBLPay doesn't have automated refund API
  // This would typically require manual processing or separate refund API calls
  await payment.markAsRefunded(payment.amount, reason);

  return ApiResponse.success(res, {
    paymentId: payment.paymentId,
    refundAmount: payment.amount,
    refundReason: reason,
    refundedAt: payment.refundedAt
  }, 'Refund processed successfully');
});

// Webhook handler for HBLPay notifications
module.exports.handleWebhook = asyncErrorHandler(async (req, res) => {
  console.log('HBLPay Webhook received:', req.body);

  const { SESSION_ID, PAYMENT_STATUS, REFERENCE_NUMBER, AMOUNT } = req.body;

  try {
    const payment = await paymentModel.findOne({
      $or: [
        { sessionId: SESSION_ID },
        { paymentId: REFERENCE_NUMBER }
      ]
    }).populate('bookingId');

    if (payment) {
      if (PAYMENT_STATUS === 'SUCCESS' || PAYMENT_STATUS === 'COMPLETED') {
        await payment.markAsCompleted(req.body);

        if (payment.bookingId) {
          await bookingModel.findByIdAndUpdate(payment.bookingId._id, {
            paymentStatus: 'paid',
            paidAt: new Date()
          });
        }
      } else if (PAYMENT_STATUS === 'FAILED' || PAYMENT_STATUS === 'CANCELLED') {
        await payment.markAsFailed('WEBHOOK_NOTIFICATION', PAYMENT_STATUS, req.body);
      }
    }

    // Always return success to HBLPay
    res.status(200).json({ status: 'received', message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(200).json({ status: 'error', message: 'Webhook processed with errors' });
  }
});