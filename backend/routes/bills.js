const express = require('express');
const router = express.Router();
const {
  getBills,
  getBill,
  createBill,
  updateBill,
  getDailySales,
  getSalesReport,
  getGstReport,
  getMonthlySales,
  getTopMedicines,
  getDashboardStats
} = require('../controllers/billController');
const { protect, adminOnly } = require('../middleware/auth');
const { syncExpiredInventory } = require('../middleware/syncExpiredInventory');

router.use(protect);
router.use(syncExpiredInventory);

router.route('/')
  .get(getBills)
  .post(createBill);

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

router.route('/:id')
  .get(getBill)
  .put(adminOnly, updateBill);

module.exports = router;
