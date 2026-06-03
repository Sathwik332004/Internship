const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  getSupplier,
  addSupplier,
  updateSupplier,
  deleteSupplier
} = require('../controllers/supplierController');
const { protect, adminOnly } = require('../middleware/auth');
const { auditAction } = require('../middleware/audit');

router.route('/')
  .get(protect, getSuppliers)
  .post(protect, adminOnly, auditAction({ module: 'Suppliers', action: 'CREATE' }), addSupplier);

router.route('/:id')
  .get(protect, getSupplier)
  .put(protect, adminOnly, auditAction({ module: 'Suppliers', action: 'UPDATE' }), updateSupplier)
  .delete(protect, adminOnly, auditAction({ module: 'Suppliers', action: 'DELETE' }), deleteSupplier);

module.exports = router;
