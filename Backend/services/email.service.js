const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.FROM_NAME || 'Hotel Booking'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });

      console.log('Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Hotel Booking Platform';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome ${user.fullname.firstname}!</h2>
        <p>Thank you for registering with our hotel booking platform.</p>
        <p>You can now:</p>
        <ul>
          <li>Search and book hotels worldwide</li>
          <li>Manage your bookings</li>
          <li>Track payment history</li>
          <li>Update your preferences</li>
        </ul>
        <p>Happy travels!</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html,
      text: `Welcome ${user.fullname.firstname}! Thank you for registering with our hotel booking platform.`
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    const subject = 'Password Reset Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${user.fullname.firstname},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p>
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
        </p>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html,
      text: `Password reset requested. Visit: ${resetUrl}`
    });
  }

  async sendBookingConfirmation(user, booking) {
    const subject = `Booking Confirmed - ${booking.bookingId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Booking Confirmed!</h2>
        <p>Dear ${user.fullname.firstname},</p>
        <p>Your booking has been confirmed. Here are the details:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Booking Details</h3>
          <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
          <p><strong>Hotel:</strong> ${booking.hotelName}</p>
          <p><strong>Room:</strong> ${booking.roomName}</p>
          <p><strong>Location:</strong> ${booking.location}</p>
          <p><strong>Check-in:</strong> ${booking.checkIn.toDateString()}</p>
          <p><strong>Check-out:</strong> ${booking.checkOut.toDateString()}</p>
          <p><strong>Guests:</strong> ${booking.guests}</p>
          <p><strong>Total Amount:</strong> €${booking.totalAmount.toFixed(2)}</p>
        </div>
        
        <p>We look forward to your stay!</p>
      </div>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html,
      text: `Booking confirmed: ${booking.bookingId} at ${booking.hotelName}`
    });
  }
}

module.exports = new EmailService();