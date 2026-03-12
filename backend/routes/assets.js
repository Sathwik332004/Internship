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

router.route('/')
  .get(protect, adminOnly, getAssets)
  .post(protect, adminOnly, addAsset);

router.route('/report')
  .get(protect, adminOnly, getAssetReport);

router.route('/:id')
  .get(protect, adminOnly, getAsset)
  .put(protect, adminOnly, updateAsset)
  .delete(protect, adminOnly, deleteAsset);

module.exports = router;
