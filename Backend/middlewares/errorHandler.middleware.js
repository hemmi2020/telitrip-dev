const ApiResponse = require('../utils/response.util');

// Global error handler
const globalErrorHandler = (err, req, res, next) => {
  console.error('Global Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
    return ApiResponse.badRequest(res, 'Validation Error', errors);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return ApiResponse.badRequest(res, `${field} '${value}' already exists`);
  }

  // Mongoose ObjectId error
  if (err.name === 'CastError') {
    return ApiResponse.badRequest(res, 'Invalid ID format');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.unauthorized(res, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.unauthorized(res, 'Token expired');
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  return ApiResponse.error(res, message, statusCode);
};

// Async error wrapper
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  return ApiResponse.notFound(res, `Route ${req.originalUrl} not found`);
};

module.exports = {
  globalErrorHandler,
  asyncErrorHandler,
  notFoundHandler
};
