const express = require('express');
const router = express.Router();
const {
  getPurchases,
  getPurchase,
  addPurchase,
  deletePurchase,
  getPurchaseReport,
  getLastPurchasePrice,
  checkBatchExists
} = require('../controllers/purchaseController');
const { protect, adminOnly } = require('../middleware/auth');

router.route('/')
  .get(protect, getPurchases)
  .post(protect, addPurchase);

router.route('/report')
  .get(protect, adminOnly, getPurchaseReport);

// New routes for purchase enhancements
router.get('/last-price/:medicineId', protect, getLastPurchasePrice);
router.get('/check-batch', protect, checkBatchExists);

router.route('/:id')
  .get(protect, getPurchase)
  .delete(protect, deletePurchase);

module.exports = router;
