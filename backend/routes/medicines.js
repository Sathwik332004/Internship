const express = require('express');
const router = express.Router();
const {
  getMedicines,
  getMedicine,
  searchMedicines,
  searchAllMedicines,
  getMedicineByBarcode,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getLowStockMedicines,
  getExpiringMedicines,
  getExpiredMedicines,
  getInventoryReport,
  getBrands,
  getDashboardSummary
} = require('../controllers/medicineController');
const { protect, adminOnly } = require('../middleware/auth');

// Public within auth routes
router.get('/search', protect, searchMedicines);
router.get('/search-all', protect, searchAllMedicines);
router.get('/barcode/:barcode', protect, getMedicineByBarcode);
router.get('/alerts/low-stock', protect, getLowStockMedicines);
router.get('/alerts/expiring', protect, getExpiringMedicines);
router.get('/alerts/expired', protect, getExpiredMedicines);
router.get('/brands', protect, getBrands);
router.get('/report/inventory', protect, adminOnly, getInventoryReport);
router.get('/dashboard/summary', protect, getDashboardSummary);

// CRUD routes (Admin only for add, edit, delete)
router.route('/')
  .get(protect, getMedicines)
  .post(protect, adminOnly, addMedicine);

router.route('/:id')
  .get(protect, getMedicine)
  .put(protect, adminOnly, updateMedicine)
  .delete(protect, adminOnly, deleteMedicine);

module.exports = router;
