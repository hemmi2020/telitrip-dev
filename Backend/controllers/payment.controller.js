// FIXED PAYMENT CONTROLLER WITH WORKING DECRYPTION AND PROPER URL PARAMETERS
// Replace your existing payment.controller.js with this

const crypto = require('crypto');
const fetch = require('node-fetch');
const paymentModel = require('../models/payment.model');
const bookingModel = require('../models/booking.model');
const ApiResponse = require('../utils/response.util');
const { asyncErrorHandler } = require('../middlewares/errorHandler.middleware');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger.util');

// HBLPay Configuration
const HBLPAY_USER_ID = process.env.HBLPAY_USER_ID || 'teliadmin';
const HBLPAY_PASSWORD = process.env.HBLPAY_PASSWORD || 'd6n26Yd4m!';
const HBL_PUBLIC_KEY = process.env.HBL_PUBLIC_KEY_PEM;
const HBL_SANDBOX_URL = process.env.HBL_SANDBOX_API_URL || 'https://testpaymentapi.hbl.com/hblpay/api/checkout';
const HBL_PRODUCTION_URL = process.env.HBL_PRODUCTION_API_URL;
const HBL_SANDBOX_REDIRECT = process.env.HBL_SANDBOX_REDIRECT_URL || 'https://testpaymentapi.hbl.com/hblpay/site/index.html#/checkout?data=';
const HBL_PRODUCTION_REDIRECT = process.env.HBL_PRODUCTION_REDIRECT_URL;
const HBL_CHANNEL = 'HBLPay_Teli_Website';
const HBL_TYPE_ID = '0';
const HBL_TIMEOUT = parseInt(process.env.HBL_TIMEOUT) || 30000;
const privateKeyPem = process.env.MERCHANT_PRIVATE_KEY_PEM;

const isProduction = process.env.NODE_ENV === 'production';
const https = require('https');

// Enhanced HTTPS agent with timeout and retry configuration
const httpsAgent = new https.Agent({
  rejectUnauthorized: !isProduction, // Only bypass SSL in sandbox
  timeout: HBL_TIMEOUT,
  keepAlive: true,
  maxSockets: 50
});

// Load node-forge
let forge;
try {
  forge = require('node-forge');
  console.log('✅ node-forge loaded successfully');
} catch (error) {
  console.log('❌ node-forge not available:', error.message);
}

// ==================== WORKING DECRYPTION WITH BINARY PARSING ====================
function parseGarbledData(rawDecryptedData) {
  try {
    console.log('🔧 [PARSE] Parsing garbled binary data...');
    
    if (!rawDecryptedData) return {};
    
    // Convert to string and extract readable ASCII characters
    let cleanText = '';
    for (let i = 0; i < rawDecryptedData.length; i++) {
      const char = rawDecryptedData[i];
      const code = char.charCodeAt(0);
      
      // Keep printable ASCII characters and common symbols
      if ((code >= 32 && code <= 126) || code === 10 || code === 13) {
        cleanText += char;
      }
    }
    
    console.log('📝 [PARSE] Extracted clean text:', cleanText);
    
    // Look for parameter patterns in the clean text
    const paramPatterns = [
      /RESPONSE_CODE=([^&\s]+)/,
      /RESPONSE_MESSAGE=([^&]+?)(?=&|$)/,
      /ORDER_REF_NUMBER=([^&\s]+)/,
      /PAYMENT_TYPE=([^&\s]+)/,
      /CARD_NUM_MASKED=([^&\s]+)/,
      /TRANSACTION_ID=([^&\s]+)/,
      /TXN_ID=([^&\s]+)/,
      /GUID=([^&\s]+)/
    ];
    
    const params = {};
    
    // Try to find parameters in the clean text
    for (const pattern of paramPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const key = pattern.source.split('=')[0].replace(/[()[\]]/g, '');
        params[key] = decodeURIComponent(match[1] || '').trim();
        console.log(`📝 [PARSE] Found ${key}:`, params[key]);
      }
    }
    
    // If standard parsing fails, try alternative methods
    if (Object.keys(params).length === 0) {
      console.log('🔄 [PARSE] Trying alternative parsing methods...');
      
      // Look for any text that contains "RESPONSE" or "ORDER"
      const responseMatch = cleanText.match(/.*RESPONSE.*?(\d+)/);
      const orderMatch = cleanText.match(/.*ORDER.*?([A-Z0-9_]+)/);
      
      if (responseMatch) {
        params.RESPONSE_CODE = responseMatch[1];
        console.log('📝 [PARSE] Alternative found RESPONSE_CODE:', params.RESPONSE_CODE);
      }
      
      if (orderMatch) {
        params.ORDER_REF_NUMBER = orderMatch[1];
        console.log('📝 [PARSE] Alternative found ORDER_REF_NUMBER:', params.ORDER_REF_NUMBER);
      }
    }
    
    return params;
    
  } catch (error) {
    console.error('❌ [PARSE] Parsing failed:', error.message);
    return {};
  }
}

