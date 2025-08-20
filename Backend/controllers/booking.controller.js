const bookingModel = require('../models/booking.model');
const paymentModel = require('../models/payment.model');
const ApiResponse = require('../utils/response.util');
const DateUtil = require('../utils/date.util');
const { asyncErrorHandler } = require('../middlewares/errorHandler.middleware');
const notificationService = require('../services/notification.service');

// Generate unique booking ID
function generateBookingId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `BK${timestamp}${random}`.toUpperCase();
}

// Create booking
module.exports.createBooking = asyncErrorHandler(async (req, res) => {
  const {
    hotelName,
    roomName,
    location,
    checkIn,
    checkOut,
    guests,
    totalAmount,
    boardType = 'Room Only',
    rateClass = 'NOR'
  } = req.body;

  const userId = req.user._id;
  const bookingId = generateBookingId();

  // Create booking
  const booking = await bookingModel.create({
    userId,
    bookingId,
    hotelName,
    roomName,
    location,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    guests,
    totalAmount,
    boardType,
    rateClass,
    status: 'pending',
    paymentStatus: 'pending'
  });

  return ApiResponse.created(res, booking, 'Booking created successfully');
});

// Get user bookings
module.exports.getUserBookings = asyncErrorHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  const query = { userId };
  if (status) query.status = status;

  const bookings = await bookingModel
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add computed status based on dates
  const bookingsWithStatus = bookings.map(booking => ({
    ...booking,
    computedStatus: DateUtil.getBookingStatus(booking.checkIn, booking.checkOut, booking.status),
    daysToCheckIn: DateUtil.getDaysBetween(new Date(), booking.checkIn),
    duration: DateUtil.getDaysBetween(booking.checkIn, booking.checkOut)
  }));

  const total = await bookingModel.countDocuments(query);

  return ApiResponse.paginated(res, bookingsWithStatus, {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    pages: Math.ceil(total / limit)
  });
});

// Get booking details
module.exports.getBookingDetails = asyncErrorHandler(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;

  const booking = await bookingModel.findOne({
    $or: [{ _id: bookingId }, { bookingId: bookingId }],
    userId
  }).lean();

  if (!booking) {
    return ApiResponse.notFound(res, 'Booking not found');
  }

  // Get associated payments
  const payments = await paymentModel.find({ bookingId: booking._id });

  // Add computed fields
  const bookingWithDetails = {
    ...booking,
    computedStatus: DateUtil.getBookingStatus(booking.checkIn, booking.checkOut, booking.status),
    daysToCheckIn: DateUtil.getDaysBetween(new Date(), booking.checkIn),
    duration: DateUtil.getDaysBetween(booking.checkIn, booking.checkOut),
    payments,
    canCancel: booking.status !== 'cancelled' && booking.status !== 'completed' && 
               DateUtil.isUpcoming(booking.checkIn)
  };

  return ApiResponse.success(res, bookingWithDetails, 'Booking details retrieved');
});

// Update booking
module.exports.updateBooking = asyncErrorHandler(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;
  const updates = req.body;

  const booking = await bookingModel.findOne({
    $or: [{ _id: bookingId }, { bookingId: bookingId }],
    userId
  });

  if (!booking) {
    return ApiResponse.notFound(res, 'Booking not found');
  }

  if (booking.status === 'cancelled' || booking.status === 'completed') {
    return ApiResponse.badRequest(res, 'Cannot update cancelled or completed booking');
  }

  // Check if check-in date is not in the past
  if (updates.checkIn && DateUtil.isPast(updates.checkIn)) {
    return ApiResponse.badRequest(res, 'Cannot update to a past date');
  }

  // Update booking
  Object.assign(booking, updates);
  await booking.save();

  return ApiResponse.success(res, booking, 'Booking updated successfully');
});

// Cancel booking
module.exports.cancelBooking = asyncErrorHandler(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;

  const booking = await bookingModel.findOne({
    $or: [{ _id: bookingId }, { bookingId: bookingId }],
    userId
  });

  if (!booking) {
    return ApiResponse.notFound(res, 'Booking not found');
  }

  if (booking.status === 'cancelled') {
    return ApiResponse.badRequest(res, 'Booking is already cancelled');
  }

  if (booking.status === 'completed') {
    return ApiResponse.badRequest(res, 'Cannot cancel completed booking');
  }

  // Update booking status
  booking.status = 'cancelled';
  await booking.save();

  // Process refund if payment was made
  if (booking.paymentStatus === 'paid') {
    const payment = await paymentModel.findOne({ bookingId: booking._id, status: 'completed' });
    
    if (payment) {
      // Create refund record
      await paymentModel.create({
        userId,
        bookingId: booking._id,
        paymentId: `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: -payment.amount,
        method: 'Refund',
        status: 'completed',
        transactionId: `refund_${payment.transactionId}`,
        currency: payment.currency
      });

      // Update payment status
      payment.status = 'refunded'; 
      await payment.save();

      booking.paymentStatus = 'refunded';
      await booking.save();
    }
  }

  // Send cancellation notification
  await notificationService.sendBookingNotification(
    userId, 
    'bookingCancellation', 
    { ...booking.toObject(), userDetails: req.user }
  );

  return ApiResponse.success(res, booking, 'Booking cancelled successfully');
});