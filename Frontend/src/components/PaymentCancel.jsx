// Frontend/src/components/PaymentCancel.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { UserDataContext, useCart } from './CartSystem';
import Header from './Header';
import Footer from './Footer';
import {
  XCircle,
  Home,
  RotateCcw,
  CreditCard,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
  ArrowLeft,
  ShoppingCart
} from 'lucide-react';

const PaymentCancel = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useContext(UserDataContext);
  const { items: cartItems, getTotalPrice, clearCart } = useCart();
  
  const [cancelDetails, setCancelDetails] = useState({
    orderId: null,
    paymentId: null,
    bookingId: null,
    amount: null,
    currency: 'PKR',
    reason: null,
    timestamp: null,
    error: null
  });

  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Extract cancellation details from URL parameters
    const details = {
      orderId: searchParams.get('orderId'),
      paymentId: searchParams.get('paymentId'),
      bookingId: searchParams.get('bookingId'),
      amount: searchParams.get('amount'),
      currency: searchParams.get('currency') || 'PKR',
      reason: searchParams.get('reason'),
      timestamp: searchParams.get('timestamp'),
      error: searchParams.get('error')
    };

    setCancelDetails(details);
    setIsLoading(false);

    // Log cancellation event
    console.log('🚫 Payment Cancellation Details:', details);

    // Optional: Clear sensitive data from URL
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, '/payment/cancel');
    }
  }, [searchParams]);

  const formatAmount = (amount, currency) => {
    if (!amount || isNaN(amount)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'PKR',
      minimumFractionDigits: 2
    }).format(parseFloat(amount));
  };

  const getCancelReason = (reason, error) => {
    if (error) {
      switch (error) {
        case 'missing_data':
          return 'Invalid payment session data';
        case 'decrypt_failed':
          return 'Payment verification failed';
        case 'processing_error':
          return 'Technical error during processing';
        default:
          return 'Unknown error occurred';
      }
    }

    switch (reason) {
      case 'user_cancelled':
        return 'You cancelled the payment';
      case 'timeout':
        return 'Payment session expired';
      case 'bank_declined':
        return 'Bank declined the transaction';
      default:
        return 'Payment was cancelled';
    }
  };

  const handleRetryPayment = () => {
    if (cartItems && cartItems.length > 0) {
      // If cart still has items, go back to checkout
      navigate('/checkout', {
        state: {
          cartItems: cartItems,
          totalAmount: getTotalPrice(),
          retryPayment: true,
          previousOrderId: cancelDetails.orderId
        }
      });
    } else if (cancelDetails.bookingId) {
      // If no cart but has booking, redirect to booking payment
      navigate(`/booking/${cancelDetails.bookingId}/payment`);
    } else {
      // Otherwise go to account to view bookings
      navigate('/account');
    }
  };

  const handleContactSupport = () => {
    const subject = `Payment Cancellation Support - Order ${cancelDetails.orderId}`;
    const body = `Hello,\n\nI need assistance with a cancelled payment:\n\nOrder ID: ${cancelDetails.orderId}\nPayment ID: ${cancelDetails.paymentId}\nAmount: ${formatAmount(cancelDetails.amount, cancelDetails.currency)}\nCancellation Time: ${cancelDetails.timestamp}\nReason: ${getCancelReason(cancelDetails.reason, cancelDetails.error)}\n\nPlease help me resolve this issue.\n\nThank you!`;
    
    const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@telitrip.com';
    window.open(`mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing cancellation...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="pt-20 pb-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Cancel Message */}
          <div className="bg-white rounded-lg shadow-sm p-8 text-center mb-6">
            <div className="mb-6">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
              <p className="text-lg text-gray-600">
                {getCancelReason(cancelDetails.reason, cancelDetails.error)}
              </p>
            </div>

            {/* Cancellation Details */}
            {(cancelDetails.orderId || cancelDetails.amount) && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancellation Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  {cancelDetails.orderId && (
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Order ID</span>
                      <span className="text-gray-900">{cancelDetails.orderId}</span>
                    </div>
                  )}
                  {cancelDetails.amount && (
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Amount</span>
                      <span className="text-gray-900 font-semibold">
                        {formatAmount(cancelDetails.amount, cancelDetails.currency)}
                      </span>
                    </div>
                  )}
                  {cancelDetails.paymentId && (
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Payment ID</span>
                      <span className="text-gray-900">{cancelDetails.paymentId}</span>
                    </div>
                  )}
                  {cancelDetails.timestamp && (
                    <div>
                      <span className="block text-sm font-medium text-gray-500">Cancelled At</span>
                      <span className="text-gray-900">
                        {new Date(cancelDetails.timestamp).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleRetryPayment}
                className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Payment Again
              </button>
              
              <button
                onClick={() => navigate('/home')}
                className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                Return to Home
              </button>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
              What Happened?
            </h3>
            
            <div className="space-y-4 text-gray-700">
              <p>
                Your payment was cancelled before completion. This can happen if:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You clicked the cancel button on the payment page</li>
                <li>You closed the browser window during payment</li>
                <li>The payment session expired</li>
                <li>There was a network connection issue</li>
              </ul>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-6">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-blue-400 mr-2" />
                  <p className="text-blue-700">
                    <strong>No charges applied:</strong> Since the payment was cancelled, 
                    no amount has been charged to your account.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Support Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleContactSupport}
                className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-5 h-5 text-gray-500 mr-3" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Email Support</div>
                  <div className="text-sm text-gray-500">Get help via email</div>
                </div>
              </button>

              <a
                href={`tel:${import.meta.env.VITE_SUPPORT_PHONE || '+92-300-1234567'}`}
                className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Phone className="w-5 h-5 text-gray-500 mr-3" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Call Support</div>
                  <div className="text-sm text-gray-500">Speak with our team</div>
                </div>
              </a>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <CreditCard className="w-5 h-5 text-gray-500 mr-3" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Payment Info</div>
                  <div className="text-sm text-gray-500">View technical details</div>
                </div>
              </button>
            </div>

            {/* Technical Details (Collapsible) */}
            {showDetails && (
              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Technical Details</h4>
                <div className="text-sm text-gray-700 space-y-2">
                  <p><strong>Session:</strong> {cancelDetails.sessionId || 'Not available'}</p>
                  <p><strong>Gateway:</strong> HBLPay</p>
                  <p><strong>Environment:</strong> {import.meta.env.MODE || 'Development'}</p>
                  <p><strong>Browser:</strong> {navigator.userAgent.split(' ')[0]}</p>
                  <p><strong>Timestamp:</strong> {cancelDetails.timestamp || new Date().toISOString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Cart Recovery (if items still in cart) */}
          {cartItems && cartItems.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
              <div className="flex items-center mb-4">
                <ShoppingCart className="w-5 h-5 text-yellow-600 mr-2" />
                <h3 className="text-lg font-semibold text-yellow-800">Your Cart Items Are Safe</h3>
              </div>
              <p className="text-yellow-700 mb-4">
                You have {cartItems.length} item(s) in your cart worth {formatAmount(getTotalPrice(), 'PKR')}. 
                Your selections have been preserved.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRetryPayment}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Complete Your Booking
                </button>
                <button
                  onClick={() => {
                    clearCart();
                    navigate('/home');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Clear Cart & Browse
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-8 text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/home')}
                className="flex items-center justify-center px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </button>
              
              {user?.email && (
                <button
                  onClick={() => navigate('/account')}
                  className="flex items-center justify-center px-6 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  View My Account
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default PaymentCancel;