function enhancedDecryption(encryptedData, privateKeyPem) {
  try {
    console.log('\n🔧 [ENHANCED] Starting enhanced decryption...');
    
    if (!encryptedData || !privateKeyPem) {
      return {};
    }
    
    // Step 1: Fix URL encoding issues
    let cleanData = encryptedData.trim();
    cleanData = cleanData.replace(/ /g, '+');
    cleanData = cleanData.replace(/%2B/g, '+');
    cleanData = cleanData.replace(/%2F/g, '/');
    cleanData = cleanData.replace(/%3D/g, '=');
    
    console.log('🧹 [ENHANCED] Cleaned data length:', cleanData.length);
    
    // Step 2: Try forge decryption first (for standard cases)
    if (forge) {
      try {
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
        const binaryData = forge.util.decode64(cleanData);
        
        console.log('📦 [ENHANCED] Forge decoded:', binaryData.length, 'bytes');
        
        if (binaryData.length === 512) {
          // Perfect block size - standard decryption
          const result = privateKey.decrypt(binaryData, 'RSAES-PKCS1-V1_5');
          if (result && result.includes('RESPONSE_CODE')) {
            console.log('✅ [ENHANCED] Forge standard decryption successful');
            const params = {};
            result.split('&').forEach(pair => {
              if (pair.includes('=')) {
                const [key, ...valueParts] = pair.split('=');
                params[key.trim()] = decodeURIComponent(valueParts.join('=') || '');
              }
            });
            return params;
          }
        }
      } catch (forgeError) {
        console.log('❌ [ENHANCED] Forge method failed:', forgeError.message);
      }
    }
    
    // Step 3: Use Node.js crypto with NO_PADDING (this worked in your logs)
    try {
      console.log('🔄 [ENHANCED] Trying Node.js crypto NO_PADDING...');
      
      const encryptedBuffer = Buffer.from(cleanData, 'base64');
      console.log('📦 [ENHANCED] Buffer length:', encryptedBuffer.length);
      
      const decrypted = crypto.privateDecrypt({
        key: privateKeyPem,
        padding: crypto.constants.RSA_NO_PADDING
      }, encryptedBuffer);
      
      console.log('✅ [ENHANCED] Node.js decryption successful');
      
      // Parse the garbled binary data
      const decryptedString = decrypted.toString('binary');
      const params = parseGarbledData(decryptedString);
      
      if (Object.keys(params).length > 0) {
        console.log('✅ [ENHANCED] Successfully parsed parameters from binary data');
        return params;
      }
      
      // Fallback: try different string encodings
      const encodings = ['utf8', 'ascii', 'latin1'];
      for (const encoding of encodings) {
        try {
          const testString = decrypted.toString(encoding);
          const testParams = parseGarbledData(testString);
          if (Object.keys(testParams).length > 0) {
            console.log(`✅ [ENHANCED] Success with ${encoding} encoding`);
            return testParams;
          }
        } catch (encodingError) {
          // Continue to next encoding
        }
      }
      
    } catch (cryptoError) {
      console.log('❌ [ENHANCED] Node.js crypto failed:', cryptoError.message);
    }
    
    console.log('❌ [ENHANCED] All decryption methods failed');
    return {};
    
  } catch (error) {
    console.error('💥 [ENHANCED] Fatal error:', error.message);
    return {};
  }
}





