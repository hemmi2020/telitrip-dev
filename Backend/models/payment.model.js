const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Core payment information
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^PAY_\d+_[a-z0-9]+$/
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'booking',
    required: true,
    index: true
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be greater than 0'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value > 0;
      },
      message: 'Amount must be a valid positive number'
    }
  },
  currency: {
    type: String,
    required: true,
    enum: ['PKR', 'USD', 'EUR'],
    default: 'PKR',
    uppercase: true
  },
  
  // Payment method and gateway
  method: {
    type: String,
    required: true,
    enum: ['HBLPay', 'Cash', 'Bank Transfer', 'Credit Card', 'Debit Card'],
    default: 'HBLPay'
  },
  gateway: {
    type: String,
    default: 'HBLPay',
    enum: ['HBLPay', 'Manual', 'Other']
  },
  
  // Payment status
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partial_refund'],
    default: 'pending',
    index: true
  },
  
  // HBLPay specific fields
  sessionId: {
    type: String,
    index: true,
    sparse: true  // Allow null values but index non-null ones
  },
  transactionId: {
    type: String,
    index: true,
    sparse: true
  },
  
  // Gateway response data
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Payment card information (if applicable)
  cardInfo: {
    last4Digits: {
      type: String,
      match: /^\d{4}$/,
      validate: {
        validator: function(v) {
          return !v || /^\d{4}$/.test(v);
        },
        message: 'Last 4 digits must be exactly 4 numbers'
      }
    },
    cardType: {
      type: String,
      enum: ['Visa', 'MasterCard', 'UnionPay', 'HBL Debit', 'HBL Credit']
    },
    maskedCardNumber: String,
    expiryMonth: {
      type: Number,
      min: 1,
      max: 12
    },
    expiryYear: {
      type: Number,
      min: 2023,
      max: 2050
    }
  },
  
  // Timestamps for payment flow
  initiatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    index: true
  },
  failedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  
  // Error information
  errorCode: String,
  errorMessage: String,
  failureReason: String,
  
  // Additional metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    returnUrl: String,
    cancelUrl: String,
    orderId: String,
    
    // HBLPay specific metadata
    channel: {
      type: String,
      default: 'HOTEL_WEB'
    },
    typeId: {
      type: String,
      default: 'ECOM'
    },
    
    // Billing information
    billingInfo: {
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  
  // Refund information
  refundAmount: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(value) {
        return value <= this.amount;
      },
      message: 'Refund amount cannot exceed payment amount'
    }
  },
  refundReason: String,
  refundedAt: Date,
  refundTransactionId: String,
  
  // Partial refunds tracking
  refunds: [{
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    reason: {
      type: String,
      required: true
    },
    refundedAt: {
      type: Date,
      default: Date.now
    },
    transactionId: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    }
  }],
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }
}, {
  timestamps: true,
  versionKey: false,
  
  // Indexes for better query performance
  indexes: [
    { userId: 1, status: 1 },
    { bookingId: 1 },
    { sessionId: 1 },
    { transactionId: 1 },
    { paymentId: 1 },
    { status: 1, createdAt: -1 },
    { 'metadata.orderId': 1 },
    { createdAt: -1 },
    { amount: 1, currency: 1 },
    { method: 1, gateway: 1 }
  ]
});

// Compound indexes
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, initiatedAt: -1 });
paymentSchema.index({ bookingId: 1, status: 1 });

// Virtual for payment duration
paymentSchema.virtual('duration').get(function() {
  if (this.completedAt && this.initiatedAt) {
    return this.completedAt - this.initiatedAt;
  }
  return null;
});

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency,
    minimumFractionDigits: 2
  });
  
  try {
    return formatter.format(this.amount);
  } catch (error) {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }
});

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function() {
  if (this.refunds && this.refunds.length > 0) {
    return this.refunds
      .filter(refund => refund.status === 'completed')
      .reduce((total, refund) => total + refund.amount, 0);
  }
  return this.refundAmount || 0;
});

// Virtual for remaining refundable amount
paymentSchema.virtual('refundableAmount').get(function() {
  if (this.status !== 'completed') return 0;
  return this.amount - this.totalRefunded;
});

