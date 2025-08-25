const emailService = require('./email.service');
const crypto = require('crypto');

class NotificationService {
  constructor() {
    this.notificationTypes = {
      EMAIL: 'email',
      SMS: 'sms',
      PUSH: 'push',
      WEBHOOK: 'webhook'
    };
    
    this.eventTypes = {
      PAYMENT_COMPLETED: 'payment.completed',
      PAYMENT_FAILED: 'payment.failed',
      PAYMENT_REFUNDED: 'payment.refunded',
      PAYMENT_REMINDER: 'payment.reminder',
      PAYMENT_CANCELLED: 'payment.cancelled',
      BOOKING_CONFIRMED: 'booking.confirmed',
      BOOKING_CANCELLED: 'booking.cancelled',
      BOOKING_REMINDER: 'booking.reminder',
      BOOKING_MODIFIED: 'booking.modified'
    };
  }

  // ==================== PAYMENT NOTIFICATIONS ====================

  // Send payment confirmation notification
  async sendPaymentConfirmation(payment) {
    try {
      const populatedPayment = await payment.populate([
        { path: 'userId', select: 'fullname email phone preferences' },
        { path: 'bookingId', select: 'hotelName checkIn checkOut bookingId guests roomName location' }
      ]);

      // Check user preferences
      const userPrefs = await this.getNotificationPreferences(populatedPayment.userId._id);
      if (!userPrefs.preferences.paymentConfirmation) {
        console.log('User has disabled payment confirmation notifications');
        return;
      }

      const emailData = {
        to: populatedPayment.userId.email,
        subject: 'Payment Confirmation - Telitrip',
        template: 'payment-confirmation',
        context: {
          customerName: `${populatedPayment.userId.fullname?.firstname} ${populatedPayment.userId.fullname?.lastname}`,
          paymentId: populatedPayment.paymentId,
          amount: populatedPayment.formattedAmount,
          currency: populatedPayment.currency,
          hotelName: populatedPayment.bookingId?.hotelName,
          roomName: populatedPayment.bookingId?.roomName,
          location: populatedPayment.bookingId?.location,
          bookingId: populatedPayment.bookingId?.bookingId,
          checkIn: populatedPayment.bookingId?.checkIn?.toDateString(),
          checkOut: populatedPayment.bookingId?.checkOut?.toDateString(),
          guests: populatedPayment.bookingId?.guests,
          paymentDate: populatedPayment.completedAt?.toDateString(),
          method: populatedPayment.method,
          gateway: populatedPayment.gateway,
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours',
          supportEmail: process.env.COMPANY_EMAIL || 'support@telitrip.com',
          websiteUrl: process.env.FRONTEND_URL
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Payment confirmation email sent for payment: ${payment.paymentId}`);
      
      // Send SMS if enabled and user has phone
      if (userPrefs.sms && populatedPayment.userId.phone) {
        const smsMessage = `Payment confirmed! ${populatedPayment.formattedAmount} for booking ${populatedPayment.bookingId?.bookingId}. Payment ID: ${populatedPayment.paymentId}`;
        await this.sendSMSNotification(populatedPayment.userId.phone, smsMessage, 'payment_confirmation');
      }

      return { success: true, type: 'payment_confirmation' };
      
    } catch (error) {
      console.error('Failed to send payment confirmation:', error);
      throw error;
    }
  }

  // Send payment failure notification
  async sendPaymentFailure(payment) {
    try {
      const populatedPayment = await payment.populate([
        { path: 'userId', select: 'fullname email phone preferences' },
        { path: 'bookingId', select: 'hotelName bookingId roomName location' }
      ]);

      const userPrefs = await this.getNotificationPreferences(populatedPayment.userId._id);
      if (!userPrefs.preferences.paymentFailure) {
        console.log('User has disabled payment failure notifications');
        return;
      }

      const emailData = {
        to: populatedPayment.userId.email,
        subject: 'Payment Failed - Please Try Again',
        template: 'payment-failed',
        context: {
          customerName: `${populatedPayment.userId.fullname?.firstname} ${populatedPayment.userId.fullname?.lastname}`,
          paymentId: populatedPayment.paymentId,
          amount: populatedPayment.formattedAmount,
          hotelName: populatedPayment.bookingId?.hotelName,
          roomName: populatedPayment.bookingId?.roomName,
          location: populatedPayment.bookingId?.location,
          bookingId: populatedPayment.bookingId?.bookingId,
          failureReason: populatedPayment.errorMessage || 'Payment processing failed due to technical issues',
          failureCode: populatedPayment.errorCode || 'UNKNOWN',
          retryUrl: `${process.env.FRONTEND_URL}/booking/${populatedPayment.bookingId?.bookingId}/payment`,
          supportUrl: `${process.env.FRONTEND_URL}/support`,
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours',
          supportEmail: process.env.COMPANY_EMAIL || 'support@telitrip.com',
          supportPhone: process.env.COMPANY_PHONE || '+1-800-TELITRIP'
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Payment failure email sent for payment: ${payment.paymentId}`);

      return { success: true, type: 'payment_failure' };
      
    } catch (error) {
      console.error('Failed to send payment failure notification:', error);
      throw error;
    }
  }

  // Send refund confirmation
  async sendRefundConfirmation(payment, refundAmount, refundReason) {
    try {
      const populatedPayment = await payment.populate([
        { path: 'userId', select: 'fullname email phone preferences' },
        { path: 'bookingId', select: 'hotelName bookingId roomName location' }
      ]);

      const userPrefs = await this.getNotificationPreferences(populatedPayment.userId._id);
      if (!userPrefs.preferences.refundNotification) {
        console.log('User has disabled refund notifications');
        return;
      }

      const emailData = {
        to: populatedPayment.userId.email,
        subject: 'Refund Processed Successfully - Telitrip',
        template: 'refund-confirmation',
        context: {
          customerName: `${populatedPayment.userId.fullname?.firstname} ${populatedPayment.userId.fullname?.lastname}`,
          paymentId: populatedPayment.paymentId,
          originalAmount: populatedPayment.formattedAmount,
          refundAmount: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: populatedPayment.currency
          }).format(refundAmount),
          refundReason: refundReason || 'Booking cancellation',
          hotelName: populatedPayment.bookingId?.hotelName,
          roomName: populatedPayment.bookingId?.roomName,
          location: populatedPayment.bookingId?.location,
          bookingId: populatedPayment.bookingId?.bookingId,
          refundDate: new Date().toDateString(),
          processingTime: '3-5 business days',
          refundMethod: populatedPayment.method,
          transactionId: populatedPayment.transactionId,
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours',
          supportEmail: process.env.COMPANY_EMAIL || 'support@telitrip.com',
          refundPolicyUrl: `${process.env.FRONTEND_URL}/refund-policy`
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Refund confirmation email sent for payment: ${payment.paymentId}`);

      return { success: true, type: 'refund_confirmation' };
      
    } catch (error) {
      console.error('Failed to send refund confirmation:', error);
      throw error;
    }
  }

  // Send payment reminder for pending payments
  async sendPaymentReminder(payment) {
    try {
      const populatedPayment = await payment.populate([
        { path: 'userId', select: 'fullname email phone preferences' },
        { path: 'bookingId', select: 'hotelName bookingId checkIn checkOut roomName location' }
      ]);

      // Only send reminder if payment is still pending and not expired
      if (populatedPayment.status !== 'pending' || populatedPayment.isExpired()) {
        console.log('Payment is not pending or has expired, skipping reminder');
        return;
      }

      const userPrefs = await this.getNotificationPreferences(populatedPayment.userId._id);
      if (!userPrefs.preferences.paymentReminder) {
        console.log('User has disabled payment reminder notifications');
        return;
      }

      const emailData = {
        to: populatedPayment.userId.email,
        subject: 'Payment Reminder - Complete Your Booking',
        template: 'payment-reminder',
        context: {
          customerName: `${populatedPayment.userId.fullname?.firstname} ${populatedPayment.userId.fullname?.lastname}`,
          paymentId: populatedPayment.paymentId,
          amount: populatedPayment.formattedAmount,
          hotelName: populatedPayment.bookingId?.hotelName,
          roomName: populatedPayment.bookingId?.roomName,
          location: populatedPayment.bookingId?.location,
          bookingId: populatedPayment.bookingId?.bookingId,
          checkIn: populatedPayment.bookingId?.checkIn?.toDateString(),
          checkOut: populatedPayment.bookingId?.checkOut?.toDateString(),
          paymentUrl: `${process.env.FRONTEND_URL}/payment/resume?paymentId=${populatedPayment.paymentId}`,
          expiryTime: '30 minutes',
          urgentMessage: 'Your booking will be cancelled if payment is not completed soon.',
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours',
          supportEmail: process.env.COMPANY_EMAIL || 'support@telitrip.com'
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Payment reminder email sent for payment: ${payment.paymentId}`);

      return { success: true, type: 'payment_reminder' };
      
    } catch (error) {
      console.error('Failed to send payment reminder:', error);
      throw error;
    }
  }

