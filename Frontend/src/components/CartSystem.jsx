import React, { createContext, useContext, useReducer, useState, useEffect } from 'react';
import { X, ShoppingCart, Plus, Minus, Calendar, Users, MapPin, Star, Trash2, ArrowRight, CreditCard, Tag, Info, User, Lock, Mail, Eye, EyeOff } from 'lucide-react';

// Mock UserDataContext for demo
const UserDataContext = createContext();

const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  
  return (
    <UserDataContext.Provider value={{ user, setUser }}>
      {children}
    </UserDataContext.Provider>
  );
};
export { UserProvider, UserDataContext }; 

// Cart Context
export const CartContext = createContext(); 

// Cart Reducer
// Cart Reducer
const cartReducer = (state, action) => {
  switch (action.type) {
    case "ADD_ITEM":
      const existingItem = state.items.find(
        (item) =>
          item.id === action.payload.id &&
          item.checkIn === action.payload.checkIn &&
          item.checkOut === action.payload.checkOut
      );
      return {
        ...state,
        items: existingItem
          ? state.items.map((item) =>
              item.id === action.payload.id &&
              item.checkIn === action.payload.checkIn &&
              item.checkOut === action.payload.checkOut
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          : [...state.items, { ...action.payload, quantity: 1 }],
      };

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter(
          (item) =>
            !(
              item.id === action.payload.id &&
              item.checkIn === action.payload.checkIn &&
              item.checkOut === action.payload.checkOut
            )
        ),
      };

    case "UPDATE_QUANTITY":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id &&
          item.checkIn === action.payload.checkIn &&
          item.checkOut === action.payload.checkOut
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };

    case "CLEAR_CART":
      return { ...state, items: [] };

    default:
      return state;
  }
};

// Cookie utility functions (simplified for demo)
const setCookie = (name, value, days = 7) => {
  try {
    localStorage.setItem(name, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};

const getCookie = (name) => {
  try {
    const item = localStorage.getItem(name);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error('Failed to read from localStorage:', e);
    return null;
  }
};

const deleteCookie = (name) => {
  try {
    localStorage.removeItem(name);
  } catch (e) {
    console.error('Failed to remove from localStorage:', e);
  }
};

// Cart Provider
export const CartProvider = ({ children }) => {
  // Initialize state from localStorage
  const getInitialState = () => {
    const savedCart = getCookie("hotel_cart");
    return savedCart ? { items: savedCart } : { items: [] };
  };
  
  const [state, dispatch] = useReducer(cartReducer, getInitialState());
  

  // Persist cart state to localStorage
  useEffect(() => {
    setCookie("hotel_cart", state.items);
  }, [state.items]);
  
  // Add item to cart
  const addToCart = (item) => {
    dispatch({ type: "ADD_ITEM", payload: item });
  };

  
  const removeFromCart = (id, checkIn, checkOut) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id, checkIn, checkOut } });
  };
  
  const updateQuantity = (id, checkIn, checkOut, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, checkIn, checkOut, quantity } });
  };
  
  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
    deleteCookie('hotel_cart');
  };
  
  // Get total price
  const getTotalPrice = () => {
    return state.items.reduce((total, item) => total + item.price * item.quantity, 0);
  };
  
  const getTotalItems = () => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };
  
  return (
    <CartContext.Provider value={{
      items: state.items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getTotalItems
    }}>
      {children}
    </CartContext.Provider>
  );
};

// Custom hook to use cart
const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
export {  useCart };

// Cart Icon Component for Header
const CartIcon = ({ onClick }) => {
  const { getTotalItems } = useCart();
  const itemCount = getTotalItems();
  
  return (
    <button 
      onClick={onClick}
      className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
    >
      <ShoppingCart className="w-6 h-6 text-gray-700" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {itemCount}
        </span>
      )}
    </button>
  );
};
export { CartIcon };

// Rate Class Badge Component
const getRateClassBadge = (rateClass) => {
  switch (rateClass) {
    case "NRF":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Non-Refundable
        </span>
      );
    case "NOR":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Refundable
        </span>
      );
    default:
      return null;
  }
};

