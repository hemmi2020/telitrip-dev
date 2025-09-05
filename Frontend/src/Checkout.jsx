// Fixed Checkout.jsx - Updated for backend validation compatibility
import React, { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserDataContext } from './components/CartSystem';
import { useCart } from './components/CartSystem';
import { AuthModal } from './components/CartSystem';
import Header from './components/Header';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  CreditCard, 
  Lock,
  AlertCircle,
  Loader2
} from 'lucide-react';
import axios from 'axios';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(UserDataContext);
  const { items: cartItems, getTotalPrice, clearCart } = useCart();
  
  // Get cart data from navigation state or use current cart
  const checkoutItems = location.state?.cartItems || cartItems;
  const totalAmount = location.state?.totalAmount || getTotalPrice();

  // State management
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBillingDetails, setShowBillingDetails] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form data - Changed structure to match backend expectations
  const [billingInfo, setBillingInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'PK', // Default to Pakistan country code
    state: '',
    postalCode: ''
  });

  // Populate form with user data if logged in
  useEffect(() => {
    if (user && user.email) {
      setBillingInfo(prev => ({
        ...prev,
        firstName: user.fullname?.firstname || '',
        lastName: user.fullname?.lastname || '',
        email: user.email || '',
        phone: user.phone || ''
      }));
    }
  }, [checkoutItems, navigate, user]);

  // Redirect if no items to checkout
  useEffect(() => {
    if (!checkoutItems || checkoutItems.length === 0) {
      navigate('/home');
    }
  }, [checkoutItems, navigate]);

  const handleInputChange = (field, value) => {
    setBillingInfo(prev => ({
      ...prev,
      [field]: value
    }));
    setError(''); // Clear errors when user types
  };

  const validateForm = () => {
    const required = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'country', 'state'];
    const missing = required.filter(field => !billingInfo[field]);
    
    if (missing.length > 0) {
      setError(`Please fill in all required fields: ${missing.join(', ')}`);
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(billingInfo.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Phone validation for Pakistani format
    const phoneRegex = /^(\+92|0)?[0-9]{10}$/;
    if (!phoneRegex.test(billingInfo.phone.replace(/\s/g, ''))) {
      setError('Please enter a valid Pakistani phone number (e.g., 03001234567 or +923001234567)');
      return false;
    }

    return true;
  };

  const handlePayment = async () => {
  if (!validateForm()) {
    return;
  }

  setIsProcessing(true);
  setError('');

  try {
    console.log('🚀 Starting checkout process...');

    // Step 1: Create booking first (required by backend)
    const bookingData = {
      hotelName: checkoutItems[0]?.hotelName || 'Hotel Booking',
      roomName: checkoutItems.map(item => item.roomName).join(', ') || 'Multiple Rooms',
      location: checkoutItems[0]?.location || 'Various Locations',
      checkIn: checkoutItems[0]?.checkIn,
      checkOut: checkoutItems[0]?.checkOut,
      guests: checkoutItems.reduce((total, item) => total + (item.guests || 1), 0),
      totalAmount: parseFloat(totalAmount),
      boardType: 'Room Only',
      rateClass: checkoutItems[0]?.rateClass || 'NOR',
      items: checkoutItems.map(item => ({
        roomName: item.roomName,
        hotelName: item.hotelName,
        quantity: item.quantity,
        price: item.price,
        checkIn: item.checkIn,
        checkOut: item.checkOut
      }))
    };

    console.log('📋 Creating booking with data:', bookingData);

    // Create booking first
    const bookingResponse = await axios.post(
      `${import.meta.env.VITE_BASE_URL}/api/bookings/create`,
      bookingData,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const booking = bookingResponse.data.data;
    console.log('✅ Booking created successfully:', booking);
    
    // 🔍 CRITICAL DEBUG: Check booking ID
    console.log('🔍 Booking ID type:', typeof booking._id);
    console.log('🔍 Booking ID value:', booking._id);
    console.log('🔍 Booking ID length:', booking._id?.length);
    console.log('🔍 Is valid MongoDB ObjectId?', /^[0-9a-fA-F]{24}$/.test(booking._id));

    // Validate booking ID before proceeding
    if (!booking._id) {
      throw new Error('No booking ID returned from booking creation');
    }

    if (!/^[0-9a-fA-F]{24}$/.test(booking._id)) {
      throw new Error(`Invalid booking ID format: ${booking._id}`);
    }

    // Step 2: Prepare payment data with correct structure
    const paymentData = {
      amount: parseFloat(totalAmount),
      currency: 'PKR',
      bookingId: booking._id, // This should be a valid MongoDB ObjectId
      userData: {
        firstName: billingInfo.firstName.trim(),
        lastName: billingInfo.lastName.trim(),
        email: billingInfo.email.trim().toLowerCase(),
        phone: billingInfo.phone.trim().replace(/\s/g, ''), // Remove spaces
        address: billingInfo.address.trim(),
        city: billingInfo.city.trim(),
        state: billingInfo.state, // Use state code (e.g., 'SD')
        country: billingInfo.country, // Use country code (e.g., 'PK')
        postalCode: billingInfo.postalCode || ''
      },
      bookingData: {
        items: checkoutItems.map(item => ({
          name: `${item.hotelName || 'Hotel'} - ${item.roomName || 'Room'}`,
          quantity: parseInt(item.quantity) || 1,
          price: parseFloat(item.price) || 0,
          category: 'Hotel'
        })),
        hotelName: checkoutItems[0]?.hotelName,
        checkIn: checkoutItems[0]?.checkIn,
        checkOut: checkoutItems[0]?.checkOut,
        totalAmount: parseFloat(totalAmount)
      }
    };

    // 🔍 CRITICAL DEBUG: Log complete payment data
    console.log('💳 Initiating payment with data:', JSON.stringify(paymentData, null, 2));
    console.log('🔍 Payment data bookingId:', paymentData.bookingId);
    console.log('🔍 Payment data amount:', paymentData.amount);
    console.log('🔍 Payment data userData:', paymentData.userData);

    // Call payment API
    const response = await axios.post(
      `${import.meta.env.VITE_BASE_URL}/api/payments/hblpay/initiate`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Payment response:', response.data);

    if (response.data.success && response.data.data?.paymentUrl) {
      // Clear cart and redirect to payment gateway
      clearCart();
      window.location.href = response.data.data.paymentUrl;
    } else {
      throw new Error(response.data.message || 'Payment initialization failed');
    }

  } catch (error) {
    console.error('❌ Payment error:', error);
    console.error('❌ Response data:', error.response?.data);
    console.error('❌ Response status:', error.response?.status);
    
    // 🔍 ENHANCED ERROR DEBUGGING
    if (error.response?.data) {
      console.error('🔍 Detailed error response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data.errors) {
        console.error('🔍 Validation errors:', error.response.data.errors);
      }
    }
    
    let errorMessage = 'Payment failed. Please try again.';
    
    if (error.response?.data) {
      if (error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
        // Handle validation errors array
        const validationErrors = error.response.data.errors
          .map(err => `${err.path || err.field}: ${err.msg || err.message}`)
          .join('; ');
        errorMessage = `Validation errors: ${validationErrors}`;
      } else if (typeof error.response.data === 'string') {
        errorMessage = error.response.data;
      }
    }
    
    setError(errorMessage);
  } finally {
    setIsProcessing(false);
  }
};

  const handleAuthSuccess = (userData) => {
    setShowAuthModal(false);
    setBillingInfo(prev => ({
      ...prev,
      firstName: userData.fullname?.firstname || '',
      lastName: userData.fullname?.lastname || '',
      email: userData.email || '',
      phone: userData.phone || ''
    }));
  };

  // Render authentication prompt
  const renderAuthPrompt = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-blue-900">Sign in for faster checkout</h3>
          <p className="text-sm text-blue-700 mt-1">
            Save your information and track your bookings
          </p>
        </div>
        <button
          onClick={() => setShowAuthModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {user ? 'Account' : 'Sign In'}
        </button>
      </div>
    </div>
  );

  // Render billing form
  const renderBillingForm = () => (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Billing Information</h2>
        <button
          onClick={() => setShowBillingDetails(!showBillingDetails)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {showBillingDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {showBillingDetails && (
        <div className="space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
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
                  required
                />
              </div>
            </div>

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
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact Fields */}
          <div className="grid grid-cols-2 gap-4">
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
                  required
                />
              </div>
            </div>

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
                  placeholder="03001234567"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Pakistani format: 03001234567 (10 digits after 0)
              </p>
            </div>
          </div>

          {/* Address Field */}
          <div>
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
                placeholder="Enter full address"
                required
              />
            </div>
          </div>

          {/* City and Postal Code */}
          <div className="grid grid-cols-2 gap-4">
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
                required
              />
            </div>

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
          </div>

          {/* Country and State - FIXED to match backend validation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country *
              </label>
              <select
                value={billingInfo.country}
                onChange={(e) => {
                  handleInputChange('country', e.target.value);
                  handleInputChange('state', ''); // Reset state when country changes
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Country</option>
                <option value="PK">Pakistan</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="CA">Canada</option>
                {/* Add more countries as needed */}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State/Province *
              </label>
              <select
                value={billingInfo.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={!billingInfo.country}
              >
                <option value="">
                  {billingInfo.country ? 'Select State/Province' : 'Select Country First'}
                </option>
                {billingInfo.country === 'PK' && (
                  <>
                    <option value="IS">Islamabad</option>
                    <option value="BA">Balochistan</option>
                    <option value="KP">Khyber Pakhtunkhwa</option>
                    <option value="PB">Punjab</option>
                    <option value="SD">Sindh</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render order summary
  const renderOrderSummary = () => (
    <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
      
      <div className="space-y-4 mb-6">
        {checkoutItems.map((item, index) => (
          <div key={index} className="flex justify-between items-start border-b pb-4">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{item.hotelName}</h3>
              <p className="text-sm text-gray-600">{item.roomName}</p>
              <div className="flex items-center text-xs text-gray-500 mt-1">
                <Calendar className="w-3 h-3 mr-1" />
                {new Date(item.checkIn).toLocaleDateString()} - {new Date(item.checkOut).toLocaleDateString()}
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <MapPin className="w-3 h-3 mr-1" />
                {item.location}
              </div>
              {item.quantity > 1 && (
                <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                PKR {(item.price * item.quantity).toLocaleString()}
              </p>
              {item.rateClass && (
                <span className={`inline-block px-2 py-1 rounded text-xs mt-1 ${
                  item.rateClass.toLowerCase().includes('refundable') 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {item.rateClass}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Total Amount:</span>
          <span className="text-blue-600">PKR {totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Debug Info - Remove this in production */}
      {import.meta.env.MODE === 'production' && (
        <div className="bg-gray-100 p-4 rounded-lg mb-4 text-xs">
          <h4 className="font-medium mb-2">Debug Info:</h4>
          <pre>{JSON.stringify({
            userData: billingInfo, // Changed from billingInfo to userData for clarity
            checkoutItems: checkoutItems?.length || 0,
            totalAmount,
            user: user?.email || 'Not logged in'
          }, null, 2)}</pre>
        </div>
      )}

      {/* Payment Button */}
      <div className="mt-6">
        {error && (
          <div className="flex items-center space-x-2 text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center space-x-2 text-green-600 text-sm mb-4 p-3 bg-green-50 rounded-lg">
            <span>✅ {success}</span>
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={isProcessing || checkoutItems.length === 0}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Secure Payment - PKR {totalAmount.toLocaleString()}</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-center space-x-2 mt-3 text-xs text-gray-500">
          <Lock className="w-3 h-3" />
          <span>Your payment information is secure and encrypted</span>
        </div>
      </div>
    </div>
  );

  if (!checkoutItems || checkoutItems.length === 0) {
    return (
      <>
        <Header />
        <div className="pt-20 min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
              <p className="text-gray-600 mb-6">Add some items to your cart to proceed with checkout.</p>
              <button
                onClick={() => navigate('/home')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="pt-20 min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
            <p className="text-gray-600 mt-2">Complete your booking securely</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Forms */}
            <div className="lg:col-span-2 space-y-6">
              {!user && renderAuthPrompt()}
              {renderBillingForm()}
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              {renderOrderSummary()}
            </div>
          </div>
        </div>
      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
        defaultTab="login"
      />
    </>
  );
};

export default Checkout;
