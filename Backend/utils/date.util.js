class DateUtil {
  // Format date to readable string
  static formatDate(date, locale = 'en-US') {
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Format date and time
  static formatDateTime(date, locale = 'en-US') {
    return new Date(date).toLocaleString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Get days between two dates
  static getDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Check if date is in the future
  static isUpcoming(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    return targetDate >= today;
  }

  // Check if date is in the past
  static isPast(date) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const targetDate = new Date(date);
    return targetDate < today;
  }

  // Get booking status based on dates
  static getBookingStatus(checkIn, checkOut, currentStatus = null) {
    const now = new Date();
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // If booking is cancelled, return cancelled regardless of dates
    if (currentStatus === 'cancelled') {
      return 'cancelled';
    }

    if (now < checkInDate) {
      return 'upcoming';
    } else if (now >= checkInDate && now <= checkOutDate) {
      return 'active';
    } else {
      return 'completed';
    }
  }

  // Add days to a date
  static addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Get start and end of day
  static getStartOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  static getEndOfDay(date) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  // Validate date range
  static validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const errors = [];

    if (isNaN(start.getTime())) {
      errors.push('Invalid start date');
    }

    if (isNaN(end.getTime())) {
      errors.push('Invalid end date');
    }

    if (start < today) {
      errors.push('Start date cannot be in the past');
    }

    if (end <= start) {
      errors.push('End date must be after start date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = DateUtil;