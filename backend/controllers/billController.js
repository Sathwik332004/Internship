const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Medicine = require('../models/Medicine');
const Inventory = require('../models/Inventory');
const HSN = require('../models/HSN');
const {
  isNonNegativeNumber,
  isPositiveInteger,
  isValidPhone,
  normalizeOptionalText,
  normalizePhone
} = require('../utils/validation');

// Helper function to calculate tax (extracts GST from MRP)
// MRP = BasePrice + GST (inclusive pricing)
const calculateTax = (mrp, gstPercent, quantity, isInterstate) => {
  const basePrice = mrp / (1 + gstPercent / 100);
  const gstValuePerUnit = mrp - basePrice;
  const totalBaseAmount = basePrice * quantity;
  const totalGst = gstValuePerUnit * quantity;

  if (isInterstate) {
    return {
      basePrice: totalBaseAmount,
      gstPercent,
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: gstPercent,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalGst,
      totalGst,
      finalAmount: totalBaseAmount + totalGst
    };
  }

  const cgstAmount = totalGst / 2;
  const sgstAmount = totalGst / 2;
  return {
    basePrice: totalBaseAmount,
    gstPercent,
    cgstPercent: gstPercent / 2,
    sgstPercent: gstPercent / 2,
    igstPercent: 0,
    cgstAmount,
    sgstAmount,
    igstAmount: 0,
    totalGst,
    finalAmount: totalBaseAmount + totalGst
  };
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getSaleQuantity = (item = {}) => {
  const quantityCandidates = [item.quantity, item.packQuantity, item.looseQuantity];

  for (const candidate of quantityCandidates) {
    if (isPositiveInteger(candidate)) {
      return Number(candidate);
    }
  }

  return 0;
};

const validateBillPayload = (payload = {}) => {
  const {
    customerName,
    customerPhone,
    customerState,
    customerAddress,
    items,
    discountPercent,
    discountAmount,
    paymentMode,
    amountPaid,
    isInterstate
  } = payload;

  const normalizedCustomerName = normalizeOptionalText(customerName);
  const normalizedCustomerPhone = normalizePhone(customerPhone);
  const normalizedCustomerState = normalizeOptionalText(customerState);
  const normalizedCustomerAddress = normalizeOptionalText(customerAddress);

  if (normalizedCustomerName && normalizedCustomerName.length < 2) {
    throw createHttpError(400, 'Customer name must be at least 2 characters');
  }

  if (normalizedCustomerPhone && !isValidPhone(normalizedCustomerPhone)) {
    throw createHttpError(400, 'Customer phone must be 10 digits');
  }

  if (normalizedCustomerState && normalizedCustomerState.length < 2) {
    throw createHttpError(400, 'Customer state must be at least 2 characters');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, 'At least one bill item is required');
  }

  if (discountPercent !== undefined && (!isNonNegativeNumber(discountPercent) || Number(discountPercent) > 100)) {
    throw createHttpError(400, 'Discount percent must be between 0 and 100');
  }

  if (discountAmount !== undefined && discountAmount !== null && discountAmount !== '' && !isNonNegativeNumber(discountAmount)) {
    throw createHttpError(400, 'Discount amount cannot be negative');
  }

  if (amountPaid !== undefined && amountPaid !== null && amountPaid !== '' && !isNonNegativeNumber(amountPaid)) {
    throw createHttpError(400, 'Amount paid cannot be negative');
  }

  if (paymentMode && !['CASH', 'UPI', 'CARD', 'BANK'].includes(paymentMode)) {
    throw createHttpError(400, 'Invalid payment mode');
  }

  items.forEach((item, index) => {
    const saleQuantity = getSaleQuantity(item);

    if (!item.medicine) {
      throw createHttpError(400, `Medicine is required for item ${index + 1}`);
    }

    if (!item.inventoryBatchId && !item.batchNumber) {
      throw createHttpError(400, `Batch information is required for item ${index + 1}`);
    }

    if (!isPositiveInteger(item.unitQuantity) || !isPositiveInteger(saleQuantity)) {
      throw createHttpError(400, `Quantity must be greater than 0 for item ${index + 1}`);
    }

    if (item.rate !== undefined && !isNonNegativeNumber(item.rate)) {
      throw createHttpError(400, `Rate cannot be negative for item ${index + 1}`);
    }

    if (item.discountPercent !== undefined && (!isNonNegativeNumber(item.discountPercent) || Number(item.discountPercent) > 100)) {
      throw createHttpError(400, `Discount percent must be between 0 and 100 for item ${index + 1}`);
    }
  });

  return {
    normalizedCustomerName,
    normalizedCustomerPhone,
    normalizedCustomerState,
    normalizedCustomerAddress,
    items,
    discountPercent: discountPercent !== undefined ? Number(discountPercent) : 0,
    discountAmount: discountAmount !== undefined && discountAmount !== null && discountAmount !== ''
      ? Number(discountAmount)
      : 0,
    paymentMode: paymentMode || 'CASH',
    amountPaid: amountPaid !== undefined && amountPaid !== null && amountPaid !== ''
      ? Number(amountPaid)
      : null,
    isInterstate: Boolean(isInterstate)
  };
};

