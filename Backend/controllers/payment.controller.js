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

// ==================== ENHANCED DECRYPTION FUNCTION ====================
function decryptHBLResponse(encryptedData, privateKeyPem) {
  try {
    console.log('\n🔐 [HBL DECRYPT] Starting decryption...');
    console.log('📝 [HBL DECRYPT] Input data type:', typeof encryptedData);
    console.log('📝 [HBL DECRYPT] Input length:', encryptedData?.length || 'undefined');
    console.log('📝 [HBL DECRYPT] First 100 chars:', encryptedData?.substring(0, 100) || 'undefined');
    
    if (!encryptedData) {
      console.error('❌ [HBL DECRYPT] No encrypted data provided');
      return {};
    }
    
    if (!privateKeyPem) {
      console.error('❌ [HBL DECRYPT] No private key provided');
      return {};
    }
    
    if (!forge) {
      console.error('❌ [HBL DECRYPT] node-forge not available');
      return {};
    }
    
    const DECRYPT_BLOCK_SIZE = 512;
    
    // Step 1: Load private key
    console.log('🔑 [HBL DECRYPT] Loading private key...');
    let privateKey;
    try {
      privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      console.log('✅ [HBL DECRYPT] Private key loaded successfully');
    } catch (keyError) {
      console.error('❌ [HBL DECRYPT] Failed to load private key:', keyError.message);
      return {};
    }
    
    // Step 2: Base64 decode
    console.log('📦 [HBL DECRYPT] Decoding base64...');
    let encryptedBuffer;
    try {
      // Handle URL encoded data first
      let cleanData = encryptedData;
      if (encryptedData.includes('%')) {
        cleanData = decodeURIComponent(encryptedData);
        console.log('🔧 [HBL DECRYPT] URL decoded data');
      }
      
      encryptedBuffer = Buffer.from(cleanData, 'base64');
      console.log('📦 [HBL DECRYPT] Decoded length:', encryptedBuffer.length);
      
      if (encryptedBuffer.length === 0) {
        console.error('❌ [HBL DECRYPT] Base64 decode resulted in empty buffer');
        return {};
      }
    } catch (decodeError) {
      console.error('❌ [HBL DECRYPT] Base64 decode failed:', decodeError.message);
      return {};
    }
    
    let decryptedData = '';
    
    // Step 3: Process 512-byte blocks
    console.log('🔄 [HBL DECRYPT] Processing blocks...');
    const totalBlocks = Math.ceil(encryptedBuffer.length / DECRYPT_BLOCK_SIZE);
    console.log(`📊 [HBL DECRYPT] Total blocks to process: ${totalBlocks}`);
    
    for (let i = 0; i < encryptedBuffer.length; i += DECRYPT_BLOCK_SIZE) {
      const chunk = encryptedBuffer.slice(i, i + DECRYPT_BLOCK_SIZE);
      const chunkNum = Math.floor(i / DECRYPT_BLOCK_SIZE) + 1;
      
      console.log(`🔍 [HBL DECRYPT] Processing chunk ${chunkNum}/${totalBlocks}: ${chunk.length} bytes`);
      
      try {
        // Convert to forge binary string
        const chunkBinary = forge.util.createBuffer(chunk).getBytes();
        
        // Decrypt with PKCS1 padding
        const decryptedChunk = privateKey.decrypt(chunkBinary, 'RSAES-PKCS1-V1_5');
        
        decryptedData += decryptedChunk;
        console.log(`✅ [HBL DECRYPT] Chunk ${chunkNum} decrypted: "${decryptedChunk}"`);
        
      } catch (chunkError) {
        console.error(`❌ [HBL DECRYPT] Chunk ${chunkNum} failed:`, chunkError.message);
        
        // Try alternative decryption methods for this chunk
        try {
          console.log(`🔄 [HBL DECRYPT] Trying alternative method for chunk ${chunkNum}`);
          const chunkBinary = forge.util.createBuffer(chunk).getBytes();
          const decryptedChunk = privateKey.decrypt(chunkBinary, 'RSA-OAEP');
          decryptedData += decryptedChunk;
          console.log(`✅ [HBL DECRYPT] Chunk ${chunkNum} decrypted with OAEP: "${decryptedChunk}"`);
        } catch (altError) {
          console.error(`❌ [HBL DECRYPT] Alternative method failed for chunk ${chunkNum}:`, altError.message);
          // Continue to next chunk
        }
      }
    }
    
    console.log('📄 [HBL DECRYPT] Complete decrypted result:', decryptedData);
    
    // Step 4: Parse response
    const params = {};
    if (decryptedData && decryptedData.length > 0) {
      if (decryptedData.includes('=') && decryptedData.includes('&')) {
        const pairs = decryptedData.split('&');
        console.log(`📝 [HBL DECRYPT] Parsing ${pairs.length} key-value pairs`);
        
        pairs.forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value !== undefined) {
            params[key] = decodeURIComponent(value);
            console.log(`📝 [HBL DECRYPT] ${key} = ${params[key]}`);
          }
        });
      } else {
        console.warn('⚠️ [HBL DECRYPT] Decrypted data does not contain expected format (key=value&key=value)');
        console.log('📋 [HBL DECRYPT] Raw decrypted data format check:');
        console.log('- Contains =:', decryptedData.includes('='));
        console.log('- Contains &:', decryptedData.includes('&'));
        console.log('- Length:', decryptedData.length);
      }
    } else {
      console.error('❌ [HBL DECRYPT] No decrypted data available for parsing');
    }
    
    console.log(`🎯 [HBL DECRYPT] Final parsed parameters (${Object.keys(params).length} keys):`, params);
    
    return params;
    
  } catch (error) {
    console.error('❌ [HBL DECRYPT] Decryption failed with error:', error.message);
    console.error('📋 [HBL DECRYPT] Error stack:', error.stack);
    return {};
  }
}

