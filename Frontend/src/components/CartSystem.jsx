// COMPLETE WORKING CartSystem.jsx - Copy this and replace your file

import React, {
  createContext,
  useContext,
  useReducer,
  useState,
  useEffect,
} from "react";
import {
  X,
  ShoppingCart,
  Plus,
  Minus,
  Calendar,
  Users,
  MapPin,
  Star,
  Trash2,
  ArrowRight,
  CreditCard,
  Tag,
  Info,
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// UserDataContext
const UserDataContext = createContext();

const UserProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState({
    email: "",
    fullname: {
      firstname: "",
      lastname: "",
    },
  });

  // Check for existing authentication on component mount
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

            // Verify the user data is valid
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

export { UserProvider, UserDataContext };

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
const AuthModal = ({
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
  // const navigate = useNavigate();

  // Form states
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

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

      let errorMessage = "Failed to register. Please try again.";

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

  // Reset form and error when modal closes
  const handleClose = () => {
    setError("");
    setLoginData({ email: "", password: "" });
    setSignupData({ firstName: "", lastName: "", email: "", password: "" });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {activeTab === "login" ? "Welcome Back" : "Create Account"}
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
              setActiveTab("login");
              setError("");
            }}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === "login"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <User className="w-4 h-4 inline mr-2" />
            Login
          </button>
          <button
            onClick={() => {
              setActiveTab("signup");
              setError("");
            }}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === "signup"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <User className="w-4 h-4 inline mr-2" />
            Sign Up
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Login Form */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData({ ...loginData, email: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Signup Form */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={signupData.firstName}
                    onChange={(e) =>
                      setSignupData({
                        ...signupData,
                        firstName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={signupData.lastName}
                    onChange={(e) =>
                      setSignupData({ ...signupData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    required
                    value={signupData.email}
                    onChange={(e) =>
                      setSignupData({ ...signupData, email: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={signupData.password}
                    onChange={(e) =>
                      setSignupData({ ...signupData, password: e.target.value })
                    }
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export { AuthModal };

// Enhanced Slide-out Cart Component with Authentication
const SlideOutCart = ({ isOpen, onClose, onProceedToCheckout }) => {
  const { items, removeFromCart, updateQuantity, getTotalPrice } =
    useCart();
  const { user } = useContext(UserDataContext);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleProceedToCheckout = () => {
    console.log("🛒 Proceed to checkout clicked");
    console.log("👤 User status:", {
      isLoggedIn: !!(user && user.email),
      userEmail: user?.email || "N/A",
    });
    

    if (user && user.email) {
      // User is logged in, proceed to checkout
      if (onProceedToCheckout) {
        onProceedToCheckout();
      }
    } else {
      // User is not logged in, show AuthModal
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = (userData) => {
    console.log("✅ User authenticated successfully:", userData);
    setShowAuthModal(false); // Close the modal
    if (onProceedToCheckout) {
      onProceedToCheckout(); // Proceed to checkout after login/signup
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
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-xl z-50 transform transition-transform duration-300 ${
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
                      <div className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {item.guests} guests
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() =>
                            updateQuantity(item, item.quantity - 1)
                          }
                          className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item, item.quantity + 1)
                          }
                          className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">
                          €{(item.price * item.quantity).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          €{item.price}/night
                        </p>
                      </div>
                    </div>

                    {item.boardName && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          {item.boardName}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t p-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-xl font-bold text-blue-600">
                  €{getTotalPrice().toFixed(2)}
                </span>
              </div>

              {getTotalPrice() > 1000 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <Tag className="w-4 h-4 text-green-600 mr-2" />
                    <p className="text-sm text-green-700">
                      Free cancellation up to 24 hours before check-in
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleProceedToCheckout}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                {user && user.email
                  ? "Proceed to Checkout"
                  : "Login to Checkout"}
              </button>

              {(!user || !user.email) && (
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

export { SlideOutCart };

// Room Card Component
const RoomCard = ({ room }) => {
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    // Allow adding to cart without checking authentication
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
      cancellationPolicy: room.cancellationPolicy,
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

export { RoomCard };
