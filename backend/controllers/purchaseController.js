const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const Medicine = require('../models/Medicine');
const Inventory = require('../models/Inventory');
const Supplier = require('../models/Supplier');
const HSN = require('../models/HSN');
const {
  isFutureDate,
  isNonNegativeInteger,
  isNonNegativeNumber,
  isPositiveInteger,
  isValidBatchNumber,
  isValidHSN,
  normalizeOptionalText,
  normalizeUppercase,
  normalizeWhitespace
} = require('../utils/validation');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getExpiryYearMonth = (expiryDate) => {
  if (!expiryDate) {
    return null;
  }

  const raw = String(expiryDate).trim();
  const match = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2])
    };
  }

  const parsed = new Date(expiryDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1
  };
};

const normalizeExpiryToMonthEnd = (expiryDate) => {
  const parsed = getExpiryYearMonth(expiryDate);
  if (!parsed?.year || !parsed?.month || parsed.month < 1 || parsed.month > 12) {
    return null;
  }

  return new Date(Date.UTC(parsed.year, parsed.month, 0, 23, 59, 59, 999));
};

const isExpiryBeforePurchaseMonth = (expiryDate, purchaseDate) => {
  if (!expiryDate) {
    return false;
  }

  const parsedExpiry = getExpiryYearMonth(expiryDate);
  if (!parsedExpiry?.year || !parsedExpiry?.month) {
    return true;
  }

  const purchaseMonthDate = new Date(purchaseDate);
  if (Number.isNaN(purchaseMonthDate.getTime())) {
    return true;
  }

  const expiryMonth = new Date(parsedExpiry.year, parsedExpiry.month - 1, 1);
  const purchaseMonth = new Date(
    purchaseMonthDate.getFullYear(),
    purchaseMonthDate.getMonth(),
    1
  );

  return expiryMonth < purchaseMonth;
};

const restorePurchaseInventory = async (purchase, session) => {
  for (const item of purchase.items) {
    const inventory = await Inventory.findOne({
      medicine: item.medicine,
      batchNumber: { $regex: new RegExp(`^${escapeRegex(item.batchNumber)}$`, 'i') },
      isDeleted: false
    }).session(session);

    if (!inventory) {
      continue;
    }

    const conversionFactor = item.conversionFactor || 1;
    const purchasedQty = item.quantity * conversionFactor;
    const freeQty = (item.freeQuantity || 0) * conversionFactor;

    inventory.quantityPurchased = Math.max(0, inventory.quantityPurchased - purchasedQty);
    inventory.freeQuantity = Math.max(0, inventory.freeQuantity - freeQty);
    inventory.quantityAvailable = inventory.quantityPurchased + inventory.freeQuantity;

    await inventory.save({ session });
  }
};

// @desc    Get last purchase price for a medicine
// @route   GET /api/purchases/last-price/:medicineId
// @access  Private
exports.getLastPurchasePrice = async (req, res) => {
  try {
    const { medicineId } = req.params;

    // Find the last purchase that included this medicine
    const lastPurchase = await Purchase.findOne({
      'items.medicine': medicineId,
      isDeleted: false
    })
      .sort({ purchaseDate: -1 })
      .populate('items.medicine', 'medicineName');

    if (!lastPurchase) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No previous purchase found'
      });
    }

    // Get the specific item from the purchase
    const item = lastPurchase.items.find(
      i => i.medicine._id.toString() === medicineId
    );

    // Get HSN details for GST calculation
    let gstPercent = 0;
    let cgstPercent = 0;
    let sgstPercent = 0;
    let igstPercent = 0;
    
    if (item?.hsnCode) {
      const hsn = await HSN.findOne({ hsnCode: item.hsnCode, isDeleted: false });
      if (hsn) {
        gstPercent = hsn.gstPercent || 0;
        cgstPercent = hsn.cgstPercent || 0;
        sgstPercent = hsn.sgstPercent || 0;
        igstPercent = hsn.igstPercent || 0;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        purchasePrice: item?.purchasePrice || 0,
        mrp: item?.mrp || 0,
        batchNumber: item?.batchNumber || '',
        expiryDate: item?.expiryDate || null,
        purchaseDate: lastPurchase.purchaseDate,
        supplier: lastPurchase.supplier,
        hsnCode: item?.hsnCode || '',
        gstPercent: gstPercent,
        cgstPercent: cgstPercent,
        sgstPercent: sgstPercent,
        igstPercent: igstPercent,
        unit: item?.unit || null,
        baseUnit: item?.baseUnit || null,
        sellingUnit: item?.sellingUnit || null,
        conversionFactor: item?.conversionFactor || 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting last purchase price',
      error: error.message
    });
  }
};