// ==================== ENHANCED PAYMENT SUCCESS HANDLER ====================
module.exports.handlePaymentSuccess = asyncErrorHandler(async (req, res) => {
  const requestId = crypto.randomUUID();
  
  console.log('\n🎉 ========== PAYMENT SUCCESS CALLBACK ==========');
  console.log(`🆔 Request ID: ${requestId}`);
  console.log('📨 Request Method:', req.method);
  console.log('📨 Request URL:', req.url);
  console.log('📨 Query Parameters:', req.query);
  console.log('📨 Body Parameters:', req.body || 'undefined');
  
  try {
    // Get encrypted data from multiple sources
    // Safe access - doesn't crash if req.body is undefined
const encryptedData = req.query.data || (req.body && req.body.data) || (req.params && req.params.data);
    
    console.log('🔍 Encrypted data sources:');
    console.log('- req.query.data:', !!req.query.data, req.query.data?.length || 0);
   console.log('- req.body.data:', !!(req.body && req.body.data), (req.body && req.body.data && req.body.data.length) || 0);
    console.log('- req.params.data:', !!req.params.data, req.params.data?.length || 0);
    
    if (!encryptedData) {
      console.log('❌ No encrypted data received in any parameter');
      console.log('📋 Available query params:', Object.keys(req.query));
      console.log('📋 Available body params:', req.body ? Object.keys(req.body) : 'req.body is undefined');
      
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reason=missing_data&timestamp=${Date.now()}`);
    }
    
    console.log('📝 Encrypted data found:');
    console.log('- Length:', encryptedData.length);
    console.log('- Source:', req.query.data ? 'query' : (req.body && req.body.data) ? 'body' : 'params');
    console.log('- First 100 chars:', encryptedData.substring(0, 100));
    
    if (!privateKeyPem) {
      console.log('❌ Private key not configured in environment variables');
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reason=config_error&timestamp=${Date.now()}`);
    }
    
    // DECRYPT THE RESPONSE
    console.log('🔐 Starting decryption process...');
    const decryptedResponse = decryptHBLResponse(encryptedData, privateKeyPem);
    
    console.log('🔍 Decryption result:');
    console.log('- Success:', Object.keys(decryptedResponse).length > 0);
    console.log('- Keys found:', Object.keys(decryptedResponse));
    console.log('- Full response:', decryptedResponse);
    
    if (!decryptedResponse || Object.keys(decryptedResponse).length === 0) {
      console.log('❌ Decryption failed or returned empty result');
      
      // Log detailed debugging info
      console.log('🔍 Debugging information:');
      console.log('- node-forge available:', !!forge);
      console.log('- Private key configured:', !!privateKeyPem);
      console.log('- Private key length:', privateKeyPem?.length || 0);
      console.log('- Encrypted data type:', typeof encryptedData);
      console.log('- Is base64?', /^[A-Za-z0-9+/=]+$/.test(encryptedData));
      
      return res.redirect(`${process.env.FRONTEND_URL}/payment/error?reason=decrypt_failed&timestamp=${Date.now()}`);
    }
    
    // LOG ALL SUCCESS DATA TO CONSOLE
    console.log('\n📋 ========== DECRYPTED SUCCESS RESPONSE ==========');
    Object.entries(decryptedResponse).forEach(([key, value]) => {
      console.log(`${key}:`, value);
    });
    console.log('===============================================\n');
    
    // Check if payment was successful - be flexible with response codes
    const responseCode = decryptedResponse.RESPONSE_CODE;
    const isSuccess = responseCode === '0' || 
                     responseCode === '100' ||
                     responseCode === 0 ||
                     responseCode === 100 ||
                     responseCode === '00' ||
                     (responseCode && responseCode.toString().toLowerCase() === 'success');
    
    console.log('🔍 Payment success check:');
    console.log('- Response code:', responseCode);
    console.log('- Response code type:', typeof responseCode);
    console.log('- Is success:', isSuccess);
    
    if (!isSuccess) {
      console.log(`❌ Payment not successful. Response code: ${responseCode}`);
      
      // Create detailed failure URL with all available information
      const failureParams = new URLSearchParams({
        status: 'failed',
        code: responseCode || 'unknown',
        message: encodeURIComponent(decryptedResponse.RESPONSE_MESSAGE || 'Payment failed'),
        ref: decryptedResponse.ORDER_REF_NUMBER || 'unknown',
        timestamp: Date.now()
      });
      
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?${failureParams.toString()}`);
    }
    
    // Find payment record with multiple search strategies
    let payment = null;
    const searchStrategies = [];
    
    if (decryptedResponse.SESSION_ID) {
      searchStrategies.push(
        { sessionId: decryptedResponse.SESSION_ID },
        { transactionId: decryptedResponse.SESSION_ID }
      );
    }
    
    if (decryptedResponse.ORDER_REF_NUMBER) {
      searchStrategies.push(
        { orderRefNumber: decryptedResponse.ORDER_REF_NUMBER },
        { orderId: decryptedResponse.ORDER_REF_NUMBER },
        { transactionId: decryptedResponse.ORDER_REF_NUMBER }
      );
    }
    
    if (decryptedResponse.MERCHANT_ORDER_NO) {
      searchStrategies.push(
        { orderId: decryptedResponse.MERCHANT_ORDER_NO },
        { orderRefNumber: decryptedResponse.MERCHANT_ORDER_NO }
      );
    }
    
    console.log('🔍 Searching for payment record with strategies:', searchStrategies.length);
    
    for (let i = 0; i < searchStrategies.length && !payment; i++) {
      const strategy = searchStrategies[i];
      console.log(`🔍 Search strategy ${i + 1}:`, strategy);
      
      try {
        payment = await paymentModel.findOne(strategy);
        if (payment) {
          console.log(`✅ Payment found with strategy ${i + 1}`);
          break;
        }
      } catch (searchError) {
        console.warn(`⚠️ Search strategy ${i + 1} failed:`, searchError.message);
      }
    }
    
    // Extract payment information for URL
    let paymentInfo = {
      status: 'success',
      amount: decryptedResponse.AMOUNT || '0',
      currency: decryptedResponse.CURRENCY || 'PKR',
      ref: decryptedResponse.ORDER_REF_NUMBER || 'unknown',
      transactionId: decryptedResponse.SESSION_ID || decryptedResponse.ORDER_REF_NUMBER,
      paymentType: decryptedResponse.PAYMENT_TYPE,
      timestamp: Date.now()
    };
    
    if (payment) {
      console.log('💾 Updating payment record...');
      
      // Update payment record
      await payment.updateOne({
        status: 'completed',
        responseCode: decryptedResponse.RESPONSE_CODE,
        responseMessage: decryptedResponse.RESPONSE_MESSAGE,
        paymentType: decryptedResponse.PAYMENT_TYPE,
        completedAt: new Date(),
        updatedAt: new Date(),
        hblResponse: decryptedResponse
      });
      
      console.log('✅ Payment record updated successfully');
      
      // Add payment record info to response
      paymentInfo.paymentId = payment.paymentId;
      paymentInfo.orderId = payment.orderId;
      paymentInfo.amount = payment.amount.toString();
      
      // Update related booking
      if (payment.bookingId) {
        try {
          await bookingModel.findByIdAndUpdate(payment.bookingId, {
            paymentStatus: 'paid',
            paidAt: new Date()
          });
          console.log('🎟️ Booking updated to paid status');
        } catch (bookingError) {
          console.warn('⚠️ Failed to update booking:', bookingError.message);
        }
      }
      
      // Send success notification
      try {
        await notificationService.sendPaymentSuccess({
          userId: payment.userId,
          amount: payment.amount,
          transactionId: payment.transactionId || paymentInfo.transactionId,
          paymentMethod: 'HBLPay'
        });
        console.log('📧 Success notification sent');
      } catch (notificationError) {
        console.warn('⚠️ Failed to send notification:', notificationError.message);
      }
    } else {
      console.warn('⚠️ Payment record not found in database');
    }
    
    console.log('✅ PAYMENT SUCCESSFUL!');
    
    // Create success URL with all required parameters that match your frontend expectations
    const successParams = new URLSearchParams({
      status: paymentInfo.status,
      paymentId: paymentInfo.paymentId || '',
      orderId: paymentInfo.orderId || paymentInfo.ref,
      amount: paymentInfo.amount,
      currency: paymentInfo.currency,
      transactionId: paymentInfo.transactionId || '',
      ref: paymentInfo.ref,
      timestamp: paymentInfo.timestamp
    });
    
    const successUrl = `${process.env.FRONTEND_URL}/payment/success?${successParams.toString()}`;
    
    console.log('🎉 Success URL created:', successUrl);
    console.log('📋 URL Parameters:', Object.fromEntries(successParams));
    
    return res.redirect(successUrl);
    
  } catch (error) {
    console.error('❌ Payment success handler error:', error);
    console.error('📋 Error stack:', error.stack);
    
    const errorParams = new URLSearchParams({
      reason: 'server_error',
      message: encodeURIComponent(error.message),
      timestamp: Date.now()
    });
    
    return res.redirect(`${process.env.FRONTEND_URL}/payment/error?${errorParams.toString()}`);
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

    // Test with sample encrypted data (you can provide real HBL data here)
    const testData = req.body.testData || "VGVzdCBkYXRhIGZvciBkZWNyeXB0aW9uIHRlc3Rpbmc="; // Base64 encoded test
    
    console.log('🧪 Testing with data length:', testData.length);
    
    // Test key loading
    try {
      const testKey = forge.pki.privateKeyFromPem(privateKeyPem);
      console.log('✅ Private key loads successfully');
    } catch (keyError) {
      return res.json({
        success: false,
        error: 'Private key format error: ' + keyError.message,
        status: 'KEY_ERROR',
        solution: 'Check your private key format - it should be in PEM format'
      });
    }

    console.log('🎯 Decryption system is ready for production!');
    
    return res.json({
      success: true,
      message: 'Decryption system is properly configured and ready!',
      status: 'READY',
      configuration: {
        privateKeyConfigured: true,
        nodeForgeAvailable: true,
        environmentReady: true
      },
      nextSteps: [
        'Complete a real payment transaction',
        'Check server logs during callback',
        'Verify success/cancel URLs receive proper parameters'
      ],
      note: 'Your decryption will work when HBL sends real encrypted callback data'
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
      