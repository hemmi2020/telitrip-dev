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
  Printer
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
    amount: null,
    currency: 'PKR',
    transactionId: null,
    message: null,
    timestamp: null,
    error: null
  });

  const [isLoading, setIsLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    // Extract payment details from URL parameters
    const details = {
      status: searchParams.get('status'),
      paymentId: searchParams.get('paymentId'),
      orderId: searchParams.get('orderId'),
      amount: parseFloat(searchParams.get('amount')) || 0,
      currency: searchParams.get('currency') || 'PKR',
      transactionId: searchParams.get('transactionId'),
      message: searchParams.get('message'),
      code: searchParams.get('code'),
      timestamp: new Date().toISOString(),
      error: searchParams.get('error')
    };

    setPaymentDetails(details);
    setIsLoading(false);

    // Log success event
    console.log('💳 Payment Success Details:', details);

    // Clear cart on successful payment
    if (details.status === 'success' && details.paymentId !== 'unknown') {
      clearCart();
    }

    // Clean URL after extracting data
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, '/payment/success');
    }
  }, [searchParams, clearCart]);

  const formatAmount = (amount, currency) => {
    if (!amount || isNaN(amount)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'PKR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Payment Confirmation',
          text: `Payment successful! Transaction ID: ${paymentDetails.transactionId}`,
          url: window.location.href
        });
      } catch {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(
        `Payment Confirmation - Transaction ID: ${paymentDetails.transactionId} - Amount: ${formatAmount(paymentDetails.amount, paymentDetails.currency)}`
      );
      alert('Payment details copied to clipboard!');
    }
  };

  // Navigation handlers
  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoToDashboard = () => {
    navigate('/account');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (paymentDetails.error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-md mx-auto pt-20 pb-8 px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-500 mb-4">
              <CheckCircle className="w-16 h-16 mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Payment Processing Error
            </h1>
            <p className="text-gray-600 mb-6">
              There was an issue processing your payment confirmation. Please contact support.
            </p>
            <button
              onClick={handleGoHome}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Home className="w-5 h-5 mr-2" />
              Return to Home
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
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
            <h2 className="text-xl font-semibold text-white">
              Payment Confirmation
            </h2>
          </div>
          
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Transaction Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Transaction Details
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Payment ID</span>
                    <span className="font-medium text-gray-900">
                      {paymentDetails.paymentId || 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Order ID</span>
                    <span className="font-medium text-gray-900">
                      {paymentDetails.orderId || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Transaction ID</span>
                    <span className="font-medium text-gray-900">
                      {paymentDetails.transactionId || 'Processing'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-bold text-green-600 text-lg">
                      {formatAmount(paymentDetails.amount, paymentDetails.currency)}
                    </span>
                  </div>
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
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">{user?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">
                      {paymentDetails.paymentMethod || 'Online Payment'}
                    </span>
                  </div>
                </div>

                {/* Status Message */}
                {paymentDetails.message && (
                  <div className="mt-6 p-4 bg-green-50 rounded-lg">
                    <p className="text-green-800 text-sm">
                      {paymentDetails.message}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-5 h-5 mr-2" />
            Print Receipt
          </button>
          
          <button
            onClick={handleShare}
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Share2 className="w-5 h-5 mr-2" />
            Share Details
          </button>
          
          <button
            onClick={() => setShowReceipt(!showReceipt)}
            className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Receipt className="w-5 h-5 mr-2" />
            {showReceipt ? 'Hide' : 'Show'} Receipt
          </button>
        </div>

        {/* Receipt Details */}
        {showReceipt && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Receipt Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatAmount(paymentDetails.amount, paymentDetails.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Processing Fee:</span>
                <span>Rs 0.00</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Total Paid:</span>
                <span>{formatAmount(paymentDetails.amount, paymentDetails.currency)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            What's Next?
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
      </div>

      <Footer />
    </div>
  );
};

export default PaymentSuccess;