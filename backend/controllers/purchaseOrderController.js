const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Medicine = require('../models/Medicine');
const { checkAndCreateReorderPOs } = require('../services/reorderService');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private
exports.getPurchaseOrders = async (req, res) => {
  try {
    const { status, supplier, search, page = 1, limit = 20 } = req.query;

    const query = { isDeleted: false };

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (supplier) {
      query.supplier = supplier;
    }

    if (search) {
      const esc = escapeRegex(search);
      query.$or = [
        { poNumber: { $regex: esc, $options: 'i' } },
        { supplierName: { $regex: esc, $options: 'i' } },
        { 'items.medicineName': { $regex: esc, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const [purchaseOrders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('supplier', 'supplierName phone email')
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      PurchaseOrder.countDocuments(query)
    ]);

    // Status summary counts
    const statusCounts = await PurchaseOrder.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const counts = { ALL: 0, DRAFT: 0, APPROVED: 0, SENT: 0, CANCELLED: 0 };
    statusCounts.forEach(({ _id, count }) => {
      counts[_id] = count;
      counts.ALL += count;
    });

    res.status(200).json({
      success: true,
      count: purchaseOrders.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      statusCounts: counts,
      data: purchaseOrders
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching purchase orders', error: error.message });
  }
};

// @desc    Get single purchase order
// @route   GET /api/purchase-orders/:id
// @access  Private
exports.getPurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false })
      .populate('supplier', 'supplierName phone email address gstNumber')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('items.medicine', 'medicineName brandName reorderLevel sellingUnit');

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    res.status(200).json({ success: true, data: po });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching purchase order', error: error.message });
  }
};

// @desc    Create a manual purchase order
// @route   POST /api/purchase-orders
// @access  Private/Admin
exports.createPurchaseOrder = async (req, res) => {
  try {
    const { supplierId, items, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    // Validate supplier if provided
    let supplier = null;
    if (supplierId) {
      supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false });
      if (!supplier) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
      }
    }

    // Validate and enrich items
    const enrichedItems = [];
    for (const item of items) {
      if (!item.medicineId || !item.requestedQty || item.requestedQty < 1) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have a valid medicineId and requestedQty >= 1'
        });
      }
      const med = await Medicine.findOne({ _id: item.medicineId, isDeleted: false });
      if (!med) {
        return res.status(404).json({ success: false, message: `Medicine ${item.medicineId} not found` });
      }
      enrichedItems.push({
        medicine: med._id,
        medicineName: med.medicineName,
        brandName: med.brandName || '',
        currentStock: item.currentStock ?? 0,
        reorderLevel: med.reorderLevel ?? 0,
        requestedQty: item.requestedQty,
        lastPurchasePrice: item.lastPurchasePrice ?? 0,
        unit: med.sellingUnit || med.baseUnit || null
      });
    }

    const poNumber = await PurchaseOrder.generatePONumber();

    const po = await PurchaseOrder.create({
      poNumber,
      supplier: supplier?._id || null,
      supplierName: supplier?.supplierName || 'Unassigned',
      status: 'DRAFT',
      items: enrichedItems,
      notes,
      generatedBy: 'MANUAL',
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: po });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error creating purchase order', error: error.message });
  }
};

// @desc    Update a DRAFT purchase order (items qty, notes, supplier)
// @route   PUT /api/purchase-orders/:id
// @access  Private/Admin
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false });

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (po.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Only DRAFT purchase orders can be edited' });
    }

    const { supplierId, items, notes } = req.body;

    // Update supplier if provided
    if (supplierId !== undefined) {
      if (supplierId) {
        const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false });
        if (!supplier) {
          return res.status(404).json({ success: false, message: 'Supplier not found' });
        }
        po.supplier = supplier._id;
        po.supplierName = supplier.supplierName;
      } else {
        po.supplier = null;
        po.supplierName = 'Unassigned';
      }
    }

    // Update item quantities
    if (items && Array.isArray(items)) {
      for (const update of items) {
        const poItem = po.items.id(update.itemId);
        if (poItem) {
          if (update.requestedQty !== undefined) {
            if (update.requestedQty < 1) {
              return res.status(400).json({ success: false, message: 'requestedQty must be >= 1' });
            }
            poItem.requestedQty = update.requestedQty;
          }
        }
      }
    }

    if (notes !== undefined) po.notes = notes;

    await po.save();

    res.status(200).json({ success: true, data: po });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error updating purchase order', error: error.message });
  }
};

// @desc    Approve a DRAFT purchase order
// @route   PUT /api/purchase-orders/:id/approve
// @access  Private/Admin
exports.approvePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false });

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (po.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: `Cannot approve a PO with status ${po.status}` });
    }

    po.status = 'APPROVED';
    po.approvedBy = req.user._id;
    po.approvedAt = new Date();

    await po.save();

    const populated = await PurchaseOrder.findById(po._id)
      .populate('supplier', 'supplierName phone email')
      .populate('approvedBy', 'name email');

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error approving purchase order', error: error.message });
  }
};

// @desc    Mark an APPROVED purchase order as SENT (to supplier)
// @route   PUT /api/purchase-orders/:id/send
// @access  Private/Admin
exports.markPurchaseOrderSent = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false });

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (po.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: `Only APPROVED orders can be marked as SENT` });
    }

    po.status = 'SENT';
    await po.save();

    res.status(200).json({ success: true, data: po });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error updating purchase order', error: error.message });
  }
};

// @desc    Cancel a purchase order (DRAFT or APPROVED only)
// @route   PUT /api/purchase-orders/:id/cancel
// @access  Private/Admin
exports.cancelPurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false });

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (!['DRAFT', 'APPROVED'].includes(po.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a PO with status ${po.status}` });
    }

    po.status = 'CANCELLED';
    await po.save();

    res.status(200).json({ success: true, data: po });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error cancelling purchase order', error: error.message });
  }
};

// @desc    Delete (soft) a CANCELLED purchase order
// @route   DELETE /api/purchase-orders/:id
// @access  Private/Admin
exports.deletePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false });

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (!['CANCELLED', 'DRAFT'].includes(po.status)) {
      return res.status(400).json({ success: false, message: 'Only DRAFT or CANCELLED orders can be deleted' });
    }

    po.isDeleted = true;
    await po.save();

    res.status(200).json({ success: true, message: 'Purchase order deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting purchase order', error: error.message });
  }
};

// @desc    Manually trigger the reorder check
// @route   POST /api/purchase-orders/run-reorder
// @access  Private/Admin
exports.runReorderCheck = async (req, res) => {
  try {
    const result = await checkAndCreateReorderPOs();

    res.status(200).json({
      success: true,
      message: result.createdCount > 0
        ? `Created ${result.createdCount} draft PO(s) covering ${result.itemCount} low-stock item(s). ${result.skippedCount} item(s) already had pending POs.`
        : `No new POs needed. ${result.skippedCount} item(s) already have pending draft POs.`,
      data: result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error running reorder check', error: error.message });
  }
};

// @desc    Remove a single item from a DRAFT PO
// @route   DELETE /api/purchase-orders/:id/items/:itemId
// @access  Private/Admin
exports.removeItem = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false });

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (po.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Only DRAFT orders can be edited' });
    }

    const itemIndex = po.items.findIndex((i) => i._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in this purchase order' });
    }

    if (po.items.length === 1) {
      return res.status(400).json({ success: false, message: 'A purchase order must have at least one item' });
    }

    po.items.splice(itemIndex, 1);
    await po.save();

    res.status(200).json({ success: true, data: po });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error removing item', error: error.message });
  }
};
