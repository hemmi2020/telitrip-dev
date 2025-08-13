const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authUser } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validateRequest, validateBookingDates } = require('../middlewares/validation.middleware');

// Create booking
router.post('/create', [
  body('hotelName').notEmpty().withMessage('Hotel name is required'),
  body('roomName').notEmpty().withMessage('Room name is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('checkIn').isISO8601().withMessage('Valid check-in date is required'),
  body('checkOut').isISO8601().withMessage('Valid check-out date is required'),
  body('guests').isInt({ min: 1 }).withMessage('Guests must be at least 1'),
  body('totalAmount').isNumeric().withMessage('Total amount must be a number'),
], authUser, validateRequest, validateBookingDates, bookingController.createBooking);

// Get user bookings
router.get('/', authUser, bookingController.getUserBookings);

// Get booking details
router.get('/:bookingId', authUser, bookingController.getBookingDetails);

// Update booking
router.put('/:bookingId', [
  body('checkIn').optional().isISO8601().withMessage('Valid check-in date is required'),
  body('checkOut').optional().isISO8601().withMessage('Valid check-out date is required'),
  body('guests').optional().isInt({ min: 1 }).withMessage('Guests must be at least 1'),
], authUser, validateRequest, validateBookingDates, bookingController.updateBooking);

// Cancel booking
router.put('/:bookingId/cancel', authUser, bookingController.cancelBooking);

module.exports = router;