const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Inventory = require('../models/Inventory');
const SalesReturn = require('../models/SalesReturn');
const {
  isPositiveInteger,
  normalizeOptionalText
} = require('../utils/validation');

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getReturnedQuantityMap = async (billId, session) => {
  const returns = await SalesReturn.find({ bill: billId })
    .select('items.originalItemIndex items.returnQuantity')
    .session(session);

  return returns.reduce((acc, salesReturn) => {
    (salesReturn.items || []).forEach((item) => {
      const key = Number(item.originalItemIndex);
      acc.set(key, (acc.get(key) || 0) + Number(item.returnQuantity || 0));
    });
    return acc;
  }, new Map());
};

const validateSalesReturnPayload = (payload = {}) => {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const reason = normalizeOptionalText(payload.reason);
  const notes = normalizeOptionalText(payload.notes);
  const seenItemIndexes = new Set();

  if (!payload.billId) {
    throw createHttpError(400, 'Bill is required for sales return');
  }

  if (!items.length) {
    throw createHttpError(400, 'Select at least one item to return');
  }

  items.forEach((item, index) => {
    if (!Number.isInteger(Number(item.originalItemIndex)) || Number(item.originalItemIndex) < 0) {
      throw createHttpError(400, `Original bill item is invalid for row ${index + 1}`);
    }

    if (seenItemIndexes.has(Number(item.originalItemIndex))) {
      throw createHttpError(400, `Bill item ${Number(item.originalItemIndex) + 1} is included more than once`);
    }

    seenItemIndexes.add(Number(item.originalItemIndex));

    if (!isPositiveInteger(item.returnQuantity)) {
      throw createHttpError(400, `Return quantity must be greater than 0 for row ${index + 1}`);
    }
  });

  return {
    billId: payload.billId,
    reason,
    notes,
    items: items.map((item) => ({
      originalItemIndex: Number(item.originalItemIndex),
      returnQuantity: Number(item.returnQuantity)
    }))
  };
};

// @desc    Get sales returns
// @route   GET /api/sales-returns
// @access  Private
exports.getSalesReturns = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      search,
      billId,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (req.user.role === 'staff') {
      query.createdBy = req.user.id;
    }

    if (billId) {
      query.bill = billId;
    }

    if (startDate || endDate) {
      query.returnDate = {};
      if (startDate) {
        query.returnDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.returnDate.$lte = end;
      }
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { returnNumber: searchRegex },
        { invoiceNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const returns = await SalesReturn.find(query)
      .populate('bill', 'invoiceNumber billDate')
      .populate('createdBy', 'name')
      .sort({ returnDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await SalesReturn.countDocuments(query);

    res.status(200).json({
      success: true,
      count: returns.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      currentPage: pageNum,
      data: returns
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting sales returns',
      error: error.message
    });
  }
};

// @desc    Get single sales return
// @route   GET /api/sales-returns/:id
// @access  Private
exports.getSalesReturn = async (req, res) => {
  try {
    const salesReturn = await SalesReturn.findById(req.params.id)
      .populate('bill', 'invoiceNumber billDate customerName customerPhone')
      .populate('createdBy', 'name');

    if (!salesReturn) {
      return res.status(404).json({
        success: false,
        message: 'Sales return not found'
      });
    }

    if (req.user.role === 'staff' && salesReturn.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this sales return'
      });
    }

    res.status(200).json({
      success: true,
      data: salesReturn
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting sales return',
      error: error.message
    });
  }
};

