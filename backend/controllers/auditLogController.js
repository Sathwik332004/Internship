const AuditLog = require('../models/AuditLog');

const buildQuery = (query = {}) => {
  const filter = {};

  if (query.action) {
    filter.action = query.action;
  }

  if (query.module) {
    filter.module = query.module;
  }

  if (query.user) {
    filter.$or = [
      { userName: { $regex: query.user, $options: 'i' } },
      { userEmail: { $regex: query.user, $options: 'i' } }
    ];
  }

  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { userName: searchRegex },
        { userEmail: searchRegex },
        { module: searchRegex },
        { action: searchRegex },
        { entityId: searchRegex },
        { path: searchRegex }
      ]
    });
  }

  if (query.startDate || query.endDate) {
    filter.createdAt = {};

    if (query.startDate) {
      filter.createdAt.$gte = new Date(query.startDate);
    }

    if (query.endDate) {
      const endDate = new Date(query.endDate);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endDate;
    }
  }

  return filter;
};

// @desc    Get audit logs
// @route   GET /api/audit-logs
// @access  Private/Admin
exports.getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '25', 10), 1), 100);
    const query = buildQuery(req.query);
    const skip = (page - 1) * limit;

    const [logs, total, summaryResult, modules] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(query),
      AuditLog.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            createCount: {
              $sum: { $cond: [{ $eq: ['$action', 'CREATE'] }, 1, 0] }
            },
            updateCount: {
              $sum: { $cond: [{ $eq: ['$action', 'UPDATE'] }, 1, 0] }
            },
            deleteCount: {
              $sum: { $cond: [{ $eq: ['$action', 'DELETE'] }, 1, 0] }
            }
          }
        }
      ]),
      AuditLog.distinct('module', query)
    ]);

    const summary = summaryResult[0] || {
      total: 0,
      createCount: 0,
      updateCount: 0,
      deleteCount: 0
    };

    res.status(200).json({
      success: true,
      count: logs.length,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      },
      summary,
      modules: modules.filter(Boolean).sort(),
      data: logs
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting audit logs',
      error: error.message
    });
  }
};