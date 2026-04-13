const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Purchase = require('../models/Purchase');
const PurchaseReturn = require('../models/PurchaseReturn');
const Supplier = require('../models/Supplier');
const {
  isNonNegativeInteger,
  normalizeOptionalText
} = require('../utils/validation');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getReturnedQuantityMap = async (purchaseId, session) => {
  const returns = await PurchaseReturn.find({ purchase: purchaseId })
    .select('items.originalItemIndex items.returnQuantity items.returnFreeQuantity')
    .session(session);

  return returns.reduce((acc, purchaseReturn) => {
    (purchaseReturn.items || []).forEach((item) => {
      const key = Number(item.originalItemIndex);
      const current = acc.get(key) || { quantity: 0, freeQuantity: 0 };

      acc.set(key, {
        quantity: current.quantity + Number(item.returnQuantity || 0),
        freeQuantity: current.freeQuantity + Number(item.returnFreeQuantity || 0)
      });
    });

    return acc;
  }, new Map());
};

const validatePurchaseReturnPayload = (payload = {}) => {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const reason = normalizeOptionalText(payload.reason);
  const notes = normalizeOptionalText(payload.notes);
  const seenItemIndexes = new Set();

  if (!payload.purchaseId) {
    throw createHttpError(400, 'Purchase is required for purchase return');
  }

  if (!items.length) {
    throw createHttpError(400, 'Select at least one item to return');
  }

  items.forEach((item, index) => {
    const originalItemIndex = Number(item.originalItemIndex);
    const returnQuantity = Number(item.returnQuantity || 0);
    const returnFreeQuantity = Number(item.returnFreeQuantity || 0);

    if (!Number.isInteger(originalItemIndex) || originalItemIndex < 0) {
      throw createHttpError(400, `Original purchase item is invalid for row ${index + 1}`);
    }

    if (seenItemIndexes.has(originalItemIndex)) {
      throw createHttpError(400, `Purchase item ${originalItemIndex + 1} is included more than once`);
    }

    seenItemIndexes.add(originalItemIndex);

    if (!isNonNegativeInteger(returnQuantity) || !isNonNegativeInteger(returnFreeQuantity)) {
      throw createHttpError(400, `Return quantities must be whole numbers for row ${index + 1}`);
    }

    if (returnQuantity <= 0 && returnFreeQuantity <= 0) {
      throw createHttpError(400, `Enter a return quantity or free return quantity for row ${index + 1}`);
    }
  });

  return {
    purchaseId: payload.purchaseId,
    reason,
    notes,
    items: items.map((item) => ({
      originalItemIndex: Number(item.originalItemIndex),
      returnQuantity: Number(item.returnQuantity || 0),
      returnFreeQuantity: Number(item.returnFreeQuantity || 0)
    }))
  };
};

exports.getPurchaseReturns = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      search,
      purchaseId,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (purchaseId) {
      query.purchase = purchaseId;
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
      const searchRegex = new RegExp(escapeRegex(String(search).trim()), 'i');
      query.$or = [
        { returnNumber: searchRegex },
        { purchaseNumber: searchRegex },
        { supplierInvoiceNumber: searchRegex },
        { supplierName: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const returns = await PurchaseReturn.find(query)
      .populate('purchase', 'purchaseNumber purchaseDate')
      .populate('supplier', 'supplierName')
      .populate('createdBy', 'name')
      .sort({ returnDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await PurchaseReturn.countDocuments(query);

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
      message: 'Error getting purchase returns',
      error: error.message
    });
  }
};

exports.getPurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.id)
      .populate('purchase', 'purchaseNumber purchaseDate supplierInvoiceNumber')
      .populate('supplier', 'supplierName gstNumber')
      .populate('createdBy', 'name');

    if (!purchaseReturn) {
      return res.status(404).json({
        success: false,
        message: 'Purchase return not found'
      });
    }

    res.status(200).json({
      success: true,
      data: purchaseReturn
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting purchase return',
      error: error.message
    });
  }
};