  // ==================== BOOKING NOTIFICATIONS ====================

  // Send booking confirmation notification
  async sendBookingConfirmation(booking) {
    try {
      const populatedBooking = await booking.populate([
        { path: 'userId', select: 'fullname email phone preferences' }
      ]);

      const userPrefs = await this.getNotificationPreferences(populatedBooking.userId._id);
      if (!userPrefs.preferences.bookingConfirmation) {
        console.log('User has disabled booking confirmation notifications');
        return;
      }

      const emailData = {
        to: populatedBooking.userId.email,
        subject: `Booking Confirmed - ${populatedBooking.bookingId}`,
        template: 'booking-confirmation',
        context: {
          customerName: `${populatedBooking.userId.fullname?.firstname} ${populatedBooking.userId.fullname?.lastname}`,
          bookingId: populatedBooking.bookingId,
          hotelName: populatedBooking.hotelName,
          roomName: populatedBooking.roomName,
          location: populatedBooking.location,
          checkIn: populatedBooking.checkIn?.toDateString(),
          checkOut: populatedBooking.checkOut?.toDateString(),
          guests: populatedBooking.guests,
          boardType: populatedBooking.boardType,
          totalAmount: populatedBooking.formattedAmount || `€${populatedBooking.totalAmount?.toFixed(2)}`,
          bookingDate: populatedBooking.createdAt?.toDateString(),
          cancellationPolicy: populatedBooking.cancellationPolicy,
          specialRequests: populatedBooking.specialRequests,
          checkInTime: '15:00',
          checkOutTime: '11:00',
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours',
          supportEmail: process.env.COMPANY_EMAIL || 'support@telitrip.com',
          manageBookingUrl: `${process.env.FRONTEND_URL}/bookings/${populatedBooking.bookingId}`
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Booking confirmation email sent for booking: ${booking.bookingId}`);

      return { success: true, type: 'booking_confirmation' };
      
    } catch (error) {
      console.error('Failed to send booking confirmation:', error);
      throw error;
    }
  }

  // Send booking cancellation notification
  async sendBookingCancellation(booking, cancellationReason = '') {
    try {
      const populatedBooking = await booking.populate([
        { path: 'userId', select: 'fullname email phone preferences' }
      ]);

      const userPrefs = await this.getNotificationPreferences(populatedBooking.userId._id);
      if (!userPrefs.emailNotifications) {
        console.log('User has disabled email notifications');
        return;
      }

      const emailData = {
        to: populatedBooking.userId.email,
        subject: `Booking Cancelled - ${populatedBooking.bookingId}`,
        template: 'booking-cancellation',
        context: {
          customerName: `${populatedBooking.userId.fullname?.firstname} ${populatedBooking.userId.fullname?.lastname}`,
          bookingId: populatedBooking.bookingId,
          hotelName: populatedBooking.hotelName,
          roomName: populatedBooking.roomName,
          location: populatedBooking.location,
          checkIn: populatedBooking.checkIn?.toDateString(),
          checkOut: populatedBooking.checkOut?.toDateString(),
          totalAmount: populatedBooking.formattedAmount || `€${populatedBooking.totalAmount?.toFixed(2)}`,
          cancellationReason: cancellationReason,
          cancellationDate: new Date().toDateString(),
          refundInfo: populatedBooking.paymentStatus === 'refunded' ? 
            'The refund has been processed and will appear in your account within 5-7 business days.' :
            'If you made a payment, the refund will be processed within 24 hours.',
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours',
          supportEmail: process.env.COMPANY_EMAIL || 'support@telitrip.com'
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Booking cancellation email sent for booking: ${booking.bookingId}`);

      return { success: true, type: 'booking_cancellation' };
      
    } catch (error) {
      console.error('Failed to send booking cancellation:', error);
      throw error;
    }
  }

  // Send booking reminder notification
  async sendBookingReminder(booking) {
    try {
      const populatedBooking = await booking.populate([
        { path: 'userId', select: 'fullname email phone preferences' }
      ]);

      const userPrefs = await this.getNotificationPreferences(populatedBooking.userId._id);
      if (!userPrefs.preferences.bookingReminder) {
        console.log('User has disabled booking reminder notifications');
        return;
      }

      const emailData = {
        to: populatedBooking.userId.email,
        subject: `Upcoming Stay Reminder - ${populatedBooking.bookingId}`,
        template: 'booking-reminder',
        context: {
          customerName: `${populatedBooking.userId.fullname?.firstname} ${populatedBooking.userId.fullname?.lastname}`,
          bookingId: populatedBooking.bookingId,
          hotelName: populatedBooking.hotelName,
          roomName: populatedBooking.roomName,
          location: populatedBooking.location,
          address: populatedBooking.address,
          checkIn: populatedBooking.checkIn?.toDateString(),
          checkOut: populatedBooking.checkOut?.toDateString(),
          guests: populatedBooking.guests,
          boardType: populatedBooking.boardType,
          checkInTime: '15:00',
          checkOutTime: '11:00',
          hotelPhone: populatedBooking.hotelPhone,
          directions: populatedBooking.directions,
          weatherTip: 'Don\'t forget to check the weather forecast for your destination!',
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours',
          supportEmail: process.env.COMPANY_EMAIL || 'support@telitrip.com',
          manageBookingUrl: `${process.env.FRONTEND_URL}/bookings/${populatedBooking.bookingId}`
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Booking reminder email sent for booking: ${booking.bookingId}`);

      return { success: true, type: 'booking_reminder' };
      
    } catch (error) {
      console.error('Failed to send booking reminder:', error);
      throw error;
    }
  }

  // Send booking modification notification
  async sendBookingModification(booking, changes) {
    try {
      const populatedBooking = await booking.populate([
        { path: 'userId', select: 'fullname email phone preferences' }
      ]);

      const userPrefs = await this.getNotificationPreferences(populatedBooking.userId._id);
      if (!userPrefs.emailNotifications) {
        console.log('User has disabled email notifications');
        return;
      }

      const emailData = {
        to: populatedBooking.userId.email,
        subject: `Booking Modified - ${populatedBooking.bookingId}`,
        template: 'booking-modification',
        context: {
          customerName: `${populatedBooking.userId.fullname?.firstname} ${populatedBooking.userId.fullname?.lastname}`,
          bookingId: populatedBooking.bookingId,
          hotelName: populatedBooking.hotelName,
          changes: changes,
          modificationDate: new Date().toDateString(),
          newCheckIn: populatedBooking.checkIn?.toDateString(),
          newCheckOut: populatedBooking.checkOut?.toDateString(),
          newTotalAmount: populatedBooking.formattedAmount || `€${populatedBooking.totalAmount?.toFixed(2)}`,
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours',
          supportEmail: process.env.COMPANY_EMAIL || 'support@telitrip.com',
          manageBookingUrl: `${process.env.FRONTEND_URL}/bookings/${populatedBooking.bookingId}`
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Booking modification email sent for booking: ${booking.bookingId}`);

      return { success: true, type: 'booking_modification' };
      
    } catch (error) {
      console.error('Failed to send booking modification:', error);
      throw error;
    }
  }

  // ==================== ADMIN NOTIFICATIONS ====================

  // Send admin notification for high-value payments
  async sendAdminPaymentNotification(payment, type = 'completed') {
    try {
      // Only notify for payments above threshold
      const notificationThreshold = process.env.ADMIN_NOTIFICATION_THRESHOLD || 50000;
      if (payment.amount < notificationThreshold) {
        return;
      }

      const populatedPayment = await payment.populate([
        { path: 'userId', select: 'fullname email phone' },
        { path: 'bookingId', select: 'hotelName bookingId checkIn checkOut roomName location' }
      ]);

      const emailData = {
        to: process.env.ADMIN_EMAIL,
        subject: `🚨 High-Value Payment ${type.toUpperCase()} - ${populatedPayment.formattedAmount}`,
        template: 'admin-payment-notification',
        context: {
          paymentId: populatedPayment.paymentId,
          amount: populatedPayment.formattedAmount,
          currency: populatedPayment.currency,
          status: populatedPayment.status,
          type: type,
          customerName: `${populatedPayment.userId.fullname?.firstname} ${populatedPayment.userId.fullname?.lastname}`,
          customerEmail: populatedPayment.userId.email,
          customerPhone: populatedPayment.userId.phone,
          hotelName: populatedPayment.bookingId?.hotelName,
          roomName: populatedPayment.bookingId?.roomName,
          location: populatedPayment.bookingId?.location,
          bookingId: populatedPayment.bookingId?.bookingId,
          checkIn: populatedPayment.bookingId?.checkIn?.toDateString(),
          checkOut: populatedPayment.bookingId?.checkOut?.toDateString(),
          paymentDate: populatedPayment.completedAt?.toDateString() || populatedPayment.createdAt?.toDateString(),
          method: populatedPayment.method,
          gateway: populatedPayment.gateway,
          transactionId: populatedPayment.transactionId,
          adminUrl: `${process.env.BACKEND_URL}/admin/payments/${populatedPayment.paymentId}`,
          customerUrl: `${process.env.BACKEND_URL}/admin/users/${populatedPayment.userId._id}`,
          bookingUrl: `${process.env.BACKEND_URL}/admin/bookings/${populatedPayment.bookingId?._id}`,
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours'
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Admin notification sent for payment: ${payment.paymentId}`);

      return { success: true, type: 'admin_payment_notification' };
      
    } catch (error) {
      console.error('Failed to send admin notification:', error);
      // Don't throw error for admin notifications to avoid affecting user flow
    }
  }

  // Send admin booking notification
  async sendAdminBookingNotification(booking, type = 'new') {
    try {
      if (!process.env.ADMIN_EMAIL) {
        return;
      }

      const populatedBooking = await booking.populate([
        { path: 'userId', select: 'fullname email phone' }
      ]);

      const emailData = {
        to: process.env.ADMIN_EMAIL,
        subject: `📋 ${type.toUpperCase()} Booking - ${populatedBooking.bookingId}`,
        template: 'admin-booking-notification',
        context: {
          bookingId: populatedBooking.bookingId,
          type: type,
          hotelName: populatedBooking.hotelName,
          roomName: populatedBooking.roomName,
          location: populatedBooking.location,
          checkIn: populatedBooking.checkIn?.toDateString(),
          checkOut: populatedBooking.checkOut?.toDateString(),
          guests: populatedBooking.guests,
          totalAmount: populatedBooking.formattedAmount || `€${populatedBooking.totalAmount?.toFixed(2)}`,
          customerName: `${populatedBooking.userId.fullname?.firstname} ${populatedBooking.userId.fullname?.lastname}`,
          customerEmail: populatedBooking.userId.email,
          customerPhone: populatedBooking.userId.phone,
          bookingDate: populatedBooking.createdAt?.toDateString(),
          status: populatedBooking.status,
          paymentStatus: populatedBooking.paymentStatus,
          adminUrl: `${process.env.BACKEND_URL}/admin/bookings/${populatedBooking._id}`,
          customerUrl: `${process.env.BACKEND_URL}/admin/users/${populatedBooking.userId._id}`,
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours'
        }
      };

      await emailService.sendEmail(emailData);
      console.log(`Admin booking notification sent for booking: ${booking.bookingId}`);

      return { success: true, type: 'admin_booking_notification' };
      
    } catch (error) {
      console.error('Failed to send admin booking notification:', error);
    }
  }

  // ==================== OTHER NOTIFICATION CHANNELS ====================

  // Send SMS notification (if SMS service is configured)
  async sendSMSNotification(phone, message, type = 'general') {
    try {
      if (!process.env.SMS_ENABLED || process.env.SMS_ENABLED !== 'true') {
        console.log('SMS notifications disabled');
        return;
      }

      // Validate phone number
      if (!phone || !phone.match(/^\+?[\d\s-()]+$/)) {
        console.log('Invalid phone number format');
        return;
      }

      // SMS implementation would go here (Twilio, AWS SNS, etc.)
      // This is a placeholder for SMS service integration
      console.log(`SMS ${type} notification sent to ${phone}: ${message}`);
      
      return { success: true, phone, type, message };
      
    } catch (error) {
      console.error('Failed to send SMS notification:', error);
      // Don't throw error for SMS notifications
    }
  }

  // Send push notification (if push service is configured)
  async sendPushNotification(userId, title, body, data = {}) {
    try {
      if (!process.env.FCM_ENABLED || process.env.FCM_ENABLED !== 'true') {
        console.log('Push notifications disabled');
        return;
      }

      // FCM implementation would go here
      // This is a placeholder for FCM integration
      console.log(`Push notification sent to user ${userId}: ${title} - ${body}`);
      
      return { success: true, userId, title, body, data };
      
    } catch (error) {
      console.error('Failed to send push notification:', error);
      // Don't throw error for push notifications
    }
  }

  // Send webhook notification to external systems
  async sendWebhookNotification(webhookUrl, eventData, eventType) {
    try {
      if (!webhookUrl) {
        return;
      }

      const webhookPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: eventData,
        signature: this.generateWebhookSignature(eventData),
        version: '1.0'
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': webhookPayload.signature,
          'X-Webhook-Event': eventType,
          'User-Agent': 'Telitrip-Webhook/1.0'
        },
        body: JSON.stringify(webhookPayload),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      console.log(`Webhook notification sent for event: ${eventType}`);
      return { success: true, eventType, status: response.status };
      
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
      // Log webhook failures but don't throw to avoid affecting main flow
    }
  }

  // Generate webhook signature for security
  generateWebhookSignature(data) {
    const secret = process.env.WEBHOOK_SECRET || 'default_webhook_secret';
    
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex');
  }

  // ==================== EVENT DISPATCHERS ====================

  // Comprehensive notification dispatcher for payment events
  async notifyPaymentEvent(payment, eventType, additionalData = {}) {
    try {
      console.log(`Processing notifications for payment event: ${eventType}`);

      let result = {};

      switch (eventType) {
        case this.eventTypes.PAYMENT_COMPLETED:
          result.email = await this.sendPaymentConfirmation(payment);
          result.admin = await this.sendAdminPaymentNotification(payment, 'completed');
          
          // Send SMS if phone number is available
          const user = await payment.populate('userId', 'phone fullname preferences');
          if (user.userId?.phone) {
            const smsMessage = `Payment confirmed! Your booking is confirmed. Payment ID: ${payment.paymentId}. Amount: ${payment.formattedAmount}`;
            result.sms = await this.sendSMSNotification(user.userId.phone, smsMessage, 'payment_success');
          }
          break;

        case this.eventTypes.PAYMENT_FAILED:
          result.email = await this.sendPaymentFailure(payment);
          break;

        case this.eventTypes.PAYMENT_REFUNDED:
          const { refundAmount, refundReason } = additionalData;
          result.email = await this.sendRefundConfirmation(payment, refundAmount, refundReason);
          result.admin = await this.sendAdminPaymentNotification(payment, 'refunded');
          break;

        case this.eventTypes.PAYMENT_REMINDER:
          result.email = await this.sendPaymentReminder(payment);
          break;

        case this.eventTypes.PAYMENT_CANCELLED:
          console.log(`Payment cancelled: ${payment.paymentId}`);
          break;

        default:
          console.log(`Unknown payment event type: ${eventType}`);
      }

      // Send webhook notifications if configured
      if (process.env.WEBHOOK_URL) {
        result.webhook = await this.sendWebhookNotification(
          process.env.WEBHOOK_URL,
          payment,
          eventType
        );
      }

      return result;

    } catch (error) {
      console.error(`Failed to process notifications for payment event ${eventType}:`, error);
      // Don't throw error to avoid affecting main payment flow
    }
  }

  // Notification dispatcher for booking events
  async notifyBookingEvent(booking, eventType, additionalData = {}) {
    try {
      console.log(`Processing notifications for booking event: ${eventType}`);

      let result = {};

      switch (eventType) {
        case this.eventTypes.BOOKING_CONFIRMED:
          result.email = await this.sendBookingConfirmation(booking);
          result.admin = await this.sendAdminBookingNotification(booking, 'confirmed');
          break;

        case this.eventTypes.BOOKING_CANCELLED:
          const { cancellationReason } = additionalData;
          result.email = await this.sendBookingCancellation(booking, cancellationReason);
          result.admin = await this.sendAdminBookingNotification(booking, 'cancelled');
          break;

        case this.eventTypes.BOOKING_REMINDER:
          result.email = await this.sendBookingReminder(booking);
          break;

        case this.eventTypes.BOOKING_MODIFIED:
          const { changes } = additionalData;
          result.email = await this.sendBookingModification(booking, changes);
          result.admin = await this.sendAdminBookingNotification(booking, 'modified');
          break;

        default:
          console.log(`Unknown booking event type: ${eventType}`);
      }

      // Send webhook notifications if configured
      if (process.env.WEBHOOK_URL) {
        result.webhook = await this.sendWebhookNotification(
          process.env.WEBHOOK_URL,
          booking,
          eventType
        );
      }

      return result;

    } catch (error) {
      console.error(`Failed to process notifications for booking event ${eventType}:`, error);
    }
  }

  // Universal notification dispatcher
  async notifyEvent(entity, eventType, additionalData = {}) {
    if (eventType.startsWith('payment.')) {
      return await this.notifyPaymentEvent(entity, eventType, additionalData);
    } else if (eventType.startsWith('booking.')) {
      return await this.notifyBookingEvent(entity, eventType, additionalData);
    } else {
      console.log(`Unknown event type: ${eventType}`);
    }
  }

  // ==================== BATCH AND SCHEDULED OPERATIONS ====================

  // Batch notification for multiple entities
  async sendBatchNotifications(entities, eventType, additionalData = {}) {
    console.log(`Starting batch notifications for ${entities.length} entities, event: ${eventType}`);
    
    const batchSize = 10; // Process in batches to avoid overwhelming services
    const results = [];

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      const batchPromises = batch.map(entity => 
        this.notifyEvent(entity, eventType, additionalData).catch(error => {
          console.error(`Batch notification failed for entity ${entity._id || entity.id}:`, error);
          return { error: error.message, entity: entity._id || entity.id };
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < entities.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successful = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
    const failed = results.filter(r => r.status === 'rejected' || r.value?.error).length;
    
    console.log(`Batch notifications completed: ${successful} successful, ${failed} failed`);
    
    return { successful, failed, results };
  }

  // Schedule reminder notifications for pending payments
  async schedulePaymentReminders() {
    try {
      const paymentModel = require('../models/payment.model');
      
      // Find payments that are pending for more than 15 minutes but less than 25 minutes
      const reminderTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      const cutoffTime = new Date(Date.now() - 25 * 60 * 1000); // 25 minutes ago
      
      const pendingPayments = await paymentModel.find({
        status: 'pending',
        initiatedAt: { 
          $gte: cutoffTime,
          $lte: reminderTime 
        },
        isDeleted: false,
        reminderSent: { $ne: true } // Avoid sending multiple reminders
      });

      console.log(`Found ${pendingPayments.length} payments for reminder notifications`);

      const results = [];
      for (const payment of pendingPayments) {
        try {
          const result = await this.notifyPaymentEvent(payment, this.eventTypes.PAYMENT_REMINDER);
          
          // Mark reminder as sent
          await paymentModel.findByIdAndUpdate(payment._id, { reminderSent: true });
          
          results.push({ paymentId: payment.paymentId, success: true, result });
          
          // Add small delay to avoid overwhelming email service
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Failed to send reminder for payment ${payment.paymentId}:`, error);
          results.push({ paymentId: payment.paymentId, success: false, error: error.message });
        }
      }

      return results;

    } catch (error) {
      console.error('Failed to schedule payment reminders:', error);
      throw error;
    }
  }

  // Schedule booking reminders (call this from a cron job)
  async scheduleBookingReminders() {
    try {
      const bookingModel = require('../models/booking.model');
      
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
          status: { $in: ['confirmed', 'upcoming'] },
          reminderSent: { $ne: true } // Avoid sending multiple reminders
        })
        .populate('userId', 'email fullname preferences');

      console.log(`Found ${upcomingBookings.length} bookings for reminder notifications`);

      const results = [];
      for (const booking of upcomingBookings) {
        try {
          const result = await this.notifyBookingEvent(booking, this.eventTypes.BOOKING_REMINDER);
          
          // Mark reminder as sent
          await bookingModel.findByIdAndUpdate(booking._id, { reminderSent: true });
          
          results.push({ bookingId: booking.bookingId, success: true, result });
          
          // Add small delay to avoid overwhelming email service
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Failed to send reminder for booking ${booking.bookingId}:`, error);
          results.push({ bookingId: booking.bookingId, success: false, error: error.message });
        }
      }

      return results;

    } catch (error) {
      console.error('Error sending booking reminders:', error);
      throw error;
    }
  }

  // Schedule daily digest for admins
  async sendDailyAdminDigest() {
    try {
      if (!process.env.ADMIN_EMAIL) {
        console.log('Admin email not configured, skipping daily digest');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch today's statistics
      const [paymentModel, bookingModel] = [
        require('../models/payment.model'),
        require('../models/booking.model')
      ];

      const [todaysPayments, todaysBookings, pendingPayments] = await Promise.all([
        paymentModel.find({
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'completed'
        }),
        bookingModel.find({
          createdAt: { $gte: today, $lt: tomorrow }
        }),
        paymentModel.find({
          status: 'pending',
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        })
      ]);

      const totalRevenue = todaysPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const averageBookingValue = todaysBookings.length > 0 ? 
        todaysBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0) / todaysBookings.length : 0;

      const emailData = {
        to: process.env.ADMIN_EMAIL,
        subject: `📊 Daily Digest - ${today.toDateString()}`,
        template: 'admin-daily-digest',
        context: {
          date: today.toDateString(),
          totalPayments: todaysPayments.length,
          totalRevenue: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(totalRevenue),
          totalBookings: todaysBookings.length,
          averageBookingValue: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(averageBookingValue),
          pendingPayments: pendingPayments.length,
          highValuePayments: todaysPayments.filter(p => p.amount > (process.env.ADMIN_NOTIFICATION_THRESHOLD || 50000)).length,
          dashboardUrl: `${process.env.BACKEND_URL}/admin/dashboard`,
          companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours'
        }
      };

      await emailService.sendEmail(emailData);
      console.log('Daily admin digest sent successfully');

      return { success: true, date: today.toDateString() };

    } catch (error) {
      console.error('Failed to send daily admin digest:', error);
      throw error;
    }
  }

  // ==================== USER PREFERENCES ====================

  // Get notification preferences for a user
  async getNotificationPreferences(userId) {
    try {
      const userModel = require('../models/user.model');
      const user = await userModel.findById(userId).select('preferences');
      
      const defaultPreferences = {
        email: true,
        sms: false,
        push: true,
        webhook: false,
        emailNotifications: true,
        preferences: {
          paymentConfirmation: true,
          paymentFailure: true,
          refundNotification: true,
          paymentReminder: true,
          bookingConfirmation: true,
          bookingReminder: true,
          bookingModification: true,
          marketingEmails: false,
          promotionalOffers: false
        }
      };

      return user?.preferences ? { ...defaultPreferences, ...user.preferences } : defaultPreferences;
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      // Return default preferences
      return {
        email: true,
        sms: false,
        push: true,
        webhook: false,
        emailNotifications: true,
        preferences: {
          paymentConfirmation: true,
          paymentFailure: true,
          refundNotification: true,
          paymentReminder: true,
          bookingConfirmation: true,
          bookingReminder: true,
          bookingModification: true,
          marketingEmails: false,
          promotionalOffers: false
        }
      };
    }
  }

  // Update notification preferences
  async updateNotificationPreferences(userId, preferences) {
    try {
      const userModel = require('../models/user.model');
      
      // Validate preferences structure
      const validatedPreferences = this.validatePreferences(preferences);
      
      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { $set: { preferences: validatedPreferences } },
        { new: true, upsert: false }
      );
      
      if (!updatedUser) {
        throw new Error('User not found');
      }
      
      console.log(`Updated notification preferences for user ${userId}`);
      return updatedUser.preferences;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  // Validate preference structure
  validatePreferences(preferences) {
    const validKeys = ['email', 'sms', 'push', 'webhook', 'emailNotifications', 'preferences'];
    const validPreferenceKeys = [
      'paymentConfirmation', 'paymentFailure', 'refundNotification', 'paymentReminder',
      'bookingConfirmation', 'bookingReminder', 'bookingModification',
      'marketingEmails', 'promotionalOffers'
    ];

    const validated = {};

    // Validate top-level preferences
    validKeys.forEach(key => {
      if (preferences.hasOwnProperty(key)) {
        if (key === 'preferences') {
          validated[key] = {};
          validPreferenceKeys.forEach(prefKey => {
            if (preferences[key].hasOwnProperty(prefKey)) {
              validated[key][prefKey] = Boolean(preferences[key][prefKey]);
            }
          });
        } else {
          validated[key] = Boolean(preferences[key]);
        }
      }
    });

    return validated;
  }

  // ==================== ANALYTICS AND REPORTING ====================

  // Get notification statistics
  async getNotificationStats(startDate, endDate) {
    try {
      // This would typically come from a notifications log/analytics service
      // For now, return mock data structure
      return {
        period: {
          start: startDate,
          end: endDate
        },
        email: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          failed: 0
        },
        sms: {
          sent: 0,
          delivered: 0,
          failed: 0
        },
        push: {
          sent: 0,
          delivered: 0,
          opened: 0,
          failed: 0
        },
        webhook: {
          sent: 0,
          successful: 0,
          failed: 0
        },
        byType: {
          paymentConfirmation: 0,
          paymentFailure: 0,
          paymentReminder: 0,
          bookingConfirmation: 0,
          bookingReminder: 0,
          refundConfirmation: 0
        }
      };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  // Test notification system
  async testNotificationSystem() {
    try {
      const testResults = {
        email: false,
        sms: false,
        push: false,
        webhook: false
      };

      // Test email
      if (process.env.TEST_EMAIL) {
        try {
          await emailService.sendEmail({
            to: process.env.TEST_EMAIL,
            subject: 'Test Notification System',
            template: 'test-notification',
            context: {
              testTime: new Date().toISOString(),
              companyName: process.env.COMPANY_NAME || 'Telitrip Travel & Tours'
            }
          });
          testResults.email = true;
        } catch (error) {
          console.error('Email test failed:', error);
        }
      }

      // Test SMS
      if (process.env.SMS_ENABLED === 'true' && process.env.TEST_PHONE) {
        try {
          await this.sendSMSNotification(process.env.TEST_PHONE, 'Test SMS notification', 'test');
          testResults.sms = true;
        } catch (error) {
          console.error('SMS test failed:', error);
        }
      }

      // Test Push
      if (process.env.FCM_ENABLED === 'true' && process.env.TEST_USER_ID) {
        try {
          await this.sendPushNotification(process.env.TEST_USER_ID, 'Test Push', 'Test push notification');
          testResults.push = true;
        } catch (error) {
          console.error('Push test failed:', error);
        }
      }

      // Test Webhook
      if (process.env.TEST_WEBHOOK_URL) {
        try {
          await this.sendWebhookNotification(process.env.TEST_WEBHOOK_URL, { test: true }, 'test.notification');
          testResults.webhook = true;
        } catch (error) {
          console.error('Webhook test failed:', error);
        }
      }

      console.log('Notification system test results:', testResults);
      return testResults;

    } catch (error) {
      console.error('Failed to test notification system:', error);
      throw error;
    }
  }

  // Health check for notification service
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        email: false,
        sms: false,
        push: false,
        webhook: false
      },
      environment: {
        companyName: process.env.COMPANY_NAME || 'Not set',
        adminEmail: process.env.ADMIN_EMAIL ? 'Set' : 'Not set',
        frontendUrl: process.env.FRONTEND_URL || 'Not set',
        smsEnabled: process.env.SMS_ENABLED === 'true',
        fcmEnabled: process.env.FCM_ENABLED === 'true',
        webhookUrl: process.env.WEBHOOK_URL ? 'Set' : 'Not set'
      }
    };

    try {
      // Check email service
      health.services.email = typeof emailService.sendEmail === 'function';
      
      // Check SMS configuration
      health.services.sms = process.env.SMS_ENABLED === 'true';
      
      // Check push configuration
      health.services.push = process.env.FCM_ENABLED === 'true';
      
      // Check webhook configuration
      health.services.webhook = Boolean(process.env.WEBHOOK_URL);

      const allHealthy = Object.values(health.services).some(service => service === true);
      health.status = allHealthy ? 'healthy' : 'degraded';

    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;  
    } 

    return health;
  }
}

module.exports = new NotificationService();