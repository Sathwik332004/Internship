const express = require('express');
const router = express.Router();

const {
  register,
  login,
  verifyLoginOTP,
  resendLoginOTP,
  forgotPassword,
  resetPassword,
  getMe,
  updateDetails,
  updatePassword,
  getUsers,
  toggleUserStatus,
  deleteUser,
  updateUser
} = require('../controllers/authController');

const { protect, adminOnly } = require('../middleware/auth');


/* ===========================
   PUBLIC ROUTES
=========================== */

router.post('/login', login);
router.post('/verify-login-otp', verifyLoginOTP);
router.post('/resend-login-otp', resendLoginOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);


/* ===========================
   PROTECTED ROUTES
=========================== */

// Get logged in user profile
router.get('/me', protect, getMe);

// Update profile details (name, email, phone, password)
router.put('/updatedetails', protect, updateDetails);

// Update password separately (optional)
router.put('/updatepassword', protect, updatePassword);


/* ===========================
   ADMIN ONLY ROUTES
=========================== */

// Register staff/admin
router.post('/register', protect, adminOnly, register);

// Get all users
router.get('/users', protect, adminOnly, getUsers);

// Toggle active status
router.put('/users/:id/toggle-status', protect, adminOnly, toggleUserStatus);

// Delete user
router.delete('/users/:id', protect, adminOnly, deleteUser);

// Update user
router.put('/users/:id', protect, adminOnly, updateUser);


module.exports = router;