exports.createPurchaseReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      purchaseId,
      items,
      reason,
      notes
    } = validatePurchaseReturnPayload(req.body);

    const purchase = await Purchase.findOne({
      _id: purchaseId,
      isDeleted: false
    })
      .populate('supplier', 'supplierName')
      .populate('items.medicine', 'medicineName brandName')
      .session(session);

    if (!purchase) {
      throw createHttpError(404, 'Purchase not found');
    }

    const returnedQuantityMap = await getReturnedQuantityMap(purchase._id, session);
    const returnItems = [];

    for (const requestItem of items) {
      const originalItem = purchase.items?.[requestItem.originalItemIndex];

      if (!originalItem) {
        throw createHttpError(400, `Purchase item ${requestItem.originalItemIndex + 1} was not found`);
      }

      const originalQuantity = Number(originalItem.quantity || 0);
      const originalFreeQuantity = Number(originalItem.freeQuantity || 0);
      const originalBatchNumber = String(originalItem.batchNumber || '').trim();
      const itemLabel = originalItem.medicineName || originalItem.medicine?.medicineName || `item ${requestItem.originalItemIndex + 1}`;
      const alreadyReturned = returnedQuantityMap.get(requestItem.originalItemIndex) || {
        quantity: 0,
        freeQuantity: 0
      };

      const remainingQuantity = Math.max(originalQuantity - alreadyReturned.quantity, 0);
      const remainingFreeQuantity = Math.max(originalFreeQuantity - alreadyReturned.freeQuantity, 0);

      if (requestItem.returnQuantity > remainingQuantity) {
        throw createHttpError(
          400,
          `Return quantity for ${itemLabel} exceeds remaining purchased quantity (${remainingQuantity})`
        );
      }

      if (requestItem.returnFreeQuantity > remainingFreeQuantity) {
        throw createHttpError(
          400,
          `Free return quantity for ${itemLabel} exceeds remaining free quantity (${remainingFreeQuantity})`
        );
      }

      const conversionFactor = Math.max(Number(originalItem.conversionFactor || 1), 1);
      const returnUnitQuantity = requestItem.returnQuantity * conversionFactor;
      const returnFreeUnitQuantity = requestItem.returnFreeQuantity * conversionFactor;
      const totalReturnUnits = returnUnitQuantity + returnFreeUnitQuantity;

      const inventory = await Inventory.findOne({
        medicine: originalItem.medicine?._id || originalItem.medicine,
        batchNumber: { $regex: new RegExp(`^${escapeRegex(originalBatchNumber)}$`, 'i') },
        isDeleted: false
      }).session(session);

      if (!inventory) {
        throw createHttpError(
          400,
          `Inventory batch ${originalBatchNumber || '(no batch)'} for ${itemLabel} was not found`
        );
      }

      if (Number(inventory.quantityAvailable || 0) < totalReturnUnits) {
        throw createHttpError(
          400,
          `Return quantity for ${itemLabel} exceeds available stock (${Number(inventory.quantityAvailable || 0)})`
        );
      }

      inventory.quantityPurchased = Math.max(
        0,
        Number(inventory.quantityPurchased || 0) - returnUnitQuantity
      );
      inventory.freeQuantity = Math.max(
        0,
        Number(inventory.freeQuantity || 0) - returnFreeUnitQuantity
      );
      inventory.quantityAvailable = Math.max(
        0,
        Number(inventory.quantityAvailable || 0) - totalReturnUnits
      );
      await inventory.save({ session });

      const quantityRatio = originalQuantity > 0
        ? requestItem.returnQuantity / originalQuantity
        : 0;

      returnItems.push({
        originalItemIndex: requestItem.originalItemIndex,
        medicine: originalItem.medicine?._id || originalItem.medicine,
        medicineName: itemLabel,
        brandName: originalItem.brandName || originalItem.medicine?.brandName || null,
        batchNumber: originalBatchNumber,
        expiryDate: originalItem.expiryDate,
        conversionFactor,
        originalQuantity,
        originalFreeQuantity,
        returnQuantity: requestItem.returnQuantity,
        returnFreeQuantity: requestItem.returnFreeQuantity,
        returnUnitQuantity,
        returnFreeUnitQuantity,
        purchasePrice: roundCurrency(Number(originalItem.purchasePrice || 0)),
        gstPercent: roundCurrency(Number(originalItem.gstPercent || 0)),
        cgstPercent: roundCurrency(Number(originalItem.cgstPercent || 0)),
        sgstPercent: roundCurrency(Number(originalItem.sgstPercent || 0)),
        igstPercent: roundCurrency(Number(originalItem.igstPercent || 0)),
        subtotal: roundCurrency(Number(originalItem.subtotal || 0) * quantityRatio),
        taxableAmount: roundCurrency(Number(originalItem.taxableAmount || 0) * quantityRatio),
        discountAmount: roundCurrency(Number(originalItem.discountAmount || 0) * quantityRatio),
        gstAmount: roundCurrency(Number(originalItem.gstAmount || 0) * quantityRatio),
        cgstAmount: roundCurrency(Number(originalItem.cgstAmount || 0) * quantityRatio),
        sgstAmount: roundCurrency(Number(originalItem.sgstAmount || 0) * quantityRatio),
        igstAmount: roundCurrency(Number(originalItem.igstAmount || 0) * quantityRatio),
        totalAmount: roundCurrency(Number(originalItem.totalAmount || 0) * quantityRatio)
      });

      returnedQuantityMap.set(requestItem.originalItemIndex, {
        quantity: alreadyReturned.quantity + requestItem.returnQuantity,
        freeQuantity: alreadyReturned.freeQuantity + requestItem.returnFreeQuantity
      });
    }

    const totals = returnItems.reduce(
      (acc, item) => {
        acc.subtotal += Number(item.subtotal || 0);
        acc.taxableAmount += Number(item.taxableAmount || 0);
        acc.totalGst += Number(item.gstAmount || 0);
        acc.totalCgst += Number(item.cgstAmount || 0);
        acc.totalSgst += Number(item.sgstAmount || 0);
        acc.totalIgst += Number(item.igstAmount || 0);
        acc.discountAmount += Number(item.discountAmount || 0);
        acc.grandTotal += Number(item.totalAmount || 0);
        return acc;
      },
      {
        subtotal: 0,
        taxableAmount: 0,
        totalGst: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        discountAmount: 0,
        grandTotal: 0
      }
    );

    const returnNumber = await PurchaseReturn.generateReturnNumber();
    const adjustmentAmount = roundCurrency(totals.grandTotal);
    const supplierDoc = await Supplier.findById(purchase.supplier?._id || purchase.supplier).session(session);

    if (!supplierDoc) {
      throw createHttpError(404, 'Supplier not found for purchase return');
    }

    supplierDoc.adjustmentBalance = roundCurrency(
      Number(supplierDoc.adjustmentBalance || 0) + adjustmentAmount
    );
    await supplierDoc.save({ session });

    const [createdPurchaseReturn] = await PurchaseReturn.create(
      [
        {
          returnNumber,
          purchase: purchase._id,
          purchaseNumber: purchase.purchaseNumber,
          supplier: purchase.supplier?._id || purchase.supplier,
          supplierName: purchase.supplier?.supplierName || 'Supplier',
          supplierInvoiceNumber: purchase.supplierInvoiceNumber,
          reason,
          notes,
          items: returnItems,
          subtotal: roundCurrency(totals.subtotal),
          taxableAmount: roundCurrency(totals.taxableAmount),
          totalGst: roundCurrency(totals.totalGst),
          totalCgst: roundCurrency(totals.totalCgst),
          totalSgst: roundCurrency(totals.totalSgst),
          totalIgst: roundCurrency(totals.totalIgst),
          discountAmount: roundCurrency(totals.discountAmount),
          adjustmentAmount,
          grandTotal: roundCurrency(totals.grandTotal),
          createdBy: req.user.id
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const populatedPurchaseReturn = await PurchaseReturn.findById(createdPurchaseReturn._id)
      .populate('purchase', 'purchaseNumber purchaseDate')
      .populate('supplier', 'supplierName')
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      data: populatedPurchaseReturn
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Error creating purchase return',
      error: error.message
    });
  }
};
