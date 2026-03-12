const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Medicine = require('../models/Medicine');
const Inventory = require('../models/Inventory');
const HSN = require('../models/HSN');

// @desc    Get all bills
// @route   GET /api/bills
// @access  Private
exports.getBills = async (req, res) => {
  try {
    const { startDate, endDate, paymentMode, createdBy, page = 1, limit = 20 } = req.query;

    let query = { isDeleted: false };

    // Staff can only see their own bills
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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
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

    // Check if staff can access
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

// Helper function to calculate tax (extracts GST from MRP)
// This is the main tax calculation function used in bill creation
// MRP = BasePrice + GST (inclusive pricing)
const calculateTax = (mrp, gstPercent, quantity, isInterstate) => {
  // Extract base price from MRP: BasePrice = MRP / (1 + GST/100)
  const basePrice = mrp / (1 + gstPercent / 100);
  
  // GST value per unit = MRP - BasePrice
  const gstValuePerUnit = mrp - basePrice;
  
  // Total amounts for the quantity
  const totalBaseAmount = basePrice * quantity;
  const totalGst = gstValuePerUnit * quantity;
  
  if (isInterstate) {
    // IGST for interstate
    return {
      basePrice: totalBaseAmount,
      gstPercent,
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: gstPercent,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalGst,
      totalGst: totalGst,
      finalAmount: totalBaseAmount + totalGst
    };
  } else {
    // CGST + SGST for intrastate (split equally)
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
      totalGst: totalGst,
      finalAmount: totalBaseAmount + totalGst
    };
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
    } = req.body;

    // Generate invoice number
    const invoiceNumber = await Bill.generateInvoiceNumber();

    // Determine if interstate (different state = IGST)
    const interstate = isInterstate || false;

    // Process items and validate stock from Inventory
    let calculatedSubtotal = 0;
    let calculatedGst = 0;
    let calculatedCgst = 0;
    let calculatedSgst = 0;
    let calculatedIgst = 0;
    const processedItems = [];

    for (const item of items) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Get medicine details from Medicine model
      const medicine = await Medicine.findById(item.medicine).session(session);

      if (!medicine) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: `Medicine not found: ${item.medicine}`
        });
      }

      // Get available stock from Inventory using FIFO
      let quantityNeeded = item.unitQuantity;
      
      // DEBUG: Log inventory query parameters
      console.log('[BILLING DEBUG] Fetching inventory for medicine:', {
        medicineId: item.medicine,
        medicineName: medicine.medicineName,
        brandName: medicine.brandName,
        quantityNeeded,
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

      // DEBUG: Log inventory query results
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
        await session.abortTransaction();
        session.endSession();
        
        // DEBUG: Log the error with more details
        console.error('[BILLING DEBUG] No stock available for medicine:', {
          medicineId: item.medicine,
          medicineName: medicine.medicineName,
          brandName: medicine.brandName
        });
        
        return res.status(400).json({
          success: false,
          message: `No stock available for ${medicine.medicineName} (${medicine.brandName})`
        });
      }

      // Check total available quantity
      const totalAvailable = availableInventory.reduce((sum, inv) => sum + inv.quantityAvailable, 0);
      
      // DEBUG: Log total available
      console.log('[BILLING DEBUG] Total available stock:', {
        medicineId: item.medicine,
        totalAvailable,
        quantityNeeded
      });
      
      if (totalAvailable < quantityNeeded) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${medicine.medicineName} (${medicine.brandName}). Available: ${totalAvailable}, Required: ${quantityNeeded}`
        });
      }

      // Calculate item totals using the formula: baseAmount = quantity × rate
      // Use MRP from inventory as the selling price (first batch in FIFO)
      const inventoryMrp = availableInventory.length > 0 ? availableInventory[0].mrp : 0;
      const rate = item.rate || inventoryMrp || medicine.defaultSellingPrice || 0;
      const baseAmount = item.unitQuantity * rate;
      
      // Get GST percent from item or medicine
      const gstPercent = item.gstPercent || medicine.gstPercent || 0;
      
      // Calculate tax using the formula: gstAmount = baseAmount × gstPercentage / 100
      const taxCalculation = calculateTax(rate, gstPercent, item.unitQuantity, interstate);
      
      const itemDiscount = baseAmount * ((item.discountPercent || 0) / 100);

      calculatedSubtotal += baseAmount;
      calculatedGst += taxCalculation.totalGst;
      calculatedCgst += taxCalculation.cgstAmount;
      calculatedSgst += taxCalculation.sgstAmount;
      calculatedIgst += taxCalculation.igstAmount;

      // Deduct stock from inventory using FIFO
      let remainingQuantity = quantityNeeded;
      let batchInfo = null;

      for (const inventory of availableInventory) {
        if (remainingQuantity <= 0) break;

        const deductFromThis = Math.min(inventory.quantityAvailable, remainingQuantity);
        inventory.quantityAvailable -= deductFromThis;
        remainingQuantity -= deductFromThis;

        // Update inventory status based on quantity
        if (inventory.quantityAvailable <= 0) {
          inventory.status = 'EXHAUSTED';
        }

        await inventory.save({ session });

        // Capture batch info from first batch used
        if (!batchInfo) {
          batchInfo = {
            batchNumber: inventory.batchNumber,
            expiryDate: inventory.expiryDate,
            hsnCode: inventory.hsnCodeString,
            gstPercent: inventory.gstPercent
          };
        }
      }

      // finalAmount = baseAmount + gstAmount - discount
      const finalAmount = taxCalculation.finalAmount - itemDiscount;

      processedItems.push({
        medicine: medicine._id,
        medicineName: medicine.medicineName,
        brandName: medicine.brandName,
        batchNumber: batchInfo?.batchNumber || 'N/A',
        expiryDate: batchInfo?.expiryDate || new Date(),
        quantity: item.quantity || 1,
        looseQuantity: item.looseQuantity || 0,
        packQuantity: item.packQuantity || 0,
        unitQuantity: item.unitQuantity,
        rate: rate,
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
        baseAmount: baseAmount,
        total: finalAmount
      });
    }

    // Apply discount
    const calculatedDiscountAmount = discountPercent
      ? calculatedSubtotal * (discountPercent / 100)
      : discountAmount || 0;

    const grandTotal = calculatedSubtotal + calculatedGst - calculatedDiscountAmount;
    const balance = amountPaid ? amountPaid - grandTotal : 0;

    // Create bill
    const bill = new Bill({
      invoiceNumber,
      customerName,
      customerPhone,
      customerState,
      customerAddress,
      isInterstate: interstate,
      items: processedItems,
      subtotal: calculatedSubtotal,
      totalGst: calculatedGst,
      totalCgst: calculatedCgst,
      totalSgst: calculatedSgst,
      totalIgst: calculatedIgst,
      discountPercent: discountPercent || 0,
      discountAmount: calculatedDiscountAmount,
      grandTotal,
      paymentMode: paymentMode || 'CASH',
      amountPaid: amountPaid || grandTotal,
      balance,
      createdBy: req.user.id
    });

    await bill.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate and return
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
    res.status(500).json({
      success: false,
      message: 'Error creating bill',
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

    // First, restore the inventory for the original bill items
    for (const item of bill.items) {
      const inventory = await Inventory.findOne({
        medicine: item.medicine,
        batchNumber: item.batchNumber,
        isDeleted: false
      }).session(session);

      if (inventory) {
        inventory.quantityAvailable += item.unitQuantity;
        if (inventory.status === 'EXHAUSTED') {
          inventory.status = 'ACTIVE';
        }
        await inventory.save({ session });
      }
    }

    // Now process the updated bill with new items
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
    } = req.body;

    const interstate = isInterstate || false;

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
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: `Medicine not found: ${item.medicine}`
        });
      }

      // Get available stock from Inventory using FIFO
      let quantityNeeded = item.unitQuantity;
      
      // DEBUG: Log inventory query parameters for updateBill
      console.log('[BILLING DEBUG UPDATE] Fetching inventory for medicine:', {
        medicineId: item.medicine,
        medicineName: medicine.medicineName,
        brandName: medicine.brandName,
        quantityNeeded,
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

      // DEBUG: Log inventory query results for updateBill
      console.log('[BILLING DEBUG UPDATE] Inventory query results:', {
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
        await session.abortTransaction();
        session.endSession();
        
        // DEBUG: Log the error for updateBill
        console.error('[BILLING DEBUG UPDATE] No stock available for medicine:', {
          medicineId: item.medicine,
          medicineName: medicine.medicineName,
          brandName: medicine.brandName
        });
        
        return res.status(400).json({
          success: false,
          message: `No stock available for ${medicine.medicineName} (${medicine.brandName})`
        });
      }

      const totalAvailable = availableInventory.reduce((sum, inv) => sum + inv.quantityAvailable, 0);
      
      // DEBUG: Log total available for updateBill
      console.log('[BILLING DEBUG UPDATE] Total available stock:', {
        medicineId: item.medicine,
        totalAvailable,
        quantityNeeded
      });
      
      if (totalAvailable < quantityNeeded) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${medicine.medicineName}. Available: ${totalAvailable}, Required: ${quantityNeeded}`
        });
      }

      // Calculate tax
      // Use MRP from inventory as the selling price (first batch in FIFO)
      const inventoryMrpUpdate = availableInventory.length > 0 ? availableInventory[0].mrp : 0;
      const rate = item.rate || inventoryMrpUpdate || medicine.defaultSellingPrice || 0;
      const baseAmount = item.unitQuantity * rate;
      const gstPercent = item.gstPercent || medicine.gstPercent || 0;
      const taxCalculation = calculateTax(rate, gstPercent, item.unitQuantity, interstate);
      const itemDiscount = baseAmount * ((item.discountPercent || 0) / 100);

      calculatedSubtotal += baseAmount;
      calculatedGst += taxCalculation.totalGst;
      calculatedCgst += taxCalculation.cgstAmount;
      calculatedSgst += taxCalculation.sgstAmount;
      calculatedIgst += taxCalculation.igstAmount;

      // Deduct stock from inventory using FIFO
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
            batchNumber: inventory.batchNumber,
            expiryDate: inventory.expiryDate,
            hsnCode: inventory.hsnCodeString,
            gstPercent: inventory.gstPercent
          };
        }
      }

      const finalAmount = taxCalculation.finalAmount - itemDiscount;

      processedItems.push({
        medicine: medicine._id,
        medicineName: medicine.medicineName,
        brandName: medicine.brandName,
        batchNumber: batchInfo?.batchNumber || 'N/A',
        expiryDate: batchInfo?.expiryDate || new Date(),
        quantity: item.quantity || 1,
        looseQuantity: item.looseQuantity || 0,
        packQuantity: item.packQuantity || 0,
        unitQuantity: item.unitQuantity,
        rate: rate,
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
        baseAmount: baseAmount,
        total: finalAmount
      });
    }

    const calculatedDiscountAmount = discountPercent
      ? calculatedSubtotal * (discountPercent / 100)
      : discountAmount || 0;

    const grandTotal = calculatedSubtotal + calculatedGst - calculatedDiscountAmount;
    const balance = amountPaid ? amountPaid - grandTotal : 0;

    // Update bill
    bill.customerName = customerName || bill.customerName;
    bill.customerPhone = customerPhone || bill.customerPhone;
    bill.customerState = customerState || bill.customerState;
    bill.customerAddress = customerAddress || bill.customerAddress;
    bill.isInterstate = interstate;
    bill.items = processedItems;
    bill.subtotal = calculatedSubtotal;
    bill.totalGst = calculatedGst;
    bill.totalCgst = calculatedCgst;
    bill.totalSgst = calculatedSgst;
    bill.totalIgst = calculatedIgst;
    bill.discountPercent = discountPercent || bill.discountPercent;
    bill.discountAmount = calculatedDiscountAmount;
    bill.grandTotal = grandTotal;
    bill.paymentMode = paymentMode || bill.paymentMode;
    bill.amountPaid = amountPaid || bill.amountPaid;
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
    res.status(500).json({
      success: false,
      message: 'Error updating bill',
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

    // Group by date for chart
    const salesByDate = {};
    const paymentModeDistribution = { CASH: 0, UPI: 0, CARD: 0 };

    bills.forEach(bill => {
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
    const { startDate, endDate } = req.query;

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
    const currentYear = parseInt(year) || new Date().getFullYear();
    const currentMonth = parseInt(month) || new Date().getMonth() + 1;

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    let query = {
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

    const bills = await Bill.find(query);

    // Aggregate top medicines
    const medicineStats = {};
    bills.forEach(bill => {
      bill.items.forEach(item => {
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
      .slice(0, parseInt(limit));

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

// @desc    Get dashboard stats
// @route   GET /api/bills/dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's sales
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

    // Monthly sales
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

    // Payment mode distribution for today
    const paymentModeData = await Bill.aggregate([
      { $match: todayQuery },
      {
        $group: {
          _id: '$paymentMode',
          total: { $sum: '$grandTotal' }
        }
      }
    ]);

    // Last 7 days sales
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
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
