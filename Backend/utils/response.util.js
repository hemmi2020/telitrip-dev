class ApiResponse {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }

  static paginated(res, data, pagination, message = 'Data retrieved successfully') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: pagination.pages,
        hasNext: pagination.page < pagination.pages,
        hasPrev: pagination.page > 1
      },
      timestamp: new Date().toISOString()
    });
  }

  static created(res, data, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  static noContent(res, message = 'No content') {
    return res.status(204).json({
      success: true,
      message,
      timestamp: new Date().toISOString()
    });
  }

  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, 401);
  }

  static forbidden(res, message = 'Access forbidden') {
    return this.error(res, message, 403);
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  static badRequest(res, message = 'Bad request', errors = null) {
    return this.error(res, message, 400, errors);
  }
}

module.exports = ApiResponse;