const processBillItems = async ({ items, interstate, session }) => {
  let calculatedSubtotal = 0;
  let calculatedGst = 0;
  let calculatedCgst = 0;
  let calculatedSgst = 0;
  let calculatedIgst = 0;
  const processedItems = [];

  for (const item of items) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const medicine = await Medicine.findById(item.medicine).session(session);

    if (!medicine) {
      throw createHttpError(404, `Medicine not found: ${item.medicine}`);
    }

    const quantityNeeded = Number(item.unitQuantity);
    const saleQuantity = getSaleQuantity(item);

    console.log('[BILLING DEBUG] Fetching inventory for medicine:', {
      medicineId: item.medicine,
      medicineName: medicine.medicineName,
      brandName: medicine.brandName,
      quantityNeeded,
      saleQuantity,
      inventoryBatchId: item.inventoryBatchId,
      batchNumber: item.batchNumber
    });

    const inventoryQuery = {
      medicine: item.medicine,
      quantityAvailable: { $gt: 0 },
      expiryDate: { $gte: startOfToday },
      isDeleted: { $ne: true }
    };

    if (item.inventoryBatchId) {
      inventoryQuery._id = item.inventoryBatchId;
    } else if (item.batchNumber) {
      inventoryQuery.batchNumber = { $regex: new RegExp(`^${String(item.batchNumber).trim()}$`, 'i') };
    }

    const availableInventory = await Inventory.find(inventoryQuery)
      .sort({ expiryDate: 1 })
      .session(session);

    console.log('[BILLING DEBUG] Inventory query results:', {
      medicineId: item.medicine,
      recordsFound: availableInventory?.length || 0,
      batches: availableInventory?.map(inv => ({
        batchNumber: inv.batchNumber,
        quantityAvailable: inv.quantityAvailable,
        expiryDate: inv.expiryDate,
        status: inv.status
      })) || []
    });

    if (!availableInventory || availableInventory.length === 0) {
      throw createHttpError(400, `No stock available for ${medicine.medicineName} (${medicine.brandName})`);
    }

    const totalAvailable = availableInventory.reduce((sum, inv) => sum + inv.quantityAvailable, 0);

    console.log('[BILLING DEBUG] Total available stock:', {
      medicineId: item.medicine,
      totalAvailable,
      quantityNeeded
    });

    if (totalAvailable < quantityNeeded) {
      throw createHttpError(
        400,
        `Insufficient stock for ${medicine.medicineName} (${medicine.brandName}). Available: ${totalAvailable}, Required: ${quantityNeeded}`
      );
    }

    const inventoryMrp = availableInventory.length > 0 ? availableInventory[0].mrp : 0;
    const rate = item.rate || inventoryMrp || medicine.defaultSellingPrice || 0;
    const grossAmount = saleQuantity * rate;
    const gstPercent = item.gstPercent || medicine.gstPercent || 0;
    const taxCalculation = calculateTax(rate, gstPercent, saleQuantity, interstate);
    const baseAmount = taxCalculation.basePrice;
    const itemDiscount = grossAmount * ((item.discountPercent || 0) / 100);

    calculatedSubtotal += grossAmount;
    calculatedGst += taxCalculation.totalGst;
    calculatedCgst += taxCalculation.cgstAmount;
    calculatedSgst += taxCalculation.sgstAmount;
    calculatedIgst += taxCalculation.igstAmount;

    let remainingQuantity = quantityNeeded;
    let batchInfo = null;

    for (const inventory of availableInventory) {
      if (remainingQuantity <= 0) break;

      const deductFromThis = Math.min(inventory.quantityAvailable, remainingQuantity);
      inventory.quantityAvailable -= deductFromThis;
      remainingQuantity -= deductFromThis;

      if (inventory.quantityAvailable <= 0) {
        inventory.status = 'EXHAUSTED';
      }

      await inventory.save({ session });

      if (!batchInfo) {
        batchInfo = {
          inventoryBatchId: inventory._id,
          batchNumber: inventory.batchNumber,
          expiryDate: inventory.expiryDate,
          hsnCode: inventory.hsnCodeString
        };
      }
    }

    const finalAmount = taxCalculation.finalAmount - itemDiscount;

    processedItems.push({
      medicine: medicine._id,
      medicineName: medicine.medicineName,
      brandName: medicine.brandName,
      inventoryBatchId: item.inventoryBatchId || batchInfo?.inventoryBatchId || null,
      batchNumber: batchInfo?.batchNumber || String(item.batchNumber || 'N/A').toUpperCase(),
      expiryDate: batchInfo?.expiryDate || item.expiryDate || new Date(),
      quantity: saleQuantity,
      looseQuantity: item.looseQuantity || 0,
      packQuantity: item.packQuantity || 0,
      unitQuantity: quantityNeeded,
      rate,
      hsnCode: batchInfo?.hsnCode || medicine.hsnCodeString || '',
      gstPercent: taxCalculation.gstPercent,
      cgstPercent: taxCalculation.cgstPercent,
      sgstPercent: taxCalculation.sgstPercent,
      igstPercent: taxCalculation.igstPercent,
      cgstAmount: taxCalculation.cgstAmount,
      sgstAmount: taxCalculation.sgstAmount,
      igstAmount: taxCalculation.igstAmount,
      gstAmount: taxCalculation.totalGst,
      discountPercent: item.discountPercent || 0,
      discountAmount: itemDiscount,
      baseAmount,
      total: finalAmount
    });
  }

  return {
    processedItems,
    calculatedSubtotal,
    calculatedGst,
    calculatedCgst,
    calculatedSgst,
    calculatedIgst
  };
};

