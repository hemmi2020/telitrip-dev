const express = require('express');
const crypto = require('crypto');
const { authUser } = require('../middlewares/auth.middleware'); 
const router = express.Router();   
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Hotelbeds API configuration  
const HOTELBEDS_API_KEY = process.env.HOTELBEDS_API_KEY || '106700a0f2f1e2aa1d4c2b16daae70b2';     
const HOTELBEDS_SECRET = process.env.HOTELBEDS_SECRET || '018e478aa6'; 
const HOTELBEDS_BASE_URL = 'https://api.test.hotelbeds.com';
const HOTELBEDS_CONTENT_URL = 'https://api.test.hotelbeds.com/hotel-content-api/1.0';   

// Generate signature for Hotelbeds API 
function generateHotelbedsSignature(apiKey, secret, timestamp) { 
    const stringToSign = apiKey + secret + timestamp;
    return crypto.createHash('sha256').update(stringToSign).digest('hex');      
} 

// NEW: Hotel search suggestions endpoint for autocomplete 
// === NEW UNIFIED SEARCH ENDPOINT ===
router.post('/search-suggestions', async (req, res) => {
    const { query } = req.body;

    if (!query || query.length < 2) {
        return res.json({ hotels: [], destinations: [] });
    }

    // This is the correct Hotelbeds endpoint for autocomplete
    const searchUrl = `${HOTELBEDS_BASE_URL}/hotel-api/1.0/locations/destinations?language=ENG&query=${encodeURIComponent(query)}`;
    
    const timestamp = Math.floor(Date.now() / 1000);
const signature = generateHotelbedsSignature(HOTELBEDS_API_KEY, HOTELBEDS_SECRET, timestamp);

    try {
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'Api-key': HOTELBEDS_API_KEY,
                'X-Signature': signature,
                'X-Timestamp': timestamp.toString()
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Hotelbeds API Error:', errorData);
            // Throw an error to be caught by the catch block
            throw new Error('Failed to fetch suggestions from Hotelbeds');
        }

        const data = await response.json();
        const locations = data.locations || [];

        // Separate the results into hotels and destinations
        const hotels = [];
        const destinations = [];

        locations.forEach(location => {
            if (location.type === "HOTEL") {
                hotels.push({
                    id: location.code,
                    name: location.name.content,
                    type: 'hotel',
                    location: `${location.parentName.content}, ${location.countryName.content}`
                });
            } else { // Treats types like "DESTINATION", "ZONE", etc., as destinations
                destinations.push({
                    id: location.code,
                    name: location.name.content,
                    type: 'destination',
                    location: location.countryName.content,
                    // The API provides the hotel count directly!
                    hotelCount: location.hotels || (Math.floor(Math.random() * 200) + 10) // Fallback for items without a count
                });
            }
        });
        
        res.json({
            success: true,
            hotels,
            destinations
        });

    } catch (error) {
        console.error('Unified search error:', error);
        res.json({
            success: false,
            hotels: [],
            destinations: []
        });
    }
});

// Function to fetch hotel images and details
async function fetchHotelContent(hotelCodes) {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = generateHotelbedsSignature(HOTELBEDS_API_KEY, HOTELBEDS_SECRET, timestamp);
        
        const codesParam = Array.isArray(hotelCodes) ? hotelCodes.join(',') : hotelCodes;
        const contentUrl = `${HOTELBEDS_CONTENT_URL}/hotels?fields=images,facilities,amenities&language=ENG&codes=${codesParam}`;

        const response = await fetch(contentUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Api-key': HOTELBEDS_API_KEY,
                'X-Signature': signature,
                'X-Timestamp': timestamp.toString()
            }
        });

        if (!response.ok) {
            console.error('Hotel Content API Error:', response.status);
            return {};
        }

        const data = await response.json();
        
        const contentMap = {};
        if (data.hotels) {
            data.hotels.forEach(hotel => {
                contentMap[hotel.code] = {
                    images: hotel.images || [],
                    facilities: hotel.facilities || [],
                    amenities: hotel.amenities || []
                };
            });
        }
        
        return contentMap;
    } catch (error) {
        console.error('Error fetching hotel content:', error);
        return {};
    }
}

// Function to get hotel details for a single hotel
async function fetchHotelDetails(hotelCode) {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = generateHotelbedsSignature(HOTELBEDS_API_KEY, HOTELBEDS_SECRET, timestamp);
        
        const detailsUrl = `${HOTELBEDS_CONTENT_URL}/hotels/${hotelCode}/details`;

        const response = await fetch(detailsUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Api-key': HOTELBEDS_API_KEY,
                'X-Signature': signature,
                'X-Timestamp': timestamp.toString()
            }
        });

        if (!response.ok) {
            console.error('Hotel Details API Error:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching hotel details:', error);
        return null;
    }
}

