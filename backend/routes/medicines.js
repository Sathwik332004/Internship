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
const { syncExpiredInventory } = require('../middleware/syncExpiredInventory');

// Public within auth routes
router.use(protect);
router.use(syncExpiredInventory);
router.get('/search', searchMedicines);
router.get('/search-all', searchAllMedicines);
router.get('/barcode/:barcode', getMedicineByBarcode);
router.get('/alerts/low-stock', getLowStockMedicines);
router.get('/alerts/expiring', getExpiringMedicines);
router.get('/alerts/expired', getExpiredMedicines);
router.get('/brands', getBrands);
router.get('/report/inventory', adminOnly, getInventoryReport);
router.get('/dashboard/summary', getDashboardSummary);

// CRUD routes (Admin only for add, edit, delete)
router.route('/')
  .get(getMedicines)
  .post(adminOnly, addMedicine);

router.route('/:id')
  .get(getMedicine)
  .put(adminOnly, updateMedicine)
  .delete(adminOnly, deleteMedicine);

module.exports = router;
