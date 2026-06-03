const express = require('express');
const router = express.Router();
const {
  getBills,
  getBill,
  createBill,
  updateBill,
  deleteBill,
  settlePendingBill,
  getDailySales,
  getSalesReport,
  getGstReport,
  getMonthlySales,
  getTopMedicines,
  getDashboardStats,
  getPendingCustomers,
  handleBillingScan
} = require('../controllers/billController');
const { protect } = require('../middleware/auth');
const { auditAction } = require('../middleware/audit');
const { syncExpiredInventory } = require('../middleware/syncExpiredInventory');

router.use(protect);
router.use(syncExpiredInventory);

router.route('/')
  .get(getBills)
  .post(auditAction({ module: 'Bills', action: 'CREATE' }), createBill);

router.route('/dashboard')
  .get(getDashboardStats);

router.route('/sales/daily')
  .get(getDailySales);

router.route('/sales/monthly')
  .get(getMonthlySales);

router.route('/top-medicines')
  .get(getTopMedicines);

router.route('/report/sales')
  .get(getSalesReport);

router.route('/report/gst')
  .get(getGstReport);

router.route('/pending-customers')
  .get(getPendingCustomers);

router.route('/scan')
  .post(handleBillingScan);

router.route('/:id/settle-pending')
  .patch(auditAction({ module: 'Bills', action: 'UPDATE' }), settlePendingBill);

router.route('/:id')
  .get(getBill)
  .put(auditAction({ module: 'Bills', action: 'UPDATE' }), updateBill)
  .delete(auditAction({ module: 'Bills', action: 'DELETE' }), deleteBill);

module.exports = router;
