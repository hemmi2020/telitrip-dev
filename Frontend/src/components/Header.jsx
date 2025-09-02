// Enhanced Header.jsx - Combined modern design with existing functionality
import React, { useState, useContext, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../images/Telitrip-Logo-1.png";
import { SlideOutCart, AuthModal, useCart } from './CartSystem';
import { UserDataContext } from './CartSystem';
import { Sun, Moon, Globe, ChevronDown, ShoppingCart, Menu, X } from 'lucide-react';

const Header = () => {
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const { user, setUser } = useContext(UserDataContext);
  
  // Cart functionality from existing header
  const { getTotalItems, items: cartItems, getTotalPrice } = useCart();

  // Scroll effect for modern design
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAccountClick = () => {
    if (user && user.email) {
      navigate("/account");
    } else {
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = (userData) => {
    console.log('User authenticated:', userData);
    setShowAuthModal(false);
    navigate("/account");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/home');
  };

  const handleProceedToCheckout = () => {
    console.log('🛒 Proceeding to checkout from header...');
    console.log('📦 Cart items:', cartItems);
    console.log('💰 Total price:', getTotalPrice());
    
    setIsCartOpen(false);
    
    if (!cartItems || cartItems.length === 0) {
      console.warn('⚠️ Cart is empty, cannot proceed to checkout');
      return;
    }
    
    navigate('/checkout', {
      state: {
        cartItems: cartItems,
        totalAmount: getTotalPrice(),
        fromCart: true
      }
    });
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.fullname?.firstname) {
      return user.fullname.firstname.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const getUserDisplayName = () => {
    if (user?.fullname?.firstname) {
      return user.fullname.firstname;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-200/50' 
          : 'bg-white/80 backdrop-blur-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 lg:h-20">
            {/* Enhanced Logo Section */}
            <NavLink to="/home" className="flex items-center space-x-4 group">
              <div className="relative">
                <img 
                  src={logo} 
                  alt="TeliTrip Logo" 
                  className="h-10 lg:h-12 transform group-hover:scale-110 transition-all duration-300" 
                />
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
                  TeliTrip
                </h1>
                <p className="text-xs text-gray-500 -mt-1">Explore the World</p>
              </div>
            </NavLink>

            {/* Enhanced Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8">
              <NavLink
                to="/home"
                className={({ isActive }) =>
                  `relative px-4 py-2 rounded-lg font-medium transition-all duration-300 group ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    Home
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                    )}
                  </>
                )}
              </NavLink>
              <NavLink
                to="/contact"
                className={({ isActive }) =>
                  `relative px-4 py-2 rounded-lg font-medium transition-all duration-300 group ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    Contact Us
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                    )}
                  </>
                )}
              </NavLink>
            </nav>

            {/* Enhanced User Actions */}
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                className="hidden md:block p-2 rounded-lg hover:bg-gray-100 transition-colors duration-300"
                title="Toggle theme"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Language Selector
              <button className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-300">
                <Globe className="w-4 h-4" />
                <span className="text-sm">EN</span>
                <ChevronDown className="w-3 h-3" />
              </button> */}

              

              {/* Enhanced User Menu */}
              {user && user.email ? (
                <div className="hidden md:flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{getUserInitials()}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{getUserDisplayName()}</span>
                    {/* <span className="text-xs text-gray-500">Member</span> */}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleAccountClick}
                      className="text-sm text-gray-700 hover:text-blue-600 transition-colors px-2 py-1 rounded"
                    >
                      Account
                    </button>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-gray-700 hover:text-red-600 transition-colors px-2 py-1 rounded"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleAccountClick}
                  className="hidden md:block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                >
                  Sign In
                </button>
              )}

              {/* Enhanced Cart */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 rounded-lg flex hover:bg-gray-100 transition-colors duration-300 group"
                title="Shopping cart"
              >
                <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                <span className="hidden lg:block ml-2 group-hover:text-blue-600 transition-colors">Cart</span>
                
                {/* Enhanced Cart Item Count Badge */}
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                    {getTotalItems()}
                  </span>
                )}
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-300"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Enhanced Mobile Navigation */}
          {isMenuOpen && (
            <div className="lg:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-xl">
              <div className="px-4 py-6 space-y-4">
                <NavLink
                  to="/home"
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-3 rounded-lg transition-colors duration-300 ${
                      isActive 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    }`
                  }
                >
                  Home
                </NavLink>
                <NavLink
                  to="/contact"
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-3 rounded-lg transition-colors duration-300 ${
                      isActive 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    }`
                  }
                >
                  Contact Us
                </NavLink>

                {/* Mobile Theme Toggle & Language Selector */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setIsDark(!isDark)}
                    className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-300"
                    title="Toggle theme"
                  >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    <span className="text-sm font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                  
                  {/* <button className="flex items-center space-x-2 px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-300">
                    <Globe className="w-4 h-4" />
                    <span className="text-sm">EN</span>
                    <ChevronDown className="w-3 h-3" />
                  </button> */}
                </div>

                {/* Mobile User Actions */}
                {user && user.email ? (
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <div className="flex items-center space-x-3 px-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">{getUserInitials()}</span>
                      </div>
                      <span className="text-sm font-medium">{getUserDisplayName()}</span>
                    </div>
                    <button
                      onClick={() => {
                        handleAccountClick();
                        setIsMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-300"
                    >
                      Account
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-300"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      handleAccountClick();
                      setIsMenuOpen(false);
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium transform hover:scale-105 transition-all duration-300"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Cart Slide-out */}
      <SlideOutCart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={handleProceedToCheckout}
      />

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

export default Header;