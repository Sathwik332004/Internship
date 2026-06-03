const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  generateNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { auditAction } = require('../middleware/audit');

router.use(protect);

router.route('/')
  .get(getNotifications);

router.route('/mark-all-read')
  .put(auditAction({ module: 'Notifications', action: 'UPDATE' }), markAllAsRead);

router.route('/generate')
  .post(auditAction({ module: 'Notifications', action: 'CREATE' }), generateNotifications);

router.route('/:id/read')
  .put(auditAction({ module: 'Notifications', action: 'UPDATE' }), markAsRead);

module.exports = router;
