const dotenv = require('dotenv');
const cors = require('cors');
const express = require('express');
const connectToDb = require('./db/db');
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/user.route');
const hotelRoutes = require('./routes/hotel.route.js');   
const paymentRoutes = require('./routes/payment.route');
const bookingRoutes = require('./routes/booking.route');
const { globalErrorHandler, notFoundHandler } = require('./middlewares/errorHandler.middleware');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

  

dotenv.config();   
connectToDb();
const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);


app.use(cookieParser());
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:3001'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
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
    const ApiResponse = require('./utils/response.util');
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

// Error handling middleware (MUST be last)
app.use( notFoundHandler); // Handle 404s
app.use(globalErrorHandler); // Handle all errors
module.exports = app;

