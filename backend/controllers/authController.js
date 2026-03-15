const User = require('../models/User');
const { sendOTPEmail, sendWelcomeEmail } = require('../utils/email');
const {
  isValidEmail,
  isValidOtp,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  normalizeWhitespace
} = require('../utils/validation');

// @desc    Register new user (Admin only)
// @route   POST /api/auth/register
// @access  Private/Admin
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const normalizedName = normalizeWhitespace(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const normalizedRole = role || 'staff';

    if (normalizedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters'
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    if (!['admin', 'staff'].includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role'
      });
    }

    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password,
      role: normalizedRole,
      phone: normalizedPhone || ''
    });

    // Send welcome email
    await sendWelcomeEmail(normalizedEmail, normalizedName);

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Validate email & password
    if (!isValidEmail(normalizedEmail) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check user role
    if (user.role === 'staff') {
      // Staff login directly without OTP
      sendTokenResponse(user, 200, res);
    } else {
      // Admin requires OTP
      // Generate and send OTP
      const otp = await user.generateOTP('login');
      await sendOTPEmail(user.email, otp, 'login');

      // Return success but require OTP verification
      res.status(200).json({
        success: true,
        message: 'OTP sent to your email. Please verify to login.',
        requiresOTP: true,
        userId: user._id
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

// @desc    Verify Login OTP
// @route   POST /api/auth/verify-login-otp
// @access  Public
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !isValidOtp(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Valid user and OTP are required'
      });
    }

    const user = await User.findById(userId).select('+loginOTP +loginOTPExpire');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check OTP
    if (!user.checkOTP(otp, 'login')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as verified
    user.isOTPVerified = true;
    user.loginOTP = undefined;
    user.loginOTPExpire = undefined;
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: error.message
    });
  }
};

// @desc    Resend Login OTP
// @route   POST /api/auth/resend-login-otp
// @access  Public
exports.resendLoginOTP = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User is required'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new OTP
    const otp = await user.generateOTP('login');
    await sendOTPEmail(user.email, otp, 'login');

    res.status(200).json({
      success: true,
      message: 'OTP resent to your email'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error resending OTP',
      error: error.message
    });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email'
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email'
      });
    }

    // Generate Reset OTP
    const otp = await user.generateOTP('reset');
    await sendOTPEmail(user.email, otp, 'reset');

    res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error sending reset email',
      error: error.message
    });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email'
      });
    }

    if (!isValidOtp(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 6-digit OTP'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+resetOTP +resetOTPExpire');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check OTP
    if (!user.checkOTP(otp, 'reset')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Set new password
    user.password = password;
    user.resetOTP = undefined;
    user.resetOTPExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting user',
      error: error.message
    });
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res) => {
  try {

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ✅ Check if email already exists
    if (req.body.name !== undefined) {
      const normalizedName = normalizeWhitespace(req.body.name);
      if (normalizedName.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Name must be at least 2 characters'
        });
      }
      user.name = normalizedName;
    }

    if (req.body.email !== undefined) {

      const normalizedEmail = normalizeEmail(req.body.email);
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email'
        });
      }

      const existingUser = await User.findOne({ email: normalizedEmail });

      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "Email already in use"
        });
      }

      user.email = normalizedEmail;
    }

    if (req.body.phone !== undefined) {
      const normalizedPhone = normalizePhone(req.body.phone);
      if (normalizedPhone && !isValidPhone(normalizedPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be 10 digits'
        });
      }
      user.phone = normalizedPhone;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message
    });

  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    if (!req.body.currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required'
      });
    }

    if (!req.body.newPassword || req.body.newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    if (req.body.newPassword === req.body.currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // ✅ Check new password and confirm password
    if (req.body.newPassword !== req.body.confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    // Update password
    user.password = req.body.newPassword;

    await user.save();

    sendTokenResponse(user, 200, res);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build search query
    // Exclude soft-deleted users from the list
    let query = { isDeleted: { $ne: true } };
    
    if (search) {
      query = {
        $and: [
          { isDeleted: { $ne: true } },
          {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
              { phone: { $regex: search, $options: 'i' } }
            ]
          }
        ]
      };
    }

    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    // Get users with pagination
    const users = await User.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit),
        total
      },
      data: users
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting users',
      error: error.message
    });
  }
};


// @desc    Toggle user status (Admin only)
// @route   PUT /api/auth/users/:id/toggle-status
// @access  Private/Admin
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error toggling user status',
      error: error.message
    });
  }
};

// @desc    Delete user (Soft delete - Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isDeleted = true;
    // Avoid repeatedly prefixing email if delete is called multiple times
    if (!user.email.startsWith('deleted_')) {
      user.email = `deleted_${Date.now()}_${user.email}`;
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// @desc    Update a user (Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const fieldsToUpdate = {};
    const { name, email, role, phone, isActive } = req.body;

    if (name !== undefined) {
      const normalizedName = normalizeWhitespace(name);
      if (normalizedName.length < 2) {
        return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
      }
      fieldsToUpdate.name = normalizedName;
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email' });
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.params.id }
      });

      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }

      fieldsToUpdate.email = normalizedEmail;
    }

    if (role !== undefined) {
      if (!['admin', 'staff'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid user role' });
      }
      fieldsToUpdate.role = role;
    }

    if (phone !== undefined) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone && !isValidPhone(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Phone number must be 10 digits' });
      }
      fieldsToUpdate.phone = normalizedPhone;
    }

    if (typeof isActive !== 'undefined') fieldsToUpdate.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = undefined;

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error updating user', error: error.message });
  }
};

// Helper function to get token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    data: user
  });
};
