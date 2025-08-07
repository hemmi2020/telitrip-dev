const mongoose = require('mongoose');




const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  bookingId: {
    type: String,
    unique: true,
    required: true
  },
  hotelName: {
    type: String,
    required: true
  },
  roomName: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  guests: {
    type: Number,
    required: true,
    min: 1
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'upcoming'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  boardType: {
    type: String,
    enum: ['Room Only', 'Half Board', 'Full Board', 'All Inclusive'],
    default: 'Room Only'
  },
  rateClass: {
    type: String,
    enum: ['NOR', 'NRF', 'PRE'],
    default: 'NOR'
  }
}, {
  timestamps: true
});

const bookingModel = mongoose.model('booking', bookingSchema);

module.exports = bookingModel;