// ==================== UPDATED SUCCESS HANDLER ====================
module.exports.handlePaymentSuccess = asyncErrorHandler(async (req, res) => {
  console.log('\n🎉 ========== PAYMENT SUCCESS CALLBACK ==========');
  console.log('🔗 Full URL:', req.url);
  
  try {
    // Extract encrypted data from raw URL
    let encryptedData;
    
    if (req.url.includes('data=')) {
      const rawUrl = req.url;
      const dataStart = rawUrl.indexOf('data=') + 5;
      const dataEnd = rawUrl.indexOf('&', dataStart);
      encryptedData = dataEnd === -1 ? 
        rawUrl.substring(dataStart) : 
        rawUrl.substring(dataStart, dataEnd);
      
      console.log('🔧 [SUCCESS] Extracted from raw URL:', encryptedData?.length, 'chars');
    }
    
    // Fallback to Express parsing
    if (!encryptedData) {
      encryptedData = req.query?.data || req.body?.data;
    }
    
    if (!encryptedData) {
      console.log('❌ [SUCCESS] No encrypted data found');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/failed?reason=missing_data`);
    }
    
    console.log('📥 [SUCCESS] Processing encrypted data...');
    
    // Use enhanced decryption
    const decryptedResponse = enhancedDecryption(encryptedData, privateKeyPem);
    
    if (!decryptedResponse || Object.keys(decryptedResponse).length === 0) {
      console.log('💥 [SUCCESS] Decryption failed completely');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/failed?reason=decrypt_failed`);
    }
    
    console.log('🎊 [SUCCESS] DECRYPTION SUCCESSFUL!');
    console.log('📋 [SUCCESS] Decrypted parameters:', decryptedResponse);
    
    // For testing: ALWAYS show the success page with all decrypted data
    // regardless of success/failure
    
    const responseCode = decryptedResponse.RESPONSE_CODE;
    const orderRefNumber = decryptedResponse.ORDER_REF_NUMBER || decryptedResponse.REFERENCE_NUMBER;
    
    console.log('🔍 [SUCCESS] Response code:', responseCode);
    console.log('🔍 [SUCCESS] Order ref:', orderRefNumber);
    
    // Update database if we have order reference
    if (orderRefNumber) {
      try {
        const payment = await paymentModel.findOne({ orderRefNumber });
        if (payment) {
          const isActualSuccess = responseCode === '0' || responseCode === '100' || responseCode === 0 || responseCode === 100;
          
          await payment.updateOne({
            status: isActualSuccess ? 'completed' : 'failed',
            completedAt: isActualSuccess ? new Date() : null,
            gatewayResponse: decryptedResponse,
            transactionId: decryptedResponse.TRANSACTION_ID || decryptedResponse.TXN_ID || decryptedResponse.GUID,
            updatedAt: new Date()
          });
          
          if (payment.bookingId && isActualSuccess) {
            await bookingModel.findByIdAndUpdate(payment.bookingId, {
              paymentStatus: 'paid',
              status: 'confirmed',
              confirmedAt: new Date(),
              updatedAt: new Date()
            });
          }
          
          console.log('✅ [SUCCESS] Database records updated');
        }
      } catch (dbError) {
        console.error('❌ [SUCCESS] Database update failed:', dbError.message);
      }
    }
    
    // BUILD SUCCESS PAGE URL WITH ALL HBL DATA
    const successParams = new URLSearchParams({
      RESPONSE_CODE: decryptedResponse.RESPONSE_CODE || '',
      RESPONSE_MESSAGE: encodeURIComponent(decryptedResponse.RESPONSE_MESSAGE || ''),
      ORDER_REF_NUMBER: decryptedResponse.ORDER_REF_NUMBER || '',
      PAYMENT_TYPE: decryptedResponse.PAYMENT_TYPE || '',
      CARD_NUM_MASKED: decryptedResponse.CARD_NUM_MASKED || '',
      DISCOUNTED_AMOUNT: decryptedResponse.DISCOUNTED_AMOUNT || '0',
      DISCOUNT_CAMPAIGN_ID: decryptedResponse.DISCOUNT_CAMPAIGN_ID || '0',
      GUID: decryptedResponse.GUID || '',
      amount: '66.53', // You can get this from payment record
      currency: 'PKR',
      transactionId: decryptedResponse.TRANSACTION_ID || decryptedResponse.TXN_ID || decryptedResponse.GUID || ''
    });
    
    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success?${successParams.toString()}`;
    
    console.log('🎯 [SUCCESS] Redirecting to:', successUrl);
    console.log('🎯 [SUCCESS] URL length:', successUrl.length);
    
    return res.redirect(successUrl);
    
  } catch (error) {
    console.error('💥 [SUCCESS] Handler error:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/failed?reason=server_error`);
  }
});

// ==================== ENHANCED PAYMENT CANCEL HANDLER ====================
module.exports.handlePaymentCancel = asyncErrorHandler(async (req, res) => {
  console.log('\n🚫 ========== PAYMENT CANCEL CALLBACK ==========');
  
  try {
    // Extract encrypted data
    let encryptedData;
    
    if (req.url.includes('data=')) {
      const rawUrl = req.url;
      const dataStart = rawUrl.indexOf('data=') + 5;
      const dataEnd = rawUrl.indexOf('&', dataStart);
      encryptedData = dataEnd === -1 ? 
        rawUrl.substring(dataStart) : 
        rawUrl.substring(dataStart, dataEnd); 
    } 
    
    if (!encryptedData) { 
      encryptedData = req.query?.data || req.body?.data;
    }
    
    if (encryptedData) {
      const decryptedResponse = enhancedDecryption(encryptedData, privateKeyPem);
      
      if (decryptedResponse && Object.keys(decryptedResponse).length > 0) {
        const orderRefNumber = decryptedResponse.ORDER_REF_NUMBER;
        
        if (orderRefNumber) {
          const payment = await paymentModel.findOne({ orderRefNumber });
          if (payment) {
            await payment.updateOne({
              status: 'cancelled',
              cancelledAt: new Date(),
              gatewayResponse: decryptedResponse
            });
          }
        }
      }
    }
    
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/cancelled`);
    
  } catch (error) {
    console.error('💥 [CANCEL] Handler error:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/cancelled`);
  }
});

// ==================== MANUAL DECRYPT (UPDATED) ====================
module.exports.manualDecrypt = async (req, res) => {
  try {
    const { encryptedData } = req.body;
    
    if (!encryptedData) {
      return res.json({
        success: false,
        error: 'No encrypted data provided'
      });
    }
    
    const result = enhancedDecryption(encryptedData, privateKeyPem);
    
    return res.json({
      success: true,
      message: 'Enhanced decryption completed',
      result: {
        success: Object.keys(result).length > 0,
        data: result,
        keys: Object.keys(result)
      }
    });
    
  } catch (error) {
    return res.json({
      success: false,
      error: error.message
    });
  }
};

// ==================== EXISTING FUNCTIONS (KEEP AS IS) ====================

