const express = require('express');
const router = express.Router();
const {
  getSalesReturns,
  getSalesReturn,
  createSalesReturn
} = require('../controllers/salesReturnController');
const { protect } = require('../middleware/auth');
const { syncExpiredInventory } = require('../middleware/syncExpiredInventory');

router.use(protect);
router.use(syncExpiredInventory);

router.route('/')
  .get(getSalesReturns)
  .post(createSalesReturn);

router.route('/:id')
  .get(getSalesReturn);

module.exports = router;
