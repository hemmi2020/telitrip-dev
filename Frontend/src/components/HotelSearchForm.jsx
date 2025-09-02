import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Users, Search, SlidersHorizontal, ChevronDown, Star } from 'lucide-react';

const HotelSearchForm = () => {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [activeTab, setActiveTab] = useState('stays');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    fetch('https://countriesnow.space/api/v0.1/countries/')
      .then((response) => response.json())
      .then((data) => {
        if (!data.error) {
          const sortedCountries = data.data.sort((a, b) => a.country.localeCompare(b.country));
          setCountries(sortedCountries);
        }
      })
      .catch((error) => console.error('Error fetching countries:', error));

    setCheckIn(tomorrow.toISOString().split('T')[0]);
    setCheckOut(dayAfterTomorrow.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (country) {
      const selectedCountryData = countries.find((c) => c.iso3 === country);
      if (selectedCountryData) {
        setCities(selectedCountryData.cities || []);
        if (selectedCountryData.cities && selectedCountryData.cities.length > 0) {
          setCity(selectedCountryData.cities[0]);
        }
      }
    }
  }, [country, countries]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    const selectedCountryData = countries.find((c) => c.iso3 === country);
    const countryName = selectedCountryData ? selectedCountryData.country : country;

    const url = `/hotel-search-results?checkIn=${checkIn}&checkOut=${checkOut}&rooms=${rooms}&adults=${adults}&children=${children}&country=${encodeURIComponent(
      countryName
    )}&city=${encodeURIComponent(city)}`;

    window.location.href = url;
  };

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const tabs = [
    { id: 'stays', label: 'Stays', icon: '🏨' },
    { id: 'transfers', label: 'Transfers', icon: '🚐' },
    { id: 'experiences', label: 'Experiences', icon: '🎭' },
    { id: 'car-rental', label: 'Car Rental', icon: '🚗' },
    { id: 'theme-parks', label: 'Theme parks', icon: '🎢' }
  ];

  return (
    <div className="min-h-screen bg-transparent p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="bg-white/90 mt-20 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-2xl border border-white/20 p-3 sm:p-6 lg:p-8">
          {/* Enhanced Header */}
          <div className="text-center mb-4 sm:mb-6 lg:mb-8">
            <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent mb-2 sm:mb-4">
              Find Your Perfect Stay
            </h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg px-2">
              Search for hotels, transfers, experiences and more with the best prices
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-1 sm:gap-2 mb-4 sm:mb-6 lg:mb-8 px-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm lg:text-base font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white shadow-lg transform scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:shadow-md'
                }`}
              >
                <span className="text-sm sm:text-base">{tab.icon}</span>
                <span className="hidden sm:inline lg:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Conditional Content Based on Active Tab */}
          {activeTab === 'stays' ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Mobile-First Search Form Layout */}
              <div className="space-y-3 sm:space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-2">
                {/* Destination - Mobile: Full width, Desktop: 4 cols */}
                <div className="lg:col-span-4 relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-3 sm:py-4 lg:py-5 border border-gray-200 rounded-lg sm:rounded-xl lg:rounded-l-xl lg:rounded-r-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/80 hover:bg-white text-gray-900 text-sm sm:text-base"
                      required
                    >
                      <option value="">Select Country</option>
                      {countries.map((country) => (
                        <option key={country.iso3} value={country.iso3}>
                          {country.country}
                        </option>
                      ))}
                    </select>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 sm:px-4 py-3 sm:py-4 lg:py-5 border border-gray-200 rounded-lg sm:rounded-xl lg:rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/80 hover:bg-white text-gray-900 text-sm sm:text-base"
                      required
                      disabled={!country}
                    >
                      <option value="">Select City</option>
                      {cities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="absolute inset-0 rounded-lg sm:rounded-xl lg:rounded-l-xl lg:rounded-r-none bg-gradient-to-r from-blue-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </div>

                {/* Date Inputs - Mobile: Full width each, Desktop: 2 cols each */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:col-span-4 gap-2 sm:gap-2 lg:gap-0">
                  {/* Check-in */}
                  <div className="lg:col-span-2 relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                    </div>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-3 sm:py-4 lg:py-5 border border-gray-200 rounded-lg sm:rounded-xl lg:rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/80 hover:bg-white text-gray-900 text-sm sm:text-base"
                      required
                    />
                  </div>

                  {/* Check-out */}
                  <div className="lg:col-span-2 relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                    </div>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      min={checkIn || new Date().toISOString().split('T')[0]}
                      className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-3 sm:py-4 lg:py-5 border border-gray-200 rounded-lg sm:rounded-xl lg:rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/80 hover:bg-white text-gray-900 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                {/* Guests & Search - Mobile: Stacked, Desktop: Side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:col-span-4 gap-2 sm:gap-2 lg:gap-0">
                  {/* Guests & Rooms Combined */}
                  <div className="lg:col-span-2 relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                    </div>
                    <select
                      value={`${adults}-${children}-${rooms}`}
                      onChange={(e) => {
                        const [a, c, r] = e.target.value.split('-').map(Number);
                        setAdults(a);
                        setChildren(c);
                        setRooms(r);
                      }}
                      className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-3 sm:py-4 lg:py-5 border border-gray-200 rounded-lg sm:rounded-xl lg:rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/80 hover:bg-white text-gray-900 text-sm sm:text-base"
                    >
                      {[1, 2, 3, 4, 5].map(room => 
                        [1, 2, 3, 4, 5].map(adult =>
                          [0, 1, 2, 3, 4, 5].map(child => (
                            <option key={`${adult}-${child}-${room}`} value={`${adult}-${child}-${room}`}>
                              {adult} Adult{adult > 1 ? 's' : ''}, {child} Child{child !== 1 ? 'ren' : ''}, {room} Room{room > 1 ? 's' : ''}
                            </option>
                          ))
                        )
                      ).flat().flat()}
                    </select>
                  </div>

                  {/* Search Button */}
                  <div className="lg:col-span-2">
                    <button 
                      onClick={handleSubmit}
                      className="w-full h-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white py-3 sm:py-4 lg:py-5 px-4 sm:px-6 rounded-lg sm:rounded-xl lg:rounded-r-xl lg:rounded-l-none font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2 group text-sm sm:text-base"
                    >
                      <Search className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-300" />
                      <span>Search</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Nights Display */}
              <div className="text-center">
                <span className="inline-flex items-center px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 rounded-full text-xs sm:text-sm font-medium">
                  {calculateNights()} Night{calculateNights() !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Advanced Options Toggle */}
              <div className="flex items-center justify-center">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors duration-300"
                >
                  <SlidersHorizontal className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm font-medium">Advanced Filters</span>
                  <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Advanced Options */}
              {isExpanded && (
                <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-gradient-to-r from-gray-50/50 to-blue-50/50 rounded-lg sm:rounded-xl border border-gray-200/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Price Range</label>
                      <div className="flex space-x-2">
                        <input 
                          type="number" 
                          placeholder="Min" 
                          className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md sm:rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm" 
                        />
                        <input 
                          type="number" 
                          placeholder="Max" 
                          className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md sm:rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Star Rating</label>
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button key={star} className="p-1 hover:scale-110 transition-transform duration-300">
                            <Star className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-gray-300 hover:text-yellow-400 transition-colors duration-300" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Property Type</label>
                      <select className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md sm:rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm">
                        <option>All Types</option>
                        <option>Hotels</option>
                        <option>Resorts</option>
                        <option>Apartments</option>
                        <option>Villas</option>
                        <option>Hostels</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Coming Soon Message for Other Tabs */
            <div className="text-center py-6 px-4">
              <div className="text-4xl sm:text-5xl lg:text-6xl mb-4 animate-bounce">
                {tabs.find(tab => tab.id === activeTab)?.icon}
              </div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                {tabs.find(tab => tab.id === activeTab)?.label}
              </h2>
              <p className="text-gray-500 text-sm sm:text-base lg:text-lg mb-6 sm:mb-8">
                Coming soon! We're working on bringing you amazing {tabs.find(tab => tab.id === activeTab)?.label.toLowerCase()} options.
              </p>
              <div className="mt-6 sm:mt-8">
                <button
                  onClick={() => setActiveTab('stays')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 sm:py-3 px-6 sm:px-8 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg text-sm sm:text-base"
                >
                  Search Hotels Instead
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HotelSearchForm;