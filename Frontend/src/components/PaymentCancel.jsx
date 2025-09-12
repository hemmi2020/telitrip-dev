// PaymentCancel.jsx - For Handling Cancelled Payments
import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { UserDataContext } from './CartSystem';
import Header from './Header';
import Footer from './Footer';
import {
  XCircle,
  Home,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Copy,
  ExternalLink
} from 'lucide-react';

const PaymentCancel = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useContext(UserDataContext);
  
  const [cancelDetails, setCancelDetails] = useState({
    status: null,
    code: null,
    message: null,
    ref: null,
    reason: null,
    timestamp: null
  });

  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.log('\n🚫 ========== PAYMENT CANCEL PAGE LOADED ==========');
    console.log('📋 Current URL:', window.location.href);
    console.log('📋 Search params:', window.location.search);
    
    // Extract cancellation parameters
    const extractedDetails = {
      status: searchParams.get('status') || 'cancelled',
      code: searchParams.get('code'),
      message: searchParams.get('message'),
      ref: searchParams.get('ref'),
      reason: searchParams.get('reason'),
      timestamp: searchParams.get('timestamp') || new Date().toISOString()
    };

    console.log('🚫 Payment Cancel Details:', extractedDetails);
    
    setCancelDetails(extractedDetails);
    setIsLoading(false);

    // Clean URL after extracting data
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, '/payment/cancel');
    }
  }, [searchParams]);

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      console.log(`✅ Copied ${label} to clipboard:`, text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(parseInt(timestamp) || timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'N/A';
    }
  };

  const handleRetryPayment = () => {
    // Navigate back to checkout or cart
    navigate('/checkout');
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  const handleGoToCart = () => {
    navigate('/cart');
  };

  const getReasonMessage = (reason, code, message) => {
    // Handle different cancellation reasons
    const reasonMap = {
      'user_cancelled': 'You cancelled the payment process.',
      'session_expired': 'The payment session expired. Please try again.',
      'network_error': 'A network error occurred during payment.',
      'bank_declined': 'The payment was declined by your bank.',
      'insufficient_funds': 'Insufficient funds in your account.',
      'card_expired': 'Your card has expired.',
      'invalid_card': 'Invalid card details provided.',
      'technical_error': 'A technical error occurred. Please try again.',
      'timeout': 'The payment request timed out.',
      'server_error': 'A server error occurred. Please try again later.',
      'missing_data': 'Required payment information was missing.',
      'decrypt_failed': 'Payment verification failed.',
      'config_error': 'Payment system configuration error.'
    };

    if (reason && reasonMap[reason]) {
      return reasonMap[reason];
    }

    if (message) {
      return decodeURIComponent(message);
    }

    if (code) {
      return `Payment cancelled with code: ${code}`;
    }

    return 'The payment was cancelled.';
  };

  const getSuggestions = (reason) => {
    const suggestions = [];
    
    if (reason === 'user_cancelled') {
      suggestions.push('You can continue shopping or try payment again.');
      suggestions.push('Your items are still in your cart.');
    } else if (reason === 'session_expired' || reason === 'timeout') {
      suggestions.push('Please try the payment again.');
      suggestions.push('Make sure you complete the payment within the time limit.');
    } else if (reason === 'network_error' || reason === 'server_error') {
      suggestions.push('Check your internet connection and try again.');
      suggestions.push('If the problem persists, please contact support.');
    } else if (reason === 'insufficient_funds' || reason === 'bank_declined') {
      suggestions.push('Check your account balance or try a different payment method.');
      suggestions.push('Contact your bank if you believe this is an error.');
    } else if (reason === 'card_expired' || reason === 'invalid_card') {
      suggestions.push('Please check your card details and try again.');
      suggestions.push('Make sure your card is valid and not expired.');
    } else {
      suggestions.push('Please try the payment again.');
      suggestions.push('If the issue continues, contact our support team.');
    }

    return suggestions;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing cancellation...</p>
        </div>
      </div>
    );
  }

  const reasonMessage = getReasonMessage(cancelDetails.reason, cancelDetails.code, cancelDetails.message);
  const suggestions = getSuggestions(cancelDetails.reason);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Cancel Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Cancelled
          </h1>
          <p className="text-lg text-gray-600">
            Your payment was not completed
          </p>
        </div>

        {/* Cancel Details Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6 max-w-2xl mx-auto">
          <div className="bg-red-600 px-6 py-4">
            <h2 className="text-xl font-semibold text-white">
              Cancellation Details
            </h2>
          </div>
          
          <div className="p-6">
            {/* Reason */}
            <div className="mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    What happened?
                  </h3>
                  <p className="text-gray-700">
                    {reasonMessage}
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction Info */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                Transaction Information
              </h3>
              
              {cancelDetails.ref && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Reference Number</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 font-mono text-sm">
                      {cancelDetails.ref}
                    </span>
                    <button
                      onClick={() => copyToClipboard(cancelDetails.ref, 'Reference Number')}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Copy Reference Number"
                    >
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                </div>
              )}
              
              {cancelDetails.code && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Error Code</span>
                  <span className="font-medium text-gray-900 font-mono text-sm">
                    {cancelDetails.code}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Status</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <XCircle className="w-3 h-3 mr-1" />
                  Cancelled
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Date & Time</span>
                <span className="font-medium text-gray-900">
                  {formatDateTime(cancelDetails.timestamp)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* What to do next */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            What can you do next?
          </h3>
          <ul className="space-y-2 text-blue-800">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Copy Success Notification */}
        {copied && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
            ✅ Copied to clipboard!
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
          <button
            onClick={handleRetryPayment}
            className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Try Payment Again
          </button>
          
          <button
            onClick={handleGoToCart}
            className="inline-flex items-center justify-center px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Cart
          </button>
          
          <button
            onClick={handleGoHome}
            className="inline-flex items-center justify-center px-8 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Home className="w-5 h-5 mr-2" />
            Return Home
          </button>
        </div>

        {/* Support Information */}
        <div className="mt-8 text-center max-w-2xl mx-auto">
          <p className="text-gray-600 mb-4">
            Need help? Our support team is here to assist you.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="mailto:support@telitrip.com"
              className="inline-flex items-center text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Email Support
            </a>
            <span className="text-gray-400">|</span>
            <a
              href="tel:+923001234567"
              className="inline-flex items-center text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Call Support
            </a>
          </div>
        </div>

        {/* Debug Information (only in development) */}
        {import.meta.env.MODE === 'development' && (
          <div className="mt-8 bg-gray-100 border rounded-lg p-4 max-w-2xl mx-auto">
            <details>
              <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                🔧 Debug Information (Development Only)
              </summary>
              <pre className="text-xs text-gray-600 overflow-x-auto bg-white p-3 rounded border">
                {JSON.stringify(cancelDetails, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default PaymentCancel;