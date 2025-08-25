import React, { useState, useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../images/Telitrip-Logo-1.png";
import { CartIcon, SlideOutCart, AuthModal, useCart } from './CartSystem';
import { UserDataContext } from './CartSystem';

const Header = () => {
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, setUser } = useContext(UserDataContext); // Add setUser for logout
  const { getTotalItems } = useCart(); // Add this to get cart count
  
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
    navigate("/account"); // Navigate to account after login
  };

  // Add logout function
  const handleLogout = () => {
    setUser({email: "", fullname: { firstname: "", lastname: "" }});
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/home');
  };

  const handleProceedToCheckout = () => {
    console.log('🛒 Proceeding to checkout from header...');
    setIsCartOpen(false);
    
    // Navigate to checkout page instead of conditional rendering
    navigate('/checkout');
  };

  return (
    <>
      <header className="bg-white fixed top-0 left-0 right-0 !z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo on the left */}
            <NavLink to="/home" className="flex-shrink-0">
              <img src={logo} alt="Logo" className="h-10" />
            </NavLink>

            {/* Navigation links in the middle */}
            <nav className="hidden md:flex items-center space-x-8">
              <NavLink
                to="/home"
                className={({ isActive }) =>
                  `text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200 ${
                    isActive ? 'text-blue-600 border-b-2 border-blue-600' : ''
                  }`
                }
              >
                Home
              </NavLink>
              <NavLink
                to="/contact"
                className={({ isActive }) =>
                  `text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200 ${
                    isActive ? 'text-blue-600 border-b-2 border-blue-600' : ''
                  }`
                }
              >
                Contact Us
              </NavLink>
            </nav>

            {/* Account and Cart with icons and text */}
            <div className="flex font-bold items-center space-x-8">
              <div className="flex items-center space-x-4">
                {user && user.email ? (
                  // Logged in user menu
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-700">
                      Welcome, {user.fullname?.firstname || user.email}
                    </span>
                    <button
                      onClick={handleAccountClick}
                      className="text-gray-700 hover:text-blue-600 transition-colors"
                    >
                      Account
                    </button>
                    <button
                      onClick={handleLogout}
                      className="text-gray-700 hover:text-red-600 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  // Guest user
                  <button
                    onClick={handleAccountClick}
                    className="text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    Login / Sign Up
                  </button>
                )}

                {/* ENHANCED: Cart Icon with proper item count */}
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors flex items-center space-x-2"
                >
                  <svg 
                    className="w-6 h-6" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h12" 
                    />
                  </svg>
                  <span className="hidden md:block">Cart</span>
                  
                  {/* Cart Item Count Badge */}
                  {getTotalItems() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {getTotalItems()}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ENHANCED: Cart Slide-out with checkout integration */}
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