const crypto = require('crypto');
const paymentModel = require('../models/payment.model');
const bookingModel = require('../models/booking.model');

class PaymentService {
  constructor() {
    this.hblPayConfig = {
      userId: process.env.HBLPAY_USER_ID,
      password: process.env.HBLPAY_PASSWORD,
      channel: process.env.HBL_CHANNEL || 'HOTEL_WEB',
      typeId: process.env.HBL_TYPE_ID || 'ECOM',
      sandboxUrl: process.env.HBL_SANDBOX_API_URL,
      productionUrl: process.env.HBL_PRODUCTION_API_URL,
      sandboxRedirectUrl: process.env.HBL_SANDBOX_REDIRECT_URL,
      productionRedirectUrl: process.env.HBL_PRODUCTION_REDIRECT_URL,
      publicKey: process.env.HBL_PUBLIC_KEY_PEM
    };
  }

  // RSA Encryption for sensitive data
  encryptData(data) {
    try {
      const buffer = Buffer.from(data, 'utf8');
      const encrypted = crypto.publicEncrypt({
        key: this.hblPayConfig.publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      }, buffer);
      return encrypted.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Generate unique payment ID
  generatePaymentId() {
    return `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique order ID
  generateOrderId() {
    return `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // Validate payment amount
  validateAmount(amount, currency = 'PKR') {
    if (!amount || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Set minimum amounts based on currency
    const minimumAmounts = {
      PKR: 1,
      USD: 0.01,
      EUR: 0.01
    };

    if (amount < minimumAmounts[currency]) {
      throw new Error(`Minimum amount for ${currency} is ${minimumAmounts[currency]}`);
    }

    return true;
  }

  // Build HBLPay request payload
  buildPaymentRequest(paymentData, bookingData, userData) {
    const {
      amount,
      currency,
      paymentId,
      orderId,
      returnUrl,
      cancelUrl
    } = paymentData;

    return {
      // Authentication Fields (Required)
      USER_ID: this.hblPayConfig.userId,
      PASSWORD: this.hblPayConfig.password,
      RETURN_URL: returnUrl,
      CANCEL_URL: cancelUrl,
      CHANNEL: this.hblPayConfig.channel,
      TYPE_ID: this.hblPayConfig.typeId,

      // Order Summary (Required)
      ORDER: {
        DISCOUNT_ON_TOTAL: 0,
        SUBTOTAL: amount,
        OrderSummaryDescription: [
          {
            ITEM_NAME: `Hotel Booking - ${bookingData.hotelName || 'Hotel Reservation'}`,
            QUANTITY: 1,
            UNIT_PRICE: amount,
            OLD_PRICE: null,
            CATEGORY: 'Hotel',
            SUB_CATEGORY: 'Accommodation'
          }
        ]
      },

      // Shipping Detail (Optional)
      SHIPPING_DETAIL: {
        NAME: 'Digital Service',
        ICON_PATH: null,
        DELIEVERY_DAYS: 0,
        SHIPPING_COST: 0
      },

      // Additional Data (Required)
      ADDITIONAL_DATA: {
        REFERENCE_NUMBER: paymentId,
        CUSTOMER_ID: userData.id?.toString() || null,
        CURRENCY: currency,

        // Billing Information
        BILL_TO_FORENAME: userData.firstname || '',
        BILL_TO_SURNAME: userData.lastname || '',
        BILL_TO_EMAIL: userData.email || 'guest@example.com',
        BILL_TO_PHONE: userData.phone || '000000000',
        BILL_TO_ADDRESS_LINE: userData.address || 'N/A',
        BILL_TO_ADDRESS_CITY: userData.city || 'Karachi',
        BILL_TO_ADDRESS_STATE: userData.state || 'Sindh',
        BILL_TO_ADDRESS_COUNTRY: userData.country || 'PK',
        BILL_TO_ADDRESS_POSTAL_CODE: userData.postalCode || '74000',

        // Shipping Information (Copy of billing)
        SHIP_TO_FORENAME: userData.firstname || '',
        SHIP_TO_SURNAME: userData.lastname || '',
        SHIP_TO_EMAIL: userData.email || 'guest@example.com',
        SHIP_TO_PHONE: userData.phone || '000000000',
        SHIP_TO_ADDRESS_LINE: userData.address || 'N/A',
        SHIP_TO_ADDRESS_CITY: userData.city || 'Karachi',
        SHIP_TO_ADDRESS_STATE: userData.state || 'Sindh',
        SHIP_TO_ADDRESS_COUNTRY: userData.country || 'PK',
        SHIP_TO_ADDRESS_POSTAL_CODE: userData.postalCode || '74000',

        // Merchant Defined Data
        MerchantFields: this.buildMerchantFields(bookingData, userData)
      }
    };
  }

  // Build merchant defined data fields
  buildMerchantFields(bookingData, userData) {
    return {
      MDD1: this.hblPayConfig.channel,  // Channel of Operation
      MDD2: 'N',  // 3D Secure Registration
      MDD3: 'Hotel',  // Product Category
      MDD4: 'Hotel Booking',  // Product Name
      MDD5: userData.id ? 'Y' : 'N',  // Previous Customer
      MDD6: 'Digital',  // Shipping Method
      MDD7: '1',  // Number Of Items Sold
      MDD8: 'PK',  // Product Shipping Country
      MDD9: '0',  // Hours Till Departure
      MDD10: 'Hotel',  // Flight Type (Product Type)
      MDD11: bookingData.checkIn && bookingData.checkOut ?
        `${bookingData.checkIn} to ${bookingData.checkOut}` : 'N/A',  // Full Journey
      MDD12: 'N',  // 3rd Party Booking
      MDD13: bookingData.hotelName || 'Hotel Reservation',  // Hotel Name
      MDD14: new Date().toISOString().split('T')[0],  // Date of Booking
      MDD15: bookingData.checkIn ?
        (typeof bookingData.checkIn === 'string' ? bookingData.checkIn : bookingData.checkIn.toISOString().split('T')[0]) : '',  // Check In Date
      MDD16: bookingData.checkOut ?
        (typeof bookingData.checkOut === 'string' ? bookingData.checkOut : bookingData.checkOut.toISOString().split('T')[0]) : '',  // Check Out Date
      MDD17: 'Hotel',  // Product Type
      MDD18: userData.phone || userData.email || '',  // Customer ID/Phone
      MDD19: 'PK',  // Country Of Top-up
      MDD20: 'N'   // VIP Customer
    };
  }

  // Call HBLPay API
  async callHBLPayAPI(requestData) {
    const apiUrl = process.env.NODE_ENV === 'production' ?
      this.hblPayConfig.productionUrl : this.hblPayConfig.sandboxUrl;

    try {
      console.log('Calling HBLPay API:', {
        url: apiUrl,
        userId: requestData.USER_ID,
        channel: requestData.CHANNEL,
        amount: requestData.ORDER?.SUBTOTAL
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Node.js HBLPay Integration'
        },
        body: JSON.stringify(requestData),
        timeout: 30000  // 30 seconds timeout
      });

      const responseText = await response.text();
      console.log('HBLPay Raw Response:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let hblResponse;
      try {
        hblResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse HBLPay response:', parseError);
        throw new Error('Invalid JSON response from HBLPay');
      }

      return hblResponse;
    } catch (error) {
      console.error('HBLPay API Error:', error);
      throw new Error(`HBLPay API call failed: ${error.message}`);
    }
  }

  // Build redirect URL
  buildRedirectUrl(sessionId) {
    const baseUrl = process.env.NODE_ENV === 'production' ?
      this.hblPayConfig.productionRedirectUrl : this.hblPayConfig.sandboxRedirectUrl;

    return baseUrl + sessionId;
  }

  // Create payment session
  async createPaymentSession(paymentData) {
    const {
      amount,
      currency = 'PKR',
      bookingId,
      userId,
      returnUrl,
      cancelUrl
    } = paymentData;

    // Validate amount
    this.validateAmount(amount, currency);

    // Generate IDs
    const paymentId = this.generatePaymentId();
    const orderId = this.generateOrderId();

    // Get booking and user data
    const booking = await bookingModel.findOne({
      $or: [{ _id: bookingId }, { bookingId: bookingId }],
      userId
    }).populate('userId', 'fullname email phone');

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.paymentStatus === 'paid') {
      throw new Error('Booking is already paid');
    }

    // Create payment record
    const payment = await paymentModel.create({
      userId,
      bookingId: booking._id,
      paymentId,
      amount,
      currency,
      method: 'HBLPay',
      status: 'pending',
      metadata: {
        orderId,
        returnUrl,
        cancelUrl,
        channel: this.hblPayConfig.channel,
        typeId: this.hblPayConfig.typeId
      }
    });

    // Prepare user data
    const userData = {
      id: booking.userId._id,
      firstname: booking.userId.fullname?.firstname || '',
      lastname: booking.userId.fullname?.lastname || '',
      email: booking.userId.email || '',
      phone: booking.userId.phone || ''
    };

    // Prepare booking data
    const bookingData = {
      hotelName: booking.hotelName,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests
    };

    // Build HBLPay request
    const hblRequest = this.buildPaymentRequest(
      { amount, currency, paymentId, orderId, returnUrl, cancelUrl },
      bookingData,
      userData
    );

    // Call HBLPay API
    const hblResponse = await this.callHBLPayAPI(hblRequest);

    // Check for SESSION_ID
    if (!hblResponse.SESSION_ID) {
      await payment.markAsFailed('NO_SESSION_ID', 'No SESSION_ID received from HBLPay', hblResponse);
      throw new Error('Failed to create payment session - No SESSION_ID received');
    }

    // Update payment with session ID
    payment.sessionId = hblResponse.SESSION_ID;
    payment.transactionId = hblResponse.SESSION_ID;
    payment.gatewayResponse = hblResponse;
    await payment.save();

    // Build redirect URL
    const redirectUrl = this.buildRedirectUrl(hblResponse.SESSION_ID);

    return {
      sessionId: hblResponse.SESSION_ID,
      paymentUrl: redirectUrl,
      paymentId: payment.paymentId,
      orderId: orderId,
      amount: amount,
      currency: currency,
      payment: payment
    };
  }

  // Process payment callback
  async processPaymentCallback(callbackData) {
    const { SESSION_ID, PAYMENT_STATUS, REFERENCE_NUMBER, AMOUNT } = callbackData;

    // Find payment by session ID or reference
    const payment = await paymentModel.findOne({
      $or: [
        { sessionId: SESSION_ID },
        { paymentId: REFERENCE_NUMBER },
        { transactionId: SESSION_ID }
      ]
    }).populate('bookingId');

    if (!payment) {
      throw new Error('Payment not found for callback');
    }

    // Process based on payment status
    if (PAYMENT_STATUS === 'SUCCESS' || PAYMENT_STATUS === 'COMPLETED') {
      await payment.markAsCompleted({
        sessionId: SESSION_ID,
        paymentStatus: PAYMENT_STATUS,
        amount: AMOUNT,
        gatewayResponse: callbackData
      });

      // Update booking status
      if (payment.bookingId) {
        await bookingModel.findByIdAndUpdate(payment.bookingId._id, {
          paymentStatus: 'paid',
          paidAt: new Date()
        });
      }

      return {
        success: true,
        payment: payment,
        message: 'Payment completed successfully'
      };
    } else {
      await payment.markAsFailed('PAYMENT_FAILED', PAYMENT_STATUS || 'Payment failed', callbackData);

      return {
        success: false,
        payment: payment,
        message: 'Payment failed'
      };
    }
  }

  // Verify payment status
  async verifyPayment(sessionId, paymentId, userId) {
    const payment = await paymentModel.findOne({
      $and: [
        { userId },
        {
          $or: [
            { sessionId },
            { paymentId }
          ]
        }
      ]
    }).populate('bookingId');

    if (!payment) {
      throw new Error('Payment not found');
    }

    return payment;
  }

  // Get payment history
  async getPaymentHistory(userId, options = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate
    } = options;

    const query = { userId };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payments = await paymentModel
      .find(query)
      .populate('bookingId', 'hotelName checkIn checkOut bookingId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await paymentModel.countDocuments(query);

    return {
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Process refund
  async processRefund(paymentId, userId, refundData) {
    const { reason, amount } = refundData;

    const payment = await paymentModel
      .findOne({ paymentId, userId })
      .populate('bookingId');

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'completed') {
      throw new Error('Only completed payments can be refunded');
    }

    if (payment.refundAmount > 0) {
      throw new Error('Payment already refunded');
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      throw new Error('Refund amount cannot exceed payment amount');
    }

    // Note: HBLPay doesn't have automated refund API
    // This would require manual processing or separate API calls
    await payment.markAsRefunded(refundAmount, reason);

    return {
      paymentId: payment.paymentId,
      refundAmount: refundAmount,
      refundReason: reason,
      refundedAt: payment.refundedAt
    };
  }

  // Get payment statistics
  async getPaymentStats(userId, period = '30d') {
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const stats = await paymentModel.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const result = {
      period,
      totalPayments: 0,
      totalAmount: 0,
      completedPayments: 0,
      completedAmount: 0,
      failedPayments: 0,
      pendingPayments: 0
    };

    stats.forEach(stat => {
      result.totalPayments += stat.count;
      result.totalAmount += stat.totalAmount;

      if (stat._id === 'completed') {
        result.completedPayments = stat.count;
        result.completedAmount = stat.totalAmount;
      } else if (stat._id === 'failed') {
        result.failedPayments = stat.count;
      } else if (stat._id === 'pending') {
        result.pendingPayments = stat.count;
      }
    });

    return result;
  }

  // Validate HBLPay configuration
  validateConfiguration() {
    const required = [
      'HBLPAY_USER_ID',
      'HBLPAY_PASSWORD',
      'HBL_SANDBOX_API_URL',
      'HBL_PRODUCTION_API_URL',
      'HBL_SANDBOX_REDIRECT_URL',
      'HBL_PRODUCTION_REDIRECT_URL'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return true;
  }

  // Get test configuration
  getTestConfiguration() {
    return {
      testCards: [
        {
          type: 'Visa Non-3D',
          number: '4000000000000101',
          expiry: '05/2023',
          cvv: '111'
        },
        {
          type: 'Visa 3D',
          number: '4000000000000002',
          expiry: '05/2023',
          cvv: '111',
          passcode: '1234'
        },
        {
          type: 'Master Non-3D',
          number: '5200000000000114',
          expiry: '05/2023',
          cvv: '111'
        },
        {
          type: 'Master 3D',
          number: '5200000000000007',
          expiry: '05/2023',
          cvv: '111',
          passcode: '1234'
        }
      ],
      testUrls: {
        sandbox: this.hblPayConfig.sandboxUrl,
        sandboxRedirect: this.hblPayConfig.sandboxRedirectUrl,
        otpViewer: 'https://testpaymentapi.hbl.com/OTPViewer/Home/Email'
      }
    };
  }
}

module.exports = new PaymentService();