const restoreBillInventory = async ({ bill, session }) => {
  for (const item of bill.items) {
    const inventoryQuery = {
      medicine: item.medicine,
      isDeleted: { $ne: true }
    };

    if (item.inventoryBatchId) {
      inventoryQuery._id = item.inventoryBatchId;
    } else {
      inventoryQuery.batchNumber = { $regex: new RegExp(`^${String(item.batchNumber).trim()}$`, 'i') };
    }

    const inventory = await Inventory.findOne(inventoryQuery).session(session);

    if (inventory) {
      inventory.quantityAvailable += Number(item.unitQuantity || 0);
      await inventory.save({ session });
    }
  }
};

// @desc    Get all bills
// @route   GET /api/bills
// @access  Private
exports.getBills = async (req, res) => {
  try {
    const { startDate, endDate, paymentMode, paymentStatus, createdBy, search, page = 1, limit = 20 } = req.query;

    let query = { isDeleted: false };

    if (req.user.role === 'staff') {
      query.createdBy = req.user.id;
    } else if (createdBy) {
      query.createdBy = createdBy;
    }

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    if (paymentMode) {
      query.paymentMode = paymentMode;
    }

    if (paymentStatus === 'PENDING') {
      query.balance = { $lt: 0 };
    } else if (paymentStatus === 'PAID') {
      query.balance = { $gte: 0 };
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { invoiceNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const bills = await Bill.find(query)
      .populate('createdBy', 'name')
      .sort({ billDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Bill.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bills.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: bills
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting bills',
      error: error.message
    });
  }
};

// @desc    Get single bill
// @route   GET /api/bills/:id
// @access  Private
exports.getBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({
      _id: req.params.id,
      isDeleted: false
    })
      .populate('createdBy', 'name')
      .populate('items.medicine', 'medicineName brandName');

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    if (req.user.role === 'staff' && bill.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this bill'
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting bill',
      error: error.message
    });
  }
};

