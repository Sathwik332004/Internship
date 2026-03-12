const express = require('express');
const router = express.Router();
const {
  getHSNCodes,
  getHSNCode,
  getHSNByCode,
  searchHSNCodes,
  createHSNCode,
  updateHSNCode,
  deleteHSNCode
} = require('../controllers/hsnController');
const { protect, adminOnly } = require('../middleware/auth');

// Public within auth routes
router.get('/search', protect, searchHSNCodes);
router.get('/code/:hsnCode', protect, getHSNByCode);

// CRUD routes
router.route('/')
  .get(protect, getHSNCodes)
  .post(protect, adminOnly, createHSNCode);

router.route('/:id')
  .get(protect, getHSNCode)
  .put(protect, adminOnly, updateHSNCode)
  .delete(protect, adminOnly, deleteHSNCode);

module.exports = router;
