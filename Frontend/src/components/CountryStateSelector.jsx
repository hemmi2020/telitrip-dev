// CountryStateSelector.jsx - Complete component with ISO data
import React from 'react';

// Complete country/state data from the uploaded Excel file
const COUNTRY_STATE_DATA = [
  // Pakistan
  { country: "Pakistan", countryCode: "PK", state: "Islamabad", stateCode: "IS" },
  { country: "Pakistan", countryCode: "PK", state: "Balochistan", stateCode: "BA" },
  { country: "Pakistan", countryCode: "PK", state: "Khyber Pakhtunkhwa", stateCode: "KP" },
  { country: "Pakistan", countryCode: "PK", state: "Punjab", stateCode: "PB" },
  { country: "Pakistan", countryCode: "PK", state: "Sindh", stateCode: "SD" },
  { country: "Pakistan", countryCode: "PK", state: "Azad Jammu and Kashmir", stateCode: "JK" },
  { country: "Pakistan", countryCode: "PK", state: "Gilgit-Baltistan", stateCode: "GB" },
  { country: "Pakistan", countryCode: "PK", state: "Federally Administered Tribal Areas", stateCode: "TA" },
  
  // United States
  { country: "United States", countryCode: "US", state: "Alabama", stateCode: "AL" },
  { country: "United States", countryCode: "US", state: "Alaska", stateCode: "AK" },
  { country: "United States", countryCode: "US", state: "Arizona", stateCode: "AZ" },
  { country: "United States", countryCode: "US", state: "Arkansas", stateCode: "AR" },
  { country: "United States", countryCode: "US", state: "California", stateCode: "CA" },
  { country: "United States", countryCode: "US", state: "Colorado", stateCode: "CO" },
  { country: "United States", countryCode: "US", state: "Connecticut", stateCode: "CT" },
  { country: "United States", countryCode: "US", state: "Delaware", stateCode: "DE" },
  { country: "United States", countryCode: "US", state: "Florida", stateCode: "FL" },
  { country: "United States", countryCode: "US", state: "Georgia", stateCode: "GA" },
  { country: "United States", countryCode: "US", state: "Hawaii", stateCode: "HI" },
  { country: "United States", countryCode: "US", state: "Idaho", stateCode: "ID" },
  { country: "United States", countryCode: "US", state: "Illinois", stateCode: "IL" },
  { country: "United States", countryCode: "US", state: "Indiana", stateCode: "IN" },
  { country: "United States", countryCode: "US", state: "Iowa", stateCode: "IA" },
  { country: "United States", countryCode: "US", state: "Kansas", stateCode: "KS" },
  { country: "United States", countryCode: "US", state: "Kentucky", stateCode: "KY" },
  { country: "United States", countryCode: "US", state: "Louisiana", stateCode: "LA" },
  { country: "United States", countryCode: "US", state: "Maine", stateCode: "ME" },
  { country: "United States", countryCode: "US", state: "Maryland", stateCode: "MD" },
  { country: "United States", countryCode: "US", state: "Massachusetts", stateCode: "MA" },
  { country: "United States", countryCode: "US", state: "Michigan", stateCode: "MI" },
  { country: "United States", countryCode: "US", state: "Minnesota", stateCode: "MN" },
  { country: "United States", countryCode: "US", state: "Mississippi", stateCode: "MS" },
  { country: "United States", countryCode: "US", state: "Missouri", stateCode: "MO" },
  { country: "United States", countryCode: "US", state: "Montana", stateCode: "MT" },
  { country: "United States", countryCode: "US", state: "Nebraska", stateCode: "NE" },
  { country: "United States", countryCode: "US", state: "Nevada", stateCode: "NV" },
  { country: "United States", countryCode: "US", state: "New Hampshire", stateCode: "NH" },
  { country: "United States", countryCode: "US", state: "New Jersey", stateCode: "NJ" },
  { country: "United States", countryCode: "US", state: "New Mexico", stateCode: "NM" },
  { country: "United States", countryCode: "US", state: "New York", stateCode: "NY" },
  { country: "United States", countryCode: "US", state: "North Carolina", stateCode: "NC" },
  { country: "United States", countryCode: "US", state: "North Dakota", stateCode: "ND" },
  { country: "United States", countryCode: "US", state: "Ohio", stateCode: "OH" },
  { country: "United States", countryCode: "US", state: "Oklahoma", stateCode: "OK" },
  { country: "United States", countryCode: "US", state: "Oregon", stateCode: "OR" },
  { country: "United States", countryCode: "US", state: "Pennsylvania", stateCode: "PA" },
  { country: "United States", countryCode: "US", state: "Rhode Island", stateCode: "RI" },
  { country: "United States", countryCode: "US", state: "South Carolina", stateCode: "SC" },
  { country: "United States", countryCode: "US", state: "South Dakota", stateCode: "SD" },
  { country: "United States", countryCode: "US", state: "Tennessee", stateCode: "TN" },
  { country: "United States", countryCode: "US", state: "Texas", stateCode: "TX" },
  { country: "United States", countryCode: "US", state: "Utah", stateCode: "UT" },
  { country: "United States", countryCode: "US", state: "Vermont", stateCode: "VT" },
  { country: "United States", countryCode: "US", state: "Virginia", stateCode: "VA" },
  { country: "United States", countryCode: "US", state: "Washington", stateCode: "WA" },
  { country: "United States", countryCode: "US", state: "West Virginia", stateCode: "WV" },
  { country: "United States", countryCode: "US", state: "Wisconsin", stateCode: "WI" },
  { country: "United States", countryCode: "US", state: "Wyoming", stateCode: "WY" },

  // Add more countries as needed
  { country: "United Kingdom", countryCode: "UK", state: "England", stateCode: "ENG" },
  { country: "United Kingdom", countryCode: "UK", state: "Scotland", stateCode: "SCT" },
  { country: "United Kingdom", countryCode: "UK", state: "Wales", stateCode: "WLS" },
  { country: "United Kingdom", countryCode: "UK", state: "Northern Ireland", stateCode: "NIR" },
  
  { country: "Canada", countryCode: "CA", state: "Ontario", stateCode: "ON" },
  { country: "Canada", countryCode: "CA", state: "Quebec", stateCode: "QC" },
  { country: "Canada", countryCode: "CA", state: "British Columbia", stateCode: "BC" },
  { country: "Canada", countryCode: "CA", state: "Alberta", stateCode: "AB" },
  { country: "Canada", countryCode: "CA", state: "Manitoba", stateCode: "MB" },
  { country: "Canada", countryCode: "CA", state: "Saskatchewan", stateCode: "SK" },
  { country: "Canada", countryCode: "CA", state: "Nova Scotia", stateCode: "NS" },
  { country: "Canada", countryCode: "CA", state: "New Brunswick", stateCode: "NB" },
  { country: "Canada", countryCode: "CA", state: "Newfoundland and Labrador", stateCode: "NL" },
  { country: "Canada", countryCode: "CA", state: "Prince Edward Island", stateCode: "PE" },
  { country: "Canada", countryCode: "CA", state: "Northwest Territories", stateCode: "NT" },
  { country: "Canada", countryCode: "CA", state: "Nunavut", stateCode: "NU" },
  { country: "Canada", countryCode: "CA", state: "Yukon", stateCode: "YT" },
];