// @desc    Create new bill
// @route   POST /api/bills
// @access  Private
exports.createBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      normalizedCustomerName,
      normalizedCustomerPhone,
      normalizedCustomerState,
      normalizedCustomerAddress,
      items,
      discountPercent,
      discountAmount,
      paymentMode,
      amountPaid,
      isInterstate
    } = validateBillPayload(req.body);

    const invoiceNumber = await Bill.generateInvoiceNumber();
    const interstate = isInterstate;
    const {
      processedItems,
      calculatedSubtotal,
      calculatedGst,
      calculatedCgst,
      calculatedSgst,
      calculatedIgst
    } = await processBillItems({ items, interstate, session });

    const calculatedDiscountAmount = discountPercent
      ? calculatedSubtotal * (discountPercent / 100)
      : discountAmount;

    const grandTotal = calculatedSubtotal - calculatedDiscountAmount;
    const finalAmountPaid = amountPaid ?? grandTotal;
    const balance = finalAmountPaid - grandTotal;

    const bill = new Bill({
      invoiceNumber,
      customerName: normalizedCustomerName,
      customerPhone: normalizedCustomerPhone,
      customerState: normalizedCustomerState,
      customerAddress: normalizedCustomerAddress,
      isInterstate: interstate,
      items: processedItems,
      subtotal: calculatedSubtotal,
      totalGst: calculatedGst,
      totalCgst: calculatedCgst,
      totalSgst: calculatedSgst,
      totalIgst: calculatedIgst,
      discountPercent,
      discountAmount: calculatedDiscountAmount,
      grandTotal,
      paymentMode,
      amountPaid: finalAmountPaid,
      balance,
      createdBy: req.user.id
    });

    await bill.save({ session });
    await session.commitTransaction();
    session.endSession();

    const populatedBill = await Bill.findById(bill._id)
      .populate('createdBy', 'name')
      .populate('items.medicine', 'medicineName brandName');

    res.status(201).json({
      success: true,
      data: populatedBill
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Error creating bill',
      error: error.message
    });
  }
};

// @desc    Update bill (adjusts inventory)
// @route   PUT /api/bills/:id
// @access  Private
exports.updateBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bill = await Bill.findOne({
      _id: req.params.id,
      isDeleted: false
    }).session(session);

    if (!bill) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    if (req.user.role === 'staff' && bill.createdBy.toString() !== req.user.id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this bill'
      });
    }

    const {
      normalizedCustomerName,
      normalizedCustomerPhone,
      normalizedCustomerState,
      normalizedCustomerAddress,
      items,
      discountPercent,
      discountAmount,
      paymentMode,
      amountPaid,
      isInterstate
    } = validateBillPayload(req.body);

    await restoreBillInventory({ bill, session });

    const interstate = isInterstate;
    const {
      processedItems,
      calculatedSubtotal,
      calculatedGst,
      calculatedCgst,
      calculatedSgst,
      calculatedIgst
    } = await processBillItems({ items, interstate, session });

    const calculatedDiscountAmount = discountPercent
      ? calculatedSubtotal * (discountPercent / 100)
      : discountAmount;

    const grandTotal = calculatedSubtotal - calculatedDiscountAmount;
    const finalAmountPaid = amountPaid ?? grandTotal;
    const balance = finalAmountPaid - grandTotal;

    bill.customerName = normalizedCustomerName;
    bill.customerPhone = normalizedCustomerPhone;
    bill.customerState = normalizedCustomerState;
    bill.customerAddress = normalizedCustomerAddress;
    bill.isInterstate = interstate;
    bill.items = processedItems;
    bill.subtotal = calculatedSubtotal;
    bill.totalGst = calculatedGst;
    bill.totalCgst = calculatedCgst;
    bill.totalSgst = calculatedSgst;
    bill.totalIgst = calculatedIgst;
    bill.discountPercent = discountPercent;
    bill.discountAmount = calculatedDiscountAmount;
    bill.grandTotal = grandTotal;
    bill.paymentMode = paymentMode;
    bill.amountPaid = finalAmountPaid;
    bill.balance = balance;

    await bill.save({ session });
    await session.commitTransaction();
    session.endSession();

    const populatedBill = await Bill.findById(bill._id)
      .populate('createdBy', 'name')
      .populate('items.medicine', 'medicineName brandName');

    res.status(200).json({
      success: true,
      data: populatedBill
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Error updating bill',
      error: error.message
    });
  }
};

// @desc    Get daily sales summary
// @route   GET /api/bills/sales/daily
// @access  Private
exports.getDailySales = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const sales = await Bill.getDailySales(targetDate);

    res.status(200).json({
      success: true,
      data: sales
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting daily sales',
      error: error.message
    });
  }
};

