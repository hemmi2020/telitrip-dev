const express = require('express');
const router = express.Router();
const { authUser } = require('../middlewares/auth.middleware');
const paymentController = require('../controllers/payment.controller');
const { body, query, param } = require('express-validator');
const { validateRequest } = require('../middlewares/validation.middleware');


// Validation middleware
const validatePaymentSession = [
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 1 })
    .withMessage('Amount must be greater than 0')
    .custom((value) => {
      if (value > 1000000) {
        throw new Error('Amount cannot exceed 1,000,000');
      }
      return true;
    }),
  body('bookingId')
    .notEmpty()
    .withMessage('Booking ID is required')
    .isLength({ min: 3 })
    .withMessage('Invalid booking ID format'),
  body('currency')
    .optional()
    .isIn(['PKR', 'USD', 'EUR'])
    .withMessage('Currency must be PKR, USD, or EUR'),
    body('returnUrl')
    .optional()
    .isURL()
    .withMessage('Return URL must be a valid URL'),
  body('cancelUrl')
    .optional()
    .isURL()
    .withMessage('Cancel URL must be a valid URL')
];

const validatePaymentVerification = [
  body('sessionId')
    .optional()
    .notEmpty()
    .withMessage('Session ID cannot be empty')
    .isLength({ min: 10 })
    .withMessage('Invalid session ID format'),
  body('paymentId')
    .optional()
    .notEmpty()
    .withMessage('Payment ID cannot be empty')
    .matches(/^PAY_/)
    .withMessage('Invalid payment ID format')
];
const validatePaymentHistory = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['pending', 'completed', 'failed', 'cancelled', 'refunded'])
    .withMessage('Invalid status filter'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

const validateRefundRequest = [
  param('paymentId')
    .matches(/^PAY_/)
    .withMessage('Invalid payment ID format'),
  body('reason')
    .notEmpty()
    .withMessage('Refund reason is required')
    .isLength({ min: 3, max: 500 })
    .withMessage('Reason must be between 3 and 500 characters'),
  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Refund amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be greater than 0')
];


// ==================== PROTECTED ROUTES (Require Authentication) ====================

// Create payment session for HBLPay
router.post('/create-session', 
  validatePaymentSession, 
  authUser, 
  validateRequest, 
  paymentController.createPaymentSession
);

// Verify payment after HBLPay callback
router.post('/verify', 
  validatePaymentVerification, 
  authUser, 
  validateRequest, 
  paymentController.verifyPayment
);

// Get payment history
router.get('/history', 
  validatePaymentHistory,
  authUser, 
  validateRequest,
  paymentController.getPaymentHistory
);

// Get payment details by payment ID
router.get('/:paymentId', 
  param('paymentId').matches(/^PAY_/).withMessage('Invalid payment ID format'),
  authUser, 
  validateRequest,
  paymentController.getPaymentDetails
);

// Process refund
router.post('/:paymentId/refund', 
  validateRefundRequest,
  authUser, 
  validateRequest, 
  paymentController.processRefund
);

// Get payment statistics
router.get('/stats/:period', 
  param('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
  authUser,
  validateRequest,
  async (req, res) => {
    const { period = '30d' } = req.params;
    const userId = req.user._id;
    
    try {
      const paymentService = require('../services/payment.service');
      const stats = await paymentService.getPaymentStats(userId, period);
      
      const ApiResponse = require('../utils/response.util');
      return ApiResponse.success(res, stats, 'Payment statistics retrieved');
    } catch (error) {
      console.error('Payment stats error:', error);
      const ApiResponse = require('../utils/response.util');
      return ApiResponse.error(res, error.message, 500);
    }
  }
);


// ==================== PUBLIC ROUTES (No Authentication Required) ====================

// HBLPay return callback (GET) - Called by HBLPay after payment
router.get('/return', paymentController.handlePaymentReturn);

// HBLPay return callback (POST) - Some gateways use POST
router.post('/return', paymentController.handlePaymentReturn);

// HBLPay callback with query parameters
router.get('/callback', paymentController.handlePaymentReturn);

// HBLPay callback with POST data
router.post('/callback', paymentController.handlePaymentReturn);


// Webhook route for HBLPay notifications
router.post('/webhook', paymentController.handleWebhook);

// Health check route for payment gateway
router.get('/health', (req, res) => {
  const ApiResponse = require('../utils/response.util');
  
  try {
    const paymentService = require('../services/payment.service');
    paymentService.validateConfiguration();
    
    return ApiResponse.success(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      gateway: 'HBLPay',
      version: '1.0.0'
    }, 'Payment gateway is healthy');
  } catch (error) {
    return ApiResponse.error(res, 'Payment gateway configuration error: ' + error.message, 503);
  }
});



// ==================== DEVELOPMENT/TEST ROUTES ====================

if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  
  // Test configuration route
  router.get('/test-config', authUser, (req, res) => {
    const ApiResponse = require('../utils/response.util');
    
    const config = {
      environment: process.env.NODE_ENV,
      hblpay: {
        userId: process.env.HBLPAY_USER_ID ? 'Set' : 'Not Set',
        password: process.env.HBLPAY_PASSWORD ? 'Set' : 'Not Set',
        channel: process.env.HBL_CHANNEL || 'HOTEL_WEB',
        typeId: process.env.HBL_TYPE_ID || 'ECOM',
        publicKey: process.env.HBL_PUBLIC_KEY_PEM ? 'Set' : 'Not Set'
      },
      urls: {
        sandboxApi: process.env.HBL_SANDBOX_API_URL,
        productionApi: process.env.HBL_PRODUCTION_API_URL,
        sandboxRedirect: process.env.HBL_SANDBOX_REDIRECT_URL,
        productionRedirect: process.env.HBL_PRODUCTION_REDIRECT_URL
      },
      frontend: {
        baseUrl: process.env.FRONTEND_URL,
        successUrl: process.env.PAYMENT_SUCCESS_URL,
        cancelUrl: process.env.PAYMENT_CANCEL_URL
      }
    };

    return ApiResponse.success(res, config, 'Test configuration retrieved');
  });

  // Get test data (test cards, etc.)
  router.get('/test-data', authUser, (req, res) => {
    const ApiResponse = require('../utils/response.util');
    
    try {
      const paymentService = require('../services/payment.service');
      const testData = paymentService.getTestConfiguration();
      
      return ApiResponse.success(res, testData, 'Test data retrieved');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  });

  // Create test payment session
  router.post('/test-payment', authUser, async (req, res) => {
    const ApiResponse = require('../utils/response.util');
    
    try {
      // Create a test payment with minimal data
      const testPaymentData = {
        amount: 100,
        currency: 'PKR',
        bookingId: 'TEST_BOOKING_123',
        userId: req.user._id,
        returnUrl: `${process.env.FRONTEND_URL}/payment/test-success`,
        cancelUrl: `${process.env.FRONTEND_URL}/payment/test-cancel`
      };

      // Mock booking data for testing
      const mockBooking = {
        _id: 'TEST_BOOKING_123',
        hotelName: 'Test Hotel',
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 86400000), // Tomorrow
        guests: 2,
        paymentStatus: 'pending',
        userId: {
          _id: req.user._id,
          fullname: { firstname: 'Test', lastname: 'User' },
          email: 'test@example.com',
          phone: '03001234567'
        }
      };

      return ApiResponse.success(res, {
        message: 'Test payment endpoint - not fully implemented',
        testData: testPaymentData,
        mockBooking: mockBooking,
        note: 'Use real booking ID for actual payment creation'
      }, 'Test payment data prepared');
      
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  });

  // Simulate payment callback for testing
  router.post('/test-callback', (req, res) => {
    const ApiResponse = require('../utils/response.util');
    
    const { paymentId, status = 'SUCCESS' } = req.body;
    
    const mockCallbackData = {
      SESSION_ID: `TEST_SESSION_${Date.now()}`,
      PAYMENT_STATUS: status,
      REFERENCE_NUMBER: paymentId || `PAY_${Date.now()}_TEST`,
      AMOUNT: 100,
      CURRENCY: 'PKR',
      TRANSACTION_ID: `TXN_${Date.now()}`,
      TIMESTAMP: new Date().toISOString()
    };

    console.log('Test callback received:', mockCallbackData);

    return ApiResponse.success(res, {
      received: mockCallbackData,
      processed: true,
      message: 'Test callback processed'
    }, 'Test callback successful');
  });
}

// ==================== ERROR HANDLING MIDDLEWARE ====================

// Handle payment-specific errors
router.use((error, req, res, next) => {
  const ApiResponse = require('../utils/response.util');
  
  console.error('Payment route error:', error);

  // Handle specific payment errors
  if (error.message.includes('HBLPay')) {
    return ApiResponse.error(res, 'Payment gateway error: ' + error.message, 502);
  }

  if (error.message.includes('SESSION_ID')) {
    return ApiResponse.error(res, 'Payment session error: ' + error.message, 400);
  }

  if (error.message.includes('Booking')) {
    return ApiResponse.error(res, 'Booking error: ' + error.message, 404);
  }

  // Generic error
  return ApiResponse.error(res, 'Payment processing error', 500);
});

// 404 handler for payment routes
router.use('', (req, res) => {
  const ApiResponse = require('../utils/response.util');
  return ApiResponse.notFound(res, 'Payment endpoint not found');
});

module.exports = router;