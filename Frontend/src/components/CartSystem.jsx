// Fixed CartSystem.jsx - Complete working version
import React, { createContext, useContext, useReducer, useEffect, useState } from "react";
import { X, ShoppingCart, MapPin, Calendar, Trash2, User, Eye, EyeOff } from "lucide-react";
import axios from "axios";

// User Data Context
export const UserDataContext = createContext();

// User Provider with proper authentication check
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        const userData = localStorage.getItem("userData");

        console.log("🔍 Checking auth status:", {
          hasToken: !!token,
          hasUserData: !!userData,
        });

        if (token && userData) {
          try {
            const parsedUserData = JSON.parse(userData);

            if (parsedUserData && parsedUserData.email) {
              console.log("✅ Found valid stored auth:", parsedUserData.email);
              setUser(parsedUserData);
            } else {
              console.log("❌ Invalid stored user data, clearing...");
              localStorage.removeItem("token");
              localStorage.removeItem("userData");
            }
          } catch (parseError) {
            console.error("❌ Error parsing user data:", parseError);
            localStorage.removeItem("token");
            localStorage.removeItem("userData");
          }
        } else {
          console.log("ℹ️ No stored authentication found");
        }
      } catch (error) {
        console.error("❌ Auth check failed:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("userData");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <UserDataContext.Provider value={{ user, setUser }}>
      {children}
    </UserDataContext.Provider>
  );
};

// Cart Context
export const CartContext = createContext();

