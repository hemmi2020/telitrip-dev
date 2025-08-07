const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/response.util');
const DateUtil = require('../utils/date.util');

// General validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return ApiResponse.badRequest(res, 'Validation failed', formattedErrors);
  }
  next();
};

// Validate booking dates
const validateBookingDates = (req, res, next) => {
  const { checkIn, checkOut } = req.body;
  
  if (checkIn && checkOut) {
    const validation = DateUtil.validateDateRange(checkIn, checkOut);
    
    if (!validation.isValid) {
      return ApiResponse.badRequest(res, 'Invalid date range', validation.errors);
    }
  }
  
  next();
};

// Validate pagination parameters
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return ApiResponse.badRequest(res, 'Page number must be a positive integer');
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return ApiResponse.badRequest(res, 'Limit must be between 1 and 100');
  }
  
  req.pagination = {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum
  };
  
  next();
};

module.exports = {
  validateRequest,
  validateBookingDates,
  validatePagination
};