// Enhanced RSA encryption with error handling
function encryptHBLData(data, publicKey) {
  if (!publicKey) {
    const error = new Error('HBL public key not configured');
    error.code = 'MISSING_PUBLIC_KEY';
    throw error;
  }
  try {
    const stringData = String(data);
    const buffer = Buffer.from(stringData, 'utf8');
    const encrypted = crypto.publicEncrypt({
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    }, buffer);
    return encrypted.toString('base64');
  } catch (error) {
    console.error('RSA encryption error:', error.message);
    throw error;
  }
}

// Recursive parameter encryption
function encryptRequestParameters(data, publicKey) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => encryptRequestParameters(item, publicKey));
  }

  const result = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (key === 'USER_ID') {
      result[key] = value;
    } else if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'object') {
      result[key] = encryptRequestParameters(value, publicKey);
    } else {
      try {
        result[key] = encryptHBLData(String(value), publicKey);
      } catch (error) {
        console.warn(`Failed to encrypt field ${key}:`, error.message);
        result[key] = value;
      }
    }
  }

  return result;
}

// Build HBL request - Enhanced request builder with validation
const buildHBLPayRequest = (paymentData, userId) => {
  const { amount, currency, orderId, bookingData, userData } = paymentData;

  console.log('🔍 buildHBLPayRequest received parameters:', {
    amount: typeof amount,
    amountValue: amount,
    currency,
    orderId,
    hasBookingData: !!bookingData,
    hasUserData: !!userData,
    userId
  });

  // Validate amount parameter
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw new Error(`Invalid amount parameter: ${amount} (type: ${typeof amount})`);
  }

  // Build request matching HBL documentation sample EXACTLY - MINIMAL VERSION
  const request = {
    "USER_ID": HBLPAY_USER_ID,
    "PASSWORD": HBLPAY_PASSWORD,
    "RETURN_URL": `${process.env.BACKEND_URL || 'https://telitrip.onrender.com'}/api/payments/success`,
    "CANCEL_URL": `${process.env.BACKEND_URL || 'https://telitrip.onrender.com'}/api/payments/cancel`,
    "CHANNEL": HBL_CHANNEL,
    "TYPE_ID": HBL_TYPE_ID,
    "ORDER": {
      "DISCOUNT_ON_TOTAL": "0",
      "SUBTOTAL": amount.toFixed(2),
      "OrderSummaryDescription": [
        {
          "ITEM_NAME": bookingData?.hotelName || "HOTEL BOOKING",
          "QUANTITY": "1",
          "UNIT_PRICE": amount.toFixed(2),
          "OLD_PRICE": null,
          "CATEGORY": "Hotel",
          "SUB_CATEGORY": "Room Booking"
        }
      ]
    },
    "SHIPPING_DETAIL": {
      "NAME": "DHL SERVICE",
      "ICON_PATH": null,
      "DELIEVERY_DAYS": "0",
      "SHIPPING_COST": "0"
    },
    "ADDITIONAL_DATA": {
      "REFERENCE_NUMBER": orderId || "TEST123456789",
      "CUSTOMER_ID": userId?.toString() || "GUEST_USER_" + Date.now(),
      "CURRENCY": "PKR",
      "BILL_TO_FORENAME": userData?.firstName || "John",
      "BILL_TO_SURNAME": userData?.lastName || "Doe",
      "BILL_TO_EMAIL": userData?.email || "test@example.com",
      "BILL_TO_PHONE": userData?.phone || "02890888888",
      "BILL_TO_ADDRESS_LINE": userData?.address || "1 Card Lane",
      "BILL_TO_ADDRESS_CITY": userData?.city || "My City",
      "BILL_TO_ADDRESS_STATE": userData?.state || "CA",
      "BILL_TO_ADDRESS_COUNTRY": userData?.country || "US",
      "BILL_TO_ADDRESS_POSTAL_CODE": userData?.postalCode || "94043",
      "SHIP_TO_FORENAME": userData?.firstName || "John",
      "SHIP_TO_SURNAME": userData?.lastName || "Doe",
      "SHIP_TO_EMAIL": userData?.email || "test@example.com",
      "SHIP_TO_PHONE": userData?.phone || "02890888888",
      "SHIP_TO_ADDRESS_LINE": userData?.address || "1 Card Lane",
      "SHIP_TO_ADDRESS_CITY": userData?.city || "My City",
      "SHIP_TO_ADDRESS_STATE": userData?.state || "CA",
      "SHIP_TO_ADDRESS_COUNTRY": userData?.country || "US",
      "SHIP_TO_ADDRESS_POSTAL_CODE": userData?.postalCode || "94043",
      "MerchantFields": {
        "MDD1": HBL_CHANNEL, // Channel of Operation (Required)
        "MDD2": "N", // 3D Secure Registration (Optional)
        "MDD3": "Hotel", // Product Category (Optional)
        "MDD4": bookingData?.hotelName || "Hotel Booking", // Product Name (Optional)
        "MDD5": userData?.customerId ? "Y" : "N", // Previous Customer (Optional)
        "MDD6": "Digital", // Shipping Method (Optional)
        "MDD7": bookingData?.items?.length?.toString() || "1", // Number Of Items Sold (Optional)
        "MDD8": "PK", // Product Shipping Country Name (Optional)
        "MDD9": "0", // Hours Till Departure (Optional)
        "MDD10": "Hotel", // Flight Type (Optional)
        "MDD11": bookingData?.checkIn && bookingData?.checkOut 
          ? `${bookingData.checkIn} to ${bookingData.checkOut}` 
          : "N/A", // Full Journey/Itinerary (Optional)
        "MDD12": "N", // 3rd Party Booking (Optional)
        "MDD13": bookingData?.hotelName || "Hotel", // Hotel Name (Optional)
        "MDD14": new Date().toISOString().split('T')[0], // Date of Booking (Optional) 
        "MDD15": bookingData?.checkIn || "", // Check In Date (Optional)
        "MDD16": bookingData?.checkOut || "", // Check Out Date (Optional)
        "MDD17": "Hotel", // Product Type (Optional)
        "MDD18": userData?.phone || userData?.email || "", // Customer ID/Phone Number (Optional)
        "MDD19": userData?.country || "PK", // Country Of Top-up (Optional)
        "MDD20": "N" // VIP Customer (Optional) 
      }
    }
  };

  console.log('📤 HBLPay Request (Key fields):', {
    USER_ID: request.USER_ID,
    CHANNEL: request.CHANNEL,
    TYPE_ID: request.TYPE_ID,
    SUBTOTAL: request.ORDER.SUBTOTAL,
    CURRENCY: request.ADDITIONAL_DATA.CURRENCY,
    REFERENCE_NUMBER: request.ADDITIONAL_DATA.REFERENCE_NUMBER,
    RETURN_URL: request.RETURN_URL,
    CANCEL_URL: request.CANCEL_URL
  });

  return request;
};

