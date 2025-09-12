const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const { authUser } = require('../middlewares/auth.middleware');
const paymentController = require('../controllers/payment.controller');
const ApiResponse = require('../utils/response.util');



router.post('/test-decryption', paymentController.testDecryption);
router.post('/manual-decrypt', paymentController.manualDecrypt);
router.get('/validate-keys', paymentController.validateKeys);
router.post('/simulate-callback', paymentController.simulateCallback);



// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ApiResponse.error(res, 'Validation failed', 400, errors.array());
  }
  next();
};

// Payment initiation validation
const validatePaymentInitiation = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be a positive number'),
  body('currency')
    .optional()
    .isIn(['PKR', 'USD', 'EUR'])
    .withMessage('Currency must be PKR, USD, or EUR'),
    body('bookingId')
    .notEmpty()
    .withMessage('Booking ID is required')
    .isMongoId()
    .withMessage('Invalid booking ID format'), 
  body('userData.firstName')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name is required (2-50 characters)'),
  body('userData.lastName')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name is required (2-50 characters)'),
  body('userData.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('userData.phone')
    .matches(/^(\+92|0)?[0-9]{10}$/)
    .withMessage('Valid Pakistani phone number is required'),
  body('userData.address')
    .notEmpty()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address is required (5-200 characters)'),
  body('userData.city')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City is required (2-50 characters)'),
  body('userData.state')
    .notEmpty()
    .isIn(['IS', 'BA', 'KP', 'PB', 'SD'])
    .withMessage('Valid state is required'),
  body('userData.country')
    .optional()
    .isIn(['PK'])
    .withMessage('Country must be PK'),
  body('bookingData.items')
    .isArray({ min: 1 })
    .withMessage('At least one booking item is required'),
  body('bookingData.items.*.name')
    .notEmpty()
    .trim()
    .withMessage('Item name is required'),
  body('bookingData.items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be a positive integer'),
  body('bookingData.items.*.price')
    .isFloat({ min: 0 })
    .withMessage('Item price must be a positive number')
];

// Payment verification validation
const validatePaymentVerification = [
  param('sessionId')
    .optional()
    .isLength({ min: 10 })
    .withMessage('Invalid session ID'),
  param('paymentId')
    .optional()
    .matches(/^PAY_/)
    .withMessage('Invalid payment ID format')
];

// Payment history validation
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
    .withMessage('Invalid payment status')
];

// Refund validation
const validateRefundRequest = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be positive'),
  body('reason')
    .notEmpty()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Refund reason is required (5-200 characters)')
];

// ==================== PROTECTED ROUTES (Require Authentication) ====================

// Initiate HBLPay payment
router.post('/hblpay/initiate',   
  validatePaymentInitiation,
  authUser, 
  validateRequest,  
  paymentController.initiateHBLPayPayment   
); 
// // Create payment session
// router.post('/create', authUser, paymentController.createPayment);

// Verify payment status
// router.get('/verify/:sessionId', 
//   validatePaymentVerification,
//   authUser, 
//   validateRequest, 
//   paymentController.verifyPayment
// );

// router.get('/verify/payment/:paymentId', 
//   validatePaymentVerification,
//   authUser, 
//   validateRequest, 
//   paymentController.verifyPayment
// );

// // Get payment history
// router.get('/history', 
//   validatePaymentHistory,
//   authUser, 
//   validateRequest,
//   paymentController.getPaymentHistory
// );

// // Get payment details by payment ID
// router.get('/:paymentId', 
//   param('paymentId').matches(/^PAY_/).withMessage('Invalid payment ID format'),
//   authUser, 
//   validateRequest,
//   paymentController.getPaymentDetails
// );

// // Process refund
// router.post('/:paymentId/refund', 
//   validateRefundRequest,
//   authUser, 
//   validateRequest, 
//   paymentController.processRefund
// );

// // Get payment statistics
// router.get('/stats/:period', 
//   param('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
//   authUser,
//   validateRequest,
//   async (req, res) => {
//     const { period = '30d' } = req.params;
//     const userId = req.user._id;
    
//     try {
//       const paymentService = require('../services/payment.service');
//       const stats = await paymentService.getPaymentStats(userId, period);
      
//       return ApiResponse.success(res, stats, 'Payment statistics retrieved');
//     } catch (error) {
//       console.error('Payment stats error:', error);
//       return ApiResponse.error(res, error.message, 500);
//     }
//   }
// );



// ==================== ADMIN ROUTES ====================

// Get all payments (Admin)
// router.get('/admin/all', authAdmin, paymentController.getAllPayments);

// Get payment statistics (Admin)
// router.get('/admin/stats', authAdmin, paymentController.getPaymentStats);

