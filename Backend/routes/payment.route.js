const express = require('express');
const router = express.Router();
const { authUser } = require('../middlewares/auth.middleware');
const paymentController = require('../controllers/payment.controller');
const { body, query } = require('express-validator');
const { validateRequest } = require('../middlewares/validation.middleware');


// Validation middleware
const validatePaymentSession = [
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 1 })
    .withMessage('Amount must be greater than 0'),
  body('bookingId')
    .notEmpty()
    .withMessage('Booking ID is required'),
  body('currency')
    .optional()
    .isIn(['PKR', 'USD', 'EUR'])
    .withMessage('Currency must be PKR, USD, or EUR')
];

const validatePaymentVerification = [
  body('sessionId')
    .optional()
    .notEmpty()
    .withMessage('Session ID cannot be empty'),
  body('paymentId')
    .optional()
    .notEmpty() 
    .withMessage('Payment ID cannot be empty')
];

// Create payment session for HBLPay
router.post('/create-session', validatePaymentSession, authUser, validateRequest, paymentController.createPaymentSession);

// Verify payment after HBLPay callback
router.post('/verify',validatePaymentVerification , authUser, validateRequest, paymentController.verifyPayment);

// Get payment history
router.get('/history', authUser, paymentController.getPaymentHistory);

// Public routes for HBLPay callbacks (no auth required)
// These are called by HBLPay after payment completion
router.get('/return', paymentController.handlePaymentReturn);
router.post('/callback', paymentController.handlePaymentReturn); // Some gateways use POST

// Webhook route for HBLPay notifications (if supported)
// This should be called by HBLPay to notify about payment status changes
router.post('/webhook', (req, res) => {
  // Log the webhook data
  console.log('HBLPay Webhook received:', req.body);
  
  // Extract payment information
  const { SESSION_ID, PAYMENT_STATUS, REFERENCE_NUMBER } = req.body;
  
  // Update payment status in database based on webhook
  // This should be implemented based on HBLPay webhook specifications
  
  // Always return success to HBLPay
  res.status(200).json({ status: 'received' });
});


// Test route for payment gateway (development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/test-config', authUser, (req, res) => {
    res.json({
      HBLPAY_USER_ID: process.env.HBLPAY_USER_ID ? 'Set' : 'Not Set',
      HBLPAY_PASSWORD: process.env.HBLPAY_PASSWORD ? 'Set' : 'Not Set',
      HBL_PUBLIC_KEY: process.env.HBL_PUBLIC_KEY_PEM ? 'Set' : 'Not Set',
      SANDBOX_URL: process.env.HBL_SANDBOX_API_URL,
      PRODUCTION_URL: process.env.HBL_PRODUCTION_API_URL,
      ENVIRONMENT: process.env.NODE_ENV
    });
  });
}

// Get payment details
router.get('/:paymentId', authUser, paymentController.getPaymentDetails);

// Process refund
router.post('/:paymentId/refund', [
  body('reason').optional().isLength({ min: 3 }).withMessage('Reason must be at least 3 characters'),
], authUser, validateRequest, paymentController.processRefund);

module.exports = router;