// @desc    Check if batch exists for a medicine
// @route   GET /api/purchases/check-batch
// @access  Private
exports.checkBatchExists = async (req, res) => {
  try {
    const { medicineId, batchNumber } = req.query;

    if (!medicineId || !batchNumber) {
      return res.status(400).json({
        success: false,
        message: 'Medicine ID and batch number are required'
      });
    }

    // Use case-insensitive search for batch number
    const existingBatch = await Inventory.findOne({
      medicine: medicineId,
      batchNumber: { $regex: new RegExp(`^${escapeRegex(batchNumber)}$`, 'i') },
      isDeleted: false
    });

    res.status(200).json({
      success: true,
      exists: !!existingBatch,
      data: existingBatch ? {
        batchNumber: existingBatch.batchNumber,
        expiryDate: existingBatch.expiryDate,
        quantityAvailable: existingBatch.quantityAvailable,
        purchasePrice: existingBatch.purchasePrice,
        mrp: existingBatch.mrp
      } : null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error checking batch',
      error: error.message
    });
  }
};

// @desc    Get all purchases
// @route   GET /api/purchases
// @access  Private
exports.getPurchases = async (req, res) => {
  try {
    const { supplier, startDate, endDate, search, page = 1, limit = 20 } = req.query;

    let query = { isDeleted: false };

    // Search by supplier invoice number
    if (search) {
      query.supplierInvoiceNumber = { $regex: escapeRegex(search), $options: 'i' };
    }

    if (supplier) {
      query.supplier = supplier;
    }

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) {
        query.purchaseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = end;
      }
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const purchases = await Purchase.find(query)
      .populate('supplier', 'supplierName gstNumber')
      .populate('createdBy', 'name')
      .populate('items.medicine', 'medicineName brandName')
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Purchase.countDocuments(query);

    res.status(200).json({
      success: true,
      count: purchases.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: purchases
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting purchases',
      error: error.message
    });
  }
};

// @desc    Get single purchase
// @route   GET /api/purchases/:id
// @access  Private
exports.getPurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      isDeleted: false
    })
      .populate('supplier')
      .populate('createdBy', 'name')
      .populate('items.medicine', 'medicineName brandName strength packSize');

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    res.status(200).json({
      success: true,
      data: purchase
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting purchase',
      error: error.message
    });
  }
};

// @desc    Delete purchase and rollback inventory stock
// @route   DELETE /api/purchases/:id
// @access  Private
exports.deletePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    // Step 1: Find the purchase by id
    const purchase = await Purchase.findOne({
      _id: id,
      isDeleted: false
    }).session(session);

    if (!purchase) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    // Step 2 & 3: Restore stock from this purchase
    await restorePurchaseInventory(purchase, session);

    // Step 5: Soft delete purchase
    purchase.isDeleted = true;
    await purchase.save({ session });

    // Step 6: Commit mongoose transaction
    await session.commitTransaction();

    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Purchase deleted successfully and inventory stock restored',
      data: {
        purchaseId: purchase._id,
        purchaseNumber: purchase.purchaseNumber
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error deleting purchase. Please try again.',
      error: error.message
    });
  }
};

