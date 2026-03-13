const { autoDisposeExpiredInventory } = require('../services/inventoryDisposalService');

exports.syncExpiredInventory = async (req, res, next) => {
  try {
    await autoDisposeExpiredInventory();
    next();
  } catch (error) {
    next(error);
  }
};
