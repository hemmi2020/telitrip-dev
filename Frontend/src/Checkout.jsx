import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from './components/CartSystem';
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
  Loader,
  Calendar,
  Users,
  Star,
  X,
  Info,
  Shield,
  Building,
  Globe,
  Eye,
  EyeOff
} from 'lucide-react';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Safe cart context usage with fallbacks
  let cartItems = [];
  let getTotalPrice = () => 0;
  let clearCart = () => {};
  
  try {
    const cartContext = useCart();
    if (cartContext) {
      cartItems = cartContext.cartItems || [];
      getTotalPrice = cartContext.getTotalPrice || (() => 0);
      clearCart = cartContext.clearCart || (() => {});
    }
  } catch (error) {
    console.warn('Cart context not available:', error);
    // Use location state as fallback
    cartItems = location.state?.cartItems || [];
    getTotalPrice = () => location.state?.totalAmount || 0;
  }
  
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBillingDetails, setShowBillingDetails] = useState(true);
  
  // Get booking data from navigation state or cart
  const bookingData = location.state?.bookingData || null;
  const totalAmount = location.state?.totalAmount || (getTotalPrice ? getTotalPrice() : 0);
  
  // User authentication
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Login/Register form states
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    fullname: {
      firstname: '',
      lastname: ''
    },
    phone: ''
  });
  
  // Billing information
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

  // State options (from your Excel file)
  const stateOptions = [
    { value: 'IS', label: 'Islamabad Capital Territory' },
    { value: 'BA', label: 'Balochistan' },
    { value: 'KP', label: 'Khyber Pakhtunkhwa' },
    { value: 'PB', label: 'Punjab' },
    { value: 'SD', label: 'Sindh' },
    { value: 'GB', label: 'Gilgit-Baltistan' },
    { value: 'AJK', label: 'Azad Jammu and Kashmir' }
  ];

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuthStatus = () => {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const userData = localStorage.getItem('userData');
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setIsLoggedIn(true);
          
          // Pre-populate billing info from user data
          setBillingInfo(prev => ({
            ...prev,
            firstName: parsedUser.fullname?.firstname || '',
            lastName: parsedUser.fullname?.lastname || '',
            email: parsedUser.email || '',
            phone: parsedUser.phone || ''
          }));
        } catch (error) {
          console.error('Error parsing user data:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
        }
      }
    };
    
    checkAuthStatus();
  }, []);

  // Check for payment return/callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('status');
    const sessionId = urlParams.get('sessionId');
    
    if (paymentStatus && sessionId) {
      handlePaymentReturn(paymentStatus, sessionId);
    }
  }, []);

  // Handle payment return
  const handlePaymentReturn = (status, sessionId) => {
    if (status === 'success') {
      setSuccess('Payment completed successfully!');
      setStep(3); // Success step
      clearCart(); // Clear cart on successful payment
    } else if (status === 'failed') {
      setError('Payment failed. Please try again.');
    } else if (status === 'cancelled') {
      setError('Payment was cancelled.');
    }
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setBillingInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAuthInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setAuthForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setAuthForm(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Validation functions
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

    // Phone validation
    const phoneRegex = /^(\+92|0)?[0-9]{10}$/;
    if (!phoneRegex.test(billingInfo.phone.replace(/\s+/g, ''))) {
      setError('Please enter a valid Pakistani phone number');
      return false;
    }

    setError('');
    return true;
  };

  // Authentication functions
  const handleAuth = async () => {
    setIsProcessing(true);
    setError('');
    
    try {
      const endpoint = authMode === 'login' ? '/api/users/signin' : '/api/users/signup';
      const payload = authMode === 'login' 
        ? { email: authForm.email, password: authForm.password }
        : authForm;

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `${authMode} failed`);
      }

      if (data.success && data.token) {
        // Store auth data
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        setUser(data.user);
        setIsLoggedIn(true);
        
        // Pre-populate billing info
        setBillingInfo(prev => ({
          ...prev,
          firstName: data.user.fullname?.firstname || '',
          lastName: data.user.fullname?.lastname || '',
          email: data.user.email || '',
          phone: data.user.phone || ''
        }));

        setSuccess(`${authMode === 'login' ? 'Login' : 'Registration'} successful!`);
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError(error.message || 'Authentication failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create booking first, then process payment
  const createBookingAndProcessPayment = async () => {
    if (!validateBillingInfo()) {
      return;
    }

    if (!isLoggedIn) {
      setError('Please login or register to continue with payment');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Step 1: Create booking first if we don't have a bookingId
      let createdBookingId = bookingData?.bookingId || bookingData?.id;
      
      if (!createdBookingId && cartItems && cartItems.length > 0) {
        // Create booking from cart items
        const firstItem = cartItems[0]; // Assuming single hotel booking
        
        const bookingPayload = {
          hotelName: firstItem.hotelName,
          roomName: firstItem.roomName,
          location: firstItem.location,
          checkIn: firstItem.checkIn,
          checkOut: firstItem.checkOut,
          guests: firstItem.guests,
          totalAmount: totalAmount,
          boardType: firstItem.boardType || 'Room Only',
          rateClass: firstItem.rateClass || 'NOR'
        };

        console.log('Creating booking with data:', bookingPayload);

        const bookingResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bookings/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(bookingPayload)
        });

        const bookingResult = await bookingResponse.json();
        console.log('Booking creation response:', bookingResult);

        if (!bookingResponse.ok) {
          throw new Error(bookingResult?.message || 'Failed to create booking');
        }

        if (bookingResult.success && bookingResult.data) {
          createdBookingId = bookingResult.data._id || bookingResult.data.bookingId;
          console.log('✅ Booking created successfully:', createdBookingId);
        } else {
          throw new Error('Failed to get booking ID from creation response');
        }
      }

      if (!createdBookingId) {
        throw new Error('Unable to create or find booking. Please try again.');
      }

      // Step 2: Process payment with the bookingId
      const paymentData = {
        bookingData: {
          ...bookingData,
          items: (cartItems && cartItems.length > 0) ? cartItems : (bookingData?.items || []),
          bookingId: createdBookingId
        },
        userData: {
          ...billingInfo,
          firstname: billingInfo.firstName,
          lastname: billingInfo.lastName,
        },
        amount: totalAmount,
        currency: 'PKR',
        orderId: `ORDER_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
        bookingId: createdBookingId
      };

      console.log('Processing payment with data:', paymentData);

      const paymentResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/initiate-hblpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(paymentData)
      });

      const paymentResult = await paymentResponse.json();
      console.log('Payment response:', paymentResult);

      if (!paymentResponse.ok) {
        throw new Error(paymentResult?.message || `HTTP ${paymentResponse.status}: Payment initiation failed`);
      }

      if (paymentResult.success && paymentResult.data?.sessionId) {
        // Store order details for post-payment processing
        const orderDetails = {
          ...paymentData,
          sessionId: paymentResult.data.sessionId,
          paymentId: paymentResult.data.paymentId,
          timestamp: new Date().toISOString(),
          bookingId: createdBookingId
        };
        
        localStorage.setItem('pendingOrder', JSON.stringify(orderDetails));
        localStorage.setItem('paymentSession', paymentResult.data.sessionId);

        setSuccess('Booking created successfully! Redirecting to HBLPay for payment...');
        
        // Redirect to HBLPay
        setTimeout(() => {
          window.location.href = paymentResult.data.paymentUrl;
        }, 2000);

      } else {
        throw new Error(paymentResult?.message || 'Failed to create payment session');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      setError(error.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Redirect to checkout with cart data
  const handleProceedToCheckout = () => {
    if (!cartItems || cartItems.length === 0) {
      setError('Your cart is empty. Please add items before checkout.');
      return;
    }
    
    navigate('/checkout', {
      state: {
        cartItems: cartItems,
        totalAmount: getTotalPrice ? getTotalPrice() : 0
      }
    });
  };

  // If no booking data and no cart items, show empty state
  if (!bookingData && (!cartItems || cartItems.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">No Items to Checkout</h2>
            <p className="text-gray-600 mb-6">
              Your cart is empty. Please add some hotels to your cart before proceeding to checkout.
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Browse Hotels
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render authentication form
  const renderAuthForm = () => (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {authMode === 'login' ? 'Login to Continue' : 'Create Account'}
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAuthMode('login')}
            className={`px-4 py-2 text-sm rounded-lg ${
              authMode === 'login' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setAuthMode('register')}
            className={`px-4 py-2 text-sm rounded-lg ${
              authMode === 'register' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Register
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {authMode === 'register' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={authForm.fullname.firstname}
                  onChange={(e) => handleAuthInputChange('fullname.firstname', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={authForm.fullname.lastname}
                  onChange={(e) => handleAuthInputChange('fullname.lastname', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter last name"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={authForm.phone}
                onChange={(e) => handleAuthInputChange('phone', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+92 300 1234567"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            value={authForm.email}
            onChange={(e) => handleAuthInputChange('email', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter email address"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={authForm.password}
              onChange={(e) => handleAuthInputChange('password', e.target.value)}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          onClick={handleAuth}
          disabled={isProcessing}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isProcessing ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              {authMode === 'login' ? 'Signing In...' : 'Creating Account...'}
            </>
          ) : (
            authMode === 'login' ? 'Sign In' : 'Create Account'
          )}
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
                  placeholder="+92 300 1234567"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Address *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={billingInfo.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter street address"
              />
            </div>
          </div>

          {/* City, State, Postal Code */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={billingInfo.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter city"
                />
              </div>
            </div>

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

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Country *
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <select
                value={billingInfo.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="PK">Pakistan</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render order summary
  const renderOrderSummary = () => (
    <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
      
      {/* Items */}
      {cartItems && cartItems.length > 0 ? cartItems.map((item, index) => (
        <div key={index} className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200 last:border-b-0">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">{item.hotelName || item.name || 'Hotel Room'}</h4>
            {item.roomName && (
              <p className="text-sm text-gray-600">{item.roomName}</p>
            )}
            {item.checkIn && item.checkOut && (
              <div className="flex items-center text-xs text-gray-500 mt-1">
                <Calendar className="w-3 h-3 mr-1" />
                {new Date(item.checkIn).toLocaleDateString()} - {new Date(item.checkOut).toLocaleDateString()}
              </div>
            )}
            {item.guests && (
              <div className="flex items-center text-xs text-gray-500">
                <Users className="w-3 h-3 mr-1" />
                {item.guests} guests
              </div>
            )}
            {item.location && (
              <div className="flex items-center text-xs text-gray-500">
                <Star className="w-3 h-3 mr-1" />
                {item.location}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-900">
              €{(item.price * (item.quantity || 1)).toLocaleString()}
            </p>
            {item.quantity > 1 && (
              <p className="text-xs text-gray-500">
                €{item.price.toLocaleString()} × {item.quantity}
              </p>
            )}
          </div>
        </div>
      )) : (
        <div className="text-center py-8">
          <p className="text-gray-500">No items in cart</p>
        </div>
      )}

      {/* Total */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium">Rs. {totalAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Taxes & Fees</span>
          <span className="font-medium">Rs. 0</span>
        </div>
        <div className="flex justify-between items-center text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
          <span>Total</span>
          <span>Rs. {totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Security Badge */}
      <div className="mt-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center">
          <Shield className="w-5 h-5 text-green-600 mr-2" />
          <div>
            <p className="text-sm font-medium text-gray-900">Secure Payment</p>
            <p className="text-xs text-gray-600">Your information is protected by SSL encryption</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-gray-800 mr-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
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
              <span className="ml-2 text-sm font-medium">Details</span>
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
            <div className="w-8 border-t border-gray-200"></div>
            <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                {step >= 3 ? <Check className="w-4 h-4" /> : '3'}
              </div>
              <span className="ml-2 text-sm font-medium">Complete</span>
            </div>
          </div>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <Check className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-800">{success}</span>
            <button
              onClick={() => setSuccess('')}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step 1: Authentication & Billing */}
            {step === 1 && (
              <>
                {/* Authentication Section */}
                {!isLoggedIn && renderAuthForm()}

                {/* User Info Display (if logged in) */}
                {isLoggedIn && user && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">
                            {user.fullname?.firstname} {user.fullname?.lastname}
                          </p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          localStorage.removeItem('authToken');
                          localStorage.removeItem('token');
                          localStorage.removeItem('userData');
                          setUser(null);
                          setIsLoggedIn(false);
                          setBillingInfo({
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
                        }}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}

                {/* Billing Form */}
                {isLoggedIn && renderBillingForm()}

                {/* Continue Button */}
                {isLoggedIn && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (validateBillingInfo()) {
                          setStep(2);
                        }
                      }}
                      disabled={isProcessing}
                      className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {isProcessing ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Continue to Payment
                          <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Step 2: Payment */}
            {step === 2 && (
              <>
                {/* Payment Method Selection */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Method</h2>
                  
                  <div className="space-y-4">
                    {/* HBLPay Option */}
                    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="hblpay"
                          name="paymentMethod"
                          value="hblpay"
                          checked={true}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor="hblpay" className="ml-3 flex items-center cursor-pointer">
                          <CreditCard className="w-5 h-5 text-gray-600 mr-2" />
                          <div>
                            <div className="font-medium text-gray-900">HBLPay</div>
                            <div className="text-sm text-gray-600">Pay securely with HBL Payment Gateway</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Payment Info */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-start">
                        <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Secure Payment</p>
                          <p>You will be redirected to HBL's secure payment page to complete your transaction. All major credit and debit cards are accepted.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review Order */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Your Order</h3>
                  
                  {/* Billing Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Billing Details</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{billingInfo.firstName} {billingInfo.lastName}</p>
                      <p>{billingInfo.email}</p>
                      <p>{billingInfo.phone}</p>
                      <p>{billingInfo.address}, {billingInfo.city}</p>
                      <p>{stateOptions.find(s => s.value === billingInfo.state)?.label}, {billingInfo.country}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="flex items-center text-gray-600 hover:text-gray-800"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Details
                    </button>
                    
                    <button
                      onClick={createBookingAndProcessPayment}
                      disabled={isProcessing}
                      className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {isProcessing ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Creating Booking & Processing Payment...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Pay Rs. {totalAmount.toLocaleString()}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Payment Successful!</h2>
                <p className="text-gray-600 mb-6">
                  Your booking has been confirmed. You will receive a confirmation email shortly.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/account/bookings')}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700"
                  >
                    View My Bookings
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="w-full bg-gray-100 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-200"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            {renderOrderSummary()}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p className="flex items-center justify-center">
            <Lock className="w-4 h-4 mr-1" />
            Secure SSL encrypted payment powered by HBL
          </p>
        </div>
      </div>
    </div>
  );
};

export default Checkout;