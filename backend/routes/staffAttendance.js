const express = require('express');
const router = express.Router();
const {
  getAttendanceOverview,
  clockIn,
  clockOut,
  openCashierSession,
  closeCashierSession
} = require('../controllers/staffAttendanceController');
const { protect } = require('../middleware/auth');
const { auditAction } = require('../middleware/audit');

router.use(protect);

router.get('/', getAttendanceOverview);

router.post('/clock-in', auditAction({ module: 'Staff Attendance', action: 'CREATE' }), clockIn);
router.post('/clock-out', auditAction({ module: 'Staff Attendance', action: 'UPDATE' }), clockOut);
router.post('/cashier-sessions', auditAction({ module: 'Cashier Sessions', action: 'CREATE' }), openCashierSession);
router.post('/cashier-sessions/:id/close', auditAction({ module: 'Cashier Sessions', action: 'UPDATE' }), closeCashierSession);

module.exports = router;