// Virtual for payment age in hours
paymentSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.initiatedAt) / (1000 * 60 * 60));
});

// Instance methods
paymentSchema.methods.markAsCompleted = function(gatewayResponse = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.gatewayResponse = { ...this.gatewayResponse, ...gatewayResponse };
  this.errorCode = undefined;
  this.errorMessage = undefined;
  this.failureReason = undefined;
  return this.save();
};

paymentSchema.methods.markAsFailed = function(errorCode, errorMessage, gatewayResponse = {}) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.errorCode = errorCode;
  this.errorMessage = errorMessage;
  this.failureReason = errorMessage;
  this.gatewayResponse = { ...this.gatewayResponse, ...gatewayResponse };
  return this.save();
};

paymentSchema.methods.markAsCancelled = function(reason, gatewayResponse = {}) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.failureReason = reason;
  this.gatewayResponse = { ...this.gatewayResponse, ...gatewayResponse };
  return this.save();
};

paymentSchema.methods.markAsRefunded = function(refundAmount, refundReason, transactionId = null) {
  const refundAmt = refundAmount || this.amount;
  
  // Add to refunds array
  this.refunds.push({
    amount: refundAmt,
    reason: refundReason,
    refundedAt: new Date(),
    transactionId: transactionId,
    status: 'completed'
  });
  
  // Update main refund fields
  this.refundAmount = (this.refundAmount || 0) + refundAmt;
  this.refundReason = refundReason;
  this.refundedAt = new Date();
  this.refundTransactionId = transactionId;
  
  // Update status
  if (this.refundAmount >= this.amount) {
    this.status = 'refunded';
  } else {
    this.status = 'partial_refund';
  }
  
  return this.save();
};

paymentSchema.methods.addPartialRefund = function(amount, reason, transactionId = null) {
  if (amount <= 0) {
    throw new Error('Refund amount must be positive');
  }
  
  if (amount > this.refundableAmount) {
    throw new Error('Refund amount exceeds refundable amount');
  }
  
  return this.markAsRefunded(amount, reason, transactionId);
};

paymentSchema.methods.updateCardInfo = function(cardData) {
  if (cardData.last4Digits) {
    this.cardInfo.last4Digits = cardData.last4Digits;
  }
  if (cardData.cardType) {
    this.cardInfo.cardType = cardData.cardType;
  }
  if (cardData.maskedCardNumber) {
    this.cardInfo.maskedCardNumber = cardData.maskedCardNumber;
  }
  if (cardData.expiryMonth) {
    this.cardInfo.expiryMonth = cardData.expiryMonth;
  }
  if (cardData.expiryYear) {
    this.cardInfo.expiryYear = cardData.expiryYear;
  }
  return this.save();
};

paymentSchema.methods.canBeRefunded = function() {
  return this.status === 'completed' && this.refundableAmount > 0;
};

paymentSchema.methods.isExpired = function() {
  // Consider payment expired if pending for more than 30 minutes
  const expiryTime = 30 * 60 * 1000; // 30 minutes in milliseconds
  return this.status === 'pending' && (Date.now() - this.initiatedAt) > expiryTime;
};

paymentSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  
  // Remove sensitive information
  delete obj.gatewayResponse;
  if (obj.cardInfo) {
    delete obj.cardInfo.maskedCardNumber;
  }
  
  return obj;
};

// Static methods
paymentSchema.statics.findBySessionId = function(sessionId) {
  return this.findOne({ sessionId, isDeleted: false });
};

paymentSchema.statics.findByPaymentId = function(paymentId) {
  return this.findOne({ paymentId, isDeleted: false });
};

paymentSchema.statics.findByTransactionId = function(transactionId) {
  return this.findOne({ transactionId, isDeleted: false });
};

