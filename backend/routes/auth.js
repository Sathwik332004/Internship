const express = require('express');
const router = express.Router();

const {
  register,
  login,
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
const { auditAction } = require('../middleware/audit');


/* ===========================
   PUBLIC ROUTES
=========================== */

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);


/* ===========================
   PROTECTED ROUTES
=========================== */

// Get logged in user profile
router.get('/me', protect, getMe);

// Update profile details (name, email, phone, password)
router.put('/updatedetails', protect, auditAction({ module: 'Profile', action: 'UPDATE' }), updateDetails);

// Update password separately (optional)
router.put('/updatepassword', protect, auditAction({ module: 'Profile', action: 'UPDATE' }), updatePassword);


/* ===========================
   ADMIN ONLY ROUTES
=========================== */

// Register staff/admin
router.post('/register', protect, adminOnly, auditAction({ module: 'Users', action: 'CREATE' }), register);

// Get all users
router.get('/users', protect, adminOnly, getUsers);

// Toggle active status
router.put('/users/:id/toggle-status', protect, adminOnly, auditAction({ module: 'Users', action: 'UPDATE' }), toggleUserStatus);

// Delete user
router.delete('/users/:id', protect, adminOnly, auditAction({ module: 'Users', action: 'DELETE' }), deleteUser);

// Update user
router.put('/users/:id', protect, adminOnly, auditAction({ module: 'Users', action: 'UPDATE' }), updateUser);


module.exports = router;
