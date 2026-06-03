const mongoose = require('mongoose');
const StaffAttendance = require('../models/StaffAttendance');
const CashierSession = require('../models/CashierSession');
const Bill = require('../models/Bill');

const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

const getScopedStaffQuery = (req, field = 'staff') => {
  if (req.user.role === 'staff') {
    return { [field]: req.user._id };
  }

  if (req.query.staff) {
    return { [field]: req.query.staff };
  }

  return {};
};

const getActiveAttendance = async (user) => {
  const todayKey = getDateKey();
  return StaffAttendance.findOne({
    staff: user._id,
    dateKey: todayKey,
    status: 'PRESENT'
  });
};

exports.getAttendanceOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateMatch = {};

    if (startDate) dateMatch.$gte = startDate;
    if (endDate) dateMatch.$lte = endDate;

    const attendanceQuery = {
      ...getScopedStaffQuery(req),
      ...(Object.keys(dateMatch).length ? { dateKey: dateMatch } : {})
    };

    const sessionQuery = {
      ...getScopedStaffQuery(req),
      ...(startDate || endDate ? { openedAt: {} } : {})
    };

    if (startDate) sessionQuery.openedAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      sessionQuery.openedAt.$lte = end;
    }

    const [records, sessions, activeAttendance, activeSession] = await Promise.all([
      StaffAttendance.find(attendanceQuery).sort({ dateKey: -1, checkInAt: -1 }).limit(100),
      CashierSession.find(sessionQuery).sort({ openedAt: -1 }).limit(100),
      req.user.role === 'staff' ? getActiveAttendance(req.user) : null,
      CashierSession.findOne({ staff: req.user._id, status: 'OPEN' }).sort({ openedAt: -1 })
    ]);

    const sessionIds = sessions.map((session) => session._id);
    const salesBySession = sessionIds.length
      ? await Bill.aggregate([
        {
          $match: {
            cashierSession: { $in: sessionIds },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: '$cashierSession',
            billCount: { $sum: 1 },
            totalSales: { $sum: '$grandTotal' }
          }
        }
      ])
      : [];

    const sessionSalesMap = salesBySession.reduce((acc, item) => {
      acc.set(String(item._id), {
        billCount: item.billCount,
        totalSales: roundCurrency(item.totalSales)
      });
      return acc;
    }, new Map());

    const enrichedSessions = sessions.map((session) => {
      const sessionObject = session.toObject();
      const sales = sessionSalesMap.get(String(session._id)) || {
        billCount: Number(session.billCount || 0),
        totalSales: roundCurrency(session.totalSales)
      };
      return { ...sessionObject, ...sales };
    });

    const summary = {
      attendanceRecords: records.length,
      presentNow: records.filter((record) => record.status === 'PRESENT').length,
      openSessions: enrichedSessions.filter((session) => session.status === 'OPEN').length,
      totalBillsHandled: enrichedSessions.reduce((sum, session) => sum + Number(session.billCount || 0), 0),
      totalSessionSales: roundCurrency(enrichedSessions.reduce((sum, session) => sum + Number(session.totalSales || 0), 0))
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        attendance: records,
        sessions: enrichedSessions,
        activeAttendance,
        activeSession
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting staff attendance overview',
      error: error.message
    });
  }
};

exports.clockIn = async (req, res) => {
  try {
    const todayKey = getDateKey();
    const existing = await StaffAttendance.findOne({
      staff: req.user._id,
      dateKey: todayKey
    });

    if (existing && existing.status === 'PRESENT') {
      return res.status(400).json({
        success: false,
        message: 'Staff is already clocked in'
      });
    }

    if (existing && existing.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Attendance for today is already completed'
      });
    }

    const attendance = await StaffAttendance.create({
      staff: req.user._id,
      staffName: req.user.name || req.user.email,
      dateKey: todayKey,
      shiftName: req.body.shiftName || 'General',
      scheduledStart: req.body.scheduledStart || '',
      scheduledEnd: req.body.scheduledEnd || '',
      notes: req.body.notes || '',
      checkInAt: new Date(),
      status: 'PRESENT'
    });

    res.status(201).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error clocking in',
      error: error.message
    });
  }
};

exports.clockOut = async (req, res) => {
  try {
    const attendance = await getActiveAttendance(req.user);

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No active attendance found for today'
      });
    }

    const openSession = await CashierSession.findOne({
      staff: req.user._id,
      status: 'OPEN'
    });

    if (openSession) {
      return res.status(400).json({
        success: false,
        message: 'Close the active cashier session before clocking out'
      });
    }

    attendance.checkOutAt = new Date();
    attendance.status = 'COMPLETED';
    attendance.notes = req.body.notes ?? attendance.notes;
    await attendance.save();

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error clocking out',
      error: error.message
    });
  }
};

exports.openCashierSession = async (req, res) => {
  try {
    const existingSession = await CashierSession.findOne({
      staff: req.user._id,
      status: 'OPEN'
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: 'A cashier session is already open'
      });
    }

    let attendance = await getActiveAttendance(req.user);
    if (!attendance) {
      attendance = await StaffAttendance.create({
        staff: req.user._id,
        staffName: req.user.name || req.user.email,
        dateKey: getDateKey(),
        shiftName: req.body.shiftName || 'General',
        checkInAt: new Date(),
        status: 'PRESENT'
      });
    }

    const session = await CashierSession.create({
      staff: req.user._id,
      staffName: req.user.name || req.user.email,
      attendance: attendance._id,
      openingCash: Number(req.body.openingCash || 0),
      notes: req.body.notes || '',
      status: 'OPEN'
    });

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error opening cashier session',
      error: error.message
    });
  }
};

exports.closeCashierSession = async (req, res) => {
  try {
    const sessionId = req.params.id;
    const query = mongoose.Types.ObjectId.isValid(sessionId)
      ? { _id: sessionId }
      : { staff: req.user._id, status: 'OPEN' };

    if (req.user.role === 'staff') {
      query.staff = req.user._id;
    }

    const session = await CashierSession.findOne(query);

    if (!session || session.status !== 'OPEN') {
      return res.status(404).json({
        success: false,
        message: 'Open cashier session not found'
      });
    }

    const sales = await Bill.aggregate([
      {
        $match: {
          cashierSession: session._id,
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          billCount: { $sum: 1 },
          totalSales: { $sum: '$grandTotal' }
        }
      }
    ]);

    const totals = sales[0] || { billCount: 0, totalSales: 0 };
    session.closedAt = new Date();
    session.status = 'CLOSED';
    session.closingCash = Number(req.body.closingCash || 0);
    session.notes = req.body.notes ?? session.notes;
    session.billCount = Number(totals.billCount || 0);
    session.totalSales = roundCurrency(totals.totalSales);
    await session.save();

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error closing cashier session',
      error: error.message
    });
  }
};
