import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useCart } from './components/CartSystem';
import Header from "./components/Header";
import Footer from "./components/Footer";
import {
  Loader2,
  Star,
  MapPin,
  Wifi,
  Coffee,
  Car,
  Waves as Pool,
  Dumbbell as Gym,
  Utensils as Restaurant,
  Sparkles as Spa,
  User,
  ImageIcon,
  ArrowLeft,
  Calendar,
  Users,
  Bed,
  CheckCircle,
  XCircle,
  Tag,
  Info,
  CreditCard,
  ChevronDown,
  X,
  ShoppingCart,
} from "lucide-react";

// Cart Notification Component
const CartNotification = ({ message, type, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}
    >
      <div className="flex items-center">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 hover:opacity-70">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Helper function for cancellation policy
const formatCancellationPolicy = (policies) => {
  if (!policies || policies.length === 0) return "No cancellation policy";
  const policy = policies[0];
  const date = new Date(policy.from);
  return `Cancel before ${date.toLocaleDateString()} for €${policy.amount} fee`;
};

// Custom hook for hotel cart integration
const useHotelCartIntegration = () => {
  const { addToCart } = useCart();

  const handleAddToCart = (hotel, room, rate, searchParams) => {
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");
    const adults = parseInt(searchParams.get("adults") || "2");
    const children = parseInt(searchParams.get("children") || "0");
    const rooms = parseInt(searchParams.get("rooms") || "1");

    // Calculate number of nights
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    const cartItem = {
      id: `${hotel.id}-${room.code}-${rate.rateKey || rate.net}`,
      hotelId: hotel.id,
      hotelName: hotel.name,
      roomCode: room.code,
      roomName: room.name,
      rateKey: rate.rateKey,
      price: parseFloat(rate.net),
      currency: hotel.currency || 'EUR',
      checkIn: checkIn,
      checkOut: checkOut,
      nights: nights,
      guests: adults + children,
      adults: adults,
      children: children,
      rooms: rooms,
      location: hotel.address,
      boardName: rate.boardName,
      rateClass: rate.rateClass,
      paymentType: rate.paymentType,
      cancellationPolicy: rate.cancellationPolicies
        ? formatCancellationPolicy(rate.cancellationPolicies)
        : "No cancellation policy",
      offers: rate.offers || [],
      thumbnail: hotel.thumbnail,
      allotment: rate.allotment,
      packaging: rate.packaging,
      taxes: rate.taxes,
    };

    addToCart(cartItem);
  };

  return { handleAddToCart };
};

const HotelDetails = () => {
  const { hotelCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [visibleRoomsCount, setVisibleRoomsCount] = useState(3);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const ROOMS_PER_PAGE = 3;
  const { handleAddToCart } = useHotelCartIntegration();

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification({ show: false, message: '', type: 'success' });
  };

  const handleBookRoom = (room, rate) => {
    try {
      handleAddToCart(hotel, room, rate, searchParams);
      showNotification(`${room.name} added to cart!`, 'success');
    } catch (error) {
      console.error('Error adding to cart:', error);
      showNotification('Failed to add item to cart', 'error');
    }
  };

  const API_BASE_URL = (import.meta.env.VITE_BASE_URL || "http://localhost:3000") + "/api";

  // Auth helpers
  const getAuthToken = () => {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || null;
  };

  const makeAuthenticatedRequest = async (url, options = {}) => {
    const token = getAuthToken();
    const defaultOptions = {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };
    return fetch(url, { ...defaultOptions, ...options });
  };

  // Amenity icon mapping
  const getAmenityIcon = (amenity) => {
    switch (amenity) {
      case "WIFI":
        return <Wifi className="w-4 h-4 text-blue-600" title="WiFi" />;
      case "BREAKFAST":
        return <Coffee className="w-4 h-4 text-orange-600" title="Breakfast" />;
      case "PARKING":
        return <Car className="w-4 h-4 text-gray-600" title="Parking" />;
      case "POOL":
        return <Pool className="w-4 h-4 text-blue-500" title="Pool" />;
      case "GYM":
        return <Gym className="w-4 h-4 text-red-600" title="Gym" />;
      case "SPA":
        return <Spa className="w-4 h-4 text-purple-600" title="Spa" />;
      case "RESTAURANT":
        return <Restaurant className="w-4 h-4 text-green-600" title="Restaurant" />;
      default:
        return null;
    }
  };

  // Rate class badge
  const getRateClassBadge = (rateClass) => {
    switch (rateClass) {
      case "NRF":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Non-Refundable
          </span>
        );
      case "NOR":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Refundable
          </span>
        );
      default:
        return null;
    }
  };

  // Pagination helpers
  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleRoomsCount((prev) => prev + ROOMS_PER_PAGE);
      setLoadingMore(false);
    }, 500);
  };

  const getVisibleRooms = () => {
    if (!hotel || !hotel.rooms) return [];
    return hotel.rooms.slice(0, visibleRoomsCount);
  };

  const hasMoreRooms = () => {
    if (!hotel || !hotel.rooms) return false;
    return visibleRoomsCount < hotel.rooms.length;
  };

  // Fetch hotel details
  useEffect(() => {
    const fetchHotelDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const checkIn = searchParams.get("checkIn");
        const checkOut = searchParams.get("checkOut");
        const rooms = parseInt(searchParams.get("rooms") || "1");
        const adults = parseInt(searchParams.get("adults") || "2");
        const children = parseInt(searchParams.get("children") || "0");
        const country = searchParams.get("country");
        const city = searchParams.get("city");

        if (!checkIn || !checkOut || !city || !country) {
          throw new Error("Missing required search parameters");
        }

        // Get coordinates
        const geoResponse = await fetch(
          `${API_BASE_URL}/geocode?q=${encodeURIComponent(city + ", " + country)}`
        );

        if (!geoResponse.ok) {
          throw new Error("Failed to fetch location coordinates");
        }

        const geoResult = await geoResponse.json();
        if (!geoResult.success || !geoResult.data || geoResult.data.length === 0) {
          throw new Error("Location not found");
        }

        const { lat, lon } = geoResult.data[0];

        // Search hotels
        const requestBody = {
          stay: { checkIn, checkOut },
          occupancies: [
            {
              rooms: rooms,
              adults: adults,
              children: children > 0 ? children : 0,
            },
          ],
          geolocation: {
            latitude: parseFloat(lat),
            longitude: parseFloat(lon),
            radius: 30,
            unit: "km",
          },
        };

        let hotelResponse;
        let isAuthenticated = false;

        try {
          hotelResponse = await makeAuthenticatedRequest(
            `${API_BASE_URL}/hotels/search-auth`,
            {
              method: "POST",
              body: JSON.stringify(requestBody),
            }
          );

          if (hotelResponse.ok) {
            isAuthenticated = true;
          } else {
            hotelResponse = await fetch(`${API_BASE_URL}/hotels/search`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            });
          }
        } catch  {
          hotelResponse = await fetch(`${API_BASE_URL}/hotels/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });
        }

        if (!hotelResponse.ok) {
          throw new Error("Failed to fetch hotel details");
        }

        const hotelResult = await hotelResponse.json();
        if (!hotelResult.success) {
          throw new Error("Failed to fetch hotel details");
        }

        if (isAuthenticated && hotelResult.user) {
          setUser(hotelResult.user);
        }

        // Find specific hotel
        const hotels = hotelResult.data.hotels?.hotels || hotelResult.data.hotels || [];
        const foundHotel = hotels.find((h) => h.code.toString() === hotelCode);

        if (!foundHotel) {
          throw new Error("Hotel not found");
        }

        // Transform hotel data
        const transformedHotel = {
          id: foundHotel.code,
          name: foundHotel.name,
          category: foundHotel.categoryName || foundHotel.categoryCode || "N/A",
          address: `${foundHotel.destinationName}, ${foundHotel.zoneName}`,
          thumbnail: foundHotel.thumbnail,
          minRate: foundHotel.minRate,
          maxRate: foundHotel.maxRate,
          currency: foundHotel.currency || "EUR",
          coordinates: {
            lat: parseFloat(foundHotel.latitude),
            lng: parseFloat(foundHotel.longitude),
          },
          amenities: foundHotel.amenities || [],
          images: foundHotel.images || [],
          facilities: foundHotel.facilities || [],
          rooms: foundHotel.rooms || [],
          destinationCode: foundHotel.destinationCode,
          zoneCode: foundHotel.zoneCode,
        };

        setHotel(transformedHotel);
      } catch (err) {
        setError(err.message || "An error occurred while fetching hotel details");
      } finally {
        setLoading(false);
      }
    };

    fetchHotelDetails();
  }, [hotelCode, searchParams, API_BASE_URL]);

  const handleBackToResults = () => {
    try {
      const currentParams = searchParams.toString();
      if (currentParams) {
        navigate(`/hotel-search-results?${currentParams}`);
      } else if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/home");
      }
    } catch {
      navigate("/home");
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Loading hotel details...</span>
        </div>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="text-center py-12">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <button
            onClick={handleBackToResults}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
        <Footer />
      </>
    );
  }

  if (!hotel) {
    return (
      <>
        <Header />
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">Hotel not found</p>
          <button
            onClick={handleBackToResults}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
        <Footer />
      </>
    );
  }

  const visibleRooms = getVisibleRooms();

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={handleBackToResults}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Search Results
        </button>

        {/* User Welcome */}
        {user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <User className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-blue-800">Welcome back, {user.name}!</span>
            </div>
          </div>
        )}

        {/* Hotel Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="relative">
            <img
              src={
                hotel.thumbnail ||
                "https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg "
              }
              alt={hotel.name}
              className="w-full h-64 object-cover"
              onError={(e) => {
                e.target.src =
                  "https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg ";
              }}
            />
            {hotel.images && hotel.images.length > 1 && (
              <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg flex items-center">
                <ImageIcon className="w-4 h-4 mr-2" />
                {hotel.images.length} Photos
              </div>
            )}
          </div>
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{hotel.name}</h1>
                <div className="flex items-center mb-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-current mr-1" />
                  <span className="text-lg font-medium">{hotel.category}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{hotel.address}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">From</div>
                <div className="text-3xl font-bold text-blue-600">
                  €{hotel.minRate}
                </div>
                <div className="text-sm text-gray-600">/night</div>
              </div>
            </div>
            {/* Amenities */}
            {hotel.amenities && hotel.amenities.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {hotel.amenities.map((amenity, index) => (
                  <div
                    key={index}
                    className="flex items-center bg-gray-100 px-3 py-1 rounded-full"
                  >
                    {getAmenityIcon(amenity)}
                    <span className="ml-2 text-sm">{amenity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              <span>
                {searchParams.get("checkIn")} - {searchParams.get("checkOut")}
              </span>
            </div>
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              <span>
                {searchParams.get("rooms")} Room(s), {searchParams.get("adults")} Adult(s)
                {searchParams.get("children") &&
                  searchParams.get("children") !== "0" &&
                  `, ${searchParams.get("children")} Child(ren)`}
              </span>
            </div>
          </div>
        </div>

        {/* Rooms Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Available Rooms</h2>
            {hotel.rooms && hotel.rooms.length > 0 && (
              <div className="text-sm text-gray-600">
                Showing {Math.min(visibleRoomsCount, hotel.rooms.length)} of{" "}
                {hotel.rooms.length} rooms
              </div>
            )}
          </div>
          {visibleRooms.map((room) => (
            <div
              key={room.code}
              className="bg-white rounded-lg shadow-lg overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{room.name}</h3>
                    <div className="flex items-center text-gray-600 mb-2">
                      <Bed className="w-4 h-4 mr-2" />
                      <span>Room Code: {room.code}</span>
                    </div>
                  </div>
                </div>
                {/* Room Rates */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800">Available Rates:</h4>
                  {room.rates?.map((rate, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getRateClassBadge(rate.rateClass)}
                            {rate.packaging && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Tag className="w-3 h-3 mr-1" />
                                Package Deal
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            <strong>Board:</strong> {rate.boardName}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            <strong>Payment:</strong>{" "}
                            {rate.paymentType === "AT_WEB" ? "Pay Online" : rate.paymentType}
                          </div>
                          {rate.cancellationPolicies && (
                            <div className="text-sm text-gray-600 mb-2">
                              <strong>Cancellation:</strong>{" "}
                              {formatCancellationPolicy(rate.cancellationPolicies)}
                            </div>
                          )}
                          {rate.offers && rate.offers.length > 0 && (
                            <div className="mt-2">
                              {rate.offers.map((offer, offerIndex) => (
                                <div
                                  key={offerIndex}
                                  className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs mr-2"
                                >
                                  <Tag className="w-3 h-3 mr-1" />
                                  {offer.name}: €{Math.abs(parseFloat(offer.amount))} OFF
                                </div>
                              ))}
                            </div>
                          )}
                          {rate.taxes && !rate.taxes.allIncluded && (
                            <div className="text-xs text-orange-600 mt-2">
                              <Info className="w-3 h-3 inline mr-1" />
                              + €{rate.taxes.taxes[0]?.amount} taxes per night
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-blue-600">
                            €{rate.net}
                          </div>
                          <div className="text-sm text-gray-600">/night</div>
                          <div className="text-xs text-gray-500 mb-3">
                            {rate.allotment} room(s) left
                          </div>
                          <button
                            onClick={() => handleBookRoom(room, rate)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center"
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {/* Load More Button */}
          {hasMoreRooms() && (
            <div className="flex justify-center py-8">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Loading more rooms...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5 mr-2" />
                    Load More Rooms (
                    {Math.min(ROOMS_PER_PAGE, hotel.rooms.length - visibleRoomsCount)} more)
                  </>
                )}
              </button>
            </div>
          )}
          {/* Show completion message when all rooms are loaded */}
          {!hasMoreRooms() && hotel.rooms.length > 3 && (
            <div className="text-center py-4 text-gray-600">
              <p>All {hotel.rooms.length} rooms are now displayed</p>
            </div>
          )}
        </div>
      </div>
      <CartNotification
        message={notification.message}
        type={notification.type}
        isVisible={notification.show}
        onClose={hideNotification}
      />
      <Footer />
    </>
  );
};

export default HotelDetails;