// Refund payment (Admin)
// router.post('/admin/refund/:paymentId', authAdmin, paymentController.refundPayment);


// ==================== PUBLIC ROUTES (No Authentication Required) ====================

// HBLPay return callback (GET) - Called by HBLPay after payment
// router.get('/return', paymentController.handlePaymentReturn);

// // HBLPay return callback (POST) - Some gateways use POST
// router.post('/return', paymentController.handlePaymentReturn);

// // HBLPay callback with query parameters
// router.get('/callback', paymentController.handlePaymentReturn);

// // HBLPay callback with POST data
// router.post('/callback', paymentController.handlePaymentReturn);

// // 🚨 CRITICAL: HBLPay Cancel Routes (NEW)
router.get('/cancel', paymentController.handlePaymentCancel);
router.post('/cancel', paymentController.handlePaymentCancel); 


// // Add this to your PUBLIC ROUTES section
router.get('/success', paymentController.handlePaymentSuccess);
router.post('/success', paymentController.handlePaymentSuccess);




// // Alternative cancel route for direct frontend access
// router.get('/cancelled', paymentController.handlePaymentCancel);


// // Webhook route for HBLPay notifications
// router.post('/webhook', paymentController.handleWebhook);

// // Health check route for payment gateway
// router.get('/health', paymentController.healthCheck); 

// ==================== DEVELOPMENT/TEST ROUTES ====================

if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  
  
  

  // Get test data (test cards, etc.)
  router.get('/test-data', authUser, (req, res) => {
    const testData = {
      testCards: [
        {
          type: 'Visa Non-3D',
          number: '4000000000000101',
          expiry: '05/2023',
          cvv: '111',
          name: 'Test User'
        },
        {
          type: 'Visa 3D',
          number: '4000000000000002',
          expiry: '05/2023',
          cvv: '111',
          passcode: '1234',
          name: 'Test User'
        },
        {
          type: 'Master Non-3D',
          number: '5200000000000114',
          expiry: '05/2023',
          cvv: '111',
          name: 'Test User'
        },
        {
          type: 'Master 3D',
          number: '5200000000000007',
          expiry: '05/2023',
          cvv: '111',
          passcode: '1234',
          name: 'Test User'
        }
      ],
      testAmounts: {
        success: [100, 500, 1000, 5000],
        decline: [1, 2, 3, 4],
        error: [9999, 8888, 7777]
      },
      testUrls: {
        otpViewer: 'https://testpaymentapi.hbl.com/OTPViewer/Home/Email',
        sandbox: process.env.HBL_SANDBOX_API_URL,
        sandboxRedirect: process.env.HBL_SANDBOX_REDIRECT_URL
      },
      documentation: {
        integration: 'https://developer.hbl.com/hblpay',
        testGuide: 'https://developer.hbl.com/hblpay/testing'
      }
    };

    return ApiResponse.success(res, testData, 'Test data retrieved');
  });

  // Test payment creation (mock)
  router.post('/test-payment', authUser, validateRequest, async (req, res) => {
    const mockPaymentData = {
      amount: 1000,
      currency: 'PKR',
      userData: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+923001234567',
        address: '123 Test Street',
        city: 'Karachi',
        state: 'SD',
        country: 'PK'
      },
      bookingData: {
        items: [{
          name: 'Test Hotel Room',
          quantity: 1,
          price: 1000,
          category: 'Hotel'
        }],
        checkIn: new Date().toISOString().split('T')[0],
        checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0]
      }
    };

    try {
      // This would call the actual payment controller in a real scenario
      const result = await paymentController.initiateHBLPayPayment(
        { body: mockPaymentData, user: req.user },
        res
      );
    } catch (error) {
      return ApiResponse.error(res, 'Test payment failed: ' + error.message, 500);
    }
  });

  // Mock callback for testing
  router.all('/test-callback', (req, res) => {
    const mockCallbackData = {
      SESSION_ID: 'TEST_SESSION_' + Date.now(),
      PAYMENT_STATUS: req.query.status || 'SUCCESS',
      REFERENCE_NUMBER: 'TEST_REF_' + Date.now(),
      AMOUNT: '1000.00',
      CURRENCY: 'PKR',
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

  // Handle validation errors
  if (error.type === 'entity.parse.failed') {
    return ApiResponse.error(res, 'Invalid JSON in request body', 400);
  }

  // Generic error
  return ApiResponse.error(res, 'Payment processing error', 500);
});

// 404 handler for payment routes
router.use('/error', (req, res) => {
  return ApiResponse.error(res, `Payment endpoint not found: ${req.method} ${req.originalUrl}`, 404);
});

module.exports = router;