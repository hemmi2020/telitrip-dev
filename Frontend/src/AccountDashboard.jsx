import React, { useState, useContext, useEffect } from "react";
import { 
  User, 
  Mail, 
  Calendar, 
  MapPin, 
  CreditCard, 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Save, 
  X,
  Eye,
  Download,
  Star,
  Phone,
  Home,
  Shield,
  Bell,
  Settings
} from "lucide-react";
import { UserDataContext } from './components/CartSystem';
import Header from './components/Header';
import Footer from './components/Footer';

// Mock data for orders and payments (replace with actual API calls)
const mockOrders = [
  {
    id: "ORD-001",
    hotelName: "Grand Palace Hotel",
    roomName: "Deluxe Ocean View",
    location: "Miami, Florida",
    checkIn: "2024-08-15",
    checkOut: "2024-08-20",
    guests: 2,
    totalAmount: 1250.00,
    status: "completed",
    bookingDate: "2024-07-10",
    paymentStatus: "paid",
    boardType: "Half Board",
    rateClass: "NOR"
  },
  {
    id: "ORD-002",
    hotelName: "Mountain Resort & Spa",
    roomName: "Alpine Suite",
    location: "Aspen, Colorado",
    checkIn: "2024-09-10",
    checkOut: "2024-09-15",
    guests: 4,
    totalAmount: 2100.00,
    status: "upcoming",
    bookingDate: "2024-08-01",
    paymentStatus: "paid",
    boardType: "Full Board",
    rateClass: "NRF"
  },
  {
    id: "ORD-003",
    hotelName: "City Center Hotel",
    roomName: "Business Room",
    location: "New York, NY",
    checkIn: "2024-07-01",
    checkOut: "2024-07-03",
    guests: 1,
    totalAmount: 450.00,
    status: "cancelled",
    bookingDate: "2024-06-15",
    paymentStatus: "refunded",
    boardType: "Room Only",
    rateClass: "NOR"
  }
];

const mockPayments = [
  {
    id: "PAY-001",
    orderId: "ORD-001",
    amount: 1250.00,
    date: "2024-07-10",
    method: "Credit Card",
    cardLast4: "4242",
    status: "completed"
  },
  {
    id: "PAY-002",
    orderId: "ORD-002",
    amount: 2100.00,
    date: "2024-08-01",
    method: "Credit Card",
    cardLast4: "4567",
    status: "completed"
  },
  {
    id: "PAY-003",
    orderId: "ORD-003",
    amount: -450.00,
    date: "2024-06-20",
    method: "Refund",
    cardLast4: "4242",
    status: "refunded"
  }
];

const AccountDashboard = () => {
  const { user } = useContext(UserDataContext);
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState({
    email: "",
    fullname: { firstname: "", lastname: "" },
    phone: "",
    address: ""
  });

  useEffect(() => {
    if (user) {
      setEditedUser({
        email: user.email || "",
        fullname: {
          firstname: user.fullname?.firstname || "",
          lastname: user.fullname?.lastname || ""
        },
        phone: user.phone || "",
        address: user.address || ""
      });
    }
  }, [user]);

  const handleSaveProfile = () => {
    // Here you would typically make an API call to update the user profile
    console.log("Saving profile:", editedUser);
    setIsEditing(false);
    // You can add API call here to update user data
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      case "upcoming":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Upcoming
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case "completed":
      case "paid":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Paid
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <XCircle className="w-3 h-3 mr-1" />
            Refunded
          </span>
        );
      default:
        return null;
    }
  };

  if (!user || !user.email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Please Log In</h2>
          <p className="text-gray-600">You need to be logged in to access your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Header />
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user.fullname?.firstname || user.email}!
              </h1>
              <p className="text-gray-600">Manage your account and view your bookings</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: "profile", label: "Profile", icon: User },
                { id: "orders", label: "My Bookings", icon: Package },
                { id: "payments", label: "Payment History", icon: CreditCard },
                { id: "settings", label: "Settings", icon: Settings }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center space-x-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>
                ) : (
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveProfile}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedUser.fullname.firstname}
                      onChange={(e) => setEditedUser({
                        ...editedUser,
                        fullname: { ...editedUser.fullname, firstname: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>{user.fullname?.firstname || "Not provided"}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedUser.fullname.lastname}
                      onChange={(e) => setEditedUser({
                        ...editedUser,
                        fullname: { ...editedUser.fullname, lastname: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>{user.fullname?.lastname || "Not provided"}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span>{user.email}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedUser.phone}
                      onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter phone number"
                    />
                  ) : (
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span>{user.phone || "Not provided"}</span>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editedUser.address}
                      onChange={(e) => setEditedUser({ ...editedUser, address: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your address"
                    />
                  ) : (
                    <div className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
                      <Home className="w-4 h-4 text-gray-500 mt-0.5" />
                      <span>{user.address || "Not provided"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">My Bookings</h2>
                <div className="space-y-4">
                  {mockOrders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{order.hotelName}</h3>
                          <p className="text-gray-600">{order.roomName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">€{order.totalAmount.toFixed(2)}</p>
                          <p className="text-sm text-gray-500">Booking ID: {order.id}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">{order.location}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {new Date(order.checkIn).toLocaleDateString()} - {new Date(order.checkOut).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">{order.guests} guest(s)</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex space-x-2">
                          {getStatusBadge(order.status)}
                          {getPaymentStatusBadge(order.paymentStatus)}
                        </div>
                        <div className="flex space-x-2">
                          <button className="flex items-center space-x-1 px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors">
                            <Eye className="w-4 h-4" />
                            <span>View Details</span>
                          </button>
                          <button className="flex items-center space-x-1 px-3 py-1 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment History</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mockPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.orderId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(payment.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            <CreditCard className="w-4 h-4" />
                            <span>{payment.method}</span>
                            {payment.cardLast4 && <span>****{payment.cardLast4}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={payment.amount < 0 ? "text-red-600" : "text-green-600"}>
                            €{Math.abs(payment.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getPaymentStatusBadge(payment.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Settings</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Bell className="w-5 h-5 text-gray-500" />
                      <div>
                        <h3 className="font-medium text-gray-900">Email Notifications</h3>
                        <p className="text-sm text-gray-500">Receive booking confirmations and updates</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-5 h-5 text-gray-500" />
                      <div>
                        <h3 className="font-medium text-gray-900">Two-Factor Authentication</h3>
                        <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                      Enable
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-5 h-5 text-gray-500" />
                      <div>
                        <h3 className="font-medium text-gray-900">Payment Methods</h3>
                        <p className="text-sm text-gray-500">Manage your saved payment methods</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                      Manage
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h3>
                <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <h4 className="font-medium text-red-900 mb-2">Delete Account</h4>
                  <p className="text-sm text-red-700 mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AccountDashboard;