const CountryStateSelector = ({ 
  selectedCountry, 
  selectedState, 
  onCountryChange, 
  onStateChange,
  countryClassName = "",
  stateClassName = "",
  disabled = false 
}) => {
  // Get unique countries
  const countries = [...new Map(
    COUNTRY_STATE_DATA.map(item => [item.country, { country: item.country, countryCode: item.countryCode }])
  ).values()];

  // Get states for selected country
  const states = selectedCountry 
    ? COUNTRY_STATE_DATA.filter(item => item.country === selectedCountry)
    : [];

  const handleCountryChange = (e) => {
    const newCountry = e.target.value;
    onCountryChange(newCountry);
    onStateChange(''); // Reset state when country changes
  };

  const handleStateChange = (e) => {
    const newState = e.target.value;
    onStateChange(newState);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Country *
        </label>
        <select
          value={selectedCountry}
          onChange={handleCountryChange}
          disabled={disabled}
          className={`w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${countryClassName}`}
          required
        >
          <option value="">Select Country</option>
          {countries.map((item) => (
            <option key={item.countryCode} value={item.country}>
              {item.country} ({item.countryCode})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          State/Province *
        </label>
        <select
          value={selectedState}
          onChange={handleStateChange}
          disabled={disabled || !selectedCountry}
          className={`w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${stateClassName}`}
          required
        >
          <option value="">
            {selectedCountry ? 'Select State/Province' : 'Select Country First'}
          </option>
          {states.map((item) => (
            <option key={item.stateCode} value={item.stateCode}>
              {item.state}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

// Helper function to get state name by code
export const getStateName = (stateCode) => {
  const stateData = COUNTRY_STATE_DATA.find(item => item.stateCode === stateCode);
  return stateData ? stateData.state : stateCode;
};

// Helper function to get country name by code
export const getCountryName = (countryCode) => {
  const countryData = COUNTRY_STATE_DATA.find(item => item.countryCode === countryCode);
  return countryData ? countryData.country : countryCode;
};

// Helper function to validate country-state combination
export const isValidCountryState = (country, stateCode) => {
  return COUNTRY_STATE_DATA.some(item => 
    item.country === country && item.stateCode === stateCode
  );
};

export default CountryStateSelector;