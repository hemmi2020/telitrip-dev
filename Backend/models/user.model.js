const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');



const userSchema = new mongoose.Schema({
  fullname: {
    firstname: {
      type: String,
      required: true,
      minlength: [3, 'First name must be at least 3 characters long'],
    },
    lastname: {
      type: String,
      required: true,
      minlength: [3, 'Last name must be at least 3 characters long'],
    },
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: (props) => `${props.value} is not a valid email!`,
    },
  },
  password: {
    type: String,
    required: true,
    select: false,
    minlength: [6, 'Password must be at least 6 characters long'],
  },
  phone: {
    type: String,
    default: '',
    validate: {
      validator: function(v) {
        return !v || /^\+?[\d\s\-\(\)]+$/.test(v);
      },
      message: 'Invalid phone number format'
    }
  },
  address: {
    type: String,
    default: ''
  },

  role: {
    type: String,
    enum: ['user', 'admin', 'super-admin'],
    default: 'user',
  }
  });

  
  userSchema.methods.generateAuthToken = function (){
    const token = jwt.sign({_id: this._id}, process.env.JWT_SECRET, {expiresIn: process.env.JWT_EXPIRES_IN});
    return token;
  }

  userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
  }

  userSchema.statics.hashPassword = async function (password) {
    return await bcrypt.hash(password, 10);
  }


 const userModel = mongoose.model('user', userSchema);

module.exports = userModel;