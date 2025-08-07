const paymentModel = require('../models/payment.model');

// Generate unique payment ID
const generatePaymentId = () => {
  const prefix = 'PAY-';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

module.exports.createPayment = async (paymentData) => {
  const paymentId = generatePaymentId();
  
  const payment = new paymentModel({
    ...paymentData,
    paymentId
  });
  
  return await payment.save();
};

module.exports.processRefund = async (originalPaymentId, refundAmount, reason = 'Booking cancellation') => {
  const originalPayment = await paymentModel.findOne({ paymentId: originalPaymentId });
  
  if (!originalPayment) {
    throw new Error('Original payment not found');
  }

  const refundPayment = new paymentModel({
    userId: originalPayment.userId,
    bookingId: originalPayment.bookingId,
    paymentId: generatePaymentId().replace('PAY-', 'REF-'),
    amount: -Math.abs(refundAmount),
    method: 'Refund',
    cardLast4: originalPayment.cardLast4,
    status: 'completed',
    transactionId: `refund_${originalPayment.transactionId}`
  });

  return await refundPayment.save();
};

module.exports.getUserPaymentStats = async (userId) => {
  const stats = await paymentModel.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
        totalRefunded: { $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] } },
        totalTransactions: { $sum: 1 },
        successfulPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {
    totalSpent: 0,
    totalRefunded: 0,
    totalTransactions: 0,
    successfulPayments: 0
  };
};