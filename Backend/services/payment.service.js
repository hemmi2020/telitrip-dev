const paymentModel = require('../models/payment.model');
const logger = require('../utils/logger.util');
const { hblCircuitBreaker } = require('../middlewares/errorHandler.middleware');

class EnhancedPaymentService {
  constructor() {
    this.fallbackEnabled = process.env.ENABLE_PAYMENT_FALLBACK !== 'false';
    this.fallbackMethods = ['manual_redirect', 'qr_code', 'bank_transfer'];
    this.maxRetryAttempts = parseInt(process.env.MAX_PAYMENT_RETRIES) || 3;
  }

  // Enhanced payment creation with multiple fallback strategies
  async createPaymentWithFallback(paymentData, userId) {
    const context = 'CreatePaymentWithFallback';
    const startTime = Date.now();

    try {
      logger.info('Starting payment creation with fallback support', {
        amount: paymentData.amount,
        currency: paymentData.currency,
        userId,
        fallbackEnabled: this.fallbackEnabled
      });

      // Primary attempt: Standard HBL Pay flow
      try {
        const result = await hblCircuitBreaker.execute(async () => {
          return await this.createStandardPayment(paymentData, userId);
        }, 'Standard HBL Payment');

        logger.info('Standard payment creation successful', {
          paymentId: result.paymentId,
          sessionId: result.sessionId,
          duration: `${Date.now() - startTime}ms`
        });

        return {
          success: true,
          method: 'standard',
          data: result
        };

      } catch (standardError) {
        logger.warn('Standard payment creation failed', {
          error: standardError.message,
          code: standardError.code,
          userId,
          duration: `${Date.now() - startTime}ms`
        });

        // If fallback is disabled, throw the error
        if (!this.fallbackEnabled) {
          throw standardError;
        }

        // Attempt fallback methods
        return await this.attemptFallbackMethods(paymentData, userId, standardError);
      }

    } catch (error) {
      logger.error('All payment creation methods failed', error, {
        userId,
        amount: paymentData.amount,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  // Standard HBL Pay creation (existing logic)
  async createStandardPayment(paymentData, userId) {
    // This would contain your existing createPayment logic
    // Moving it here for better organization
    const paymentId = this.generatePaymentId();
    const orderId = this.generateOrderId();

    // Create payment record
    const payment = new paymentModel({
      paymentId,
      userId,
      bookingId: paymentData.bookingId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'pending',
      paymentMethod: 'HBLPay',
      orderId,
      userDetails: paymentData.userData,
      bookingDetails: paymentData.bookingData,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });

    await payment.save();

    // Build and call HBL API (your existing logic)
    const hblRequest = this.buildHBLRequest(paymentData, orderId, userId);
    const hblResponse = await this.callHBLAPI(hblRequest);

    if (!hblResponse.IsSuccess || !hblResponse.Data?.SESSION_ID) {
      await payment.updateOne({
        status: 'failed',
        failureReason: 'NO_SESSION_ID',
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });

      const error = new Error(`HBL API failed: ${hblResponse.ResponseMessage}`);
      error.code = 'HBL_API_FAILED';
      error.hblResponse = hblResponse;
      throw error;
    }

    const sessionId = hblResponse.Data.SESSION_ID;
    await payment.updateOne({
      sessionId,
      status: 'initiated',
      gatewayResponse: hblResponse,
      updatedAt: new Date()
    });

    const redirectUrl = `${process.env.HBL_SANDBOX_REDIRECT_URL}${sessionId}`;

    return {
      paymentId,
      sessionId,
      redirectUrl,
      orderId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      expiresAt: payment.expiresAt
    };
  }

  // Fallback method attempts
  async attemptFallbackMethods(paymentData, userId, originalError) {
    logger.info('Attempting fallback payment methods', {
      userId,
      originalError: originalError.message,
      fallbackMethods: this.fallbackMethods
    });

    // Fallback 1: Manual redirect with enhanced error handling
    try {
      const manualResult = await this.createManualRedirectPayment(paymentData, userId);
      logger.info('Manual redirect fallback successful', {
        paymentId: manualResult.paymentId
      });

      return {
        success: true,
        method: 'manual_redirect',
        data: manualResult,
        fallbackReason: originalError.message
      };
    } catch (manualError) {
      logger.warn('Manual redirect fallback failed', {
        error: manualError.message
      });
    }

    // Fallback 2: QR Code payment
    try {
      const qrResult = await this.createQRCodePayment(paymentData, userId);
      logger.info('QR Code fallback successful', {
        paymentId: qrResult.paymentId
      });

      return {
        success: true,
        method: 'qr_code',
        data: qrResult,
        fallbackReason: originalError.message
      };
    } catch (qrError) {
      logger.warn('QR Code fallback failed', {
        error: qrError.message
      });
    }

    // Fallback 3: Bank transfer instructions
    try {
      const bankTransferResult = await this.createBankTransferPayment(paymentData, userId);
      logger.info('Bank transfer fallback successful', {
        paymentId: bankTransferResult.paymentId
      });

      return {
        success: true,
        method: 'bank_transfer',
        data: bankTransferResult,
        fallbackReason: originalError.message
      };
    } catch (bankError) {
      logger.error('All fallback methods failed', bankError);
    }

    // If all fallbacks fail, throw the original error
    throw originalError;
  }

  // Manual redirect payment method
  async createManualRedirectPayment(paymentData, userId) {
    const paymentId = this.generatePaymentId();
    const orderId = this.generateOrderId();

    const payment = new paymentModel({
      paymentId,
      userId,
      bookingId: paymentData.bookingId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'manual_redirect',
      paymentMethod: 'HBLPay_Manual',
      orderId,
      userDetails: paymentData.userData,
      bookingDetails: paymentData.bookingData,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour for manual
      metadata: {
        fallbackMethod: 'manual_redirect',
        instructions: 'User must manually navigate to HBL Pay'
      }
    });

    await payment.save();

    return {
      paymentId,
      orderId,
      method: 'manual_redirect',
      instructions: {
        title: 'Manual Payment Required',
        steps: [
          'Click the link below to open HBL Pay',
          'Enter your card details on the HBL Pay page',
          'Complete the payment process',
          'You will be redirected back automatically'
        ],
        manualUrl: `https://testpaymentapi.hbl.com/hblpay/site/index.html`,
        fallbackPageUrl: `${process.env.BACKEND_URL}/payment/fallback?sessionId=manual_${paymentId}`
      },
      amount: paymentData.amount,
      currency: paymentData.currency,
      expiresAt: payment.expiresAt
    };
  }

  // QR Code payment method
  async createQRCodePayment(paymentData, userId) {
    const paymentId = this.generatePaymentId();
    const orderId = this.generateOrderId();

    // Create payment record
    const payment = new paymentModel({
      paymentId,
      userId,
      bookingId: paymentData.bookingId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'qr_generated',
      paymentMethod: 'HBLPay_QR',
      orderId,
      userDetails: paymentData.userData,
      bookingDetails: paymentData.bookingData,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      metadata: {
        fallbackMethod: 'qr_code',
        qrData: `hblpay://pay?amount=${paymentData.amount}&currency=${paymentData.currency}&order=${orderId}`
      }
    });

    await payment.save();

    return {
      paymentId,
      orderId,
      method: 'qr_code',
      qrCode: {
        data: payment.metadata.qrData,
        image: `${process.env.BACKEND_URL}/api/v1/payments/${paymentId}/qr`,
        instructions: [
          'Open your HBL mobile app',
          'Scan this QR code',
          'Confirm the payment details',
          'Complete the transaction'
        ]
      },
      amount: paymentData.amount,
      currency: paymentData.currency,
      expiresAt: payment.expiresAt
    };
  }

  // Bank transfer payment method
  async createBankTransferPayment(paymentData, userId) {
    const paymentId = this.generatePaymentId();
    const orderId = this.generateOrderId();

    const payment = new paymentModel({
      paymentId,
      userId,
      bookingId: paymentData.bookingId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'bank_transfer_pending',
      paymentMethod: 'Bank_Transfer',
      orderId,
      userDetails: paymentData.userData,
      bookingDetails: paymentData.bookingData,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata: {
        fallbackMethod: 'bank_transfer',
        bankDetails: {
          bankName: 'Habib Bank Limited',
          accountTitle: 'Teli Private Limited',
          accountNumber: process.env.HBL_MERCHANT_ACCOUNT || 'XXXX-XXXX-XXXX',
          branchCode: process.env.HBL_BRANCH_CODE || 'XXXX',
          swiftCode: 'HABBPKKA'
        }
      }
    });

    await payment.save();

    return {
      paymentId,
      orderId,
      method: 'bank_transfer',
      bankTransfer: {
        instructions: [
          'Transfer the exact amount to the account below',
          'Use the payment reference in transfer description',
          'Share the transfer receipt via email or WhatsApp',
          'Your booking will be confirmed once payment is verified'
        ],
        bankDetails: payment.metadata.bankDetails,
        transferReference: `TELI-${orderId}`,
        amount: paymentData.amount,
        currency: paymentData.currency,
        verificationEmail: process.env.PAYMENT_VERIFICATION_EMAIL || 'payments@telitrip.com',
        verificationWhatsApp: process.env.PAYMENT_VERIFICATION_WHATSAPP || '+92-XXX-XXXXXXX'
      },
      expiresAt: payment.expiresAt
    };
  }

  // Enhanced payment monitoring
  async monitorPaymentHealth() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      // Get payment statistics
      const stats = await paymentModel.aggregate([
        {
          $match: {
            createdAt: { $gte: last24Hours }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgResponseTime: { $avg: '$responseTime' }
          }
        }
      ]);

      // Calculate health metrics
      const healthMetrics = {
        timestamp: now.toISOString(),
        period: '24 hours',
        totalTransactions: 0,
        successRate: 0,
        averageResponseTime: 0,
        circuitBreakerStatus: hblCircuitBreaker.getStats(),
        statusBreakdown: {},
        alerts: []
      };

      let successfulPayments = 0;
      let totalPayments = 0;
      let totalResponseTime = 0;

      stats.forEach(stat => {
        totalPayments += stat.count;
        healthMetrics.statusBreakdown[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount,
          percentage: 0 // Will calculate after total is known
        };

        if (stat._id === 'completed') {
          successfulPayments += stat.count;
        }

        if (stat.avgResponseTime) {
          totalResponseTime += stat.avgResponseTime;
        }
      });

      // Calculate percentages and rates
      healthMetrics.totalTransactions = totalPayments;
      healthMetrics.successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;
      healthMetrics.averageResponseTime = stats.length > 0 ? totalResponseTime / stats.length : 0;

      Object.keys(healthMetrics.statusBreakdown).forEach(status => {
        healthMetrics.statusBreakdown[status].percentage = 
          (healthMetrics.statusBreakdown[status].count / totalPayments) * 100;
      });

      // Generate alerts based on metrics
      if (healthMetrics.successRate < 85) {
        healthMetrics.alerts.push({
          type: 'LOW_SUCCESS_RATE',
          message: `Success rate is ${healthMetrics.successRate.toFixed(1)}% (below 85% threshold)`,
          severity: 'high'
        });
      }

      if (healthMetrics.averageResponseTime > 10000) {
        healthMetrics.alerts.push({
          type: 'SLOW_RESPONSE_TIME',
          message: `Average response time is ${(healthMetrics.averageResponseTime / 1000).toFixed(1)}s (above 10s threshold)`,
          severity: 'medium'
        });
      }

      if (hblCircuitBreaker.getStats().state === 'OPEN') {
        healthMetrics.alerts.push({
          type: 'CIRCUIT_BREAKER_OPEN',
          message: 'Circuit breaker is open - HBL API is currently unavailable',
          severity: 'critical'
        });
      }

      // Check for stuck payments
      const stuckPayments = await paymentModel.countDocuments({
        status: 'pending',
        createdAt: { $lt: new Date(now.getTime() - 60 * 60 * 1000) } // Older than 1 hour
      });

      if (stuckPayments > 0) {
        healthMetrics.alerts.push({
          type: 'STUCK_PAYMENTS',
          message: `${stuckPayments} payments have been pending for over 1 hour`,
          severity: 'medium'
        });
      }

      logger.info('Payment health monitoring completed', healthMetrics);
      return healthMetrics;

    } catch (error) {
      logger.error('Payment health monitoring failed', error);
      throw error;
    }
  }

  // Auto-recovery for stuck payments
  async recoverStuckPayments() {
    const context = 'RecoverStuckPayments';
    
    try {
      const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      
      const stuckPayments = await paymentModel.find({
        status: { $in: ['pending', 'initiated'] },
        createdAt: { $lt: cutoffTime },
        retryCount: { $lt: this.maxRetryAttempts }
      });

      logger.info('Found stuck payments for recovery', {
        count: stuckPayments.length,
        cutoffTime: cutoffTime.toISOString()
      });

      const recoveryResults = {
        attempted: stuckPayments.length,
        recovered: 0,
        failed: 0,
        expired: 0
      };

      for (const payment of stuckPayments) {
        try {
          // Check if payment has expired
          if (payment.expiresAt < new Date()) {
            await payment.updateOne({
              status: 'expired',
              expiredAt: new Date(),
              updatedAt: new Date()
            });
            recoveryResults.expired++;
            continue;
          }

          // Attempt to query payment status from HBL
          const statusResult = await this.queryPaymentStatus(payment);
          
          if (statusResult.recovered) {
            recoveryResults.recovered++;
            logger.info('Payment recovered', {
              paymentId: payment.paymentId,
              newStatus: statusResult.status
            });
          } else {
            recoveryResults.failed++;
          }

        } catch (recoveryError) {
          logger.error('Payment recovery failed', recoveryError, {
            paymentId: payment.paymentId
          });
          recoveryResults.failed++;
        }
      }

      logger.info('Stuck payment recovery completed', recoveryResults);
      return recoveryResults;

    } catch (error) {
      logger.error('Stuck payment recovery process failed', error);
      throw error;
    }
  }

  // Query payment status from HBL (if they provide such an API)
  async queryPaymentStatus(payment) {
    try {
      // This would call HBL's status query API if available
      // For now, we'll implement a basic timeout-based recovery
      
      const ageMinutes = (Date.now() - payment.createdAt.getTime()) / (1000 * 60);
      
      if (ageMinutes > 30) {
        // Mark as expired after 30 minutes
        await payment.updateOne({
          status: 'expired',
          expiredAt: new Date(),
          updatedAt: new Date(),
          failureReason: 'PAYMENT_TIMEOUT'
        });

        return { recovered: true, status: 'expired' };
      }

      return { recovered: false, status: payment.status };

    } catch (error) {
      logger.error('Payment status query failed', error, {
        paymentId: payment.paymentId
      });
      return { recovered: false, error: error.message };
    }
  }

  // Enhanced retry mechanism with smart backoff
  async retryPayment(paymentId, userId, options = {}) {
    const context = 'RetryPayment';
    
    try {
      const originalPayment = await paymentModel.findOne({ paymentId });
      
      if (!originalPayment) {
        throw new Error('Original payment not found');
      }

      if (originalPayment.userId.toString() !== userId.toString()) {
        throw new Error('Unauthorized retry attempt');
      }

      if (originalPayment.status === 'completed') {
        throw new Error('Payment already completed');
      }

      const retryCount = (originalPayment.retryCount || 0) + 1;
      
      if (retryCount > this.maxRetryAttempts) {
        throw new Error('Maximum retry attempts exceeded');
      }

      logger.info('Retrying payment', {
        originalPaymentId: paymentId,
        retryCount,
        maxAttempts: this.maxRetryAttempts,
        userId
      });

      // Smart backoff: wait longer for higher retry counts
      const backoffDelay = Math.min(Math.pow(2, retryCount) * 1000, 30000); // Max 30 seconds
      
      if (options.respectBackoff !== false) {
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }

      // Create retry payment with enhanced metadata
      const retryPaymentData = {
        amount: originalPayment.amount,
        currency: originalPayment.currency,
        bookingId: originalPayment.bookingId,
        userData: originalPayment.userDetails,
        bookingData: originalPayment.bookingDetails
      };

      const retryResult = await this.createPaymentWithFallback(retryPaymentData, userId);

      // Update original payment to link to retry
      await originalPayment.updateOne({
        retryPaymentId: retryResult.data.paymentId,
        retryCount,
        lastRetryAt: new Date(),
        updatedAt: new Date()
      });

      logger.info('Payment retry successful', {
        originalPaymentId: paymentId,
        retryPaymentId: retryResult.data.paymentId,
        method: retryResult.method,
        retryCount
      });

      return {
        ...retryResult.data,
        retryCount,
        retryMethod: retryResult.method,
        originalPaymentId: paymentId
      };

    } catch (error) {
      logger.error('Payment retry failed', error, {
        paymentId,
        userId,
        context
      });
      throw error;
    }
  }

  // Payment analytics and insights
  async getPaymentAnalytics(timeframe = '24h') {
    try {
      const hours = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 24;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      const analytics = await paymentModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startTime }
          }
        },
        {
          $group: {
            _id: {
              status: '$status',
              method: '$paymentMethod',
              hour: { $hour: '$createdAt' }
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' }
          }
        },
        {
          $sort: { '_id.hour': 1 }
        }
      ]);

