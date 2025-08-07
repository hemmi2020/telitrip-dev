const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  UPCOMING: 'upcoming',
  ACTIVE: 'active'
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  COMPLETED: 'completed'
};

const PAYMENT_METHODS = {
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'Bank Transfer',
  REFUND: 'Refund'
};

const BOARD_TYPES = {
  ROOM_ONLY: 'Room Only',
  HALF_BOARD: 'Half Board',
  FULL_BOARD: 'Full Board',
  ALL_INCLUSIVE: 'All Inclusive'
};

const RATE_CLASSES = {
  NOR: 'NOR', // Normal
  NRF: 'NRF', // Non-refundable
  PRE: 'PRE'  // Prepaid
};

const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super-admin'
};

const EMAIL_TYPES = {
  BOOKING_CONFIRMATION: 'bookingConfirmation',
  BOOKING_CANCELLATION: 'bookingCancellation',
  PAYMENT_CONFIRMATION: 'paymentConfirmation',
  PASSWORD_RESET: 'passwordReset'
};

module.exports = {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  BOARD_TYPES,
  RATE_CLASSES,
  USER_ROLES,
  EMAIL_TYPES
};