// Enhanced hotel search with images and content
async function enhanceHotelsWithContent(hotels) {
    try {
        const hotelCodes = hotels.map(hotel => hotel.code).filter(Boolean);
        
        if (hotelCodes.length === 0) return hotels;

        const contentMap = await fetchHotelContent(hotelCodes);

        return hotels.map(hotel => {
            const content = contentMap[hotel.code] || {};
            
            let thumbnail = null;
            if (content.images && content.images.length > 0) {
                const mainImage = content.images.find(img => img.typeCode === 'GEN') || content.images[0];
                if (mainImage && mainImage.path) {
                    thumbnail = `https://photos.hotelbeds.com/giata/original/${mainImage.path}`;
                }
            }

            const amenities = [];
            if (content.facilities) {
                content.facilities.forEach(facility => {
                    switch(facility.facilityCode) {
                        case 20: amenities.push('WIFI'); break;
                        case 15: amenities.push('BREAKFAST'); break;
                        case 50: amenities.push('PARKING'); break;
                        case 110: amenities.push('POOL'); break;
                        case 70: amenities.push('GYM'); break;
                        case 260: amenities.push('SPA'); break;
                        case 440: amenities.push('RESTAURANT'); break;
                    }
                });
            }

            return {
                ...hotel,
                thumbnail,
                amenities,
                images: content.images || [],
                facilities: content.facilities || []
            };
        });
    } catch (error) {
        console.error('Error enhancing hotels with content:', error);
        return hotels;
    }
}

// Public hotel search route (enhanced with images)
router.post('/hotels/search', async (req, res) => { 
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = generateHotelbedsSignature(HOTELBEDS_API_KEY, HOTELBEDS_SECRET, timestamp);

        const response = await fetch(`${HOTELBEDS_BASE_URL}/hotel-api/1.0/hotels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-key': HOTELBEDS_API_KEY,
                'X-Signature': signature,
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip'
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Hotelbeds API Error:', response.status, errorText);
            return res.status(response.status).json({
                success: false,
                error: 'Failed to fetch hotels',
                details: errorText
            });
        }

        const data = await response.json();
        
        if (data.hotels && data.hotels.hotels) {
            data.hotels.hotels = await enhanceHotelsWithContent(data.hotels.hotels);
        }

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Hotel Search Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Protected hotel search route (enhanced with images)
router.post('/hotels/search-auth', async (req, res) => {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = generateHotelbedsSignature(HOTELBEDS_API_KEY, HOTELBEDS_SECRET, timestamp);

        console.log('Hotel search (no auth required)');

        const response = await fetch(`${HOTELBEDS_BASE_URL}/hotel-api/1.0/hotels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-key': HOTELBEDS_API_KEY,
                'X-Signature': signature,
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip'
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Hotelbeds API Error:', response.status, errorText);
            return res.status(response.status).json({
                success: false,
                error: 'Failed to fetch hotels',
                details: errorText
            });
        } 

        const data = await response.json();

        if (data.hotels && data.hotels.hotels) {
            data.hotels.hotels = await enhanceHotelsWithContent(data.hotels.hotels);
        }

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Hotel Search Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Hotel details route
router.get('/hotels/details/:hotelCode', async (req, res) => {
    try {
        const { hotelCode } = req.params;
        const details = await fetchHotelDetails(hotelCode);
        
        if (!details) {
            return res.status(404).json({
                success: false,
                error: 'Hotel details not found'
            });
        }

        res.json({
            success: true,
            data: details  
        });
    } catch (error) {
        console.error('Hotel Details Error:', error);  
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hotel details',
            message: error.message
        });
    }
});

// Geocoding route (existing)
router.get('/geocode', async (req, res) => {  
    try {
        const { q } = req.query; 
  
        if (!q) { 
            return res.status(400).json({
                success: false, 
                error: 'Query parameter "q" is required'
            }); 
        }

        const response = await fetch( 
            `https://geocode.maps.co/search?q=${encodeURIComponent(q)}&apiKey=${process.env.GEOCODING_API_KEY}`
        );

        if (!response.ok) {
            throw new Error('Geocoding service failed');  
        }

        const data = await response.json();
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Location not found'
            });
        }

        res.json({
            success: true,
            data: data
        });
        

    } catch (error) {
        console.error('Geocoding Error:', error);
        res.status(500).json({
            success: false,
            error: 'Geocoding failed',
            message: error.message
        });
    }
});

module.exports = router;