      // Process analytics data
      const processedAnalytics = {
        timeframe,
        summary: {
          totalTransactions: 0,
          totalAmount: 0,
          averageAmount: 0,
          successRate: 0
        },
        byStatus: {},
        byMethod: {},
        hourlyBreakdown: {},
        trends: []
      };

      analytics.forEach(item => {
        const { status, method, hour } = item._id;
        
        processedAnalytics.summary.totalTransactions += item.count;
        processedAnalytics.summary.totalAmount += item.totalAmount;

        // Group by status
        if (!processedAnalytics.byStatus[status]) {
          processedAnalytics.byStatus[status] = { count: 0, amount: 0 };
        }
        processedAnalytics.byStatus[status].count += item.count;
        processedAnalytics.byStatus[status].amount += item.totalAmount;

        // Group by method
        if (!processedAnalytics.byMethod[method]) {
          processedAnalytics.byMethod[method] = { count: 0, amount: 0 };
        }
        processedAnalytics.byMethod[method].count += item.count;
        processedAnalytics.byMethod[method].amount += item.totalAmount;

        // Hourly breakdown
        if (!processedAnalytics.hourlyBreakdown[hour]) {
          processedAnalytics.hourlyBreakdown[hour] = { count: 0, amount: 0 };
        }
        processedAnalytics.hourlyBreakdown[hour].count += item.count;
        processedAnalytics.hourlyBreakdown[hour].amount += item.totalAmount;
      });

