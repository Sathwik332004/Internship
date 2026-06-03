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
const { auditAction } = require('../middleware/audit');

// Public within auth routes
router.get('/search', protect, searchHSNCodes);
router.get('/code/:hsnCode', protect, getHSNByCode);

// CRUD routes
router.route('/')
  .get(protect, getHSNCodes)
  .post(protect, adminOnly, auditAction({ module: 'HSN Codes', action: 'CREATE' }), createHSNCode);

router.route('/:id')
  .get(protect, getHSNCode)
  .put(protect, adminOnly, auditAction({ module: 'HSN Codes', action: 'UPDATE' }), updateHSNCode)
  .delete(protect, adminOnly, auditAction({ module: 'HSN Codes', action: 'DELETE' }), deleteHSNCode);

module.exports = router;