// @desc    Get sales report
// @route   GET /api/bills/report/sales
// @access  Private
exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, createdBy } = req.query;

    let query = { isDeleted: false };

    if (req.user.role === 'staff') {
      query.createdBy = req.user.id;
    } else if (createdBy) {
      query.createdBy = createdBy;
    }

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    const bills = await Bill.find(query)
      .populate('createdBy', 'name')
      .sort({ billDate: -1 });

    const salesByDate = {};
    const paymentModeDistribution = { CASH: 0, UPI: 0, CARD: 0, BANK: 0 };

    bills.forEach((bill) => {
      const dateKey = bill.billDate.toISOString().split('T')[0];
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { total: 0, gst: 0, bills: 0, cgst: 0, sgst: 0, igst: 0 };
      }
      salesByDate[dateKey].total += bill.grandTotal;
      salesByDate[dateKey].gst += bill.totalGst;
      salesByDate[dateKey].cgst += bill.totalCgst || 0;
      salesByDate[dateKey].sgst += bill.totalSgst || 0;
      salesByDate[dateKey].igst += bill.totalIgst || 0;
      salesByDate[dateKey].bills += 1;
      paymentModeDistribution[bill.paymentMode] = (paymentModeDistribution[bill.paymentMode] || 0) + bill.grandTotal;
    });

    const summary = bills.reduce(
      (acc, bill) => {
        acc.totalSales += bill.grandTotal;
        acc.totalGst += bill.totalGst;
        acc.totalCgst += bill.totalCgst || 0;
        acc.totalSgst += bill.totalSgst || 0;
        acc.totalIgst += bill.totalIgst || 0;
        acc.totalDiscount += bill.discountAmount;
        acc.totalBills += 1;
        return acc;
      },
      { totalSales: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalDiscount: 0, totalBills: 0 }
    );

    res.status(200).json({
      success: true,
      data: {
        bills,
        salesByDate,
        paymentModeDistribution,
        summary
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error generating sales report',
      error: error.message
    });
  }
};

