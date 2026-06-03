const Notification = require('../models/Notification');
const Inventory = require('../models/Inventory');
const Medicine = require('../models/Medicine');
const Bill = require('../models/Bill');
const AuditLog = require('../models/AuditLog');

const ACTION_LABELS = {
  CREATE: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted'
};

const buildStateChangeNotification = (auditLog) => {
  const actionLabel = ACTION_LABELS[auditLog.action] || auditLog.action.toLowerCase();
  const actor = auditLog.userName || auditLog.userEmail || 'A user';
  const entityText = auditLog.entityId ? ` Reference: ${auditLog.entityId}.` : '';

  return {
    type: 'APPLICATION_STATE_CHANGE',
    title: `${auditLog.module} ${actionLabel}`,
    message: `${actor} ${actionLabel} ${auditLog.module}.${entityText}`,
    referenceId: auditLog._id,
    createdAt: auditLog.createdAt
  };
};

const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const daysBetween = (fromDate, toDate) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((new Date(toDate) - new Date(fromDate)) / msPerDay);
};

const queueNotification = (operations, queuedKeys, notification) => {
  if (!notification.referenceId) {
    return;
  }

  const key = `${notification.type}:${notification.referenceId.toString()}`;
  if (queuedKeys.has(key)) {
    return;
  }

  queuedKeys.add(key);
  operations.push({
    updateOne: {
      filter: {
        type: notification.type,
        referenceId: notification.referenceId
      },
      update: {
        $setOnInsert: notification
      },
      upsert: true
    }
  });
};

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
      data: notifications
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting notifications',
      error: error.message
    });
  }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      modifiedCount: result.modifiedCount || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read',
      error: error.message
    });
  }
};

// @desc    Generate inventory, payment, and application state notifications
// @route   POST /api/notifications/generate
// @access  Private
exports.generateNotifications = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const warningDate = new Date(startOfToday);
    warningDate.setDate(warningDate.getDate() + 30);

    const operations = [];
    const queuedKeys = new Set();

    const stockTotals = await Inventory.aggregate([
      {
        $match: {
          isDeleted: false,
          status: 'ACTIVE',
          quantityAvailable: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' }
        }
      },
      {
        $match: {
          totalQuantity: { $lt: 10 }
        }
      }
    ]);

    const medicineIds = stockTotals.map((item) => item._id).filter(Boolean);
    const medicines = await Medicine.find({
      _id: { $in: medicineIds },
      isDeleted: false
    }).select('medicineName brandName');

    const medicineMap = medicines.reduce((acc, medicine) => {
      acc.set(medicine._id.toString(), medicine);
      return acc;
    }, new Map());

    stockTotals.forEach((item) => {
      const medicine = medicineMap.get(item._id.toString());
      const medicineName = medicine
        ? `${medicine.medicineName}${medicine.brandName ? ` (${medicine.brandName})` : ''}`
        : 'Medicine';

      queueNotification(operations, queuedKeys, {
        type: 'LOW_STOCK',
        title: 'Low stock alert',
        message: `${medicineName} has only ${item.totalQuantity} units available. Please reorder soon.`,
        referenceId: item._id,
        createdAt: now
      });
    });

    const expiringInventory = await Inventory.find({
      isDeleted: false,
      quantityAvailable: { $gt: 0 },
      expiryDate: { $gte: startOfToday, $lte: warningDate },
      status: 'ACTIVE'
    })
      .populate('medicine', 'medicineName brandName')
      .sort({ expiryDate: 1 });

    expiringInventory.forEach((item) => {
      const medicineName = item.medicine
        ? `${item.medicine.medicineName}${item.medicine.brandName ? ` (${item.medicine.brandName})` : ''}`
        : 'Medicine';
      const daysUntilExpiry = Math.max(daysBetween(startOfToday, item.expiryDate), 0);

      queueNotification(operations, queuedKeys, {
        type: 'EXPIRY_WARNING',
        title: 'Expiry warning',
        message: `${medicineName} batch ${item.batchNumber || 'N/A'} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} on ${formatDate(item.expiryDate)}.`,
        referenceId: item.medicine?._id || item.medicine,
        createdAt: now
      });
    });

    const expiredInventory = await Inventory.find({
      isDeleted: false,
      quantityAvailable: { $gt: 0 },
      expiryDate: { $lt: startOfToday }
    })
      .populate('medicine', 'medicineName brandName')
      .sort({ expiryDate: 1 });

    expiredInventory.forEach((item) => {
      const medicineName = item.medicine
        ? `${item.medicine.medicineName}${item.medicine.brandName ? ` (${item.medicine.brandName})` : ''}`
        : 'Medicine';

      queueNotification(operations, queuedKeys, {
        type: 'EXPIRED',
        title: 'Expired medicine',
        message: `${medicineName} batch ${item.batchNumber || 'N/A'} expired on ${formatDate(item.expiryDate)}.`,
        referenceId: item.medicine?._id || item.medicine,
        createdAt: now
      });
    });

    const pendingBills = await Bill.find({
      isDeleted: false,
      balance: { $lt: 0 }
    }).select('invoiceNumber customerName customerPhone balance billDate');

    pendingBills.forEach((bill) => {
      const pendingAmount = Math.abs(Number(bill.balance || 0));
      const customerName = bill.customerName || bill.customerPhone || 'Walk-in customer';

      queueNotification(operations, queuedKeys, {
        type: 'PENDING_PAYMENT',
        title: 'Pending payment',
        message: `${customerName} has Rs. ${pendingAmount.toFixed(2)} pending on invoice ${bill.invoiceNumber}.`,
        referenceId: bill._id,
        createdAt: now
      });
    });

    const auditLogs = await AuditLog.find({
      module: { $ne: 'Notifications' }
    })
      .sort({ createdAt: -1 })
      .limit(200);

    auditLogs.forEach((auditLog) => {
      queueNotification(operations, queuedKeys, buildStateChangeNotification(auditLog));
    });

    const result = operations.length > 0
      ? await Notification.bulkWrite(operations, { ordered: false })
      : { upsertedCount: 0 };

    const notifications = await Notification.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Notifications generated successfully',
      generatedCount: result.upsertedCount || 0,
      count: notifications.length,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
      data: notifications
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error generating notifications',
      error: error.message
    });
  }
};
