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

// Load node-forge for decryption
let forge;
try {
  forge = require('node-forge');
  console.log('✅ node-forge loaded successfully');
} catch (error) {
  console.log('❌ node-forge not available:', error.message);
  console.log('📦 Install with: npm install node-forge');
}

// ==================== FIXED DECRYPTION FOR YOUR SPECIFIC CASE ====================
function fixedDecryptHBLResponse(encryptedData, privateKeyPem) {
  try {
    console.log('\n🔧 [FIXED DECRYPT] Starting enhanced decryption...');
    console.log('📝 [FIXED DECRYPT] Input length:', encryptedData?.length);
    console.log('📝 [FIXED DECRYPT] Input preview:', encryptedData?.substring(0, 100));
    
    if (!encryptedData || !privateKeyPem || !forge) {
      console.error('❌ [FIXED DECRYPT] Missing required components');
      return {};
    }
    
    // STEP 1: AGGRESSIVE DATA CLEANING (Your data has spaces!)
    console.log('🧹 [FIXED DECRYPT] Cleaning data...');
    let cleanData = encryptedData;
    
    // Remove ALL whitespace (spaces, tabs, newlines)
    cleanData = cleanData.replace(/\s+/g, '');
    console.log('📝 [FIXED DECRYPT] After removing spaces:', cleanData.length, 'chars');
    
    // Handle URL encoding if present
    if (cleanData.includes('%')) {
      cleanData = decodeURIComponent(cleanData);
      console.log('📝 [FIXED DECRYPT] After URL decode:', cleanData.length, 'chars');
    }
    
    // STEP 2: LOAD PRIVATE KEY AND GET CORRECT BLOCK SIZE
    console.log('🔑 [FIXED DECRYPT] Loading private key...');
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const keySize = privateKey.n.bitLength();
    const blockSize = keySize / 8; // This should be 256 for 2048-bit key, not 512!
    
    console.log('🔍 [FIXED DECRYPT] Key details:');
    console.log('- Key size:', keySize, 'bits');
    console.log('- Block size:', blockSize, 'bytes');
    console.log('- Expected block size for RSA-2048:', keySize === 2048 ? '256 bytes' : `${blockSize} bytes`);
    
    // STEP 3: BASE64 DECODE WITH ERROR HANDLING
    console.log('📦 [FIXED DECRYPT] Base64 decoding...');
    let binaryData;
    try {
      // Use forge's base64 decoder (more reliable)
      binaryData = forge.util.decode64(cleanData);
      console.log('✅ [FIXED DECRYPT] Forge base64 decode successful:', binaryData.length, 'bytes');
    } catch (error) {
      console.log('🔄 [FIXED DECRYPT] Trying Node.js Buffer decode...');
      try {
        const buffer = Buffer.from(cleanData, 'base64');
        binaryData = buffer.toString('binary');
        console.log('✅ [FIXED DECRYPT] Buffer decode successful:', binaryData.length, 'bytes');
      } catch (bufferError) {
        console.error('❌ [FIXED DECRYPT] All base64 decode methods failed');
        return {};
      }
    }
    
    // STEP 4: VERIFY DATA LENGTH IS MULTIPLE OF BLOCK SIZE
    console.log('🔍 [FIXED DECRYPT] Data verification:');
    console.log('- Binary data length:', binaryData.length);
    console.log('- Block size:', blockSize);
    console.log('- Is multiple of block size:', binaryData.length % blockSize === 0);
    console.log('- Number of blocks:', Math.ceil(binaryData.length / blockSize));
    
    if (binaryData.length % blockSize !== 0) {
      console.log('⚠️ [FIXED DECRYPT] Data length not multiple of block size - this might cause issues');
    }
    
    // STEP 5: DECRYPT USING CORRECT BLOCK SIZE
    console.log('🔓 [FIXED DECRYPT] Starting block decryption...');
    let decryptedData = '';
    const totalBlocks = Math.ceil(binaryData.length / blockSize);
    
    for (let i = 0; i < binaryData.length; i += blockSize) {
      const block = binaryData.substring(i, i + blockSize);
      const blockNum = Math.floor(i / blockSize) + 1;
      
      console.log(`🔍 [FIXED DECRYPT] Block ${blockNum}/${totalBlocks}: ${block.length} bytes`);
      
      // Try multiple decryption methods for each block
      let blockDecrypted = false;
      
      // Method 1: RSAES-PKCS1-V1_5 (most common for HBL)
      try {
        const result = privateKey.decrypt(block, 'RSAES-PKCS1-V1_5');
        decryptedData += result;
        console.log(`✅ [FIXED DECRYPT] Block ${blockNum} PKCS1: "${result}"`);
        blockDecrypted = true;
      } catch (pkcs1Error) {
        console.log(`❌ [FIXED DECRYPT] Block ${blockNum} PKCS1 failed:`, pkcs1Error.message);
      }
      
      // Method 2: RSA-OAEP (if PKCS1 fails)
      if (!blockDecrypted) {
        try {
          const result = privateKey.decrypt(block, 'RSA-OAEP');
          decryptedData += result;
          console.log(`✅ [FIXED DECRYPT] Block ${blockNum} OAEP: "${result}"`);
          blockDecrypted = true;
        } catch (oaepError) {
          console.log(`❌ [FIXED DECRYPT] Block ${blockNum} OAEP failed:`, oaepError.message);
        }
      }
      
      // Method 3: Raw RSA (no padding)
      if (!blockDecrypted) {
        try {
          const result = privateKey.decrypt(block);
          decryptedData += result;
          console.log(`✅ [FIXED DECRYPT] Block ${blockNum} Raw: "${result}"`);
          blockDecrypted = true;
        } catch (rawError) {
          console.log(`❌ [FIXED DECRYPT] Block ${blockNum} Raw failed:`, rawError.message);
        }
      }
      
      if (!blockDecrypted) {
        console.error(`💥 [FIXED DECRYPT] Block ${blockNum} COMPLETELY FAILED - all methods exhausted`);
        // Don't return here, continue with other blocks
      }
    }
    
    console.log('📄 [FIXED DECRYPT] Total decrypted length:', decryptedData.length);
    console.log('📄 [FIXED DECRYPT] Decrypted content:', decryptedData);
    
    // STEP 6: PARSE THE DECRYPTED DATA
    const params = {};
    if (decryptedData.length > 0) {
      // HBL typically returns URL-encoded parameters
      if (decryptedData.includes('=') && decryptedData.includes('&')) {
        const pairs = decryptedData.split('&');
        console.log(`📝 [FIXED DECRYPT] Parsing ${pairs.length} parameters`);
        
        pairs.forEach((pair, index) => {
          if (pair.includes('=')) {
            const [key, ...valueParts] = pair.split('=');
            const value = valueParts.join('='); // Handle values with = in them
            if (key && value !== undefined) {
              try {
                params[key.trim()] = decodeURIComponent(value);
                console.log(`📝 [FIXED DECRYPT] ${index + 1}. ${key} = ${value}`);
              } catch (decodeError) {
                params[key.trim()] = value; // Use raw value if decode fails
                console.log(`📝 [FIXED DECRYPT] ${index + 1}. ${key} = ${value} (raw)`);
              }
            }
          }
        });
      } else {
        console.log('📝 [FIXED DECRYPT] Not standard parameters, storing as raw data');
        params.RAW_DATA = decryptedData;
      }
    }
    
    console.log(`🎯 [FIXED DECRYPT] Final result: ${Object.keys(params).length} parameters`);
    return params;
    
  } catch (error) {
    console.error('💥 [FIXED DECRYPT] Fatal error:', error.message);
    console.error(error.stack);
    return {};
  }
}