// AuthModal Component
const AuthModal = ({ isOpen, onClose, onAuthSuccess, defaultTab = 'login' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { setUser } = useContext(UserDataContext);
  
  // Form states
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ 
    firstName: '', 
    lastName: '',
    email: '', 
    password: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Mock login for demo
    setTimeout(() => {
      const mockUser = {
        email: loginData.email,
        fullname: { firstname: 'John', lastname: 'Doe' }
      };
      
      setUser(mockUser);
      setLoginData({ email: '', password: '' });
      
      if (onAuthSuccess) {
        onAuthSuccess(mockUser);
      }
      
      setIsLoading(false);
      onClose();
    }, 1000);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Mock signup for demo
    setTimeout(() => {
      const mockUser = {
        email: signupData.email,
        fullname: { 
          firstname: signupData.firstName, 
          lastname: signupData.lastName 
        }
      };
      
      setUser(mockUser);
      setSignupData({ firstName: '', lastName: '', email: '', password: '' });
      
      if (onAuthSuccess) {
        onAuthSuccess(mockUser);
      }
      
      setIsLoading(false);
      onClose();
    }, 1000);
  };

  const handleClose = () => {
    setError('');
    setLoginData({ email: '', password: '' });
    setSignupData({ firstName: '', lastName: '', email: '', password: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => {
              setActiveTab('login');
              setError('');
            }}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'login'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setActiveTab('signup');
              setError('');
            }}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'signup'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Enter your email"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={signupData.firstName}
                      onChange={(e) => setSignupData({...signupData, firstName: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="First name"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={signupData.lastName}
                      onChange={(e) => setSignupData({...signupData, lastName: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="Last name"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={signupData.email}
                    onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Enter your email"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={signupData.password}
                    onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Create a password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced Slide-out Cart Component with Authentication
const SlideOutCart = ({ isOpen, onClose, onProceedToCheckout }) => {
  const { items, removeFromCart, updateQuantity, clearCart, getTotalPrice } = useCart();
  const { user } = useContext(UserDataContext);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const handleProceedToCheckout = () => {
    if (user) {
      if (onProceedToCheckout) {
        onProceedToCheckout();
      }
    } else {
      setShowAuthModal(true);
    }
  };
  
  const handleAuthSuccess = (userData) => {
    console.log('User authenticated:', userData);
    setShowAuthModal(false);
    
    if (onProceedToCheckout) {
      onProceedToCheckout();
    }
  };
  
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Cart Slide-out */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold">Your Cart</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <ShoppingCart className="w-12 h-12 mb-4" />
                <p className="text-lg">Your cart is empty</p>
                <p className="text-sm">Add some rooms to get started</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {items.map((item) => (
                  <div key={`${item.id}-${item.checkIn}-${item.checkOut}`} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.roomName}</h4>
                        <p className="text-sm text-gray-600">{item.hotelName}</p>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <MapPin className="w-4 h-4 mr-1" />
                          {item.location}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id, item.checkIn, item.checkOut)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(item.checkIn).toLocaleDateString()} - {new Date(item.checkOut).toLocaleDateString()}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <Users className="w-4 h-4 mr-1" />
                      {item.guests} guest(s)
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-sm text-gray-600">
                        <strong>Board:</strong> {item.boardName}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {getRateClassBadge(item.rateClass)}
                        {item.offers && item.offers.length > 0 && (
                          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            <Tag className="w-3 h-3 mr-1" />
                            Special Offer
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.checkIn, item.checkOut, item.quantity - 1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.checkIn, item.checkOut, item.quantity + 1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">€{item.price} per night</p>
                        <p className="font-semibold">€{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                    
                    {item.cancellationPolicy && (
                      <div className="text-xs text-gray-500 mt-2">
                        <Info className="w-3 h-3 inline mr-1" />
                        {item.cancellationPolicy}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">Total: €{getTotalPrice().toFixed(2)}</span>
                <button
                  onClick={clearCart}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Clear Cart
                </button>
              </div>
              
              {/* User Status Indicator */}
              {user && (
                <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    Welcome back, {user.fullname?.firstname || user.email}!
                  </p>
                </div>
              )}
              
              <button 
                onClick={handleProceedToCheckout}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                {user ? 'Proceed to Checkout' : 'Login to Checkout'}
              </button>
              
              {!user && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  You need to login or create an account to proceed
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      
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
export {SlideOutCart};

// Fixed Header Component for your use case
const Header = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { user, setUser } = useContext(UserDataContext);
  
  const handleAccountClick = () => {
    // navigate("/account"); // Uncomment when using with React Router
    console.log("Navigate to account");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
  };

  const handleProceedToCheckout = () => {
    console.log('Proceeding to checkout...');
    // Add your checkout logic here
  };

  return (
    <>
      <header className="bg-white fixed top-0 left-0 right-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo on the left */}
            <div className="flex-shrink-0">
              {/* <img src={logo} alt="Logo" className="h-10" /> */}
              <div className="text-xl font-bold text-blue-600">Telitrip</div>
            </div>

            {/* Navigation links in the middle */}
            <nav className="hidden md:flex items-center space-x-8">
              <button className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200">
                Home
              </button>
              <button className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200">
                Contact Us
              </button>
            </nav>

            {/* Account and Cart with icons and text */}
            <div className="flex font-bold items-center space-x-6">
              <div className="flex items-center space-x-4">
                {user ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      👤 {user.fullname?.firstname || user.email}
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
                    <span>👤 Account</span>
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
      
      <SlideOutCart 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        onProceedToCheckout={handleProceedToCheckout}
      />
    </>
  );
};

// Demo Room Card Component
const RoomCard = ({ room }) => {
  const { addToCart } = useCart();
  
  const handleAddToCart = () => {
    addToCart({
      id: room.id,
      roomName: room.name,
      hotelName: room.hotelName,
      location: room.location,
      price: room.price,
      checkIn: room.checkIn,
      checkOut: room.checkOut,
      guests: room.guests,
      boardName: room.boardName,
      rateClass: room.rateClass,
      offers: room.offers,
      cancellationPolicy: room.cancellationPolicy
    });
  };
  
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-lg">{room.name}</h3>
          <p className="text-gray-600">{room.hotelName}</p>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <MapPin className="w-4 h-4 mr-1" />
            {room.location}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">€{room.price}</p>
          <p className="text-sm text-gray-500">per night</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-3">
        {getRateClassBadge(room.rateClass)}
        {room.offers && room.offers.length > 0 && (
          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
            <Tag className="w-3 h-3 mr-1" />
            Special Offer
          </span>
        )}
      </div>
      
      <button
        onClick={handleAddToCart}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add to Cart
      </button>
    </div>
  );
};

// Complete Hotel Booking App
function App() {
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  
  // Sample room data
  const sampleRooms = [
    {
      id: 1,
      name: "Deluxe Ocean View",
      hotelName: "Grand Resort & Spa",
      location: "Miami Beach, FL",
      price: 299,
      checkIn: "2024-08-15",
      checkOut: "2024-08-18",
      guests: 2,
      boardName: "Half Board",
      rateClass: "NOR",
      offers: ["Early Bird"],
      cancellationPolicy: "Cancel before Aug 10 for €50 fee"
    },
    {
      id: 2,
      name: "Standard City View",
      hotelName: "Downtown Hotel",
      location: "New York, NY",
      price: 189,
      checkIn: "2024-08-15",
      checkOut: "2024-08-18",
      guests: 2,
      boardName: "Room Only",
      rateClass: "NRF",
      offers: [],
      cancellationPolicy: "Non-refundable"
    }
  ];
  
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };
  
  const handleProceedToCheckout = () => {
    console.log('Proceeding to checkout...');
    showNotification('Proceeding to checkout...', 'success');
  };
  
  return (
    <UserProvider>
      <CartProvider>
        <div className="min-h-screen bg-gray-50">
          {/* Use the fixed Header component */}
          <Header />
          
          {/* Add padding-top to account for fixed header */}
          <div className="pt-16">
            <div className="container mx-auto px-4 py-8">
              <h2 className="text-2xl font-bold mb-6">Available Rooms</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sampleRooms.map(room => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </div>
            </div>
          </div>
          
          {/* Notification */}
          {notification.show && (
            <div className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg ${
              notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              <div className="flex items-center">
                <span>{notification.message}</span>
                <button 
                  onClick={() => setNotification({ show: false, message: '', type: 'success' })}
                  className="ml-4"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </CartProvider>
    </UserProvider>
  );
}

export default App;
