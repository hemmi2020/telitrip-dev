// Enhanced App.jsx - Replace your existing App.jsx with this

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import Signup from './Signup';
import AccountDashboard from './AccountDashboard';
import HotelSearchResults from './HotelSearchResults';
import HotelDetails from './HotelDetails';
import { CartProvider } from './components/CartSystem';
import { UserProvider } from './components/CartSystem';
import Checkout from './Checkout';

const App = () => {
  return (
    <BrowserRouter>
      <UserProvider>
        <CartProvider>
          <Routes>
            {/* Authentication routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Main app routes */}
            <Route path="/home" element={<Home />} />
            <Route path="/hotel-search-results" element={<HotelSearchResults />} />
            <Route path="/hotel-details/:hotelCode" element={<HotelDetails />} />
            
            {/* User account */}
            <Route path="/account" element={<AccountDashboard />} />
            
            {/* ENHANCED: Checkout route with proper cart integration */}
            <Route path="/checkout" element={<Checkout />} />
            
            {/* Add any other routes you need */}
          </Routes>
        </CartProvider>
      </UserProvider>
    </BrowserRouter>
  );
};

export default App;