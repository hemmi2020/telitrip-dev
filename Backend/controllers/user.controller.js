const userModel = require('../models/user.model.js');
const bookingModel = require('../models/booking.model.js');
const paymentModel = require('../models/payment.model.js');
const userService = require('../services/user.service.js');
const { validationResult } = require('express-validator');
const blacklistTokenModel = require('../models/blacklistToken.model');
const ApiResponse = require('../utils/response.util');
const DateUtil = require('../utils/date.util');
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
module.exports.updateUserProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
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
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user bookings
module.exports.getUserBookings = async (req, res) => {
  try {
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

    res.status(200).json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single booking details
module.exports.getBookingDetails = async (req, res) => {
  try {
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
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json({ booking });
  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user payment history
module.exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const payments = await paymentModel.find({ userId })
      .populate('bookingId', 'bookingId hotelName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await paymentModel.countDocuments({ userId });

    res.status(200).json({
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user preferences
module.exports.updateUserPreferences = async (req, res) => {
  try {
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

    res.status(200).json({
      message: 'Preferences updated successfully',
      preferences: updatedUser.preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Cancel booking
module.exports.cancelBooking = async (req, res) => {
  try {
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
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel completed booking' });
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

    res.status(200).json({
      message: 'Booking cancelled successfully',
      booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports.deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    // Verify password before deletion
    const user = await userModel.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Check for active bookings
    const activeBookings = await bookingModel.findOne({
      userId,
      status: { $in: ['pending', 'confirmed', 'upcoming'] }
    });

    if (activeBookings) {
      return res.status(400).json({
        message: 'Cannot delete account with active bookings. Please cancel or complete all bookings first.'
      });
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
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};