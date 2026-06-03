const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  generateNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getNotifications);

router.route('/mark-all-read')
  .put(markAllAsRead);

router.route('/generate')
  .post(generateNotifications);

router.route('/:id/read')
  .put(markAsRead);

module.exports = router;
