const express = require('express');
const router = express.Router();
const {
  getInventory,
  getDisposals,
  getInventoryItem,
  getInventoryByMedicine,
  getLowStockItems,
  getExpiringItems,
  getInventoryStats,
  disposeInventoryItem
} = require('../controllers/inventoryController');
const { protect, adminOnly } = require('../middleware/auth');
const { syncExpiredInventory } = require('../middleware/syncExpiredInventory');

// All routes require authentication
router.use(protect);
router.use(syncExpiredInventory);

// Main inventory routes
router.route('/')
  .get(getInventory);

router.route('/disposals')
  .get(getDisposals);

router.route('/stats')
  .get(getInventoryStats);

router.route('/low-stock')
  .get(getLowStockItems);

router.route('/expiring')
  .get(getExpiringItems);

router.route('/medicine/:medicineId')
  .get(getInventoryByMedicine);

router.route('/:id/dispose')
  .post(adminOnly, disposeInventoryItem);

router.route('/:id')
  .get(getInventoryItem);

module.exports = router;

