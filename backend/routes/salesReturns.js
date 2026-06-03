const express = require('express');
const router = express.Router();
const {
  getSalesReturns,
  getSalesReturn,
  createSalesReturn,
  approveSalesReturn,
  rejectSalesReturn,
  getSalesReturnReport
} = require('../controllers/salesReturnController');
const { protect, adminOnly } = require('../middleware/auth');
const { auditAction } = require('../middleware/audit');
const { syncExpiredInventory } = require('../middleware/syncExpiredInventory');

router.use(protect);
router.use(syncExpiredInventory);

router.route('/')
  .get(getSalesReturns)
  .post(auditAction({ module: 'Sales Returns', action: 'CREATE' }), createSalesReturn);

router.route('/report')
  .get(getSalesReturnReport);

router.route('/:id/approve')
  .patch(adminOnly, auditAction({ module: 'Sales Returns', action: 'UPDATE' }), approveSalesReturn);

router.route('/:id/reject')
  .patch(adminOnly, auditAction({ module: 'Sales Returns', action: 'UPDATE' }), rejectSalesReturn);

router.route('/:id')
  .get(getSalesReturn);

module.exports = router;