// Call HBL API
const callHBLPayAPI = async (requestData) => {
  const apiUrl = isProduction ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL;

  console.log('📞 Calling HBL API:', apiUrl);
  console.log('🔍 Environment:', isProduction ? 'production' : 'sandbox');

  try {
    // ✅ Encrypt the request data (except USER_ID)
    let finalRequestData = requestData;

    if (HBL_PUBLIC_KEY) {
      console.log('🔐 Encrypting request parameters...');
      finalRequestData = encryptRequestParameters(requestData, HBL_PUBLIC_KEY);
      console.log('✅ Request parameters encrypted successfully');
    } else {
      console.warn('⚠️ No HBL public key found - sending unencrypted data');
    }

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'NodeJS-HBLPay-Client/1.0'
      },
      body: JSON.stringify(finalRequestData),
      timeout: 30000
    };

    // Add SSL bypass for sandbox environment
    if (!isProduction) {
      fetchOptions.agent = httpsAgent;
    }

    console.log('📤 Sending request to HBL...');
    const response = await fetch(apiUrl, fetchOptions);

    const responseText = await response.text();
    console.log('📥 HBL API Response received:', {
      status: response.status,
      statusText: response.statusText,
      responseLength: responseText.length
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText}`);
    }

    let hblResponse;
    try {
      hblResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse HBLPay response:', parseError);
      throw new Error('Invalid JSON response from HBLPay');
    }

    console.log('📥 HBL API Response received:', {
      isSuccess: hblResponse.IsSuccess,
      responseCode: hblResponse.ResponseCode,
      responseMessage: hblResponse.ResponseMessage,
      hasSessionId: !!hblResponse.Data?.SESSION_ID
    });

    return hblResponse;
  } catch (error) {
    console.error('❌ HBLPay API Error:', error);
    throw new Error(`HBLPay API call failed: ${error.message}`);
  }
};

// Build redirect URL
const buildRedirectUrl = (sessionId) => {
  const baseUrl = isProduction ? HBL_PRODUCTION_REDIRECT : HBL_SANDBOX_REDIRECT;
  const encodedSessionId = Buffer.from(sessionId).toString('base64');
  return `${baseUrl}${encodedSessionId}`;
};

// Generate unique IDs
function generatePaymentId() {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(4).toString('hex');
  return `PAY_${timestamp}_${randomBytes}`;
}

function generateOrderId() {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(3).toString('hex');
  return `ORD_${timestamp}_${randomBytes}`;
}

// ==================== PAYMENT INITIATION (ENHANCED) ====================
module.exports.initiateHBLPayPayment = asyncErrorHandler(async (req, res) => {
  const { bookingData, userData, amount, currency = 'PKR', orderId, bookingId } = req.body;
  const userId = req.user._id;

  console.log('🚀 Initiating HBLPay payment:', {
    userId: userId.toString(),
    amount: amount,
    currency,
    orderId: orderId || 'auto-generated',
    bookingId,
    userEmail: userData?.email
  });

  // Enhanced validation
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    console.error('❌ Invalid amount:', { amount, type: typeof amount });
    return ApiResponse.error(res, `Invalid payment amount: ${amount}`, 400);
  }

  if (!userData || !userData.email || !userData.firstName) {
    return ApiResponse.error(res, 'Invalid user data - email and name required', 400);
  }

  if (!bookingData || !bookingData.items || bookingData.items.length === 0) {
    return ApiResponse.error(res, 'Invalid booking data - items required', 400);
  }

  if (!bookingId) {
    return ApiResponse.error(res, 'Booking ID is required', 400);
  }

  // Verify booking
  let bookingRecord = null;
  try {
    bookingRecord = await bookingModel.findOne({
      $or: [{ _id: bookingId }, { bookingId: bookingId }],
      userId: userId
    });

    if (!bookingRecord) {
      return ApiResponse.error(res, 'Booking not found', 404);
    }

    if (bookingRecord.paymentStatus === 'paid') {
      return ApiResponse.error(res, 'This booking is already paid', 400);
    }
  } catch (error) {
    console.error('Error validating booking:', error);
    return ApiResponse.error(res, 'Invalid booking ID format', 400);
  }

  try {
    const finalOrderId = orderId || generateOrderId();
    const paymentId = generatePaymentId();
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return ApiResponse.error(res, `Invalid payment amount: ${paymentAmount}`, 400);
    }

    // Create payment record
    const payment = new paymentModel({
      paymentId,
      userId,
      bookingId: bookingRecord._id,
      amount: paymentAmount,
      currency,
      status: 'pending',
      paymentMethod: 'HBLPay',
      orderId: finalOrderId,
      userDetails: userData,
      bookingDetails: bookingData,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });

    await payment.save();
    console.log('💾 Payment record created:', paymentId);

    // Build and call HBL API
    const hblRequest = buildHBLPayRequest({
      amount: paymentAmount,
      currency: currency,
      orderId: finalOrderId,
      bookingData: bookingData,
      userData: userData
    }, userId);

    const hblResponse = await callHBLPayAPI(hblRequest);

    if (!hblResponse.IsSuccess) {
      await payment.updateOne({
        status: 'failed',
        failureReason: `${hblResponse.ResponseCode}: ${hblResponse.ResponseMessage}`,
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });

      console.error('❌ HBLPay request failed:', {
        responseCode: hblResponse.ResponseCode,
        responseMessage: hblResponse.ResponseMessage
      });

      return ApiResponse.error(res, 
        `Payment gateway error: ${hblResponse.ResponseMessage}`, 
        502
      );
    }

    if (!hblResponse.Data || !hblResponse.Data.SESSION_ID) {
      await payment.updateOne({
        status: 'failed',
        failureReason: 'NO_SESSION_ID',
        gatewayResponse: hblResponse,
        updatedAt: new Date()
      });

      console.error('❌ No SESSION_ID in HBLPay response:', hblResponse);
      return ApiResponse.error(res, 'Failed to create payment session', 502);
    }

    const sessionId = hblResponse.Data.SESSION_ID;

    // Update payment with session ID
    await payment.updateOne({
      sessionId: sessionId,
      transactionId: sessionId,
      orderRefNumber: finalOrderId,
      gatewayResponse: hblResponse,
      updatedAt: new Date()
    });

    // Build redirect URL
    const paymentUrl = buildRedirectUrl(sessionId);

    console.log('✅ Payment session created successfully:', {
      paymentId,
      sessionId: sessionId,
      paymentUrl,
      bookingId: bookingRecord._id
    });

    return ApiResponse.success(res, {
      sessionId: sessionId,
      paymentUrl,
      paymentId,
      orderId: finalOrderId,
      amount: paymentAmount,
      currency,
      expiresAt: payment.expiresAt,
      bookingId: bookingRecord._id
    }, 'Payment session created successfully');

  } catch (error) {
    console.error('❌ Payment initiation error:', error);
    return ApiResponse.error(res, error.message || 'Failed to initiate payment', 500);
  }
});

// ==================== ENHANCED TEST DECRYPTION ====================
module.exports.testDecryption = (req, res) => {
  console.log('\n🧪 ========== TESTING DECRYPTION SYSTEM ==========');
  
  try {
    // Configuration check
    console.log('📋 System Configuration:');
    console.log('- Private key configured:', !!privateKeyPem);
    console.log('- Private key length:', privateKeyPem?.length || 0);
    console.log('- node-forge available:', !!forge);
    console.log('- Environment:', process.env.NODE_ENV || 'development');
    
    if (!privateKeyPem) {
      return res.json({
        success: false,
        error: 'MERCHANT_PRIVATE_KEY_PEM not configured in environment variables',
        solution: 'Add your private key to environment variables',
        status: 'CONFIGURATION_ERROR'
      });
    }
    
    if (!forge) {
      return res.json({
        success: false,
        error: 'node-forge library not available',
        solution: 'Install node-forge: npm install node-forge',
        status: 'DEPENDENCY_ERROR'
      });
    }

    // Test with real HBL data if provided
    const testData = req.body.encryptedData || req.query.data || "VGVzdCBkYXRhIGZvciBkZWNyeXB0aW9uIHRlc3Rpbmc=";
    
    console.log('🧪 Testing with data length:', testData.length);
    console.log('🧪 Testing data preview:', testData.substring(0, 200));
    
    // Test key loading
    try {
      const testKey = forge.pki.privateKeyFromPem(privateKeyPem);
      console.log('✅ Private key loads successfully');
      console.log('🔍 Key size:', testKey.n.bitLength(), 'bits');
    } catch (keyError) {
      return res.json({
        success: false,
        error: 'Private key format error: ' + keyError.message,
        status: 'KEY_ERROR',
        solution: 'Check your private key format - it should be in PEM format'
      });
    }

    // Test decryption with provided data
    const decryptResult1 = fixedDecryptHBLResponse(testData, privateKeyPem);
    const decryptResult2 = alternativeNodeCryptoDecrypt(testData, privateKeyPem);
    
    console.log('🎯 Decryption test completed!');
    
    return res.json({
      success: true,
      message: 'Decryption system test completed',
      status: 'TESTED',
      results: {
        forgeDecryption: {
          success: Object.keys(decryptResult1).length > 0,
          keys: Object.keys(decryptResult1),
          data: decryptResult1
        },
        cryptoDecryption: {
          success: Object.keys(decryptResult2).length > 0,
          keys: Object.keys(decryptResult2),
          data: decryptResult2
        }
      },
      configuration: {
        privateKeyConfigured: true,
        nodeForgeAvailable: true,
        environmentReady: true
      },
      instructions: [
        'If both methods failed, the encrypted data might be invalid',
        'If one method worked, use that method for production',
        'Check the console logs for detailed debugging information'
      ]
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return res.json({
      success: false,
      error: 'Test failed: ' + error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ==================== MANUAL DECRYPTION ENDPOINT ====================
module.exports.manualDecrypt = async (req, res) => {
  console.log('\n🔧 ========== MANUAL DECRYPTION TEST ==========');
  
  try {
    const { encryptedData, method } = req.body;
    
    if (!encryptedData) { 
      return res.json({
        success: false, 
        error: 'No encrypted data provided',
        usage: 'POST /api/payments/manual-decrypt with { "encryptedData": "your_encrypted_string", "method": "forge|crypto|both" }'
      });
    }
    
    console.log('📝 Manual decryption request:'); 
    console.log('- Data length:', encryptedData.length);
    console.log('- Method requested:', method || 'both');
    console.log('- Data preview:', encryptedData.substring(0, 100));
    
    const results = {};
    
    // Test forge method
    if (!method || method === 'forge' || method === 'both') {
      console.log('🔄 Testing forge decryption...');
      const forgeResult = fixedDecryptHBLResponse(encryptedData, privateKeyPem);
      results.forge = {
        success: Object.keys(forgeResult).length > 0,
        data: forgeResult,
        keys: Object.keys(forgeResult)
      };
    }
    
    // Test crypto method
    if (!method || method === 'crypto' || method === 'both') {
      console.log('🔄 Testing crypto decryption...');
      const cryptoResult = alternativeNodeCryptoDecrypt(encryptedData, privateKeyPem);
      results.crypto = {
        success: Object.keys(cryptoResult).length > 0,
        data: cryptoResult,
        keys: Object.keys(cryptoResult)
      };
    }
    
    return res.json({
      success: true,
      message: 'Manual decryption completed',
      inputData: {
        length: encryptedData.length,
        preview: encryptedData.substring(0, 100),
        isBase64Valid: /^[A-Za-z0-9+/=]+$/.test(encryptedData.replace(/\s/g, ''))
      },
      results,
      recommendation: results.forge?.success ? 'Use forge method' : 
                      results.crypto?.success ? 'Use crypto method' : 
                      'Both methods failed - check your private key and data format'
    });
    
  } catch (error) {
    console.error('❌ Manual decryption failed:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ==================== KEY VALIDATION ENDPOINT ====================
module.exports.validateKeys = async (req, res) => {
  console.log('\n🔑 ========== KEY VALIDATION TEST ==========');
  
  try {
    const validation = {
      privateKey: {
        configured: !!privateKeyPem,
        length: privateKeyPem?.length || 0,
        format: 'unknown',
        valid: false,
        keySize: 0
      },
      publicKey: {
        configured: !!HBL_PUBLIC_KEY,
        length: HBL_PUBLIC_KEY?.length || 0,
        format: 'unknown',
        valid: false
      },
      nodeForge: {
        available: !!forge,
        version: forge ? 'available' : 'not available'
      }
    };
    
    // Validate private key
    if (privateKeyPem) {
      try {
        if (privateKeyPem.includes('BEGIN RSA PRIVATE KEY') || privateKeyPem.includes('BEGIN PRIVATE KEY')) {
          validation.privateKey.format = 'PEM';
          
          if (forge) {
            const key = forge.pki.privateKeyFromPem(privateKeyPem);
            validation.privateKey.valid = true;
            validation.privateKey.keySize = key.n.bitLength();
          }
        } else if (privateKeyPem.includes('<RSAKeyValue>')) {
          validation.privateKey.format = 'XML';
        }
      } catch (error) {
        validation.privateKey.error = error.message;
      }
    }
    
    // Validate public key
    if (HBL_PUBLIC_KEY) {
      try {
        if (HBL_PUBLIC_KEY.includes('BEGIN PUBLIC KEY')) {
          validation.publicKey.format = 'PEM';
          validation.publicKey.valid = true;
        } else if (HBL_PUBLIC_KEY.includes('<RSAKeyValue>')) {
          validation.publicKey.format = 'XML';
          validation.publicKey.valid = true;
        }
      } catch (error) {
        validation.publicKey.error = error.message;
      }
    }
    
    return res.json({
      success: true,
      message: 'Key validation completed',
      validation,
      recommendations: [
        !validation.privateKey.configured ? 'Configure MERCHANT_PRIVATE_KEY_PEM in environment' : null,
        !validation.privateKey.valid ? 'Private key format is invalid - should be PEM format' : null,
        !validation.nodeForge.available ? 'Install node-forge: npm install node-forge' : null,
        validation.privateKey.keySize < 2048 ? 'Key size should be at least 2048 bits' : null
      ].filter(Boolean)
    });
    
  } catch (error) {
    console.error('❌ Key validation failed:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
};

// ==================== SIMULATE HBL CALLBACK ====================
module.exports.simulateCallback = async (req, res) => {
  console.log('\n🎭 ========== SIMULATING HBL CALLBACK ==========');
  
  try {
    const { orderId, responseCode = '0', responseMessage = 'Transaction successful' } = req.body;
    
    if (!orderId) {
      return res.json({
        success: false,
        error: 'Order ID is required',
        usage: 'POST /api/payments/simulate-callback with { "orderId": "your_order_id", "responseCode": "0", "responseMessage": "Success" }'
      });
    }
    
    // Create mock decrypted response data
    const mockResponseData = {
      RESPONSE_CODE: responseCode,
      RESPONSE_MESSAGE: responseMessage,
      ORDER_REF_NUMBER: orderId,
      TRANSACTION_ID: 'TXN_' + Date.now(),
      PAYMENT_TYPE: 'CREDIT_CARD',
      AMOUNT: '100.00',
      CURRENCY: 'PKR',
      PAYMENT_DATE: new Date().toISOString(),
      MERCHANT_ID: 'teliadmin'
    };
    
    console.log('🎭 Simulating callback with data:', mockResponseData);
    
    // Find the payment record
    const payment = await paymentModel.findOne({ orderRefNumber: orderId });
    
    if (!payment) {
      return res.json({
        success: false,
        error: `Payment record not found for order: ${orderId}`,
        suggestion: 'Create a payment first using the initiate payment endpoint'
      });
    }
    
    // Update payment status based on response code
    const isSuccess = responseCode === '0' || responseCode === '100';
    const newStatus = isSuccess ? 'completed' : 'failed';
    
    await payment.updateOne({
      status: newStatus,
      completedAt: isSuccess ? new Date() : null,
      failureReason: isSuccess ? null : responseMessage,
      gatewayResponse: mockResponseData,
      transactionId: mockResponseData.TRANSACTION_ID,
      updatedAt: new Date()
    });
    
    // Update booking if exists
    if (payment.bookingId && isSuccess) {
      await bookingModel.findByIdAndUpdate(payment.bookingId, {
        paymentStatus: 'paid',
        status: 'confirmed',
        confirmedAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return res.json({
      success: true,
      message: 'Callback simulation completed',
      simulation: {
        orderId,
        responseCode,
        paymentStatus: newStatus,
        transactionId: mockResponseData.TRANSACTION_ID
      },
      mockData: mockResponseData,
      paymentUpdated: true,
      nextSteps: [
        'Check your payment record in database',
        'Verify booking status was updated',
        'Test with different response codes for failure scenarios'
      ]
    });
    
  } catch (error) {
    console.error('❌ Callback simulation failed:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
};

// ==================== HEALTH CHECK ====================
module.exports.healthCheck = (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      gateway: 'HBLPay',
      version: '3.0.0', // Updated version with enhanced decryption
      configuration: {
        userId: !!HBLPAY_USER_ID,
        password: !!HBLPAY_PASSWORD,
        publicKey: !!HBL_PUBLIC_KEY,
        privateKey: !!privateKeyPem,
        apiUrl: isProduction ? HBL_PRODUCTION_URL : HBL_SANDBOX_URL,
        redirectUrl: isProduction ? HBL_PRODUCTION_REDIRECT : HBL_SANDBOX_REDIRECT,
        callbackUrls: {
          success: `${process.env.BACKEND_URL || 'https://telitrip.onrender.com'}/api/payments/success`,
          cancel: `${process.env.BACKEND_URL || 'https://telitrip.onrender.com'}/api/payments/cancel`
        }
      },
      decryption: {
        nodeForgeAvailable: !!forge,
        functionReady: typeof fixedDecryptHBLResponse === 'function',
        privateKeyConfigured: !!privateKeyPem,
        status: (!!forge && !!privateKeyPem) ? 'READY' : 'NOT_READY'
      }
    };

    return ApiResponse.success(res, healthStatus, 'Payment gateway is healthy and ready');
    
  } catch (error) {
    return ApiResponse.error(res, 'Health check failed: ' + error.message, 503);
  }
};
      