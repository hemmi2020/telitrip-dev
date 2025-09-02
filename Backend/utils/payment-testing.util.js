// Payment Testing Utilities
// This file contains utilities for testing payment functionality

/**
 * Test card data for HBLPay integration
 */
const TEST_CARDS = {
  visa: {
    non3d: {
      number: '4000000000000101',
      expiry: '05/2023',
      cvv: '111',
      name: 'Test User',
      type: 'Visa Non-3D'
    },
    threeDSecure: {
      number: '4000000000000002',
      expiry: '05/2023',
      cvv: '111',
      passcode: '1234',
      name: 'Test User',
      type: 'Visa 3D'
    }
  },
  mastercard: {
    non3d: {
      number: '5200000000000114',
      expiry: '05/2023',
      cvv: '111',
      name: 'Test User',
      type: 'Master Non-3D'
    },
    threeDSecure: {
      number: '5200000000000007',
      expiry: '05/2023',
      cvv: '111',
      passcode: '1234',
      name: 'Test User',
      type: 'Master 3D'
    }
  },
  unionpay: {
    debit: {
      number: '6223164991230014',
      mobile: '13012345678',
      expiry: '12/33',
      cvv: '123',
      passcode: '111111',
      mobileCode: '123456',
      name: 'Test User',
      type: 'Union Pay Debit'
    },
    credit: {
      number: '6250947000000014',
      mobile: '+85211112222',
      expiry: '12/33',
      cvv: '123',
      passcode: '111111',
      mobileCode: '123456',
      name: 'Test User',
      type: 'Union Pay Credit'
    }
  }
};

/**
 * Test amounts for different scenarios
 */
const TEST_AMOUNTS = {
  success: [100, 500, 1000, 5000], // These amounts should succeed
  decline: [1, 2, 3, 4],           // These amounts should be declined
  error: [9999, 8888, 7777]       // These amounts should cause errors
};

/**
 * Generate mock payment data for testing
 */
const generateMockPaymentData = (overrides = {}) => {
  return {
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
    },
    ...overrides
  };
};

/**
 * Generate mock callback data from HBLPay
 */
const generateMockCallbackData = (status = 'SUCCESS', overrides = {}) => {
  return {
    SESSION_ID: 'TEST_SESSION_' + Date.now(),
    PAYMENT_STATUS: status,
    REFERENCE_NUMBER: 'TEST_REF_' + Date.now(),
    AMOUNT: '1000.00',
    CURRENCY: 'PKR',
    TIMESTAMP: new Date().toISOString(),
    ...overrides
  };
};

/**
 * Validate test environment configuration
 */
const validateTestConfig = () => {
  const requiredVars = [
    'HBLPAY_USER_ID',
    'HBLPAY_PASSWORD',
    'HBL_SANDBOX_API_URL',
    'HBL_SANDBOX_REDIRECT_URL'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing test configuration variables: ${missing.join(', ')}`);
  }

  return true;
};

/**
 * Generate test URLs for HBLPay integration
 */
const getTestUrls = () => {
  return {
    otpViewer: 'https://testpaymentapi.hbl.com/OTPViewer/Home/Email',
    sandbox: process.env.HBL_SANDBOX_API_URL,
    sandboxRedirect: process.env.HBL_SANDBOX_REDIRECT_URL,
    documentation: {
      integration: 'https://developer.hbl.com/hblpay',
      testGuide: 'https://developer.hbl.com/hblpay/testing'
    }
  };
};

/**
 * Create test payment session data
 */
const createTestSession = (sessionId = null) => {
  return {
    sessionId: sessionId || 'TEST_SESSION_' + Date.now(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    status: 'pending',
    testMode: true
  };
};

/**
 * Validate payment test data
 */
const validateTestPaymentData = (paymentData) => {
  const errors = [];

  if (!paymentData.amount || paymentData.amount <= 0) {
    errors.push('Valid amount is required');
  }

  if (!paymentData.userData) {
    errors.push('User data is required');
  } else {
    if (!paymentData.userData.email) errors.push('User email is required');
    if (!paymentData.userData.firstName) errors.push('User first name is required');
    if (!paymentData.userData.lastName) errors.push('User last name is required');
  }

  if (!paymentData.bookingData || !paymentData.bookingData.items || paymentData.bookingData.items.length === 0) {
    errors.push('Booking items are required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  TEST_CARDS,
  TEST_AMOUNTS,
  generateMockPaymentData,
  generateMockCallbackData,
  validateTestConfig,
  getTestUrls,
  createTestSession,
  validateTestPaymentData
}; 