// @desc    Add new purchase (creates Inventory entries for stock)
// @route   POST /api/purchases
// @access  Private
exports.addPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      supplier,
      purchaseDate,
      supplierInvoiceNumber,
      items,
      subtotal,
      totalGst,
      discountPercent,
      discountAmount,
      miscellaneousAmount,
      grandTotal,
      paymentMode,
      notes
    } = req.body;
    const normalizedInvoiceNumber = normalizeWhitespace(supplierInvoiceNumber);
    const normalizedNotes = normalizeOptionalText(notes);

    if (!supplier) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Supplier is required'
      });
    }

    if (!purchaseDate || isFutureDate(purchaseDate)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Purchase date cannot be in the future'
      });
    }

    if (normalizedInvoiceNumber.length < 2) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Supplier invoice number is required'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'At least one purchase item is required'
      });
    }

    if (miscellaneousAmount !== undefined && !isNonNegativeNumber(miscellaneousAmount)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Miscellaneous amount must be 0 or higher'
      });
    }

    if (paymentMode && !['CASH', 'UPI', 'CARD', 'CREDIT'].includes(paymentMode)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid payment mode'
      });
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      if (!item.medicine) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Medicine is required for item ${index + 1}`
        });
      }

      if (!isValidHSN(item.hsnCode || '')) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Valid HSN code is required for item ${index + 1}`
        });
      }
    
      

      if (!item.expiryDate || isExpiryBeforePurchaseMonth(item.expiryDate, purchaseDate)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Expiry month cannot be earlier than purchase date for item ${index + 1}`
        });
      }

      if (!isPositiveInteger(item.quantity)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Quantity must be greater than 0 for item ${index + 1}`
        });
      }

      if (!isNonNegativeInteger(item.freeQuantity || 0)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Free quantity cannot be negative for item ${index + 1}`
        });
      }

      if (!isNonNegativeNumber(item.purchasePrice) || !isNonNegativeNumber(item.mrp || 0)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Purchase price and MRP must be 0 or higher for item ${index + 1}`
        });
      }

      const itemDiscountType = item.discountType || 'PERCENT';
      const itemSubtotal = Number(item.quantity || 0) * Number(item.purchasePrice || 0);

      if (!['PERCENT', 'AMOUNT'].includes(itemDiscountType)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Discount type must be PERCENT or AMOUNT for item ${index + 1}`
        });
      }

      if (itemDiscountType === 'PERCENT') {
        if (!isNonNegativeNumber(item.discountPercent || 0) || Number(item.discountPercent || 0) > 100) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Discount percent must be between 0 and 100 for item ${index + 1}`
          });
        }
      }

      if (itemDiscountType === 'AMOUNT') {
        if (!isNonNegativeNumber(item.discountAmount || 0)) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Discount amount must be 0 or higher for item ${index + 1}`
          });
        }

        if (Number(item.discountAmount || 0) > itemSubtotal) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Discount amount cannot exceed subtotal for item ${index + 1}`
          });
        }
      }
    }

    // Validate supplier
    const supplierDoc = await Supplier.findById(supplier);
    if (!supplierDoc) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Validate supplier invoice number is provided
    // Generate purchase number
    const purchaseNumber = await Purchase.generatePurchaseNumber();

    // Process items and calculate totals with new formula
    let calculatedSubtotal = 0;
    let calculatedDiscount = 0;
    let calculatedGst = 0;

    const processedItems = [];
    for (const item of items) {
        const medicine = await Medicine.findById(item.medicine).session(session);
        if (!medicine) {
          throw new Error(`Medicine not found: ${item.medicine}`);
        }

        // Validate HSN code is required for GST calculation
        if (!item.hsnCode) {
          throw new Error("HSN code is required for GST calculation");
        }

        // Get HSN details - GST must come from HSN collection
        let hsnRef = null;
        let gstPercent = 0;
        let cgstPercent = 0;
        let sgstPercent = 0;
        let igstPercent = 0;
        
        if (item.hsnCode) {
          hsnRef = await HSN.findOne({ hsnCode: item.hsnCode, isDeleted: false }).session(session);
          if (hsnRef) {
            // Use GST from HSN collection - can be overridden by item.gstPercent if explicitly provided
            gstPercent = hsnRef.gstPercent || 0;
            cgstPercent = hsnRef.cgstPercent || (gstPercent / 2);
            sgstPercent = hsnRef.sgstPercent || (gstPercent / 2);
            igstPercent = hsnRef.igstPercent || gstPercent;
          }
        }

        // Allow manual override of GST percentage (item.gstPercent takes precedence over HSN)
        // But if item.gstPercent is not provided, use HSN-derived value
        if (item.gstPercent !== undefined && item.gstPercent !== null) {
          gstPercent = item.gstPercent;
          cgstPercent = gstPercent / 2;
          sgstPercent = gstPercent / 2;
        }

        // Calculate item amounts with new formula
        // subtotal = quantity × purchasePrice
        const itemSubtotal = item.quantity * item.purchasePrice;
        
        const itemDiscountType = item.discountType === 'AMOUNT' ? 'AMOUNT' : 'PERCENT';
        const normalizedDiscountPercent = Number(item.discountPercent || 0);
        const normalizedDiscountAmount = Number(item.discountAmount || 0);
        const itemDiscountAmount = itemDiscountType === 'PERCENT'
          ? itemSubtotal * (normalizedDiscountPercent / 100)
          : Math.min(normalizedDiscountAmount, itemSubtotal);
        
        // taxableAmount = subtotal - discountAmount
        const itemTaxableAmount = itemSubtotal - itemDiscountAmount;
        
        // gstAmount = taxableAmount × gstPercent / 100
        const itemGstAmount = itemTaxableAmount * (gstPercent / 100);
        
        // totalAmount = taxableAmount + gstAmount
        const itemTotalAmount = itemTaxableAmount + itemGstAmount;

        calculatedSubtotal += itemSubtotal;
        calculatedDiscount += itemDiscountAmount;
        calculatedGst += itemGstAmount;

        const normalizedExpiryDate = normalizeExpiryToMonthEnd(item.expiryDate);
        if (!normalizedExpiryDate) {
          throw new Error(`Invalid expiry date for medicine: ${item.medicine}`);
        }

        processedItems.push({
          medicine: item.medicine,
          hsnCode: item.hsnCode || null,
          hsnCodeRef: hsnRef ? hsnRef._id : null,
          gstPercent: gstPercent,
          // Unit conversion fields
          unit: item.unit || medicine.sellingUnit || null,
          baseUnit: item.baseUnit || medicine.baseUnit || null,
          sellingUnit: item.sellingUnit || medicine.sellingUnit || null,
          conversionFactor: item.conversionFactor || medicine.conversionFactor || 1,
        // Batch details - normalize to uppercase and trim
          batchNumber: normalizeUppercase(item.batchNumber),
          expiryDate: normalizedExpiryDate,
          mrp: item.mrp || 0,
          // Prices
          purchasePrice: item.purchasePrice,
          // Quantity
          quantity: item.quantity,
          freeQuantity: item.freeQuantity || 0,
          // Discount
          discountType: itemDiscountType,
          discountPercent: itemDiscountType === 'PERCENT' ? normalizedDiscountPercent : 0,
          discountAmount: itemDiscountAmount,
          // Calculations
          subtotal: itemSubtotal,
          taxableAmount: itemTaxableAmount,
          // GST breakdown
          cgstPercent: cgstPercent,
          sgstPercent: sgstPercent,
          igstPercent: igstPercent,
          gstAmount: itemGstAmount,
          cgstAmount: itemGstAmount * (cgstPercent / gstPercent || 0.5),
          sgstAmount: itemGstAmount * (sgstPercent / gstPercent || 0.5),
          igstAmount: itemGstAmount * (igstPercent / gstPercent || 1),
          totalAmount: itemTotalAmount
        });
    }

    const calculatedDiscountAmount = calculatedDiscount;
    const calculatedMiscellaneousAmount = miscellaneousAmount || 0;

    const finalGrandTotal = calculatedSubtotal + calculatedGst - calculatedDiscountAmount + calculatedMiscellaneousAmount;

    // Create purchase record with new fields
    const purchase = new Purchase({
      purchaseNumber,
      supplierInvoiceNumber: normalizedInvoiceNumber,
      supplier,
      purchaseDate: purchaseDate || new Date(),
      items: processedItems,
      subtotal: calculatedSubtotal,
      totalGst: calculatedGst,
      totalCgst: calculatedGst / 2,
      totalSgst: calculatedGst / 2,
      totalIgst: 0,
      discountPercent: 0,
      discountAmount: calculatedDiscountAmount,
      miscellaneousAmount: calculatedMiscellaneousAmount,
      grandTotal: finalGrandTotal,
      paymentMode: paymentMode || 'CASH',
      notes: normalizedNotes,
      createdBy: req.user.id
    });

    await purchase.save({ session });

    // Create or update Inventory entries with unit conversion
    for (const [index, item] of items.entries()) {
        // Get medicine for unit conversion
        const medicine = await Medicine.findById(item.medicine).session(session);
        
        // Get the processed item to get GST from HSN (already calculated)
        const processedItem = processedItems[index];
        
        // Calculate base unit quantity
        const conversionFactor = item.conversionFactor || medicine?.conversionFactor || 1;
        const totalQuantity = (item.quantity * conversionFactor) + ((item.freeQuantity || 0) * conversionFactor);

        // Check for existing inventory batch with same medicine + batchNumber (normalized to uppercase)
        const normalizedBatchNumber = normalizeUppercase(item.batchNumber);
        let existingInventory = await Inventory.findOne({
          medicine: item.medicine,
          batchNumber: { $regex: new RegExp(`^${escapeRegex(normalizedBatchNumber)}$`, 'i') },
          isDeleted: false
        }).session(session);

        if (existingInventory) {
          // Update existing inventory quantities with unit conversion
          existingInventory.quantityPurchased += (item.quantity * conversionFactor);
          if (item.freeQuantity) {
            existingInventory.freeQuantity += (item.freeQuantity * conversionFactor);
          }
          existingInventory.quantityAvailable = existingInventory.quantityPurchased + existingInventory.freeQuantity;
          existingInventory.purchasePrice = item.purchasePrice;
          existingInventory.mrp = item.mrp || 0;
          existingInventory.supplier = supplier;
          existingInventory.hsnCodeString = item.hsnCode || null;
          // Use GST from processed item (from HSN)
          existingInventory.gstPercent = processedItem.gstPercent || 0;
          // Ensure batch number is stored in uppercase
          existingInventory.batchNumber = normalizedBatchNumber;
          await existingInventory.save({ session });
        } else {
          // Create new Inventory entry with unit conversion
          const newInventory = new Inventory({
            medicine: item.medicine,
            batchNumber: normalizedBatchNumber,
            expiryDate: processedItem.expiryDate,
            quantityPurchased: item.quantity * conversionFactor,
            freeQuantity: (item.freeQuantity || 0) * conversionFactor,
            quantityAvailable: totalQuantity,
            purchasePrice: item.purchasePrice,
            mrp: item.mrp || 0,
            supplier: supplier,
            purchase: purchase._id,
            hsnCodeString: item.hsnCode || null,
            hsnCode: processedItem.hsnCodeRef || null,
            // Use GST from processed item (from HSN)
            gstPercent: processedItem.gstPercent || 0
          });
          await newInventory.save({ session });
        }
    }

    await session.commitTransaction();

    session.endSession();

    // Populate and return
    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'supplierName gstNumber')
      .populate('createdBy', 'name')
      .populate('items.medicine', 'medicineName brandName strength packSize');

    res.status(201).json({
      success: true,
      data: populatedPurchase
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error adding purchase',
      error: error.message
    });
  }
};

