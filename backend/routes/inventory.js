const express = require('express');
const router = express.Router();
const {
  getInventory,
  getInventoryItem,
  getInventoryByMedicine,
  getLowStockItems,
  getExpiringItems,
  getInventoryStats
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Main inventory routes
router.route('/')
  .get(getInventory);

router.route('/stats')
  .get(getInventoryStats);

router.route('/low-stock')
  .get(getLowStockItems);

router.route('/expiring')
  .get(getExpiringItems);

router.route('/medicine/:medicineId')
  .get(getInventoryByMedicine);

router.route('/:id')
  .get(getInventoryItem);

module.exports = router;