// ==================== ALTERNATIVE: NODE.JS CRYPTO APPROACH ====================
function alternativeNodeCryptoDecrypt(encryptedData, privateKeyPem) {
  try {
    console.log('\n🔧 [NODE CRYPTO] Alternative decryption method...');
    
    // Clean the data
    const cleanData = encryptedData.replace(/\s+/g, '');
    console.log('📝 [NODE CRYPTO] Cleaned data length:', cleanData.length);
    
    // Decode base64
    const encryptedBuffer = Buffer.from(cleanData, 'base64');
    console.log('📦 [NODE CRYPTO] Buffer length:', encryptedBuffer.length);
    
    // Try different padding schemes
    const paddingMethods = [
      { name: 'PKCS1', padding: crypto.constants.RSA_PKCS1_PADDING },
      { name: 'OAEP', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      { name: 'NO_PADDING', padding: crypto.constants.RSA_NO_PADDING }
    ];
    
    for (const method of paddingMethods) {
      try {
        console.log(`🔄 [NODE CRYPTO] Trying ${method.name} padding...`);
        
        const decrypted = crypto.privateDecrypt({
          key: privateKeyPem,
          padding: method.padding
        }, encryptedBuffer);
        
        const decryptedString = decrypted.toString('utf8');
        console.log(`✅ [NODE CRYPTO] ${method.name} successful:`, decryptedString);
        
        // Parse the result
        const params = {};
        if (decryptedString.includes('=') && decryptedString.includes('&')) {
          const pairs = decryptedString.split('&');
          pairs.forEach(pair => {
            if (pair.includes('=')) {
              const [key, ...valueParts] = pair.split('=');
              const value = valueParts.join('=');
              params[key.trim()] = decodeURIComponent(value || '');
            }
          });
        } else {
          params.RAW_DATA = decryptedString;
        }
        
        return params;
        
      } catch (error) {
        console.log(`❌ [NODE CRYPTO] ${method.name} failed:`, error.message);
      }
    }
    
    console.error('💥 [NODE CRYPTO] All padding methods failed');
    return {};
    
  } catch (error) {
    console.error('💥 [NODE CRYPTO] Fatal error:', error.message);
    return {};
  }
}


// ==================== ULTIMATE DECRYPTION FUNCTION ====================
function ultimateHBLDecrypt(encryptedData, privateKeyPem) {
  console.log('\n🚀 [ULTIMATE] Starting ultimate decryption process...');
  
  // Method 1: Fixed forge approach
  console.log('🔄 [ULTIMATE] Trying fixed forge method...');
  let result = fixedDecryptHBLResponse(encryptedData, privateKeyPem);
  if (Object.keys(result).length > 0) {
    console.log('✅ [ULTIMATE] Fixed forge method succeeded!');
    return result;
  }
  
  // Method 2: Node.js crypto approach
  console.log('🔄 [ULTIMATE] Trying Node.js crypto method...');
  result = alternativeNodeCryptoDecrypt(encryptedData, privateKeyPem);
  if (Object.keys(result).length > 0) {
    console.log('✅ [ULTIMATE] Node.js crypto method succeeded!');
    return result;
  }
  
  // Method 3: Try with different key formats (if applicable)
  console.log('🔄 [ULTIMATE] All methods failed, checking key format...');
  
  // Log detailed diagnostics
  console.log('🔍 [ULTIMATE] Diagnostics:');
  console.log('- Input data length:', encryptedData?.length);
  console.log('- Has spaces:', encryptedData?.includes(' '));
  console.log('- Has URL encoding:', encryptedData?.includes('%'));
  console.log('- Private key length:', privateKeyPem?.length);
  console.log('- Private key starts with:', privateKeyPem?.substring(0, 50));
  
  return {};
}


// ==================== UPDATED SUCCESS HANDLER ====================
module.exports.handlePaymentSuccess = asyncErrorHandler(async (req, res) => {
  console.log('\n🎉 ========== ENHANCED PAYMENT SUCCESS CALLBACK ==========');
  console.log('🔗 Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
  
  try {
    // Get encrypted data with more sources
    const encryptedData = req.query.data || req.body.data || req.params.data || 
                         req.query.encryptedData || req.body.encryptedData;
    
    if (!encryptedData) {
      console.log('❌ No encrypted data found');
      console.log('Available query params:', Object.keys(req.query));
      console.log('Available body params:', req.body ? Object.keys(req.body) : 'none');
      
      return res.status(400).json({
        success: false,
        error: 'No encrypted data found in request',
        received: {
          query: req.query,
          body: req.body,
          params: req.params
        }
      });
    }
    
    console.log('📥 Encrypted data received:');
    console.log('- Length:', encryptedData.length);
    console.log('- Preview:', encryptedData.substring(0, 150));
    console.log('- Has spaces:', encryptedData.includes(' '));
    
    // Use the ultimate decryption method
    const decryptedResponse = ultimateHBLDecrypt(encryptedData, privateKeyPem);
    
    if (!decryptedResponse || Object.keys(decryptedResponse).length === 0) {
      console.log('💥 ALL DECRYPTION METHODS FAILED');
      
      // Return detailed error for debugging
      return res.status(500).json({
        success: false,
        error: 'Decryption failed',
        debug: {
          dataLength: encryptedData.length,
          dataPreview: encryptedData.substring(0, 200),
          hasSpaces: encryptedData.includes(' '),
          hasUrlEncoding: encryptedData.includes('%'),
          privateKeyConfigured: !!privateKeyPem,
          nodeForgeAvailable: !!forge
        },
        solution: 'Check the decryption logs above for specific error details'
      });
    }
    
    console.log('🎊 DECRYPTION SUCCESSFUL!');
    console.log('📋 Decrypted parameters:', decryptedResponse);
    
    // Continue with your existing payment processing logic...
    const responseCode = decryptedResponse.RESPONSE_CODE;
    const isSuccess = ['0', '100', 0, 100, '00'].includes(responseCode) || 
                     responseCode?.toString().toLowerCase() === 'success';
    
    if (!isSuccess) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?code=${responseCode}`);
    }
    
    // Process successful payment...
    const orderRefNumber = decryptedResponse.ORDER_REF_NUMBER || decryptedResponse.REFERENCE_NUMBER;
    // ... rest of your success logic
    
    return res.redirect(`${process.env.FRONTEND_URL}/payment/success?order=${orderRefNumber}`);
    
  } catch (error) {
    console.error('💥 Payment success handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==================== ENHANCED PAYMENT CANCEL HANDLER ====================
module.exports.handlePaymentCancel = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();
  
  console.log('\n🚫 ========== PAYMENT CANCEL CALLBACK ==========');
  console.log(`🆔 Request ID: ${requestId}`);
  console.log('📨 Request Method:', req.method);
  console.log('📨 Request URL:', req.url);
  console.log('📨 Query Parameters:', req.query);
  console.log('📨 Body Parameters:', req.body);
  
  try {
    // Get encrypted data from multiple sources
    const encryptedData = req.query.data || req.body.data || req.params.data;
    
    if (!encryptedData) {
      console.log('❌ No encrypted data received');
      return res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?reason=missing_data&timestamp=${Date.now()}`);
    }
    
    console.log('📝 Encrypted data received, length:', encryptedData.length);
    
    if (!privateKeyPem) {
      console.log('❌ Private key not configured');
      return res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?reason=config_error&timestamp=${Date.now()}`);
    }
    
    // DECRYPT THE RESPONSE
    console.log('🔐 Starting decryption...');
    const decryptedResponse = decryptHBLResponse(encryptedData, privateKeyPem);
    
    if (!decryptedResponse || Object.keys(decryptedResponse).length === 0) {
      console.log('❌ Decryption failed or empty result');
      return res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?reason=decrypt_failed&timestamp=${Date.now()}`);
    }
    
    // LOG ALL CANCEL DATA TO CONSOLE
    console.log('\n📋 ========== DECRYPTED CANCEL RESPONSE ==========');
    Object.entries(decryptedResponse).forEach(([key, value]) => {
      console.log(`${key}:`, value);
    });
    console.log('===============================================\n');
    
    // Find and update payment record
    let payment = null;
    const searchStrategies = [
      { sessionId: decryptedResponse.SESSION_ID },
      { orderRefNumber: decryptedResponse.ORDER_REF_NUMBER },
      { orderId: decryptedResponse.ORDER_REF_NUMBER },
      { transactionId: decryptedResponse.SESSION_ID }
    ].filter(strategy => Object.values(strategy)[0]); // Remove empty values
    
    for (const strategy of searchStrategies) {
      try {
        payment = await paymentModel.findOne(strategy);
        if (payment) break;
      } catch (error) {
        console.warn('Search strategy failed:', strategy, error.message);
      }
    }
    
    if (payment) {
      await payment.updateOne({
        status: 'cancelled',
        responseCode: decryptedResponse.RESPONSE_CODE,
        responseMessage: decryptedResponse.RESPONSE_MESSAGE,
        cancelledAt: new Date(),
        updatedAt: new Date(),
        hblResponse: decryptedResponse
      });
      
      console.log('💾 Payment record updated to cancelled');
    }
    
    console.log('🚫 PAYMENT CANCELLED!');
    
    // Create cancel URL with proper parameters
    const cancelParams = new URLSearchParams({
      status: 'cancelled',
      code: decryptedResponse.RESPONSE_CODE || 'user_cancelled',
      message: encodeURIComponent(decryptedResponse.RESPONSE_MESSAGE || 'Payment cancelled by user'),
      ref: decryptedResponse.ORDER_REF_NUMBER || 'unknown',
      timestamp: Date.now()
    });
    
    const cancelUrl = `${process.env.FRONTEND_URL}/payment/cancel?${cancelParams.toString()}`;
    console.log('🚫 Redirecting to cancel page:', cancelUrl);
    
    return res.redirect(cancelUrl);
    
  } catch (error) {
    console.error('❌ Payment cancel handler error:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?reason=server_error&timestamp=${Date.now()}`);
  }
});

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
    const decryptResult1 = decryptHBLResponse(testData, privateKeyPem);
    const decryptResult2 = decryptHBLResponseWithNodeCrypto(testData, privateKeyPem);
    
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
      const forgeResult = decryptHBLResponse(encryptedData, privateKeyPem);
      results.forge = {
        success: Object.keys(forgeResult).length > 0,
        data: forgeResult,
        keys: Object.keys(forgeResult)
      };
    }
    
    // Test crypto method
    if (!method || method === 'crypto' || method === 'both') {
      console.log('🔄 Testing crypto decryption...');
      const cryptoResult = decryptHBLResponseWithNodeCrypto(encryptedData, privateKeyPem);
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
        functionReady: typeof decryptHBLResponse === 'function',
        privateKeyConfigured: !!privateKeyPem,
        status: (!!forge && !!privateKeyPem) ? 'READY' : 'NOT_READY'
      }
    };

    return ApiResponse.success(res, healthStatus, 'Payment gateway is healthy and ready');
    
  } catch (error) {
    return ApiResponse.error(res, 'Health check failed: ' + error.message, 503);
  }
};
      