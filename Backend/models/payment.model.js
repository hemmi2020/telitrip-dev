const mongoose = require('mongoose');


const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'booking',
    required: true
  },
  paymentId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  // HBLPay specific fields
  sessionId: {
    type: String,
    index: true // For quick lookups during callbacks
  },
  orderId: {
    type: String,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min:0
  },
  currency: {
    type: String,
    enum: ['PKR', 'USD', 'EUR', 'GBP'],
    default: 'PKR'
  },
  method: {
    type: String,
    enum: ['HBLPay', 'Credit Card', 'Debit Card', 'HBL Account', 'UnionPay', 'Bank Transfer', 'Refund'],
    default: 'HBLPay'
  },
  // Payment gateway specific fields
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed, // Store complete gateway response
    default: {}
  },
  transactionId: {
    type: String, // SESSION_ID from HBLPay
    index: true
  },
  referenceNumber: {
    type: String, // REFERENCE_NUMBER from request
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  // Card details (if applicable)
  cardLast4: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^\d{4}$/.test(v);
      },
      message: 'Card last 4 digits must be exactly 4 numbers'
    }
  },
  cardType: {
    type: String,
    enum: ['Visa', 'MasterCard', 'UnionPay', 'HBL Debit', 'HBL Credit']
  },
  // Timestamps for payment flow
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  // Error information
  errorCode: String,
  errorMessage: String,
  transactionId: String,
  // Additional metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    returnUrl: String,
    cancelUrl: String,
    // HBLPay specific metadata
    channel: String,
    typeId: String
  },
  // Refund information
  refundAmount: {
    type: Number,
    default: 0
  },
  refundReason: String,
  refundedAt: Date,
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }
}, {
  timestamps: true,
  // Add index for common queries
  index: [
    { userId: 1, status: 1 },
    { bookingId: 1 },
    { sessionId: 1 },
    { transactionId: 1 },
    { paymentId: 1 },
    { status: 1, createdAt: -1 }
  ]
});

// Virtual for payment duration
paymentSchema.virtual('duration').get(function() {
  if (this.completedAt) {
    return this.completedAt - this.initiatedAt;
  }
  return null;
});

// Instance methods
paymentSchema.methods.markAsCompleted = function(gatewayResponse = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.gatewayResponse = { ...this.gatewayResponse, ...gatewayResponse };
  return this.save();
};

paymentSchema.methods.markAsFailed = function(errorCode, errorMessage, gatewayResponse = {}) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.errorCode = errorCode;
  this.errorMessage = errorMessage;
  this.gatewayResponse = { ...this.gatewayResponse, ...gatewayResponse };
  return this.save();
};

paymentSchema.methods.markAsRefunded = function(refundAmount, refundReason) {
  this.status = 'refunded';
  this.refundAmount = refundAmount || this.amount;
  this.refundReason = refundReason;
  this.refundedAt = new Date();
  return this.save();
};

// Static methods
paymentSchema.statics.findBySessionId = function(sessionId) {
  return this.findOne({ sessionId });
};

paymentSchema.statics.findByPaymentId = function(paymentId) {
  return this.findOne({ paymentId });
};

paymentSchema.statics.getUserPayments = function(userId, status = null) {
  const query = { userId };
  if (status) query.status = status;
  return this.find(query).populate('bookingId').sort({ createdAt: -1 });
};

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  // Set updatedBy if in context
  if (this.isModified() && this.$locals.userId) {
    this.updatedBy = this.$locals.userId;
  }
  next();
});

// Post-save middleware for logging
paymentSchema.post('save', function(doc) {
  console.log(`Payment ${doc.paymentId} status updated to: ${doc.status}`);
});

const paymentModel = mongoose.model('payment', paymentSchema);

module.exports = paymentModel;
