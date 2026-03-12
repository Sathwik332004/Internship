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

router.route('/')
  .get(protect, getBills)
  .post(protect, createBill);

router.route('/dashboard')
  .get(protect, getDashboardStats);

router.route('/sales/daily')
  .get(protect, getDailySales);

router.route('/sales/monthly')
  .get(protect, getMonthlySales);

router.route('/top-medicines')
  .get(protect, getTopMedicines);

router.route('/report/sales')
  .get(protect, getSalesReport);

router.route('/report/gst')
  .get(protect, getGstReport);

router.route('/:id')
  .get(protect, getBill)
  .put(protect, adminOnly, updateBill);

module.exports = router;
