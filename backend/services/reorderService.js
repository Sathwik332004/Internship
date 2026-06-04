const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Medicine = require('../models/Medicine');
const Purchase = require('../models/Purchase');
const PurchaseOrder = require('../models/PurchaseOrder');
const Notification = require('../models/Notification');

/**
 * Gets the last purchase price for a medicine from the Purchase history.
 */
const getLastPurchasePrice = async (medicineId) => {
  const lastPurchase = await Purchase.findOne({
    'items.medicine': medicineId,
    isDeleted: false
  })
    .sort({ createdAt: -1 })
    .select('items');

  if (!lastPurchase) return 0;

  const item = lastPurchase.items.find(
    (i) => i.medicine.toString() === medicineId.toString()
  );
  return item?.purchasePrice || 0;
};

/**
 * Gets the last known supplier for a medicine from Inventory records.
 * Used as a fallback when no preferredSupplier is set on the medicine.
 */
const getLastSupplier = async (medicineId) => {
  const lastInventory = await Inventory.findOne({
    medicine: medicineId,
    isDeleted: false
  })
    .sort({ createdAt: -1 })
    .select('supplier')
    .populate('supplier', 'supplierName isActive isDeleted');

  if (!lastInventory?.supplier) return null;
  const s = lastInventory.supplier;
  // Only use if supplier is still active
  if (s.isActive === false) return null;
  return s;
};

/**
 * Core function: scans all medicines, finds those below reorder level,
 * groups them by supplier, and creates DRAFT PurchaseOrders.
 *
 * Deduplication: if an existing DRAFT PO already contains items for a
 * medicine, we skip that medicine (don't create duplicates).
 *
 * Returns a summary of what was created.
 */
const checkAndCreateReorderPOs = async () => {
  // 1. Aggregate total stock per medicine (ACTIVE batches only)
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
    }
  ]);

  const stockMap = new Map(
    stockTotals.map((s) => [s._id.toString(), s.totalQuantity])
  );

  // 2. Fetch all active medicines that have reorderLevel set
  const medicines = await Medicine.find({
    isDeleted: false,
    status: 'ACTIVE',
    reorderLevel: { $gt: 0 }
  })
    .select('medicineName brandName reorderLevel preferredSupplier sellingUnit baseUnit')
    .populate('preferredSupplier', 'supplierName isActive');

  // 3. Find medicines that need reordering
  const needsReorder = medicines.filter((med) => {
    const stock = stockMap.get(med._id.toString()) ?? 0;
    return stock <= med.reorderLevel;
  });

  if (needsReorder.length === 0) {
    return { createdCount: 0, skippedCount: 0, itemCount: 0 };
  }

  // 4. Find medicine IDs already in existing DRAFT POs (to avoid duplicates)
  const existingDraftPOs = await PurchaseOrder.find({
    status: 'DRAFT',
    isDeleted: false
  }).select('items.medicine');

  const alreadyInDraft = new Set(
    existingDraftPOs.flatMap((po) =>
      po.items.map((item) => item.medicine.toString())
    )
  );

  // 5. Filter out medicines already covered by existing draft POs
  const toProcess = needsReorder.filter(
    (med) => !alreadyInDraft.has(med._id.toString())
  );

  if (toProcess.length === 0) {
    return { createdCount: 0, skippedCount: needsReorder.length, itemCount: 0 };
  }

  // 6. Group by supplier (preferredSupplier → lastSupplier → 'NO_SUPPLIER')
  const supplierGroups = new Map(); // supplierId → { supplier, items[] }

  for (const med of toProcess) {
    let supplier = null;

    // Use preferredSupplier if set and active
    if (med.preferredSupplier && med.preferredSupplier.isActive !== false) {
      supplier = med.preferredSupplier;
    } else {
      // Fall back to last supplier from purchase history
      supplier = await getLastSupplier(med._id);
    }

    const supplierId = supplier ? supplier._id.toString() : 'NO_SUPPLIER';

    if (!supplierGroups.has(supplierId)) {
      supplierGroups.set(supplierId, { supplier, items: [] });
    }

    const currentStock = stockMap.get(med._id.toString()) ?? 0;
    const lastPurchasePrice = await getLastPurchasePrice(med._id);

    // Default reorder quantity: enough to bring stock to 2× reorder level
    const requestedQty = Math.max(med.reorderLevel * 2 - currentStock, med.reorderLevel, 1);

    supplierGroups.get(supplierId).items.push({
      medicine: med._id,
      medicineName: med.medicineName,
      brandName: med.brandName || '',
      currentStock,
      reorderLevel: med.reorderLevel,
      requestedQty,
      lastPurchasePrice,
      unit: med.sellingUnit || med.baseUnit || null
    });
  }

  // 7. Create one PO per supplier group
  let createdCount = 0;
  const notificationOps = [];

  for (const [, group] of supplierGroups) {
    const poNumber = await PurchaseOrder.generatePONumber();

    const po = await PurchaseOrder.create({
      poNumber,
      supplier: group.supplier?._id || null,
      supplierName: group.supplier?.supplierName || 'Unassigned',
      status: 'DRAFT',
      items: group.items,
      generatedBy: 'AUTO'
    });

    createdCount++;

    // Queue a notification for this PO
    const itemList = group.items
      .slice(0, 3)
      .map((i) => i.medicineName)
      .join(', ');
    const extra = group.items.length > 3 ? ` +${group.items.length - 3} more` : '';

    notificationOps.push({
      updateOne: {
        filter: { type: 'LOW_STOCK', referenceId: po._id },
        update: {
          $setOnInsert: {
            type: 'LOW_STOCK',
            title: `Auto PO created — ${group.supplier?.supplierName || 'Unassigned'}`,
            message: `Draft purchase order ${poNumber} created for ${group.items.length} low-stock item(s): ${itemList}${extra}.`,
            referenceId: po._id,
            isRead: false,
            createdAt: new Date()
          }
        },
        upsert: true
      }
    });
  }

  // 8. Bulk-write notifications
  if (notificationOps.length > 0) {
    await Notification.bulkWrite(notificationOps, { ordered: false });
  }

  return {
    createdCount,
    skippedCount: needsReorder.length - toProcess.length,
    itemCount: toProcess.length
  };
};

module.exports = { checkAndCreateReorderPOs };
