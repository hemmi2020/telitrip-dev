const dotenv = require('dotenv');
const cors = require('cors');
const express = require('express');
const connectToDb = require('./db/db');
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/user.route');
const hotelRoutes = require('./routes/hotel.route.js');   
const { globalErrorHandler, notFoundHandler } = require('./middlewares/errorHandler.middleware');
  

dotenv.config();   
connectToDb();
const app = express();

app.use(cookieParser());
app.use(cors({
     origin: 'http://localhost:5173',
  credentials: true,
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

// Error handling middleware (MUST be last)
app.use('*', notFoundHandler); // Handle 404s
app.use(globalErrorHandler); // Handle all errors

app.use('/users', userRoutes);
app.use('/api', hotelRoutes); // Add this line

module.exports = app;

