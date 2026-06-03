const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

const ACTION_LABELS = {
  CREATE: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted'
};

const getEntityId = (req, responseBody) => {
  const responseData = responseBody?.data || responseBody;
  const candidate = req.params?.id
    || req.params?.userId
    || req.params?.medicineId
    || req.body?.id
    || responseData?._id
    || responseData?.id
    || responseBody?._id
    || responseBody?.id;

  if (candidate === undefined || candidate === null) {
    return '';
  }

  return typeof candidate === 'string' ? candidate : candidate.toString();
};

const recordAuditLog = async ({ req, action, module, responseBody, entityId, details }) => {
  const user = req.user;

  if (!user?._id || !action || !module) {
    return;
  }

  const resolvedEntityId = entityId !== undefined ? entityId : getEntityId(req, responseBody);

  try {
    const auditLog = await AuditLog.create({
      user: user._id,
      userName: user.name || user.email || 'Unknown user',
      userEmail: user.email || '',
      userRole: user.role || '',
      action,
      module,
      entityId: resolvedEntityId,
      method: req.method,
      path: req.originalUrl || req.url || '',
      statusCode: req.res?.statusCode || 200,
      details: details || null,
      createdAt: new Date()
    });

    if (module !== 'Notifications') {
      const actionLabel = ACTION_LABELS[action] || action.toLowerCase();
      const actor = user.name || user.email || 'A user';
      const entityText = resolvedEntityId ? ` Reference: ${resolvedEntityId}.` : '';

      await Notification.create({
        type: 'APPLICATION_STATE_CHANGE',
        title: `${module} ${actionLabel}`,
        message: `${actor} ${actionLabel} ${module}.${entityText}`,
        referenceId: auditLog._id,
        createdAt: auditLog.createdAt
      });
    }
  } catch (error) {
    console.error('Failed to record audit log:', error.message);
  }
};

const auditAction = ({ module, action, entityIdResolver, detailsResolver } = {}) => {
  return (req, res, next) => {
    if (!module || !action) {
      return next();
    }

    let logged = false;
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const finalize = (responseBody) => {
      if (logged) {
        return;
      }

      logged = true;

      if (res.statusCode >= 400) {
        return;
      }

      let entityId;
      let details;

      try {
        entityId = typeof entityIdResolver === 'function'
          ? entityIdResolver(req, responseBody)
          : getEntityId(req, responseBody);
      } catch (error) {
        entityId = getEntityId(req, responseBody);
      }

      try {
        details = typeof detailsResolver === 'function'
          ? detailsResolver(req, responseBody)
          : undefined;
      } catch (error) {
        details = undefined;
      }

      void recordAuditLog({
        req,
        action,
        module,
        responseBody,
        entityId,
        details
      });
    };

    res.json = function patchedJson(body) {
      finalize(body);
      return originalJson(body);
    };

    res.send = function patchedSend(body) {
      finalize(body);
      return originalSend(body);
    };

    next();
  };
};

module.exports = {
  auditAction,
  recordAuditLog
};
