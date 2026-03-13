const Inventory = require('../models/Inventory');
const InventoryDisposal = require('../models/InventoryDisposal');

const normalizeQuantity = (value) => {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : NaN;
};

const disposeInventoryQuantity = async ({
  inventory,
  quantity,
  disposalReason,
  source = 'MANUAL',
  notes = '',
  disposedBy = null,
  disposedAt = new Date(),
  session = null
}) => {
  if (!inventory) {
    throw new Error('Inventory batch is required for disposal');
  }

  const quantityToDispose = normalizeQuantity(quantity);
  if (!Number.isFinite(quantityToDispose) || quantityToDispose <= 0) {
    throw new Error('Disposal quantity must be greater than 0');
  }

  if (quantityToDispose > inventory.quantityAvailable) {
    throw new Error('Disposal quantity cannot exceed available stock');
  }

  const now = new Date();
  let nextStatus = 'ACTIVE';

  if ((inventory.quantityAvailable - quantityToDispose) <= 0) {
    nextStatus = 'DISPOSED';
  } else if (inventory.expiryDate < now) {
    nextStatus = 'EXPIRED';
  }

  const inventoryBeforeUpdate = await Inventory.findOneAndUpdate(
    {
      _id: inventory._id,
      quantityAvailable: { $gte: quantityToDispose },
      isDeleted: false
    },
    {
      $inc: {
        quantityAvailable: -quantityToDispose,
        quantityDisposed: quantityToDispose
      },
      $set: {
        status: nextStatus
      }
    },
    {
      new: false,
      session
    }
  );

  if (!inventoryBeforeUpdate) {
    throw new Error('Inventory batch no longer has enough stock to dispose');
  }

  const updatedInventory = await Inventory.findById(inventory._id).session(session);
  const quantityBefore = inventoryBeforeUpdate.quantityAvailable;

  const [record] = await InventoryDisposal.create([{
    inventory: inventory._id,
    medicine: inventory.medicine,
    supplier: inventory.supplier || null,
    purchase: inventory.purchase || null,
    batchNumber: inventory.batchNumber,
    expiryDate: inventory.expiryDate,
    quantityDisposed: quantityToDispose,
    quantityBefore,
    quantityAfter: updatedInventory.quantityAvailable,
    purchasePrice: inventory.purchasePrice || 0,
    mrp: inventory.mrp || 0,
    disposalReason,
    source,
    notes,
    disposedAt,
    disposedBy
  }], { session });

  return {
    inventory: updatedInventory,
    disposal: record
  };
};

const autoDisposeExpiredInventory = async ({ session = null } = {}) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  let query = Inventory.find({
    isDeleted: false,
    quantityAvailable: { $gt: 0 },
    expiryDate: { $lt: startOfToday }
  });

  if (session) {
    query = query.session(session);
  }

  const expiredInventory = await query;

  let disposedCount = 0;
  let disposedUnits = 0;

  for (const inventory of expiredInventory) {
    const quantity = inventory.quantityAvailable;

    try {
      await disposeInventoryQuantity({
        inventory,
        quantity,
        disposalReason: 'EXPIRED',
        source: 'AUTO_EXPIRY',
        notes: 'Auto-disposed after batch expiry',
        session
      });
    } catch (error) {
      if (error.message === 'Inventory batch no longer has enough stock to dispose') {
        continue;
      }

      throw error;
    }

    disposedCount += 1;
    disposedUnits += quantity;
  }

  return {
    disposedCount,
    disposedUnits
  };
};

module.exports = {
  disposeInventoryQuantity,
  autoDisposeExpiredInventory
};
