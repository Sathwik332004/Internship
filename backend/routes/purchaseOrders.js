const express = require('express');
const router = express.Router();
const {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  approvePurchaseOrder,
  markPurchaseOrderSent,
  cancelPurchaseOrder,
  deletePurchaseOrder,
  runReorderCheck,
  removeItem
} = require('../controllers/purchaseOrderController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);

// Manual reorder trigger
router.post('/run-reorder', adminOnly, runReorderCheck);

// CRUD
router.route('/')
  .get(getPurchaseOrders)
  .post(adminOnly, createPurchaseOrder);

router.route('/:id')
  .get(getPurchaseOrder)
  .put(adminOnly, updatePurchaseOrder)
  .delete(adminOnly, deletePurchaseOrder);

// Status transitions
router.put('/:id/approve', adminOnly, approvePurchaseOrder);
router.put('/:id/send', adminOnly, markPurchaseOrderSent);
router.put('/:id/cancel', adminOnly, cancelPurchaseOrder);

// Item removal
router.delete('/:id/items/:itemId', adminOnly, removeItem);

module.exports = router;