paymentSchema.statics.getUserPayments = function(userId, status = null, options = {}) {
  const query = { userId, isDeleted: false };
  if (status) query.status = status;
  
  const {
    page = 1,
    limit = 10,
    sort = { createdAt: -1 }
  } = options;
  
  return this.find(query)
    .populate('bookingId', 'hotelName checkIn checkOut bookingId')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

paymentSchema.statics.getPaymentStats = function(userId, startDate, endDate) {
  const matchStage = {
    userId: new mongoose.Types.ObjectId(userId),
    isDeleted: false
  };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $group: {
        _id: null,
        stats: {
          $push: {
            status: '$_id',
            count: '$count',
            totalAmount: '$totalAmount',
            avgAmount: '$avgAmount'
          }
        },
        totalPayments: { $sum: '$count' },
        grandTotal: { $sum: '$totalAmount' }
      }
    }
  ]);
};

paymentSchema.statics.findExpiredPayments = function() {
  const expiryTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
  return this.find({
    status: 'pending',
    initiatedAt: { $lt: expiryTime },
    isDeleted: false
  });
};

paymentSchema.statics.getTotalsByStatus = function(userId = null) {
  const matchStage = { isDeleted: false };
  if (userId) {
    matchStage.userId = new mongoose.Types.ObjectId(userId);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

paymentSchema.statics.getRecentPayments = function(limit = 10) {
  return this.find({ isDeleted: false })
    .populate('userId', 'fullname email')
    .populate('bookingId', 'hotelName bookingId')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  // Set updatedBy if in context
  if (this.isModified() && this.$locals && this.$locals.userId) {
    this.updatedBy = this.$locals.userId;
  }
  
  // Auto-generate paymentId if not set
  if (this.isNew && !this.paymentId) {
    this.paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Validate refund amount
  if (this.refundAmount > this.amount) {
    return next(new Error('Refund amount cannot exceed payment amount'));
  }
  
  // Auto-set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Auto-set failedAt when status changes to failed
  if (this.isModified('status') && this.status === 'failed' && !this.failedAt) {
    this.failedAt = new Date();
  }
  
  // Auto-set cancelledAt when status changes to cancelled
  if (this.isModified('status') && this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
  
  next();
});

// Pre-validate middleware
paymentSchema.pre('validate', function(next) {
  // Ensure currency is uppercase
  if (this.currency) {
    this.currency = this.currency.toUpperCase();
  }
  
  // Validate amount precision based on currency
  if (this.amount) {
    if (this.currency === 'PKR') {
      // PKR allows up to 2 decimal places
      this.amount = Math.round(this.amount * 100) / 100;
    } else {
      // USD, EUR allow up to 2 decimal places
      this.amount = Math.round(this.amount * 100) / 100;
    }
  }
  
  next();
});

// Post-save middleware for logging
paymentSchema.post('save', function(doc) {
  console.log(`Payment ${doc.paymentId} status updated to: ${doc.status}`);
  
  // Log important status changes
  if (doc.status === 'completed') {
    console.log(`✅ Payment completed: ${doc.paymentId} - ${doc.formattedAmount}`);
  } else if (doc.status === 'failed') {
    console.log(`❌ Payment failed: ${doc.paymentId} - ${doc.errorMessage || 'Unknown error'}`);
  } else if (doc.status === 'refunded') {
    console.log(`🔄 Payment refunded: ${doc.paymentId} - ${doc.formattedAmount}`);
  }
});

// Post-update middleware
paymentSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    console.log(`Payment ${doc.paymentId} updated via findOneAndUpdate`);
  }
});

// Error handling middleware
paymentSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    next(new Error('Payment ID already exists'));
  } else {
    next(error);
  }
});

// Soft delete method
paymentSchema.methods.softDelete = function(deletedBy = null) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) {
    this.deletedBy = deletedBy;
  }
  return this.save();
};

// Restore soft deleted document
paymentSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

// Query helpers
paymentSchema.query.active = function() {
  return this.where({ isDeleted: false });
};

paymentSchema.query.byStatus = function(status) {
  return this.where({ status });
};

paymentSchema.query.byUser = function(userId) {
  return this.where({ userId });
};

paymentSchema.query.recent = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return this.where({ createdAt: { $gte: startDate } });
};

// Ensure virtual fields are serialized
paymentSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

paymentSchema.set('toObject', { virtuals: true });

const paymentModel = mongoose.model('payment', paymentSchema);

module.exports = paymentModel;