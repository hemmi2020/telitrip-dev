const userModel = require('../models/user.model.js');
const bookingModel = require('../models/booking.model.js');
const paymentModel = require('../models/payment.model.js');
const userService = require('../services/user.service.js');
const { validationResult } = require('express-validator');
const blacklistTokenModel = require('../models/blacklistToken.model');
const ApiResponse = require('../utils/response.util');
const DateUtil = require('../utils/date.util');
const crypto = require('crypto');
const emailService = require('../services/email.service');
const { asyncErrorHandler } = require('../middlewares/errorHandler.middleware');



module.exports.registerUser = asyncErrorHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
        }));
        return ApiResponse.badRequest(res, 'Validation failed', formattedErrors);
    }

    const { fullname, email, password } = req.body; 
    const isUserAlreadyExist = await userModel.findOne({ email });
    
    if (isUserAlreadyExist) {
        return ApiResponse.badRequest(res, 'User is already registered');
    }

    const hashedPassword = await userModel.hashPassword(password);

    const user = await userService.createUser({
        firstname: fullname.firstname,
        lastname: fullname.lastname,
        email,
        password: hashedPassword
    });
    
    const token = user.generateAuthToken();

    // Send welcome email
    try {
        await emailService.sendWelcomeEmail(user);
    } catch (emailError) {
        console.error('Welcome email failed:', emailError);
        // Don't fail registration if email fails
    }
    
    // Use ApiResponse utility instead of res.status().json()
    return ApiResponse.created(res, { token, user }, 'User registered successfully');
});


module.exports.loginUser = asyncErrorHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
        }));
        return ApiResponse.badRequest(res, 'Validation failed', formattedErrors);
    }

    const { email, password } = req.body;
    const user = await userModel.findOne({ email }).select('+password');

    if (!user) {
        return ApiResponse.unauthorized(res, 'Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        return ApiResponse.unauthorized(res, 'Invalid email or password');
    }

    const token = user.generateAuthToken();
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        sameSite: 'strict'
    });

    const userResponse = user.toJSON ? user.toJSON() : user;
    
    // Add formatted dates using DateUtil
    const responseData = {
        token,
        user: {
            ...userResponse,
            memberSince: DateUtil.formatDate(user.createdAt),
            lastLogin: DateUtil.formatDateTime(new Date())
        }
    };

    return ApiResponse.success(res, responseData, 'Login successful');
});

// Forgot password
module.exports.forgotPassword = asyncErrorHandler(async (req, res) => {
  const { email } = req.body;
  
  const user = await userModel.findOne({ email });
  
  if (!user) {
    // Don't reveal whether email exists for security
    return ApiResponse.success(res, null, 'If email exists, password reset link has been sent');
  }
  
  // Generate reset token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set expiry
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  await user.save({ validateBeforeSave: false });
  
  // Send email
  await emailService.sendPasswordResetEmail(user, resetToken);
  
  return ApiResponse.success(res, null, 'Password reset email sent');
});

// Reset password
module.exports.resetPassword = asyncErrorHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  
  // Hash token to compare with database
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
    
  const user = await userModel.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });
  
  if (!user) {
    return ApiResponse.badRequest(res, 'Invalid or expired reset token');
  }
  
  // Set new password
  user.password = await userModel.hashPassword(password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  
  await user.save();
  
  return ApiResponse.success(res, null, 'Password reset successful');
}); 




module.exports.getUserProfile = asyncErrorHandler(async (req, res) => {
    if (!req.user) {
        return ApiResponse.unauthorized(res, 'Authentication required');
    }

    const user = await userModel.findById(req.user._id);

    if (!user) {
        return ApiResponse.notFound(res, 'User not found');
    }

    // Format user data with utilities
    const userData = {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        preferences: user.preferences || { emailNotifications: true, twoFactorAuth: false },
        role: user.role,
        memberSince: DateUtil.formatDate(user.createdAt),
        lastUpdated: DateUtil.formatDateTime(user.updatedAt)
    };

    return ApiResponse.success(res, userData, 'Profile retrieved successfully');
});



