const crypto = require('crypto');
const paymentModel = require('../models/payment.model');
const bookingModel = require('../models/booking.model');
const ApiResponse = require('../utils/response.util');
const { asyncErrorHandler } = require('../middlewares/errorHandler.middleware');
const notificationService = require('../services/notification.service');

// HBLPay Configuration
const HBLPAY_USER_ID = process.env.HBLPAY_USER_ID;
const HBLPAY_PASSWORD = process.env.HBLPAY_PASSWORD;
const HBLPAY_PUBLIC_KEY = process.env.HBLPAY_PUBLIC_KEY;
const HBLPAY_SANDBOX_URL = 'https://testpaymentapi.hbl.com/hblpay/api/checkout';
const HBLPAY_PRODUCTION_URL = 'https://digitalbankingportal.hbl.com/hostedcheckout/api/checkout';

// Encrypt sensitive data for HBLPay
function encryptData(data, publicKey) {
  const buffer = Buffer.from(data, 'utf8');
  const encrypted = crypto.publicEncrypt({
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }, buffer);
  return encrypted.toString('base64');
}

// Create payment session
module.exports.createPaymentSession = asyncErrorHandler(async (req, res) => {
  const { amount, bookingId, currency = 'PKR' } = req.body;
  const userId = req.user._id;

  // Validate booking exists and belongs to user
  const booking = await bookingModel.findOne({ 
    $or: [{ _id: bookingId }, { bookingId: bookingId }], 
    userId 
  });

  if (!booking) {
    return ApiResponse.notFound(res, 'Booking not found');
  }

  if (booking.paymentStatus === 'paid') {
    return ApiResponse.badRequest(res, 'Booking is already paid');
  }

  // Generate unique payment ID
  const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

  // Prepare HBLPay request data
  const paymentData = {
    USER_ID: HBLPAY_USER_ID,
    PASSWORD: HBLPAY_PASSWORD,
    RETURN_URL: `${process.env.FRONTEND_URL}/payment/success`,
    CANCEL_URL: `${process.env.FRONTEND_URL}/payment/cancel`,
    CHANNEL: 'Web',
    TYPE_ID: 'ECOM',
    SUBTOTAL: amount,
    ITEM_NAME: `Hotel Booking - ${booking.hotelName}`,
    QUANTITY: 1,
    UNIT_PRICE: amount,
    CATEGORY: 'Hotel',
    SUB_CATEGORY: 'Accommodation',
    CURRENCY: currency,
    REFERENCE_NUMBER: paymentId,
    CUSTOMER_EMAIL: req.user.email,
    CUSTOMER_PHONE: req.user.phone || '',
    ADDITIONAL_DATA: {
      BOOKING_ID: booking.bookingId,
      USER_NAME: `${req.user.fullname.firstname} ${req.user.fullname.lastname}`,
      HOTEL_NAME: booking.hotelName,
      CHECK_IN: booking.checkIn.toISOString().split('T')[0],
      CHECK_OUT: booking.checkOut.toISOString().split('T')[0]
    }
  };

  try {
    // Call HBLPay API
    const response = await fetch(process.env.NODE_ENV === 'production' ? HBLPAY_PRODUCTION_URL : HBLPAY_SANDBOX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData)
    });

    const hblResponse = await response.json();

    if (hblResponse.SESSION_ID) {
      // Update payment with session ID
      payment.transactionId = hblResponse.SESSION_ID;
      await payment.save();

      return ApiResponse.success(res, {
        sessionId: hblResponse.SESSION_ID,
        paymentUrl: `${process.env.NODE_ENV === 'production' ? 'https://digitalbankingportal.hbl.com' : 'https://testpaymentapi.hbl.com'}/HBLPay/Site/index.html#/checkout?data=${hblResponse.SESSION_ID}`,
        paymentId: payment.paymentId
      }, 'Payment session created successfully');

    } else {
      return ApiResponse.error(res, 'Failed to create payment session', 500);
    }

  } catch (error) {
    console.error('HBLPay API Error:', error);
    return ApiResponse.error(res, 'Payment gateway error', 500);
  }
});

// Verify payment
module.exports.verifyPayment = asyncErrorHandler(async (req, res) => {
  const { sessionId, paymentStatus } = req.body;
  const userId = req.user._id;

  const payment = await paymentModel.findOne({ 
    transactionId: sessionId,
    userId 
  });

  if (!payment) {
    return ApiResponse.notFound(res, 'Payment not found');
  }

  const booking = await bookingModel.findById(payment.bookingId);

  if (paymentStatus === 'SUCCESS' || paymentStatus === 'COMPLETED') {
    // Update payment status
    payment.status = 'completed';
    await payment.save();

    // Update booking status
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    await booking.save();

    // Send confirmation notification
    await notificationService.sendBookingNotification(
      userId, 
      'bookingConfirmation', 
      { ...booking.toObject(), userDetails: req.user }
    );

    return ApiResponse.success(res, {
      payment,
      booking
    }, 'Payment verified successfully');

  } else {
    // Payment failed
    payment.status = 'failed';
    await payment.save();

    booking.paymentStatus = 'failed';
    await booking.save();

    return ApiResponse.error(res, 'Payment verification failed', 400);
  }
});

// Get payment history
module.exports.getPaymentHistory = asyncErrorHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, status } = req.query;

  const query = { userId };
  if (status) query.status = status;

  const payments = await paymentModel
    .find(query)
    .populate('bookingId', 'bookingId hotelName roomName checkIn checkOut')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await paymentModel.countDocuments(query);

  return ApiResponse.paginated(res, payments, {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    pages: Math.ceil(total / limit)
  });
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