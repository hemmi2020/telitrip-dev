const dotenv = require('dotenv');
const cors = require('cors');
const express = require('express');
const connectToDb = require('./db/db');
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/user.route');
const hotelRoutes = require('./routes/hotel.route.js');   
  

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

app.use('/users', userRoutes);
app.use('/api', hotelRoutes); // Add this line

module.exports = app;

