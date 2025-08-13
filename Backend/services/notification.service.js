// ===== 3. NOTIFICATION SERVICE (services/notification.service.js) =====
const userModel = require('../models/user.model');
const emailService = require('./email.service');

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
      - Location: ${booking.location}
      - Check-in: ${booking.checkIn.toDateString()}
      - Check-out: ${booking.checkOut.toDateString()}
      - Guests: ${booking.guests}
      - Board Type: ${booking.boardType}
      - Total Amount: €${booking.totalAmount.toFixed(2)}
      
      Thank you for choosing our service!

      Best regards,
      Hotel Booking Team
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
      - Location: ${booking.location}
      - Amount to be refunded: €${booking.totalAmount.toFixed(2)}
      
      ${booking.paymentStatus === 'refunded' ? 
        'The refund has been processed and will appear in your account within 5-7 business days.' :
        'If you made a payment, the refund will be processed within 24 hours.'
      }
      
      We're sorry to see you go and hope to serve you again in the future.
      
      Best regards,
      Hotel Booking Team
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
      - Currency: ${payment.currency}
      - Date: ${payment.createdAt.toDateString()}
      
      Booking Details:
      - Booking ID: ${booking?.bookingId || 'N/A'}
      - Hotel: ${booking?.hotelName || 'N/A'}

      Thank you for your payment!

      Best regards,
      Hotel Booking Team
    `
  }),
  bookingReminder: (booking) => ({
    subject: `Upcoming Stay Reminder - ${booking.bookingId}`,
    body: `
      Dear ${booking.userDetails?.fullname?.firstname || 'Guest'},
      
      This is a friendly reminder about your upcoming stay.
      
      Booking Details:
      - Booking ID: ${booking.bookingId}
      - Hotel: ${booking.hotelName}
      - Room: ${booking.roomName}
      - Location: ${booking.location}
      - Check-in: ${booking.checkIn.toDateString()}
      - Check-out: ${booking.checkOut.toDateString()}
      - Guests: ${booking.guests}
      
      We look forward to welcoming you!
      
      Safe travels,
      Hotel Booking Team
    `
  })
};



module.exports.sendBookingNotification = async (userId, type, data) => {
  try {
    const user = await userModel.findById(userId);
    
    if (!user || !user.preferences?.emailNotifications) {
      console.log('User notifications disabled or user not found');
      return; // User doesn't want notifications
    }

    const template = emailTemplates[type];
    if (!template) {
      throw new Error(`Unknown notification type: ${type}`);
    }

    const notification = template(data);
    
    // Send email using email service
    const result = await emailService.sendEmail({
      to: user.email,
      subject: notification.subject,
      text: notification.body,
      html: notification.body.replace(/\n/g, '<br>')
    });
    if (result.success) {
      console.log(`${type} notification sent to ${user.email}`);
    } else {
      console.error(`Failed to send ${type} notification:`, result.error);
    }
    
  } catch (error) {
    console.error('Notification error:', error);
  }
};


// Schedule booking reminders (call this from a cron job)
module.exports.sendBookingReminders = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Find bookings checking in tomorrow
    const upcomingBookings = await bookingModel
      .find({
        checkIn: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow
        },
        status: { $in: ['confirmed', 'upcoming'] }
      })
      .populate('userId', 'email fullname preferences');

    for (const booking of upcomingBookings) {
      if (booking.userId?.preferences?.emailNotifications) {
        await this.sendBookingNotification(
          booking.userId._id, 
          'bookingReminder',
          { ...booking.toObject(), userDetails: booking.userId }
        );
      }
    }

    console.log(`Sent ${upcomingBookings.length} booking reminders`);
  } catch (error) {
    console.error('Error sending booking reminders:', error);
  }
};