import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import Signup from './Signup';
import AccountDashboard from './AccountDashboard';
// import UserProtectedWrapper from './UserProtectedWrapper';
import HotelSearchResults from './HotelSearchResults';
import HotelDetails from './HotelDetails';
import { CartProvider } from './components/CartSystem';
import { UserProvider } from './components/CartSystem';


const App = () => {
 
  return (
    <BrowserRouter>
      <UserProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/home" element={<Home />} />
            <Route path="/hotel-search-results" element={<HotelSearchResults />} />
            <Route path="/hotel-details/:hotelCode" element={<HotelDetails />} />
            <Route path="/account" element={<AccountDashboard />} />
          </Routes>
        </CartProvider>
      </UserProvider>
    </BrowserRouter>
  );
};

export default App;