// @desc    Update purchase and sync inventory
// @route   PUT /api/purchases/:id
// @access  Private
exports.updatePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      isDeleted: false
    }).session(session);

    if (!purchase) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    const {
      supplier,
      purchaseDate,
      supplierInvoiceNumber,
      items,
      discountPercent,
      discountAmount,
      miscellaneousAmount,
      paymentMode,
      notes
    } = req.body;
    const normalizedInvoiceNumber = normalizeWhitespace(supplierInvoiceNumber);
    const normalizedNotes = normalizeOptionalText(notes);

    if (!supplier) {
      throw new Error('Supplier is required');
    }

    if (!purchaseDate || isFutureDate(purchaseDate)) {
      throw new Error('Purchase date cannot be in the future');
    }

    if (normalizedInvoiceNumber.length < 2) {
      throw new Error('Supplier invoice number is required');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('At least one purchase item is required');
    }

    if (miscellaneousAmount !== undefined && !isNonNegativeNumber(miscellaneousAmount)) {
      throw new Error('Miscellaneous amount must be 0 or higher');
    }

    if (paymentMode && !['CASH', 'UPI', 'CARD', 'CREDIT'].includes(paymentMode)) {
      throw new Error('Invalid payment mode');
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      if (!item.medicine) {
        throw new Error(`Medicine is required for item ${index + 1}`);
      }

      if (!isValidHSN(item.hsnCode || '')) {
        throw new Error(`Valid HSN code is required for item ${index + 1}`);
      }

      if (item.batchNumber && !isValidBatchNumber(item.batchNumber || '')) {
        throw new Error(`Valid batch number is required for item ${index + 1}`);
      }

      if (!item.expiryDate || isExpiryBeforePurchaseMonth(item.expiryDate, purchaseDate)) {
        throw new Error(`Expiry month cannot be earlier than purchase date for item ${index + 1}`);
      }

      if (!isPositiveInteger(item.quantity)) {
        throw new Error(`Quantity must be greater than 0 for item ${index + 1}`);
      }

      if (!isNonNegativeInteger(item.freeQuantity || 0)) {
        throw new Error(`Free quantity cannot be negative for item ${index + 1}`);
      }

      if (!isNonNegativeNumber(item.purchasePrice) || !isNonNegativeNumber(item.mrp || 0)) {
        throw new Error(`Purchase price and MRP must be 0 or higher for item ${index + 1}`);
      }

      const itemDiscountType = item.discountType || 'PERCENT';
      const itemSubtotal = Number(item.quantity || 0) * Number(item.purchasePrice || 0);

      if (!['PERCENT', 'AMOUNT'].includes(itemDiscountType)) {
        throw new Error(`Discount type must be PERCENT or AMOUNT for item ${index + 1}`);
      }

      if (itemDiscountType === 'PERCENT') {
        if (!isNonNegativeNumber(item.discountPercent || 0) || Number(item.discountPercent || 0) > 100) {
          throw new Error(`Discount percent must be between 0 and 100 for item ${index + 1}`);
        }
      }

      if (itemDiscountType === 'AMOUNT') {
        if (!isNonNegativeNumber(item.discountAmount || 0)) {
          throw new Error(`Discount amount must be 0 or higher for item ${index + 1}`);
        }

        if (Number(item.discountAmount || 0) > itemSubtotal) {
          throw new Error(`Discount amount cannot exceed subtotal for item ${index + 1}`);
        }
      }
    }

    const supplierDoc = await Supplier.findById(supplier).session(session);
    if (!supplierDoc) {
      throw new Error('Supplier not found');
    }

    await restorePurchaseInventory(purchase, session);

    let calculatedSubtotal = 0;
    let calculatedDiscount = 0;
    let calculatedGst = 0;
    const processedItems = [];

    for (const item of items) {
      const medicine = await Medicine.findById(item.medicine).session(session);
      if (!medicine) {
        throw new Error(`Medicine not found: ${item.medicine}`);
      }

      if (!item.hsnCode) {
        throw new Error('HSN code is required for GST calculation');
      }

      let hsnRef = null;
      let gstPercent = 0;
      let cgstPercent = 0;
      let sgstPercent = 0;
      let igstPercent = 0;

      if (item.hsnCode) {
        hsnRef = await HSN.findOne({ hsnCode: item.hsnCode, isDeleted: false }).session(session);
        if (hsnRef) {
          gstPercent = hsnRef.gstPercent || 0;
          cgstPercent = hsnRef.cgstPercent || (gstPercent / 2);
          sgstPercent = hsnRef.sgstPercent || (gstPercent / 2);
          igstPercent = hsnRef.igstPercent || gstPercent;
        }
      }

      if (item.gstPercent !== undefined && item.gstPercent !== null) {
        gstPercent = item.gstPercent;
        cgstPercent = gstPercent / 2;
        sgstPercent = gstPercent / 2;
      }

      const itemSubtotal = item.quantity * item.purchasePrice;
      const itemDiscountType = item.discountType === 'AMOUNT' ? 'AMOUNT' : 'PERCENT';
      const normalizedDiscountPercent = Number(item.discountPercent || 0);
      const normalizedDiscountAmount = Number(item.discountAmount || 0);
      const itemDiscountAmount = itemDiscountType === 'PERCENT'
        ? itemSubtotal * (normalizedDiscountPercent / 100)
        : Math.min(normalizedDiscountAmount, itemSubtotal);
      const itemTaxableAmount = itemSubtotal - itemDiscountAmount;
      const itemGstAmount = itemTaxableAmount * (gstPercent / 100);
      const itemTotalAmount = itemTaxableAmount + itemGstAmount;

      calculatedSubtotal += itemSubtotal;
      calculatedDiscount += itemDiscountAmount;
      calculatedGst += itemGstAmount;

      const normalizedExpiryDate = normalizeExpiryToMonthEnd(item.expiryDate);
      if (!normalizedExpiryDate) {
        throw new Error(`Invalid expiry date for medicine: ${item.medicine}`);
      }

      processedItems.push({
        medicine: item.medicine,
        hsnCode: item.hsnCode || null,
        hsnCodeRef: hsnRef ? hsnRef._id : null,
        gstPercent,
        unit: item.unit || medicine.sellingUnit || null,
        baseUnit: item.baseUnit || medicine.baseUnit || null,
        sellingUnit: item.sellingUnit || medicine.sellingUnit || null,
        conversionFactor: item.conversionFactor || medicine.conversionFactor || 1,
        batchNumber: normalizeUppercase(item.batchNumber),
        expiryDate: normalizedExpiryDate,
        mrp: item.mrp || 0,
        purchasePrice: item.purchasePrice,
        quantity: item.quantity,
        freeQuantity: item.freeQuantity || 0,
        discountType: itemDiscountType,
        discountPercent: itemDiscountType === 'PERCENT' ? normalizedDiscountPercent : 0,
        discountAmount: itemDiscountAmount,
        subtotal: itemSubtotal,
        taxableAmount: itemTaxableAmount,
        cgstPercent,
        sgstPercent,
        igstPercent,
        gstAmount: itemGstAmount,
        cgstAmount: itemGstAmount * (cgstPercent / gstPercent || 0.5),
        sgstAmount: itemGstAmount * (sgstPercent / gstPercent || 0.5),
        igstAmount: itemGstAmount * (igstPercent / gstPercent || 1),
        totalAmount: itemTotalAmount
      });
    }

    const calculatedDiscountAmount = calculatedDiscount;
    const calculatedMiscellaneousAmount = miscellaneousAmount || 0;
    const finalGrandTotal = calculatedSubtotal + calculatedGst - calculatedDiscountAmount + calculatedMiscellaneousAmount;

    purchase.supplierInvoiceNumber = normalizedInvoiceNumber;
    purchase.supplier = supplier;
    purchase.purchaseDate = purchaseDate || new Date();
    purchase.items = processedItems;
    purchase.subtotal = calculatedSubtotal;
    purchase.totalGst = calculatedGst;
    purchase.totalCgst = calculatedGst / 2;
    purchase.totalSgst = calculatedGst / 2;
    purchase.totalIgst = 0;
    purchase.discountPercent = 0;
    purchase.discountAmount = calculatedDiscountAmount;
    purchase.miscellaneousAmount = calculatedMiscellaneousAmount;
    purchase.grandTotal = finalGrandTotal;
    purchase.paymentMode = paymentMode || 'CASH';
    purchase.notes = normalizedNotes;

    await purchase.save({ session });

    for (const [index, item] of items.entries()) {
      const medicine = await Medicine.findById(item.medicine).session(session);
      const processedItem = processedItems[index];
      const conversionFactor = item.conversionFactor || medicine?.conversionFactor || 1;
      const totalQuantity = (item.quantity * conversionFactor) + ((item.freeQuantity || 0) * conversionFactor);
      const normalizedBatchNumber = normalizeUppercase(item.batchNumber);

      let existingInventory = await Inventory.findOne({
        medicine: item.medicine,
        batchNumber: { $regex: new RegExp(`^${escapeRegex(normalizedBatchNumber)}$`, 'i') },
        isDeleted: false
      }).session(session);

      if (existingInventory) {
        existingInventory.quantityPurchased += (item.quantity * conversionFactor);
        if (item.freeQuantity) {
          existingInventory.freeQuantity += (item.freeQuantity * conversionFactor);
        }
        existingInventory.quantityAvailable = existingInventory.quantityPurchased + existingInventory.freeQuantity;
        existingInventory.purchasePrice = item.purchasePrice;
        existingInventory.mrp = item.mrp || 0;
        existingInventory.supplier = supplier;
        existingInventory.purchase = purchase._id;
        existingInventory.hsnCodeString = item.hsnCode || null;
        existingInventory.gstPercent = processedItem.gstPercent || 0;
        existingInventory.batchNumber = normalizedBatchNumber;
        existingInventory.expiryDate = processedItem.expiryDate;
        await existingInventory.save({ session });
      } else {
        const newInventory = new Inventory({
          medicine: item.medicine,
          batchNumber: normalizedBatchNumber,
          expiryDate: processedItem.expiryDate,
          quantityPurchased: item.quantity * conversionFactor,
          freeQuantity: (item.freeQuantity || 0) * conversionFactor,
          quantityAvailable: totalQuantity,
          purchasePrice: item.purchasePrice,
          mrp: item.mrp || 0,
          supplier,
          purchase: purchase._id,
          hsnCodeString: item.hsnCode || null,
          hsnCode: processedItem.hsnCodeRef || null,
          gstPercent: processedItem.gstPercent || 0
        });
        await newInventory.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'supplierName gstNumber')
      .populate('createdBy', 'name')
      .populate('items.medicine', 'medicineName brandName strength packSize');

    res.status(200).json({
      success: true,
      data: populatedPurchase
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating purchase',
      error: error.message
    });
  }
};

// @desc    Get purchase report
// @route   GET /api/purchases/report
// @access  Private/Admin
exports.getPurchaseReport = async (req, res) => {
  try {
    const { startDate, endDate, supplier } = req.query;

    let query = { isDeleted: false };

    if (supplier) {
      query.supplier = supplier;
    }

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) {
        query.purchaseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = end;
      }
    }

    const purchases = await Purchase.find(query)
      .populate('supplier', 'supplierName gstNumber')
      .populate('createdBy', 'name')
      .sort({ purchaseDate: -1 });

    const summary = purchases.reduce(
      (acc, purchase) => {
        acc.totalPurchases += purchase.grandTotal;
        acc.totalGst += purchase.totalGst;
        acc.totalItems += purchase.items.length;
        return acc;
      },
      { totalPurchases: 0, totalGst: 0, totalItems: 0 }
    );

    res.status(200).json({
      success: true,
      data: {
        purchases,
        summary
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error generating purchase report',
      error: error.message
    });
  }
};
