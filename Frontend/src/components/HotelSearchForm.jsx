import React, { useState, useEffect } from 'react';

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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB');
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
    <div className="min-h-screen bg-transparent from-blue-50 to-orange-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 backdrop-blur-sm bg-opacity-95">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            Search for hotels, transfers, experiences and more
          </h1>

          {/* Tabs */}
          <div className="flex space-x-2 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Conditional Content Based on Active Tab */}
          {activeTab === 'stays' ? (
            /* Search Form - Only shown for Stays */
            <div className="space-y-6">
              {/* Destination Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination, zone or hotel name
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
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
                </div>

                {/* Date Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dates
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1">
                      <input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                        required
                      />
                    </div>
                    <span className="text-gray-500">-</span>
                    <div className="flex-1">
                      <input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        min={checkIn || new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Nights and Travellers Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nights
                  </label>
                  <div className="px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                    {calculateNights()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rooms
                  </label>
                  <select
                    value={rooms}
                    onChange={(e) => setRooms(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                  >
                    {[1, 2, 3, 4, 5].map((num) => (
                      <option key={num} value={num}>{num} Room{num > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adults
                  </label>
                  <select
                    value={adults}
                    onChange={(e) => setAdults(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                  >
                    {[1, 2, 3, 4, 5].map((num) => (
                      <option key={num} value={num}>{num} Adult{num > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Children
                  </label>
                  <select
                    value={children}
                    onChange={(e) => setChildren(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                  >
                    {[0, 1, 2, 3, 4, 5].map((num) => (
                      <option key={num} value={num}>{num} Child{num > 1 ? 'ren' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search Button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleSubmit}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                >
                  <span>🔍</span>
                  <span>Search</span>
                </button>
              </div>
            </div>
          ) : (
            /* Coming Soon Message for Other Tabs */
            <div className="text-center py-16">
              <div className="text-6xl mb-4">
                {tabs.find(tab => tab.id === activeTab)?.icon}
              </div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                {tabs.find(tab => tab.id === activeTab)?.label}
              </h2>
              <p className="text-gray-500 text-lg">
                Coming soon! We're working on bringing you amazing {tabs.find(tab => tab.id === activeTab)?.label.toLowerCase()} options.
              </p>
              <div className="mt-8">
                <button
                  onClick={() => setActiveTab('stays')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200"
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