      // Calculate derived metrics
      if (processedAnalytics.summary.totalTransactions > 0) {
        processedAnalytics.summary.averageAmount = 
          processedAnalytics.summary.totalAmount / processedAnalytics.summary.totalTransactions;
        
        const completedCount = processedAnalytics.byStatus.completed?.count || 0;
        processedAnalytics.summary.successRate = 
          (completedCount / processedAnalytics.summary.totalTransactions) * 100;
      }

      logger.info('Payment analytics generated', {
        timeframe,
        totalTransactions: processedAnalytics.summary.totalTransactions,
        successRate: processedAnalytics.summary.successRate
      });

      return processedAnalytics;

    } catch (error) {
      logger.error('Payment analytics generation failed', error);
      throw error;
    }
  }

  // Utility methods
  generatePaymentId() {
    const timestamp = Date.now();
    const randomBytes = require('crypto').randomBytes(4).toString('hex');
    return `PAY_${timestamp}_${randomBytes}`;
  }

  generateOrderId() {
    const timestamp = Date.now();
    const randomBytes = require('crypto').randomBytes(3).toString('hex');
    return `ORD_${timestamp}_${randomBytes}`;
  }

  // Build HBL request (simplified version)
  buildHBLRequest(paymentData, orderId, userId) {
    // Your existing buildHBLPayRequest logic here
    return {
      USER_ID: process.env.HBLPAY_USER_ID,
      // ... other encrypted parameters
    };
  }

  // Call HBL API (simplified version)
  async callHBLAPI(requestData) {
    // Your existing callHBLPayAPI logic here
    const response = await fetch(process.env.HBL_SANDBOX_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    return await response.json();
  }

  // Cleanup expired payments
  async cleanupExpiredPayments() {
    try {
      const result = await paymentModel.updateMany(
        {
          status: { $in: ['pending', 'initiated'] },
          expiresAt: { $lt: new Date() }
        },
        {
          $set: {
            status: 'expired',
            expiredAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      logger.info('Expired payments cleaned up', {
        modifiedCount: result.modifiedCount
      });

      return result.modifiedCount;
    } catch (error) {
      logger.error('Cleanup expired payments failed', error);
      throw error;
    }
  }

  // Generate payment report
  async generatePaymentReport(startDate, endDate, options = {}) {
    try {
      const matchStage = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (options.status) {
        matchStage.status = options.status;
      }

      if (options.paymentMethod) {
        matchStage.paymentMethod = options.paymentMethod;
      }

      const report = await paymentModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              status: '$status',
              method: '$paymentMethod'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' },
            minAmount: { $min: '$amount' },
            maxAmount: { $max: '$amount' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      logger.info('Payment report generated', {
        startDate,
        endDate,
        recordCount: report.length,
        options
      });

      return {
        period: { startDate, endDate },
        options,
        data: report,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Payment report generation failed', error);
      throw error;
    }
  }
}

module.exports = new EnhancedPaymentService();