// Cart Reducer
const cartReducer = (state, action) => {
  switch (action.type) {
    case "ADD_ITEM": {
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
    }

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

// Cookie utility functions
const setCookie = (name, value) => {
  try {
    localStorage.setItem(name, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
};

const getCookie = (name) => {
  try {
    const item = localStorage.getItem(name);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error("Failed to read from localStorage:", e);
    return null;
  }
};

// Cart Provider
export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, {
    items: getCookie("cart") || [],
  });

  useEffect(() => {
    setCookie("cart", state.items);
  }, [state.items]);

  const addToCart = (item) => {
    dispatch({ type: "ADD_ITEM", payload: item });
  };

  const removeFromCart = (item) => {
    dispatch({ type: "REMOVE_ITEM", payload: item });
  };

  const updateQuantity = (item, quantity) => {
    if (quantity <= 0) {
      removeFromCart(item);
    } else {
      dispatch({ type: "UPDATE_QUANTITY", payload: { ...item, quantity } });
    }
  };

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" });
  };

  const getTotalPrice = () => {
    return state.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  };

  const getTotalItems = () => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalPrice,
        getTotalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

// Cart Icon Component for Header
export const CartIcon = ({ onClick }) => {
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

// Rate class badge helper
const getRateClassBadge = (rateClass) => {
  switch (rateClass?.toLowerCase()) {
    case "non-refundable":
      return (
        <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
          Non-Refundable
        </span>
      );
    case "refundable":
      return (
        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
          Refundable
        </span>
      );
    default:
      return null;
  }
};

// FIXED AuthModal Component
export const AuthModal = ({
  isOpen,
  onClose,
  onAuthSuccess,
  defaultTab = "login",
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { setUser } = useContext(UserDataContext);

  // Form states
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError("");
      setLoginData({ email: "", password: "" });
      setSignupData({ firstName: "", lastName: "", email: "", password: "" });
    }
  }, [isOpen]);

  // FIXED LOGIN HANDLER
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    console.log("🚀 Starting login process...");
    console.log("📤 Login data:", { email: loginData.email, password: "***" });

    const userData = {
      email: loginData.email,
      password: loginData.password,
    };

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/users/login`,
        userData
      );

      console.log("📥 Full login response:", response);
      console.log("📋 Response data:", response.data);

      if (response.status === 200 || response.status === 201) {
        const responseData = response.data;

        // Handle different response structures
        let token, user;

        if (responseData.success && responseData.data) {
          // Backend uses ApiResponse wrapper: { success: true, data: { token, user } }
          token = responseData.data.token;
          user = responseData.data.user;
          console.log("📦 Using wrapped response structure");
        } else if (responseData.token && responseData.user) {
          // Direct response: { token, user }
          token = responseData.token;
          user = responseData.user;
          console.log("📦 Using direct response structure");
        } else {
          throw new Error("Invalid response structure from server");
        }

        if (!token || !user) {
          throw new Error("Missing token or user data in response");
        }

        // Store authentication data
        localStorage.setItem("token", token);
        localStorage.setItem("userData", JSON.stringify(user));
        setUser(user);

        console.log("✅ Login successful:", {
          userEmail: user.email,
          tokenLength: token.length,
          userName: user.fullname
            ? `${user.fullname.firstname} ${user.fullname.lastname}`
            : "N/A",
        });

        // Clear form data
        setLoginData({ email: "", password: "" });

        // Close modal and execute callbacks
        onClose();
        if (onAuthSuccess) {
          onAuthSuccess(user);
        }
      }
    } catch (error) {
      console.error("❌ Login error:", error);

      let errorMessage = "Failed to login. Please try again.";

      if (error.response) {
        console.error("Server error response:", error.response.data);
        errorMessage =
          error.response.data?.message ||
          error.response.data?.data?.message ||
          `Server error: ${error.response.status}`;
      } else if (error.request) {
        console.error("Network error:", error.request);
        errorMessage = "Network error. Please check your connection.";
      } else {
        console.error("Other error:", error.message);
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // FIXED SIGNUP HANDLER
  const handleSignup = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    console.log("🚀 Starting registration process...");

    const newUser = {
      email: signupData.email,
      password: signupData.password,
      fullname: {
        firstname: signupData.firstName,
        lastname: signupData.lastName,
      },
    };

    console.log("📤 Registration data:", { ...newUser, password: "***" });

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/users/register`,
        newUser
      );

      console.log("📥 Full registration response:", response);
      console.log("📋 Response data:", response.data);

      if (response.status === 200 || response.status === 201) {
        const responseData = response.data;

        // Handle different response structures
        let token, user;

        if (responseData.success && responseData.data) {
          // Backend uses ApiResponse wrapper: { success: true, data: { token, user } }
          token = responseData.data.token;
          user = responseData.data.user;
          console.log("📦 Using wrapped response structure");
        } else if (responseData.token && responseData.user) {
          // Direct response: { token, user }
          token = responseData.token;
          user = responseData.user;
          console.log("📦 Using direct response structure");
        } else {
          throw new Error("Invalid response structure from server");
        }

        if (!token || !user) {
          throw new Error("Missing token or user data in response");
        }

        // Store authentication data
        localStorage.setItem("token", token);
        localStorage.setItem("userData", JSON.stringify(user));
        setUser(user);

        console.log("✅ Registration successful:", {
          userEmail: user.email,
          tokenLength: token.length,
          userName: user.fullname
            ? `${user.fullname.firstname} ${user.fullname.lastname}`
            : "N/A",
        });

        // Clear form data
        setSignupData({ firstName: "", lastName: "", email: "", password: "" });

        // Close modal and execute callbacks
        onClose();
        if (onAuthSuccess) {
          onAuthSuccess(user);
        }
      }
    } catch (error) {
      console.error("❌ Registration error:", error);

      let errorMessage = "Failed to create account. Please try again.";

      if (error.response) {
        console.error("Server error response:", error.response.data);
        errorMessage =
          error.response.data?.message ||
          error.response.data?.data?.message ||
          `Server error: ${error.response.status}`;
      } else if (error.request) {
        console.error("Network error:", error.request);
        errorMessage = "Network error. Please check your connection.";
      } else {
        console.error("Other error:", error.message);
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {activeTab === "login" ? "Sign In" : "Create Account"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 py-3 px-4 text-center ${
              activeTab === "login"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("login")}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-3 px-4 text-center ${
              activeTab === "signup"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("signup")}
          >
            Sign Up
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {activeTab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={loginData.email}
                  onChange={(e) =>
                    setLoginData({ ...loginData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={signupData.firstName}
                    onChange={(e) =>
                      setSignupData({ ...signupData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="First name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={signupData.lastName}
                    onChange={(e) =>
                      setSignupData({ ...signupData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={signupData.email}
                  onChange={(e) =>
                    setSignupData({ ...signupData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={signupData.password}
                    onChange={(e) =>
                      setSignupData({ ...signupData, password: e.target.value })
                    }
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Create a password"
                    required
                    minLength="6"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Updated SlideOut Cart Component with Authentication Check
export const SlideOutCart = ({ isOpen, onClose, onProceedToCheckout }) => {
  const { items, removeFromCart, updateQuantity, getTotalPrice } = useCart();
  const { user } = useContext(UserDataContext);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Handle checkout button click with authentication check
  const handleCheckoutClick = () => {
    if (!user || !user.email) {
      // User is not logged in - show auth modal
      setShowAuthModal(true);
    } else {
      // User is logged in - proceed to checkout
      onProceedToCheckout();
    }
  };

  // Handle successful authentication
  const handleAuthSuccess = (userData) => {
    setShowAuthModal(false);
    // Now proceed to checkout after authentication
    onProceedToCheckout();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
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
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p className="text-lg font-medium">Your cart is empty</p>
                <p className="text-sm">Add some rooms to get started!</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {items.map((item) => (
                  <div
                    key={`${item.id}-${item.checkIn}-${item.checkOut}`}
                    className="border rounded-lg p-3"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{item.roomName}</h3>
                        <p className="text-xs text-gray-600">
                          {item.hotelName}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <MapPin className="w-3 h-3 mr-1" />
                          {item.location}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(item.checkIn).toLocaleDateString()} -{" "}
                        {new Date(item.checkOut).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item, item.quantity - 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs hover:bg-gray-300"
                        >
                          -
                        </button>
                        <span className="text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item, item.quantity + 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs hover:bg-gray-300"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          PKR {(item.price * item.quantity).toLocaleString()}
                        </p>
                        {getRateClassBadge(item.rateClass)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with Authentication Check */}
          {items.length > 0 && (
            <div className="border-t p-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-lg font-bold text-blue-600">
                  PKR {getTotalPrice().toLocaleString()}
                </span>
              </div>
              
              {/* Authentication Status Indicator */}
              {!user || !user.email ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center text-yellow-800 text-sm">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Sign in required for checkout
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center text-green-800 text-sm">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Ready to checkout as {user.fullname?.firstname || user.email}
                  </div>
                </div>
              )}

              <button
                onClick={handleCheckoutClick}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center space-x-2"
              >
                {!user || !user.email ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Sign In to Checkout</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Proceed to Checkout</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Authentication Modal for Cart */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
        defaultTab="login"
      />
    </>
  );
};
