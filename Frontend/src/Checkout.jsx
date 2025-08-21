import React, { useState, useContext } from 'react';
import {
  CreditCard,
  MapPin,
  Calendar,
  Users,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  User,
  Home,
  Globe,
  Lock,
  Info,
  ShoppingCart
} from 'lucide-react';

// Import the contexts from your existing code
import { CartContext, UserDataContext } from './HotelBookingApp';

const CheckoutScreen = ({ onBack, onPaymentSuccess }) => {
  const { items, getTotalPrice, clearCart } = useContext(CartContext);
  const { user } = useContext(UserDataContext);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Billing Info, 2: Payment Processing
  
  // Billing Information State
  const [billingInfo, setBillingInfo] = useState({
    firstName: user?.fullname?.firstname || '',
    lastName: user?.fullname?.lastname || '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'Pakistan',
    postalCode: ''
  });

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('hblpay');

  const handleInputChange = (field, value) => {
    setBillingInfo(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const validateBillingInfo = () => {
    const required = ['firstName', 'lastName', 'email', 'phone', 'address', 'city'];
    for (let field of required) {
      if (!billingInfo[field]) {
        setError(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(billingInfo.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const generateOrderId = () => {
    return 'HOTEL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
  };

  const generateReferenceNumber = () => {
    return 'REF_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  const prepareHBLPayData = () => {
    const orderId = generateOrderId();
    const referenceNumber = generateReferenceNumber();
    const totalAmount = getTotalPrice();

    // Prepare order items for HBLPay
    const orderItems = items.map(item => ({
      ITEM_NAME: item.roomName,
      QUANTITY: item.quantity.toString(),
      UNIT_PRICE: item.price.toString(),
      OLD_PRICE: null,
      CATEGORY: "Hotel Room",
      SUB_CATEGORY: item.boardName || "Standard"
    }));

    const hblPayData = {
      USER_ID: "your_merchant_id", // Replace with actual merchant ID from HBL
      PASSWORD: "your_merchant_password", // Replace with actual password from HBL
      RETURN_URL: `${window.location.origin}/payment-success`,
      CANCEL_URL: `${window.location.origin}/payment-cancel`,
      CHANNEL: "HOTEL_WEB",
      TYPE_ID: "0",
      ORDER: {
        DISCOUNT_ON_TOTAL: "0",
        SUBTOTAL: totalAmount.toString(),
        OrderSummaryDescription: orderItems
      },
      SHIPPING_DETAIL: {
        NAME: "Hotel Booking",
        ICON_PATH: null,
        DELIEVERY_DAYS: "0",
        SHIPPING_COST: "0"
      },
      ADDITIONAL_DATA: {
        REFERENCE_NUMBER: referenceNumber,
        CUSTOMER_ID: user?.email || null,
        CURRENCY: "PKR",
        BILL_TO_FORENAME: billingInfo.firstName,
        BILL_TO_SURNAME: billingInfo.lastName,
        BILL_TO_EMAIL: billingInfo.email,
        BILL_TO_PHONE: billingInfo.phone,
        BILL_TO_ADDRESS_LINE: billingInfo.address,
        BILL_TO_ADDRESS_CITY: billingInfo.city,
        BILL_TO_ADDRESS_STATE: billingInfo.state,
        BILL_TO_ADDRESS_COUNTRY: billingInfo.country,
        BILL_TO_ADDRESS_POSTAL_CODE: billingInfo.postalCode,
        SHIP_TO_FORENAME: billingInfo.firstName,
        SHIP_TO_SURNAME: billingInfo.lastName,
        SHIP_TO_EMAIL: billingInfo.email,
        SHIP_TO_PHONE: billingInfo.phone,
        SHIP_TO_ADDRESS_LINE: billingInfo.address,
        SHIP_TO_ADDRESS_CITY: billingInfo.city,
        SHIP_TO_ADDRESS_STATE: billingInfo.state,
        SHIP_TO_ADDRESS_COUNTRY: billingInfo.country,
        SHIP_TO_ADDRESS_POSTAL_CODE: billingInfo.postalCode,
        MerchantFields: {
          MDD1: "Hotel Booking",
          MDD2: "Online Payment",
          MDD3: "Hotel Category",
          MDD4: items[0]?.roomName || "Hotel Room",
          MDD5: "Returning Customer",
          MDD6: "Online Booking",
          MDD7: items.length.toString(),
          MDD8: billingInfo.country,
          MDD9: "0",
          MDD10: "Online",
          MDD11: "Complete Journey",
          MDD12: "Direct Booking",
          MDD13: items[0]?.hotelName || "Hotel",
          MDD14: new Date().toISOString().split('T')[0],
          MDD15: items[0]?.checkIn || new Date().toISOString().split('T')[0],
          MDD16: items[0]?.checkOut || new Date().toISOString().split('T')[0],
          MDD17: "Hotel Room",
          MDD18: user?.email || billingInfo.phone,
          MDD19: billingInfo.country,
          MDD20: "Regular Customer"
        }
      }
    };

    return hblPayData;
  };

  const processPayment = async () => {
    if (!validateBillingInfo()) return;

    setIsProcessing(true);
    setError('');

    try {
      const hblPayData = prepareHBLPayData();
      
      // Call your backend API to initiate HBLPay transaction
      const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}/payment/hblpay/initiate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(hblPayData)
        }
      );

      const responseData = await response.json();

      if (responseData && responseData.success && responseData.sessionId) {
        // Redirect to HBLPay checkout page
        const hblPayUrl = `https://testpaymentapi.hbl.com/hblpay/site/index.html#/checkout?data=${responseData.sessionId}`;
        
        // Store order details in localStorage for post-payment processing
        localStorage.setItem('pendingOrder', JSON.stringify({
          items,
          billingInfo,
          totalAmount: getTotalPrice(),
          orderId: generateOrderId(),
          timestamp: new Date().toISOString()
        }));

        // Redirect to HBLPay
        window.location.href = hblPayUrl;
      } else {
        throw new Error(responseData?.message || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      setError(error.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedToPayment = () => {
    if (validateBillingInfo()) {
      setStep(2);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-800 mr-6"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Cart
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                1
              </div>
              <span className="ml-2 font-medium">Billing Info</span>
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                2
              </div>
              <span className="ml-2 font-medium">Payment</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-6">Billing Information</h2>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                    <span className="text-red-700">{error}</span>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <User className="w-5 h-5 mr-2" />
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={billingInfo.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter your first name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={billingInfo.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter your last name"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <Mail className="w-5 h-5 mr-2" />
                      Contact Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={billingInfo.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter your email"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          value={billingInfo.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="+92 300 1234567"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Information */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <Home className="w-5 h-5 mr-2" />
                      Address Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Street Address *
                        </label>
                        <input
                          type="text"
                          value={billingInfo.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter your street address"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            City *
                          </label>
                          <input
                            type="text"
                            value={billingInfo.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            State/Province
                          </label>
                          <input
                            type="text"
                            value={billingInfo.state}
                            onChange={(e) => handleInputChange('state', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="State"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Postal Code
                          </label>
                          <input
                            type="text"
                            value={billingInfo.postalCode}
                            onChange={(e) => handleInputChange('postalCode', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="12345"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country
                        </label>
                        <select
                          value={billingInfo.country}
                          onChange={(e) => handleInputChange('country', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="Pakistan">Pakistan</option>
                          <option value="India">India</option>
                          <option value="Bangladesh">Bangladesh</option>
                          <option value="UAE">UAE</option>
                          <option value="Saudi Arabia">Saudi Arabia</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-6">Payment Method</h2>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                    <span className="text-red-700">{error}</span>
                  </div>
                )}

                <div className="space-y-4">
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
                        className="mr-3"
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
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
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
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Order Summary
              </h3>
              
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={`${item.id}-${item.checkIn}-${item.checkOut}`} className="border-b border-gray-200 pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.roomName}</h4>
                        <p className="text-sm text-gray-600">{item.hotelName}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <MapPin className="w-3 h-3 mr-1" />
                          {item.location}
                        </div>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(item.checkIn).toLocaleDateString()} - {new Date(item.checkOut).toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <Users className="w-3 h-3 mr-1" />
                          {item.guests} guest(s)
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">€{(item.price * item.quantity).toFixed(2)}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">€{getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Taxes & Fees:</span>
                  <span className="font-medium">€0.00</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold border-t border-gray-200 pt-2">
                  <span>Total:</span>
                  <span className="text-blue-600">€{getTotalPrice().toFixed(2)}</span>
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
                ) : (
                  <button
                    onClick={processPayment}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Pay Securely
                      </>
                    )}
                  </button>
                )}
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