module.exports.logoutUser = asyncErrorHandler(async (req, res) => {
    const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
    
    if (token) {
        await blacklistTokenModel.create({ token });
    }
    
    res.clearCookie('token', {
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production'
    });

    return ApiResponse.success(res, null, 'Logged out successfully'); 
});
// Update user profile
module.exports.updateUserProfile = asyncErrorHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    return ApiResponse.badRequest(res, 'Validation failed', formattedErrors);
  }

  const userId = req.user._id;
  const { fullname, phone, address } = req.body;

  const updateData = {};
  if (fullname) {
    updateData.fullname = fullname;
  }
  if (phone !== undefined) {
    updateData.phone = phone;
  }
  if (address !== undefined) {
    updateData.address = address;
  }

  const updatedUser = await userModel.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    return ApiResponse.notFound(res, 'User not found');
  }

  return ApiResponse.success(res, { user: updatedUser }, 'Profile updated successfully');
});

// Get user bookings
module.exports.getUserBookings = asyncErrorHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  const query = { userId };
  if (status) {
    query.status = status;
  }

  const bookings = await bookingModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await bookingModel.countDocuments(query);

  return ApiResponse.success(res, {
    bookings,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Bookings retrieved successfully');
});

// Get single booking details
module.exports.getBookingDetails = asyncErrorHandler(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;

  const booking = await bookingModel.findOne({
    $or: [
      { _id: bookingId },
      { bookingId: bookingId }
    ],
    userId
  });

  if (!booking) {
    return ApiResponse.notFound(res, 'Booking not found');
  }

  return ApiResponse.success(res, { booking }, 'Booking details retrieved successfully');
});


// Get user payment history
module.exports.getPaymentHistory = asyncErrorHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  const payments = await paymentModel.find({ userId })
    .populate('bookingId', 'bookingId hotelName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await paymentModel.countDocuments({ userId });

  return ApiResponse.success(res, {
    payments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  }, 'Payment history retrieved successfully');
});

// Update user preferences
module.exports.updateUserPreferences = asyncErrorHandler(async (req, res) => {
  const userId = req.user._id;
  const { emailNotifications, twoFactorAuth } = req.body;

  const updateData = {};
  if (emailNotifications !== undefined) {
    updateData['preferences.emailNotifications'] = emailNotifications;
  }
  if (twoFactorAuth !== undefined) {
    updateData['preferences.twoFactorAuth'] = twoFactorAuth;
  }

  const updatedUser = await userModel.findByIdAndUpdate(
    userId,
    updateData,
    { new: true }
  );

  return ApiResponse.success(res, {
    preferences: updatedUser.preferences
  }, 'Preferences updated successfully');
});


// Cancel booking
module.exports.cancelBooking = asyncErrorHandler(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;

  const booking = await bookingModel.findOne({
    $or: [
      { _id: bookingId },
      { bookingId: bookingId }
    ],
    userId
  });

  if (!booking) {
    return ApiResponse.notFound(res, 'Booking not found');
  }

  if (booking.status === 'cancelled') {
    return ApiResponse.badRequest(res, 'Booking is already cancelled');
  }

  if (booking.status === 'completed') {
    return ApiResponse.badRequest(res, 'Cannot cancel completed booking');
  }

  // Update booking status
  booking.status = 'cancelled';
  await booking.save();

  // Create refund payment record if payment was made
  if (booking.paymentStatus === 'paid') {
    const refundPayment = new paymentModel({
      userId,
      bookingId: booking._id,
      paymentId: `REF-${Date.now()}`,
      amount: -booking.totalAmount, // Negative amount for refund
      method: 'Refund',
      status: 'completed'
    });
    await refundPayment.save();
    
    booking.paymentStatus = 'refunded';
    await booking.save();
  }

  return ApiResponse.success(res, { booking }, 'Booking cancelled successfully');
});

module.exports.deleteUserAccount = asyncErrorHandler(async (req, res) => {
  const userId = req.user._id;
  const { password } = req.body;

  // Verify password before deletion
  const user = await userModel.findById(userId).select('+password');
  if (!user) {
    return ApiResponse.notFound(res, 'User not found');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return ApiResponse.unauthorized(res, 'Invalid password');
  }

  // Check for active bookings
  const activeBookings = await bookingModel.findOne({
    userId,
    status: { $in: ['pending', 'confirmed', 'upcoming'] }
  });

  if (activeBookings) {
    return ApiResponse.badRequest(res, 'Cannot delete account with active bookings. Please cancel or complete all bookings first.');
  }

  // Delete user and related data
  await userModel.findByIdAndDelete(userId);
  await bookingModel.deleteMany({ userId });
  await paymentModel.deleteMany({ userId });

  // Blacklist current token
  const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
  if (token) {
    await blacklistTokenModel.create({ token });
  }

  res.clearCookie('token');
  return ApiResponse.success(res, null, 'Account deleted successfully');
});