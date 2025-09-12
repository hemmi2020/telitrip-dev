// Fixed PaymentSuccess.jsx - Updated for Enhanced Payment Controller
import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { UserDataContext, useCart } from './CartSystem';
import Header from './Header';
import Footer from './Footer';
import {
  CheckCircle,
  Download,
  Home,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Receipt,
  ArrowRight,
  Share2,
  Printer,
  AlertCircle,
  Copy,
  ExternalLink
} from 'lucide-react';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useContext(UserDataContext);
  const { clearCart } = useCart();
  
  const [paymentDetails, setPaymentDetails] = useState({
    status: null,
    paymentId: null,
    orderId: null,
    amount: 0,
    currency: 'PKR',
    transactionId: null,
    message: null,
    timestamp: null,
    error: null,
    code: null,
    ref: null
  });

  const [isLoading, setIsLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.log('\n🎯 ========== PAYMENT SUCCESS PAGE LOADED ==========');
    console.log('📋 Current URL:', window.location.href);
    console.log('📋 Search params:', window.location.search);
    
    // Extract all possible parameters that might come from the enhanced controller
    const extractedDetails = {
      status: searchParams.get('status'),
      paymentId: searchParams.get('paymentId'),
      orderId: searchParams.get('orderId'),
      amount: parseFloat(searchParams.get('amount')) || 0,
      currency: searchParams.get('currency') || 'PKR',
      transactionId: searchParams.get('transactionId'),
      message: searchParams.get('message'),
      code: searchParams.get('code'),
      error: searchParams.get('error'),
      ref: searchParams.get('ref'), // HBL reference number
      timestamp: searchParams.get('timestamp') || new Date().toISOString()
    };

    console.log('💳 Payment Success Details:', extractedDetails);
    
    // Log each parameter individually for debugging
    console.log('🔍 Individual Parameters:');
    Object.entries(extractedDetails).forEach(([key, value]) => {
      console.log(`  ${key}:`, value);
    });

    // Check if this is actually a successful payment
    const isActualSuccess = extractedDetails.status === 'success' && 
                           extractedDetails.amount > 0 && 
                           (extractedDetails.paymentId || extractedDetails.transactionId);
    
    console.log('✅ Is actual success:', isActualSuccess);

    setPaymentDetails(extractedDetails);
    setIsLoading(false);

    // Clear cart only on actual successful payment
    if (isActualSuccess) {
      console.log('🛒 Clearing cart due to successful payment');
      clearCart();
    } else {
      console.warn('⚠️ Payment success page loaded but payment details seem incomplete');
    }

    // Clean URL after extracting data (optional)
    if (window.history.replaceState && isActualSuccess) {
      window.history.replaceState({}, document.title, '/payment/success');
    }
  }, [searchParams, clearCart]);

  const formatAmount = (amount, currency) => {
    if (!amount || isNaN(amount)) return 'N/A';
    
    // Handle Pakistani Rupee formatting
    if (currency === 'PKR') {
      return `PKR ${amount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'PKR',
      minimumFractionDigits: 2
    }).format(amount);
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
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'N/A';
    }
  };

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

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Payment Confirmation - Telitrip',
      text: `Payment successful! Amount: ${formatAmount(paymentDetails.amount, paymentDetails.currency)}`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        console.log('Native sharing failed, falling back to clipboard');
        copyToClipboard(shareData.text, 'payment details');
      }
    } else {
      copyToClipboard(shareData.text, 'payment details');
    }
  };

  const handleGoToDashboard = () => {
    navigate('/account');
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  const handleDownloadReceipt = () => {
    // This would typically generate a PDF or trigger a download
    console.log('Download receipt requested');
    window.print(); // For now, use browser print as PDF
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing payment confirmation...</p>
        </div>
      </div>
    );
  }

  // Check if payment was actually successful
  const isPaymentSuccessful = paymentDetails.status === 'success' && paymentDetails.amount > 0;
  const hasPaymentDetails = paymentDetails.paymentId || paymentDetails.transactionId || paymentDetails.ref;

  // Show error state if payment failed or incomplete
  if (!isPaymentSuccessful && !hasPaymentDetails) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="max-w-2xl mx-auto text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Payment Status Unclear
            </h1>
            <p className="text-gray-600 mb-6">
              We couldn't retrieve your payment details. This might be a temporary issue.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">Debug Information:</h3>
              <pre className="text-xs text-yellow-700 overflow-x-auto">
                {JSON.stringify(paymentDetails, null, 2)}
              </pre>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleGoToDashboard}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Check My Bookings
              </button>
              <button
                onClick={handleGoHome}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Return Home
              </button>
            </div>
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
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-lg text-gray-600">
            Your payment has been processed successfully
          </p>
        </div>

        {/* Payment Details Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-green-600 px-6 py-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                Payment Confirmation
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleShare}
                  className="p-2 bg-green-500 hover:bg-green-400 rounded-lg text-white transition-colors"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePrint}
                  className="p-2 bg-green-500 hover:bg-green-400 rounded-lg text-white transition-colors"
                  title="Print"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Transaction Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Transaction Details
                </h3>
                <div className="space-y-3">
                  {/* Payment ID */}
                  {paymentDetails.paymentId && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Payment ID</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 font-mono text-sm">
                          {paymentDetails.paymentId}
                        </span>
                        <button
                          onClick={() => copyToClipboard(paymentDetails.paymentId, 'Payment ID')}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Copy Payment ID"
                        >
                          <Copy className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Order ID */}
                  {paymentDetails.orderId && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Order ID</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 font-mono text-sm">
                          {paymentDetails.orderId}
                        </span>
                        <button
                          onClick={() => copyToClipboard(paymentDetails.orderId, 'Order ID')}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Copy Order ID"
                        >
                          <Copy className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Transaction ID */}
                  {paymentDetails.transactionId && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Transaction ID</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 font-mono text-sm">
                          {paymentDetails.transactionId}
                        </span>
                        <button
                          onClick={() => copyToClipboard(paymentDetails.transactionId, 'Transaction ID')}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Copy Transaction ID"
                        >
                          <Copy className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* HBL Reference */}
                  {paymentDetails.ref && paymentDetails.ref !== paymentDetails.orderId && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">HBL Reference</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 font-mono text-sm">
                          {paymentDetails.ref}
                        </span>
                        <button
                          onClick={() => copyToClipboard(paymentDetails.ref, 'HBL Reference')}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Copy HBL Reference"
                        >
                          <Copy className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Amount */}
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-bold text-green-600 text-lg">
                      {formatAmount(paymentDetails.amount, paymentDetails.currency)}
                    </span>
                  </div>
                  
                  {/* Payment Status */}
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Status</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {paymentDetails.status === 'success' ? 'Completed' : paymentDetails.status}
                    </span>
                  </div>
                  
                  {/* Date & Time */}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Date & Time</span>
                    <span className="font-medium text-gray-900">
                      {formatDateTime(paymentDetails.timestamp)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Customer Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">{user?.email || 'N/A'}</span>
                  </div>
                  {user?.phone && (
                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-900">{user.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">HBLPay</span>
                  </div>
                </div>

                {/* Receipt Download */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Receipt</h4>
                  <button
                    onClick={handleDownloadReceipt}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message & Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            What happens next?
          </h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-center">
              <ArrowRight className="w-4 h-4 mr-2" />
              You'll receive a confirmation email shortly
            </li>
            <li className="flex items-center">
              <ArrowRight className="w-4 h-4 mr-2" />
              Check your booking details in the dashboard
            </li>
            <li className="flex items-center">
              <ArrowRight className="w-4 h-4 mr-2" />
              Contact support if you have any questions
            </li>
          </ul>
        </div>

        {/* Copy Success Notification */}
        {copied && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
            ✅ Copied to clipboard!
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleGoToDashboard}
            className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View My Bookings
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
          
          <button
            onClick={handleGoHome}
            className="inline-flex items-center justify-center px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Home className="w-5 h-5 mr-2" />
            Return to Home
          </button>
        </div>

        {/* Debug Information (only in development) */}
        {import.meta.env.MODE === 'development' && (
          <div className="mt-8 bg-gray-100 border rounded-lg p-4">
            <details>
              <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                🔧 Debug Information (Development Only)
              </summary>
              <pre className="text-xs text-gray-600 overflow-x-auto bg-white p-3 rounded border">
                {JSON.stringify(paymentDetails, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default PaymentSuccess;