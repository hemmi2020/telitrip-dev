import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../images/Telitrip-Logo-1.png";
import { CartIcon, SlideOutCart } from './CartSystem';
import { useState } from "react";
// import { CartProvider } from "./CartSystem";

const Header = () => {
  const navigate = useNavigate();
const [isCartOpen, setIsCartOpen] = useState(false);

  const handleAccountClick = () => {
    navigate("/account"); // or wherever you want to send the user
  };

  const handleCartClick = () => {
    navigate("/cart");
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
            <button
              onClick={handleAccountClick}
              className="flex items-center space-x-2  text-gray-700 hover:text-blue-600 focus:outline-none"
              title="Account"
            >
              <span>👤 Account</span>
            </button>

            <CartIcon onClick={() => setIsCartOpen(true)} />Cart
          </div>
        </div>
      </div>
    </header>
    <SlideOutCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
  
    </>
    
  );
};

export default Header;