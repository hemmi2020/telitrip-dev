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
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['Credit Card', 'Debit Card', 'PayPal', 'Bank Transfer', 'Refund'],
    required: true
  },
  cardLast4: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^\d{4}$/.test(v);
      },
      message: 'Card last 4 digits must be exactly 4 numbers'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: String,
  currency: {
    type: String,
    default: 'EUR'
  }
}, {
  timestamps: true
});

const paymentModel = mongoose.model('payment', paymentSchema);

module.exports = paymentModel;
