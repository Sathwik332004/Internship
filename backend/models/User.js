const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'staff'],
    default: 'staff'
  },
  phone: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  // OTP fields
  resetOTP: {
    type: String,
    select: false
  },
  resetOTPExpire: {
    type: Date,
    select: false
  },
  loginOTP: {
    type: String,
    select: false
  },
  loginOTPExpire: {
    type: Date,
    select: false
  },
  isOTPVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {

  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  this.updatedAt = Date.now();

  next();

});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate Signed JWT token
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Generate and hash OTP
userSchema.methods.generateOTP = async function (otpType) {
  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expireMinutes = otpType === 'login' 
    ? parseInt(process.env.LOGIN_OTP_EXPIRE_MINUTES) || 5 
    : parseInt(process.env.OTP_EXPIRE_MINUTES) || 10;
  
  const expireTime = Date.now() + expireMinutes * 60 * 1000;

  if (otpType === 'login') {
    this.loginOTP = otp;
    this.loginOTPExpire = expireTime;
    this.isOTPVerified = false;
  } else {
    this.resetOTP = otp;
    this.resetOTPExpire = expireTime;
  }

  await this.save({ validateBeforeSave: false });
  return otp;
};

// Check if OTP is valid
userSchema.methods.checkOTP = function (enteredOTP, otpType) {
  if (otpType === 'login') {
    return (
      this.loginOTP === enteredOTP &&
      this.loginOTPExpire > Date.now()
    );
  } else {
    return (
      this.resetOTP === enteredOTP &&
      this.resetOTPExpire > Date.now()
    );
  }
};

module.exports = mongoose.model('User', userSchema);
