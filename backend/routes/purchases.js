const express = require('express');
const router = express.Router();
const {
  getPurchases,
  getPurchase,
  addPurchase,
  updatePurchase,
  deletePurchase,
  getPurchaseReport,
  getLastPurchasePrice,
  checkBatchExists
} = require('../controllers/purchaseController');
const { protect, adminOnly } = require('../middleware/auth');
const { auditAction } = require('../middleware/audit');
const { syncExpiredInventory } = require('../middleware/syncExpiredInventory');

router.use(protect);
router.use(syncExpiredInventory);

router.route('/')
  .get(getPurchases)
  .post(auditAction({ module: 'Purchases', action: 'CREATE' }), addPurchase);

router.route('/report')
  .get(adminOnly, getPurchaseReport);

// New routes for purchase enhancements
router.get('/last-price/:medicineId', getLastPurchasePrice);
router.get('/check-batch', checkBatchExists);

router.route('/:id')
  .get(getPurchase)
  .put(auditAction({ module: 'Purchases', action: 'UPDATE' }), updatePurchase)
  .delete(auditAction({ module: 'Purchases', action: 'DELETE' }), deletePurchase);

module.exports = router;
