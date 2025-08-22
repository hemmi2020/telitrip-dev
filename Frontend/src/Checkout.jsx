import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  CreditCard, 
  Lock, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Check,
  AlertCircle,
  Loader
} from 'lucide-react';

const CheckoutScreen = ({ items = [], onBack }) => {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('hblpay');
  
  // State for billing information
  const [billingInfo, setBillingInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'PK'
  });

  // State codes from the Excel file
  const stateOptions = [
    { value: 'IS', label: 'Islamabad' },
    { value: 'BA', label: 'Balochistan' },
    { value: 'KP', label: 'Khyber Pakhtunkhwa' },
    { value: 'PB', label: 'Punjab' },
    { value: 'SD', label: 'Sindh' }
  ];

  // Calculate total price
  const getTotalPrice = () => {
    return items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  // Generate unique order ID
  const generateOrderId = () => {
    return 'ORD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  // Validate billing information
  const validateBillingInfo = () => {
    const required = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state'];
    const missing = required.filter(field => !billingInfo[field]?.trim());
    
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(', ')}`);
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(billingInfo.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Phone validation (Pakistani format)
    const phoneRegex = /^(\+92|0)?[0-9]{10}$/;
    if (!phoneRegex.test(billingInfo.phone.replace(/\s|-/g, ''))) {
      setError('Please enter a valid Pakistani phone number');
      return false;
    }

    setError('');
    return true;
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setBillingInfo(prev => ({
      ...prev,
      [field]: value
    }));
    if (error) setError(''); // Clear error on input change
  };

  // Prepare HBLPay data
  const prepareHBLPayData = () => {
    const orderId = generateOrderId();
    const amount = getTotalPrice();
    
    return {
      bookingData: {
        checkIn: new Date().toISOString().split('T')[0],
        checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Next day
        guests: items.reduce((total, item) => total + item.quantity, 0),
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          category: item.category || 'Hotel'
        }))
      },
      userData: {
        firstName: billingInfo.firstName,
        lastName: billingInfo.lastName,
        email: billingInfo.email,
        phone: billingInfo.phone,
        address: billingInfo.address,
        city: billingInfo.city,
        state: billingInfo.state,
        postalCode: billingInfo.postalCode,
        country: billingInfo.country
      },
      amount: amount,
      currency: 'PKR',
      orderId: orderId
    };
  };

  // Process payment with improved error handling
  const processPayment = async () => {
    if (!validateBillingInfo()) return;

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const paymentData = prepareHBLPayData();
      
      // Get auth token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please login to continue with payment');
      }

      console.log('Initiating payment with data:', paymentData);

      // Call backend to create payment session
      const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}/api/payments/hblpay/initiate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(paymentData)
        }
      );

      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData?.message || `HTTP ${response.status}: Payment initiation failed`);
      }

      if (responseData.success && responseData.data?.sessionId) {
        // Store order details for post-payment processing
        const orderDetails = {
          ...paymentData,
          sessionId: responseData.data.sessionId,
          paymentId: responseData.data.paymentId,
          timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('pendingOrder', JSON.stringify(orderDetails));
        localStorage.setItem('paymentSession', responseData.data.sessionId);

        setSuccess('Payment session created successfully. Redirecting to HBLPay...');
        
        // Redirect to HBLPay after a short delay
        setTimeout(() => {
          window.location.href = responseData.data.paymentUrl;
        }, 2000);

      } else {
        throw new Error(responseData?.message || 'Failed to create payment session');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      setError(error.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle proceed to payment
  const handleProceedToPayment = () => {
    if (validateBillingInfo()) {
      setStep(2);
    }
  };

  // Check for payment return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('status');
    const sessionId = urlParams.get('sessionId');
    
    if (paymentStatus && sessionId) {
      if (paymentStatus === 'success') {
        setSuccess('Payment completed successfully!');
        setStep(3); // Success step
      } else if (paymentStatus === 'failed') {
        setError('Payment failed. Please try again.');
      } else if (paymentStatus === 'cancelled') {
        setError('Payment was cancelled.');
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-800 mr-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Cart
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                {step > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className="ml-2 text-sm font-medium">Billing Info</span>
            </div>
            <div className="w-8 border-t border-gray-200"></div>
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                {step > 2 ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className="ml-2 text-sm font-medium">Payment</span>
            </div>
            {step === 3 && (
              <>
                <div className="w-8 border-t border-gray-200"></div>
                <div className="flex items-center text-green-600">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-600 text-white">
                    <Check className="w-4 h-4" />
                  </div>
                  <span className="ml-2 text-sm font-medium">Complete</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <Check className="w-5 h-5 text-green-500 mr-3" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Billing Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={billingInfo.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter first name"
                      />
                    </div>
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={billingInfo.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={billingInfo.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={billingInfo.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+92 300 1234567"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={billingInfo.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your address"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={billingInfo.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter city"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State/Province *
                    </label>
                    <select
                      value={billingInfo.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select state</option>
                      {stateOptions.map(state => (
                        <option key={state.value} value={state.value}>
                          {state.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Postal Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={billingInfo.postalCode}
                      onChange={(e) => handleInputChange('postalCode', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter postal code"
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <select
                      value={billingInfo.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="PK">Pakistan</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Method</h2>
                
                {/* HBLPay Option */}
                <div className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  paymentMethod === 'hblpay' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="hblpay"
                      name="paymentMethod"
                      value="hblpay"
                      checked={paymentMethod === 'hblpay'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mr-3 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                        <span className="font-medium">HBL Pay</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Pay securely with Visa, Mastercard, UnionPay, or HBL Account
                      </p>
                      <div className="flex items-center mt-2 space-x-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Visa</span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Mastercard</span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">UnionPay</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">HBL Account</span>
                      </div>
                    </div>
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {/* Security Notice */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start">
                    <Lock className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-gray-900">Secure Payment</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Your payment information is encrypted and secure. We never store your card details.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Payment Successful!</h2>
                <p className="text-gray-600 mb-6">
                  Thank you for your payment. Your booking has been confirmed.
                </p>
                <button
                  onClick={() => window.location.href = '/'}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Return to Home
                </button>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
              
              {/* Items */}
              <div className="space-y-3 mb-4">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      <p className="text-sm text-gray-600">
                        Qty: {item.quantity} × PKR {item.price.toFixed(2)}
                      </p>
                    </div>
                    <span className="font-medium">
                      PKR {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">PKR {getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Taxes & Fees:</span>
                  <span className="font-medium">PKR 0.00</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold border-t border-gray-200 pt-2">
                  <span>Total:</span>
                  <span className="text-blue-600">PKR {getTotalPrice().toFixed(2)}</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6">
                {step === 1 ? (
                  <button
                    onClick={handleProceedToPayment}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Proceed to Payment
                  </button>
                ) : step === 2 ? (
                  <button
                    onClick={processPayment}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="animate-spin w-4 h-4 mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Pay Securely
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              {/* Security Notice */}
              <div className="mt-4 text-center">
                <div className="flex items-center justify-center text-xs text-gray-500">
                  <Lock className="w-3 h-3 mr-1" />
                  256-bit SSL encryption
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutScreen;