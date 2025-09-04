// Fixed App.jsx - Complete working version
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider, UserProvider } from './components/CartSystem';

// Import your page components
import Home from './Home';
import Login from './Login';
import Signup from './Signup';
import HotelSearchResults from './HotelSearchResults';
import HotelDetails from './HotelDetails';
import Checkout from './Checkout';
import AccountDashboard from './AccountDashboard';
import PaymentSuccess from './components/PaymentSuccess';

// Import Payment Components (NEW)
import PaymentCancel from './components/PaymentCancel';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">We're sorry, but something unexpected happened.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <UserProvider>
          <CartProvider>
            <Routes>
              {/* Default route redirects to home */}
              <Route path="/" element={<Navigate to="/home" replace />} />
              
              {/* Authentication routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              
              {/* Main application routes */}
              <Route path="/home" element={<Home />} />
              <Route path="/hotel-search-results" element={<HotelSearchResults />} />
              <Route path="/hotel-details/:hotelCode" element={<HotelDetails />} />
              
              {/* User account routes */}
              <Route path="/account" element={<AccountDashboard />} />
              
              {/* Checkout route */}
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              {/* 🚨 CRITICAL: Payment Result Routes (NEW) */}
              <Route path="/payment/cancel" element={<PaymentCancel />} />
              
              {/* Catch-all route for 404s */}
              <Route path="*" element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <p className="text-gray-600 mb-6">Page not found</p>
                    <button
                      onClick={() => window.location.href = '/home'}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                    >
                      Go Home
                    </button>
                  </div>
                </div>
              } />
            </Routes>
          </CartProvider>
        </UserProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;