// @desc    Get GST report
// @route   GET /api/bills/report/gst
// @access  Private
exports.getGstReport = async (req, res) => {
  try {
    const { startDate, endDate, search } = req.query;

    let query = { isDeleted: false };

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    const bills = await Bill.find(query)
      .populate('createdBy', 'name')
      .sort({ billDate: -1 });

    const summary = bills.reduce(
      (acc, bill) => {
        acc.totalSales += bill.subtotal || 0;
        acc.totalGst += bill.totalGst || 0;
        acc.totalCgst += bill.totalCgst || 0;
        acc.totalSgst += bill.totalSgst || 0;
        acc.totalIgst += bill.totalIgst || 0;
        acc.totalBills += 1;
        return acc;
      },
      { totalSales: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalBills: 0 }
    );

    res.status(200).json({
      success: true,
      data: {
        bills,
        summary
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error generating GST report',
      error: error.message
    });
  }
};

// @desc    Get monthly sales
// @route   GET /api/bills/sales/monthly
// @access  Private
exports.getMonthlySales = async (req, res) => {
  try {
    const { year, month } = req.query;
    const currentYear = parseInt(year, 10) || new Date().getFullYear();
    const currentMonth = parseInt(month, 10) || new Date().getMonth() + 1;

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const query = {
      isDeleted: false,
      billDate: { $gte: startDate, $lte: endDate }
    };

    if (req.user.role === 'staff') {
      query.createdBy = req.user.id;
    }

    const bills = await Bill.find(query);

    const summary = bills.reduce(
      (acc, bill) => {
        acc.totalSales += bill.grandTotal;
        acc.totalGst += bill.totalGst;
        acc.totalCgst += bill.totalCgst || 0;
        acc.totalSgst += bill.totalSgst || 0;
        acc.totalIgst += bill.totalIgst || 0;
        acc.totalBills += 1;
        return acc;
      },
      { totalSales: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalBills: 0 }
    );

    res.status(200).json({
      success: true,
      data: {
        ...summary,
        year: currentYear,
        month: currentMonth
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting monthly sales',
      error: error.message
    });
  }
};

// @desc    Get top selling medicines
// @route   GET /api/bills/top-medicines
// @access  Private
exports.getTopMedicines = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const query = { isDeleted: false };

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    const bills = await Bill.find(query);

    const medicineStats = {};
    bills.forEach((bill) => {
      bill.items.forEach((item) => {
        const key = item.medicine.toString();
        if (!medicineStats[key]) {
          medicineStats[key] = {
            medicineName: item.medicineName,
            brandName: item.brandName,
            totalQuantity: 0,
            totalAmount: 0
          };
        }
        medicineStats[key].totalQuantity += item.unitQuantity;
        medicineStats[key].totalAmount += item.total;
      });
    });

    const topMedicines = Object.entries(medicineStats)
      .map(([key, value]) => ({ ...value, _id: key }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, parseInt(limit, 10));

    res.status(200).json({
      success: true,
      data: topMedicines
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting top medicines',
      error: error.message
    });
  }
};

// @desc    Get pending customers with outstanding amount due
// @route   GET /api/bills/pending-customers
// @access  Private
exports.getPendingCustomers = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let matchStage = {
      balance: { $lt: 0 },
      isDeleted: false 
    };

    // Apply date filter if provided
    if (startDate || endDate) {
      matchStage.billDate = {};
      if (startDate) matchStage.billDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.billDate.$lte = end;
      }
    }

    // Staff role filter
    if (req.user.role === 'staff') {
      matchStage.createdBy = req.user.id;
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      matchStage.$or = [
        { customerName: searchRegex },
        { customerPhone: searchRegex }
      ];
    }

    const pendingCustomers = await Bill.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            customerName: { $ifNull: ['$customerName', 'Unknown Customer'] },
            customerPhone: { $ifNull: ['$customerPhone', 'No Phone'] }
          },
          totalPending: { $sum: { $multiply: ['$balance', -1] } },
          billCount: { $sum: 1 },
          recentInvoice: { 
            $last: {
              invoiceNumber: '$invoiceNumber',
              billDate: '$billDate'
            }
          }
        }
      },
      {
        $sort: { 'totalPending': -1 }
      },
      {
        $project: {
          customerName: '$_id.customerName',
          customerPhone: '$_id.customerPhone',
          totalPending: { $round: ['$totalPending', 2] },
          billCount: 1,
          recentInvoiceNumber: '$recentInvoice.invoiceNumber',
          recentBillDate: '$recentInvoice.billDate',
          _id: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: pendingCustomers.length,
      data: pendingCustomers
    });
  } catch (error) {
    console.error('Error getting pending customers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending customers',
      error: error.message
    });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/bills/dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayQuery = {
      isDeleted: false,
      billDate: { $gte: today, $lt: tomorrow }
    };

    if (req.user.role === 'staff') {
      todayQuery.createdBy = req.user.id;
    }

    const todaySales = await Bill.aggregate([
      { $match: todayQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalGst: { $sum: '$totalGst' },
          totalCgst: { $sum: '$totalCgst' },
          totalSgst: { $sum: '$totalSgst' },
          totalIgst: { $sum: '$totalIgst' },
          totalBills: { $sum: 1 }
        }
      }
    ]);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyQuery = {
      isDeleted: false,
      billDate: { $gte: startOfMonth }
    };

    if (req.user.role === 'staff') {
      monthlyQuery.createdBy = req.user.id;
    }

    const monthlySales = await Bill.aggregate([
      { $match: monthlyQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalGst: { $sum: '$totalGst' },
          totalCgst: { $sum: '$totalCgst' },
          totalSgst: { $sum: '$totalSgst' },
          totalIgst: { $sum: '$totalIgst' },
          totalBills: { $sum: 1 }
        }
      }
    ]);

    const paymentModeData = await Bill.aggregate([
      { $match: todayQuery },
      {
        $group: {
          _id: '$paymentMode',
          total: { $sum: '$grandTotal' }
        }
      }
    ]);

    const last7Days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayQuery = {
        isDeleted: false,
        billDate: { $gte: dayStart, $lte: dayEnd }
      };

      if (req.user.role === 'staff') {
        dayQuery.createdBy = req.user.id;
      }

      const daySales = await Bill.aggregate([
        { $match: dayQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$grandTotal' }
          }
        }
      ]);

      last7Days.push({
        date: date.toISOString().split('T')[0],
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: daySales[0]?.total || 0
      });
    }

    res.status(200).json({
      success: true,
      data: {
        today: todaySales[0] || { totalSales: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalBills: 0 },
        monthly: monthlySales[0] || { totalSales: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalBills: 0 },
        paymentModeData,
        last7Days
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting dashboard stats',
      error: error.message
    });
  }
};
