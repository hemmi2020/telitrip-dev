// Updated PaymentSuccess.jsx - Shows HBL decrypted data
import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { UserDataContext, useCart } from './CartSystem';
import Header from './Header';
import Footer from './Footer';
import {
  CheckCircle,
  AlertCircle,
  CreditCard,
  Receipt,
  Calendar,
  Hash,
  Eye,
  EyeOff,
  Copy,
  Download,
  Home,
  RefreshCw
} from 'lucide-react';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  useContext(UserDataContext);
  const { clearCart } = useCart();
  
  const [paymentData, setPaymentData] = useState({
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
    status: 'unknown'
  });

  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Extract all URL parameters
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
      status: searchParams.get('status')
    };

    // Decode URL-encoded message if present
    if (extractedData.responseMessage) {
      try {
        extractedData.responseMessage = decodeURIComponent(extractedData.responseMessage);
      } catch {
        // Keep original if decoding fails
      }
    }

    // Determine if payment was actually successful based on response code
    const isActuallySuccessful = extractedData.responseCode === '0' || 
                                extractedData.responseCode === '100' || 
                                extractedData.responseCode === 0 || 
                                extractedData.responseCode === 100;

    extractedData.isSuccess = isActuallySuccessful;
    
    setPaymentData(extractedData);
    setIsLoading(false);

    console.log('Payment Success Page Data:', extractedData);
  }, [searchParams]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGoHome = () => {
    clearCart();
    navigate('/home');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleRetry = () => {
    navigate('/checkout');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing payment result...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Determine display based on actual success/failure
  const isSuccess = paymentData.isSuccess;
  const statusColor = isSuccess ? 'green' : 'red';
  const StatusIcon = isSuccess ? CheckCircle : AlertCircle;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Status Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 bg-${statusColor}-100 rounded-full mb-4`}>
            <StatusIcon className={`w-8 h-8 text-${statusColor}-600`} />
          </div>
          <h1 className={`text-3xl font-bold text-gray-900 mb-2`}>
            {isSuccess ? 'Payment Successful!' : 'Payment Status Update'}
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {paymentData.responseMessage || 
             (isSuccess ? 'Your payment has been processed successfully.' : 'Your payment status has been updated.')}
          </p>
        </div>

        {/* Payment Details Card */}
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          {/* Header */}
          <div className={`px-6 py-4 bg-${statusColor}-50 border-b`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Transaction Details
              </h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${statusColor}-100 text-${statusColor}-800`}>
                Code: {paymentData.responseCode || 'N/A'}
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
                    {paymentData.orderRefNumber || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Hash className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Transaction ID</p>
                  <p className="text-lg font-mono text-gray-900">
                    {paymentData.transactionId || paymentData.guid || 'N/A'}
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
                    {paymentData.paymentType || 'Credit/Debit Card'}
                  </p>
                  {paymentData.cardMasked && (
                    <p className="text-sm text-gray-500 font-mono">
                      {paymentData.cardMasked}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {paymentData.currency} {paymentData.amount}
                  </p>
                  {paymentData.discountedAmount !== '0' && (
                    <p className="text-sm text-green-600">
                      Discount: {paymentData.currency} {paymentData.discountedAmount}
                    </p>
                  )}
                </div>
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
                  <h3 className="text-sm font-medium text-gray-700 mb-3">HBL Response Data</h3>
                  <div className="space-y-2 text-sm">
                    {paymentData.guid && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">GUID:</span>
                        <span className="font-mono text-gray-900">{paymentData.guid}</span>
                      </div>
                    )}
                    {paymentData.discountCampaignId !== '0' && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Campaign ID:</span>
                        <span className="font-mono text-gray-900">{paymentData.discountCampaignId}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Response Code:</span>
                      <span className="font-mono text-gray-900">{paymentData.responseCode}</span>
                    </div>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(paymentData, null, 2))}
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
          {isSuccess ? (
            <div className="space-x-4">
              <button
                onClick={handleGoToDashboard}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                View My Bookings
              </button>
              <button
                onClick={handleGoHome}
                className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
              >
                <Home className="w-4 h-4 inline mr-2" />
                Go Home
              </button>
            </div>
          ) : (
            <div className="space-x-4">
              <button
                onClick={handleRetry}
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
          )}
        </div>

        {/* Debug Information (Development Only) */}
        {import.meta.env.MODE === 'development' && (
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">
                Development Debug Info
              </h3>
              <pre className="text-xs text-yellow-700 overflow-x-auto">
                {JSON.stringify(paymentData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
      
      <Footer />
    </div>
  );
};

export default PaymentSuccess;