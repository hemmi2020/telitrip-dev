const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authUser } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validateRequest } = require('../middlewares/validation.middleware');

// Create payment session for HBLPay
router.post('/create-session', [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('bookingId').notEmpty().withMessage('Booking ID is required'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
], authUser, validateRequest, paymentController.createPaymentSession);

// Verify payment after HBLPay callback
router.post('/verify', [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('paymentStatus').notEmpty().withMessage('Payment status is required'),
], authUser, validateRequest, paymentController.verifyPayment);

// Get payment history
router.get('/history', authUser, paymentController.getPaymentHistory);

// Get payment details
router.get('/:paymentId', authUser, paymentController.getPaymentDetails);

// Process refund
router.post('/:paymentId/refund', [
  body('reason').optional().isLength({ min: 3 }).withMessage('Reason must be at least 3 characters'),
], authUser, validateRequest, paymentController.processRefund);

module.exports = router;