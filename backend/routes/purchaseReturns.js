const express = require('express');
const router = express.Router();
const {
  getPurchaseReturns,
  getPurchaseReturn,
  createPurchaseReturn
} = require('../controllers/purchaseReturnController');
const { protect } = require('../middleware/auth');
const { auditAction } = require('../middleware/audit');
const { syncExpiredInventory } = require('../middleware/syncExpiredInventory');

router.use(protect);
router.use(syncExpiredInventory);

router.route('/')
  .get(getPurchaseReturns)
  .post(auditAction({ module: 'Purchase Returns', action: 'CREATE' }), createPurchaseReturn);

router.route('/:id')
  .get(getPurchaseReturn);

module.exports = router;
