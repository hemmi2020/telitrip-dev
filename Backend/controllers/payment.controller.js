const crypto = require('crypto');
const paymentModel = require('../models/payment.model');
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
    CHANNEL: process.env.HBL_CHANNEL || 'WEB',
    TYPE_ID: process.env.HBL_TYPE_ID || 'ECOM',

    // ORDER SUMMARY (Required)
    SUBTOTAL: amount,
    DISCOUNT_ON_TOTAL: 0, // Optional

    // ORDER SUMMARY DESCRIPTION (Required)
    OrderSummaryDescription: [
      {
        ITEM_NAME: `Hotel Booking - ${booking.hotelName}`,
        QUANTITY: 1,
        UNIT_PRICE: amount,
        CATEGORY: 'Hotel',
        SUB_CATEGORY: 'Accommodation'
      }
    ],

    // SHIPPING DETAIL (Optional but recommended)
    SHIPPING_DETAIL: {
      NAME: 'Digital Service', // No physical shipping
      DELIVERY_DAYS: 0,
      SHIPPING_COST: 0
    },

    // ADDITIONAL DATA FIELDS (Optional)
    ORDER_ID: orderId,
    REFERENCE_NUMBER: paymentId,
    AMOUNT: amount,
    CURRENCY: currency,
    PAYMENT_METHOD: 'Multiple', // HBL supports Visa/Master/UnionPay/HBL Account

    // BILLING DETAILS (Optional but recommended)
    BILL_TO_FORENAME: booking.userId?.fullname?.firstname || '',
    BILL_TO_SURNAME: booking.userId?.fullname?.lastname || '',
    
    // MERCHANT DEFINED DATA (Optional)
    MERCHANT_DEFINED_DATA1: booking.bookingId,
    MERCHANT_DEFINED_DATA2: booking.hotelName,
    MERCHANT_DEFINED_DATA3: booking.checkIn.toISOString().split('T')[0],
    MERCHANT_DEFINED_DATA4: booking.checkOut.toISOString().split('T')[0],
    MERCHANT_DEFINED_DATA5: booking.guests.toString(),
    MERCHANT_DEFINED_DATA6: booking.userId?.email || '',
    MERCHANT_DEFINED_DATA7: booking.userId?.phone || '',
    MERCHANT_DEFINED_DATA8: booking.boardType || 'Room Only',
    MERCHANT_DEFINED_DATA9: booking.rateClass || 'NOR',
    MERCHANT_DEFINED_DATA10: booking.location || ''
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
      payment.transactionId = hblResponse.SESSION_ID;
      await payment.save();

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
  const { paymentId, status, sessionId } = req.query;

  if (!paymentId) {
    return ApiResponse.badRequest(res, 'Payment ID is required');
  }

  const payment = await paymentModel.findOne({ paymentId });
  if (!payment) {
    return ApiResponse.notFound(res, 'Payment not found');
  }

  const booking = await bookingModel.findById(payment.bookingId);

  // Update payment and booking status based on return
  if (status === 'success' || status === 'completed') {
    payment.status = 'completed';
    await payment.save();

    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    await booking.save();

    // Send confirmation notification
    await notificationService.sendBookingNotification(
      payment.userId, 
      'bookingConfirmation', 
      booking
    );

    return ApiResponse.success(res, {
      payment,
      booking,
      message: 'Payment completed successfully'
    });

  } else {
    payment.status = 'failed';
    await payment.save();

    return ApiResponse.error(res, 'Payment failed or cancelled', 400);
  }
});


// Verify payment status - CORRECTED
module.exports.verifyPayment = asyncErrorHandler(async (req, res) => {
  const { sessionId, paymentId } = req.body;
  const userId = req.user._id;

  const payment = await paymentModel.findOne({ 
    $or: [
      { transactionId: sessionId },
      { paymentId: paymentId }
    ],
    userId 
  });

  if (!payment) {
    return ApiResponse.notFound(res, 'Payment not found');
  }

  const booking = await bookingModel.findById(payment.bookingId);

  return ApiResponse.success(res, {
    payment: {
      id: payment.paymentId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      transactionId: payment.transactionId,
      createdAt: payment.createdAt
    },
    booking: {
      id: booking.bookingId,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      hotelName: booking.hotelName,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut
    }
  }, 'Payment status retrieved');
});

// Get payment history
module.exports.getPaymentHistory = asyncErrorHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  const payments = await paymentModel.find({ userId })
    .populate('bookingId', 'bookingId hotelName checkIn checkOut')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await paymentModel.countDocuments({ userId });

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

  // Create refund record
  const refund = await paymentModel.create({
    userId,
    bookingId: payment.bookingId._id,
    paymentId: `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount: -payment.amount,
    method: 'Refund',
    status: 'completed',
    transactionId: `refund_${payment.transactionId}`,
    currency: payment.currency
  });

  // Update original payment
  payment.status = 'refunded';
  await payment.save();

  // Update booking
  const booking = await bookingModel.findById(payment.bookingId._id);
  booking.paymentStatus = 'refunded';
  booking.status = 'cancelled';
  await booking.save();

  return ApiResponse.success(res, { refund, payment }, 'Refund processed successfully');
});