import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { UserDataContext, useCart } from './CartSystem';
import Header from './Header';
import Footer from './Footer';
import {
  XCircle,
  AlertTriangle,
  CreditCard,
  Receipt,
  Calendar,
  Hash,
  Eye,
  EyeOff,
  Copy,
  Home,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

const PaymentCancel = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  useContext(UserDataContext);
  const { clearCart } = useCart();
  
  const [cancelData, setCancelData] = useState({
    responseCode: null,
    responseMessage: '',
    orderRefNumber: '',
    paymentType: '',
    cardMasked: '',
    discountedAmount: '0',
    discountCampaignId: '0',
    guid: '',
    amount: '0',
    currency: 'PKR',
    transactionId: '',
    status: 'cancelled',
    timestamp: null,
    reason: null
  });

  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('\n🚫 ========== PAYMENT CANCEL PAGE LOADED ==========');
    console.log('📋 Current URL:', window.location.href);
    console.log('📋 Search params:', window.location.search);
    
    // Extract all URL parameters (same approach as success page)
    const extractedData = {
      responseCode: searchParams.get('RESPONSE_CODE') || searchParams.get('code'),
      responseMessage: searchParams.get('RESPONSE_MESSAGE') || searchParams.get('message'),
      orderRefNumber: searchParams.get('ORDER_REF_NUMBER') || searchParams.get('order'),
      paymentType: searchParams.get('PAYMENT_TYPE'),
      cardMasked: searchParams.get('CARD_NUM_MASKED'),
      discountedAmount: searchParams.get('DISCOUNTED_AMOUNT') || '0',
      discountCampaignId: searchParams.get('DISCOUNT_CAMPAIGN_ID') || '0',
      guid: searchParams.get('GUID'),
      amount: searchParams.get('amount') || searchParams.get('AMOUNT') || '0',
      currency: searchParams.get('currency') || 'PKR',
      transactionId: searchParams.get('transactionId') || searchParams.get('TRANSACTION_ID'),
      status: searchParams.get('status') || 'cancelled',
      timestamp: searchParams.get('timestamp') || Date.now(),
      reason: searchParams.get('reason')
    };

    // Decode URL-encoded message if present
    if (extractedData.responseMessage) {
      try {
        extractedData.responseMessage = decodeURIComponent(extractedData.responseMessage);
      } catch {
        // Keep original if decoding fails
      }
    }

    setCancelData(extractedData);
    setIsLoading(false);

    console.log('Payment Cancel Data:', extractedData);
  }, [searchParams]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
    } catch {
      return 'N/A';
    }
  };

  const handleRetryPayment = () => {
    clearCart();
    navigate('/checkout');
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  const getReasonMessage = () => {
    if (cancelData.responseMessage && cancelData.responseMessage !== 'Payment was cancelled') {
      return cancelData.responseMessage;
    }
    
    const reasonMap = {
      'user_cancelled': 'You cancelled the payment process.',
      'session_expired': 'The payment session expired.',
      'no_data': 'Payment was cancelled - no transaction data received.',
      'decrypt_failed': 'Payment was cancelled - unable to process transaction data.',
      'server_error': 'Payment was cancelled due to a technical issue.'
    };
    
    return reasonMap[cancelData.reason] || 'Your payment was cancelled or could not be completed.';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing cancellation...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

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
          <p className="text-gray-600 max-w-2xl mx-auto">
            {getReasonMessage()}
          </p>
        </div>

        {/* Payment Details Card */}
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          {/* Header */}
          <div className="px-6 py-4 bg-red-50 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Cancellation Details
              </h2>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                Code: {cancelData.responseCode || 'N/A'}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            {/* Order Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Receipt className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Order Number</p>
                  <p className="text-lg font-mono text-gray-900">
                    {cancelData.orderRefNumber || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Hash className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Transaction ID</p>
                  <p className="text-lg font-mono text-gray-900">
                    {cancelData.transactionId || cancelData.guid || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-start space-x-3">
                <CreditCard className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Payment Method</p>
                  <p className="text-lg text-gray-900">
                    {cancelData.paymentType || 'Credit/Debit Card'}
                  </p>
                  {cancelData.cardMasked && (
                    <p className="text-sm text-gray-500 font-mono">
                      {cancelData.cardMasked}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {cancelData.currency} {cancelData.amount}
                  </p>
                  <p className="text-sm text-gray-500">Not charged</p>
                </div>
              </div>
            </div>

            {/* Timestamp */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Cancelled At</span>
                <span className="text-sm text-gray-900">
                  {formatDateTime(cancelData.timestamp)}
                </span>
              </div>
            </div>

            {/* Technical Details Toggle */}
            <div className="pt-4 border-t">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                {showDetails ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showDetails ? 'Hide' : 'Show'} Technical Details
              </button>

              {showDetails && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">HBL Cancel Response Data</h3>
                  <div className="space-y-2 text-sm">
                    {cancelData.guid && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">GUID:</span>
                        <span className="font-mono text-gray-900">{cancelData.guid}</span>
                      </div>
                    )}
                    {cancelData.discountCampaignId !== '0' && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Campaign ID:</span>
                        <span className="font-mono text-gray-900">{cancelData.discountCampaignId}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Response Code:</span>
                      <span className="font-mono text-gray-900">{cancelData.responseCode}</span>
                    </div>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(cancelData, null, 2))}
                    className="mt-3 flex items-center text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {copied ? 'Copied!' : 'Copy All Data'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <div className="space-x-4">
            <button
              onClick={handleRetryPayment}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Try Again
            </button>
            <button
              onClick={handleGoHome}
              className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              <Home className="w-4 h-4 inline mr-2" />
              Go Home
            </button>
          </div>
        </div>

        {/* Debug Information (Development Only) */}
        {import.meta.env.MODE === 'development' && (
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">
                Development Debug Info
              </h3>
              <pre className="text-xs text-yellow-700 overflow-x-auto">
                {JSON.stringify(cancelData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
      
      <Footer />
    </div>
  );
};

export default PaymentCancel;