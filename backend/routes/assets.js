const express = require('express');
const router = express.Router();
const {
  getAssets,
  getAsset,
  addAsset,
  updateAsset,
  deleteAsset,
  getAssetReport
} = require('../controllers/assetController');
const { protect, adminOnly } = require('../middleware/auth');
const { auditAction } = require('../middleware/audit');

router.route('/')
  .get(protect, adminOnly, getAssets)
  .post(protect, adminOnly, auditAction({ module: 'Assets', action: 'CREATE' }), addAsset);

router.route('/report')
  .get(protect, adminOnly, getAssetReport);

router.route('/:id')
  .get(protect, adminOnly, getAsset)
  .put(protect, adminOnly, auditAction({ module: 'Assets', action: 'UPDATE' }), updateAsset)
  .delete(protect, adminOnly, auditAction({ module: 'Assets', action: 'DELETE' }), deleteAsset);

module.exports = router;
