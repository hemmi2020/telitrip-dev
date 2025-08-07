const bookingModel = require('../models/booking.model');

// Generate unique booking ID
const generateBookingId = () => {
  const prefix = 'ORD-';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

module.exports.createBooking = async (bookingData) => {
  const bookingId = generateBookingId();
  
  const booking = new bookingModel({
    ...bookingData,
    bookingId
  });
  
  return await booking.save();
};

module.exports.updateBookingStatus = async (bookingId, status) => {
  return await bookingModel.findOneAndUpdate(
    { $or: [{ _id: bookingId }, { bookingId }] },
    { status },
    { new: true }
  );
};

module.exports.getUpcomingBookings = async (userId) => {
  const today = new Date();
  return await bookingModel.find({
    userId,
    checkIn: { $gte: today },
    status: { $in: ['confirmed', 'upcoming'] }
  }).sort({ checkIn: 1 });
};