// @desc    Create sales return
// @route   POST /api/sales-returns
// @access  Private
exports.createSalesReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      billId,
      items,
      reason,
      notes
    } = validateSalesReturnPayload(req.body);

    const bill = await Bill.findOne({
      _id: billId,
      isDeleted: false
    }).session(session);

    if (!bill) {
      throw createHttpError(404, 'Bill not found');
    }

    if (req.user.role === 'staff' && bill.createdBy.toString() !== req.user.id) {
      throw createHttpError(403, 'Not authorized to create sales return for this bill');
    }

    const returnedQuantityMap = await getReturnedQuantityMap(bill._id, session);
    const returnItems = [];

    for (const requestItem of items) {
      const originalItem = bill.items?.[requestItem.originalItemIndex];

      if (!originalItem) {
        throw createHttpError(400, `Bill item ${requestItem.originalItemIndex + 1} was not found`);
      }

      const originalQuantity = Number(originalItem.quantity || 0);
      const originalUnitQuantity = Number(originalItem.unitQuantity || 0);

      if (!isPositiveInteger(originalQuantity) || !isPositiveInteger(originalUnitQuantity)) {
        throw createHttpError(400, `Bill item ${requestItem.originalItemIndex + 1} is not returnable`);
      }

      const alreadyReturned = returnedQuantityMap.get(requestItem.originalItemIndex) || 0;
      const remainingQuantity = originalQuantity - alreadyReturned;

      if (requestItem.returnQuantity > remainingQuantity) {
        throw createHttpError(
          400,
          `Return quantity for ${originalItem.medicineName} exceeds remaining sale quantity (${remainingQuantity})`
        );
      }

      const unitMultiplier = originalUnitQuantity / originalQuantity;
      const returnUnitQuantity = Math.round(unitMultiplier * requestItem.returnQuantity);

      if (!isPositiveInteger(returnUnitQuantity)) {
        throw createHttpError(400, `Return quantity for ${originalItem.medicineName} is invalid`);
      }

      const inventoryQuery = {
        medicine: originalItem.medicine,
        isDeleted: { $ne: true }
      };

      if (originalItem.inventoryBatchId) {
        inventoryQuery._id = originalItem.inventoryBatchId;
      } else {
        inventoryQuery.batchNumber = {
          $regex: new RegExp(`^${String(originalItem.batchNumber).trim()}$`, 'i')
        };
      }

      const inventory = await Inventory.findOne(inventoryQuery).session(session);

      if (!inventory) {
        throw createHttpError(
          400,
          `Inventory batch ${originalItem.batchNumber} for ${originalItem.medicineName} was not found`
        );
      }

      inventory.quantityAvailable += returnUnitQuantity;
      await inventory.save({ session });

      const returnRatio = requestItem.returnQuantity / originalQuantity;
      const subtotalShare = roundCurrency(Number(originalItem.rate || 0) * requestItem.returnQuantity);
      const discountShare = bill.subtotal
        ? roundCurrency((Number(bill.discountAmount || 0) * subtotalShare) / Number(bill.subtotal || 1))
        : 0;

      returnItems.push({
        originalItemIndex: requestItem.originalItemIndex,
        medicine: originalItem.medicine,
        medicineName: originalItem.medicineName,
        brandName: originalItem.brandName,
        batchNumber: originalItem.batchNumber,
        inventoryBatchId: originalItem.inventoryBatchId || inventory._id,
        expiryDate: originalItem.expiryDate,
        originalQuantity,
        originalUnitQuantity,
        returnQuantity: requestItem.returnQuantity,
        returnUnitQuantity,
        rate: roundCurrency(Number(originalItem.rate || 0)),
        gstPercent: roundCurrency(Number(originalItem.gstPercent || 0)),
        cgstPercent: roundCurrency(Number(originalItem.cgstPercent || 0)),
        sgstPercent: roundCurrency(Number(originalItem.sgstPercent || 0)),
        igstPercent: roundCurrency(Number(originalItem.igstPercent || 0)),
        gstAmount: roundCurrency(Number(originalItem.gstAmount || 0) * returnRatio),
        cgstAmount: roundCurrency(Number(originalItem.cgstAmount || 0) * returnRatio),
        sgstAmount: roundCurrency(Number(originalItem.sgstAmount || 0) * returnRatio),
        igstAmount: roundCurrency(Number(originalItem.igstAmount || 0) * returnRatio),
        baseAmount: roundCurrency(Number(originalItem.baseAmount || 0) * returnRatio),
        discountAmount: discountShare,
        total: roundCurrency(Math.max(Number(originalItem.total || 0) * returnRatio - discountShare, 0))
      });

      returnedQuantityMap.set(
        requestItem.originalItemIndex,
        alreadyReturned + requestItem.returnQuantity
      );
    }

    const totals = returnItems.reduce(
      (acc, item) => {
        acc.subtotal += roundCurrency(item.rate * item.returnQuantity);
        acc.totalGst += item.gstAmount;
        acc.totalCgst += item.cgstAmount;
        acc.totalSgst += item.sgstAmount;
        acc.totalIgst += item.igstAmount;
        acc.discountAmount += item.discountAmount;
        acc.grandTotal += item.total;
        return acc;
      },
      {
        subtotal: 0,
        totalGst: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        discountAmount: 0,
        grandTotal: 0
      }
    );

    const returnNumber = await SalesReturn.generateReturnNumber();

    const [createdSalesReturn] = await SalesReturn.create(
      [
        {
          returnNumber,
          bill: bill._id,
          invoiceNumber: bill.invoiceNumber,
          customerName: bill.customerName || null,
          customerPhone: bill.customerPhone || null,
          reason,
          notes,
          items: returnItems,
          subtotal: roundCurrency(totals.subtotal),
          totalGst: roundCurrency(totals.totalGst),
          totalCgst: roundCurrency(totals.totalCgst),
          totalSgst: roundCurrency(totals.totalSgst),
          totalIgst: roundCurrency(totals.totalIgst),
          discountAmount: roundCurrency(totals.discountAmount),
          grandTotal: roundCurrency(totals.grandTotal),
          createdBy: req.user.id
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const populatedSalesReturn = await SalesReturn.findById(createdSalesReturn._id)
      .populate('bill', 'invoiceNumber billDate')
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      data: populatedSalesReturn
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Error creating sales return',
      error: error.message
    });
  }
};
