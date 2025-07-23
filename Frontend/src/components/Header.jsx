import React, { useState, useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../images/Telitrip-Logo-1.png";
import { CartIcon, SlideOutCart, AuthModal } from './CartSystem';
import { UserDataContext } from './CartSystem';

const Header = () => {
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, setUser } = useContext(UserDataContext); // Add setUser for logout
  
  const handleAccountClick = () => {
    if (!user) {
      navigate("/account");
    } else {
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = (userData) => {
    console.log('User authenticated:', userData);
    setShowAuthModal(false);
  };

  // Add logout function
  const handleLogout = () => {
    setUser({email: "", fullname: { firstname: "", lastname: "" }});
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/home');
  };

  // Add checkout handler
  const handleProceedToCheckout = () => {
    console.log('Proceeding to checkout...');
    setIsCartOpen(false);
    // Add your checkout navigation logic here
    // navigate('/checkout');
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
                  <div className="flex items-center space-x-2">
                    <span 
  onClick={() => navigate("/account")} 
  className="text-sm text-gray-600 hover:text-blue-600 hover:font-bold hover:underline cursor-pointer transition-all duration-200"
>
  👤My Account
   {/* {user.fullname?.firstname || user.email} */}
</span>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAccountClick}
                    className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 focus:outline-none"
                    title="Account"
                  >
                    <span>👤 Login</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <CartIcon onClick={() => setIsCartOpen(true)} />
                <span className="text-gray-700">Cart</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Cart with checkout handler */}
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