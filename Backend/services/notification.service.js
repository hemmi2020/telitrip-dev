// ===== 3. NOTIFICATION SERVICE (services/notification.service.js) =====
const userModel = require('../models/user.model');

// Email notification templates
const emailTemplates = {
  bookingConfirmation: (booking) => ({
    subject: `Booking Confirmed - ${booking.bookingId}`,
    body: `
      Dear ${booking.userDetails?.firstname || 'Guest'},
      
      Your booking has been confirmed!
      
      Booking Details:
      - Booking ID: ${booking.bookingId}
      - Hotel: ${booking.hotelName}
      - Room: ${booking.roomName}
      - Check-in: ${booking.checkIn.toDateString()}
      - Check-out: ${booking.checkOut.toDateString()}
      - Guests: ${booking.guests}
      - Total Amount: €${booking.totalAmount.toFixed(2)}
      
      Thank you for choosing our service!
    `
  }),
  
  bookingCancellation: (booking) => ({
    subject: `Booking Cancelled - ${booking.bookingId}`,
    body: `
      Dear ${booking.userDetails?.firstname || 'Guest'},
      
      Your booking has been cancelled.
      
      Booking Details:
      - Booking ID: ${booking.bookingId}
      - Hotel: ${booking.hotelName}
      - Amount to be refunded: €${booking.totalAmount.toFixed(2)}
      
      The refund will be processed within 5-7 business days.
    `
  }),
  
  paymentConfirmation: (payment, booking) => ({
    subject: `Payment Confirmation - ${payment.paymentId}`,
    body: `
      Dear Customer,
      
      Your payment has been processed successfully.
      
      Payment Details:
      - Payment ID: ${payment.paymentId}
      - Amount: €${payment.amount.toFixed(2)}
      - Method: ${payment.method}
      - Booking ID: ${booking?.bookingId || 'N/A'}
      
      Thank you for your payment!
    `
  })
};

module.exports.sendBookingNotification = async (userId, type, data) => {
  try {
    const user = await userModel.findById(userId);
    
    if (!user || !user.preferences?.emailNotifications) {
      return; // User doesn't want notifications
    }

    const template = emailTemplates[type];
    if (!template) {
      throw new Error(`Unknown notification type: ${type}`);
    }

    const notification = template(data);
    
    // Here you would integrate with your email service (SendGrid, NodeMailer, etc.)
    console.log('Sending email notification:', {
      to: user.email,
      subject: notification.subject,
      body: notification.body
    });
    
    // For now, just log the notification
    // In production, replace with actual email sending logic
    
  } catch (error) {
    console.error('Notification error:', error);
  }
};