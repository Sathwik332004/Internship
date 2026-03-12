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

router.route('/')
  .get(protect, getSuppliers)
  .post(protect, adminOnly, addSupplier);

router.route('/:id')
  .get(protect, getSupplier)
  .put(protect, adminOnly, updateSupplier)
  .delete(protect, adminOnly, deleteSupplier);

module.exports = router;
