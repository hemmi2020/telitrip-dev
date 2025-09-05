const dotenv = require('dotenv');
const cors = require('cors');
const express = require('express');
const connectToDb = require('./db/db');
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/user.route');
const hotelRoutes = require('./routes/hotel.route.js');   
const paymentRoutes = require('./routes/payment.route');
const bookingRoutes = require('./routes/booking.route');
const { globalErrorHandler } = require('./middlewares/errorHandler.middleware');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const ApiResponse = require('./utils/response.util');

  

dotenv.config();   
connectToDb();
const app = express();

// Security middleware
app.use(helmet());

app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);


app.use(cookieParser());
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 


app.get('/', (req, res) => {
    res.send('Hello World!');
})
// Health check route
app.get('/health', (req, res) => {
    return ApiResponse.success(res, { 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    }, 'Server is running');
});


app.use('/users', userRoutes); 
app.use('/api', hotelRoutes); // Add this line
app.use('/api/payments', paymentRoutes);
app.use('/api/bookings', bookingRoutes);
console.log('userRoutes:', typeof userRoutes);
console.log('hotelRoutes:', typeof hotelRoutes);
console.log('paymentRoutes:', typeof paymentRoutes);
console.log('bookingRoutes:', typeof bookingRoutes);

// Error handling middleware (MUST be last)
// Handle 404s
app.use(globalErrorHandler); // Handle all errors
module.exports = app;


