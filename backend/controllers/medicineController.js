const Medicine = require('../models/Medicine');
const Inventory = require('../models/Inventory');
const HSN = require('../models/HSN');
const {
  isNonNegativeInteger,
  isNonNegativeNumber,
  isValidBarcode,
  isValidGTIN,
  normalizeOptionalText,
  normalizeWhitespace
} = require('../utils/validation');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Get all medicines with stock info
// @route   GET /api/medicines
// @access  Private
exports.getMedicines = async (req, res) => {
  try {
    const { search, brand, status, page = 1, limit = 20 } = req.query;

    let query = { isDeleted: false };

    // Search functionality
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { medicineName: { $regex: escapedSearch, $options: 'i' } },
        { brandName: { $regex: escapedSearch, $options: 'i' } },
        { barcode: { $regex: escapedSearch, $options: 'i' } },
        { hsnCodeString: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    if (brand) {
      query.brandName = { $regex: brand, $options: 'i' };
    }

    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const medicines = await Medicine.find(query)
      .populate('hsnCode', 'hsnCode description gstPercent')
      .sort({ medicineName: 1 })
      .skip(skip)
      .limit(limitNum);

    // Get latest MRP from inventory for list view
    const medicineIds1 = medicines.map(m => m._id);
    const latestMrps = await Inventory.aggregate([
      {
        $match: {
          medicine: { $in: medicineIds1 },
          isDeleted: false
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$medicine',
          latestMrp: { $first: '$mrp' }
        }
      }
    ]);

    const mrpMap = {};
    latestMrps.forEach(item => {
      mrpMap[item._id.toString()] = item.latestMrp;
    });

    const total = await Medicine.countDocuments(query);

    // Get stock info from Inventory for each medicine
    const medicineIds = medicines.map(m => m._id);
    const inventoryStats = await Inventory.aggregate([
      {
        $match: {
          medicine: { $in: medicineIds },
          isDeleted: false,
          quantityAvailable: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' },
          earliestExpiry: { $min: '$expiryDate' },
          latestExpiry: { $max: '$expiryDate' },
          latestMrp: { $max: '$mrp' }
        }
      }
    ]);

    // Create a map for quick lookup
    const inventoryMap = {};
    inventoryStats.forEach(stat => {
      inventoryMap[stat._id.toString()] = {
        quantity: stat.totalQuantity,
        earliestExpiry: stat.earliestExpiry,
        latestExpiry: stat.latestExpiry,
        latestMrp: stat.latestMrp || 0
      };
    });

    // Add stock info to medicines
    const medicinesWithStock = medicines.map(med => {
      const stock = inventoryMap[med._id.toString()] || { quantity: 0, earliestExpiry: null, latestExpiry: null, latestMrp: 0 };
      const latestMrp = stock.latestMrp || mrpMap[med._id.toString()] || med.defaultSellingPrice || 0;
      return {
        ...med.toObject(),
        quantity: stock.quantity,
        expiryDate: stock.earliestExpiry,
        latestExpiry: stock.latestExpiry,
        latestInventoryMrp: latestMrp
      };
    });

    res.status(200).json({
      success: true,
      count: medicinesWithStock.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: medicinesWithStock
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting medicines',
      error: error.message
    });
  }
};

// @desc    Get single medicine with stock
// @route   GET /api/medicines/:id
// @access  Private
exports.getMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      isDeleted: false
    }).populate('hsnCode', 'hsnCode description gstPercent');

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Get stock from Inventory
    const inventoryStats = await Inventory.aggregate([
      { $match: { medicine: medicine._id, isDeleted: false } },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' },
          batches: {
            $push: {
              batchNumber: '$batchNumber',
              expiryDate: '$expiryDate',
              quantity: '$quantityAvailable',
              status: '$status',
              hsnCode: '$hsnCodeString',
              gstPercent: '$gstPercent'
            }
          }
        }
      }
    ]);

    const stockInfo = inventoryStats[0] || { totalQuantity: 0, batches: [] };

    res.status(200).json({
      success: true,
      data: {
        ...medicine.toObject(),
        quantity: stockInfo.totalQuantity,
        batches: stockInfo.batches
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting medicine',
      error: error.message
    });
  }
};

// @desc    Search medicines (for billing autocomplete - with stock filter)
// @route   GET /api/medicines/search
// @access  Private
exports.searchMedicines = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const escapedQuery = escapeRegex(q);

    // First find medicines that match the search
    const medicines = await Medicine.find({
      isDeleted: false,
      $or: [
        { medicineName: { $regex: escapedQuery, $options: 'i' } },
        { brandName: { $regex: escapedQuery, $options: 'i' } },
        { barcode: { $regex: escapedQuery, $options: 'i' } }
      ]
    })
      .select('medicineName brandName strength packSize defaultSellingPrice barcode gstPercent gtin hsnCode hsnCodeString baseUnit sellingUnit conversionFactor allowDecimal')
      .populate('hsnCode', 'hsnCode gstPercent')
      .sort({ medicineName: 1 })
      .limit(parseInt(limit) * 2);

    if (medicines.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // Get stock info from Inventory
    const medicineIds = medicines.map(m => m._id);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const inventoryStats = await Inventory.aggregate([
      {
        $match: {
          medicine: { $in: medicineIds },
          quantityAvailable: { $gt: 0 },
          expiryDate: { $gte: startOfToday },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' },
          earliestExpiry: { $min: '$expiryDate' },
          latestMrp: { $max: '$mrp' }
        }
      }
    ]);

    const inventoryMap = {};
    inventoryStats.forEach(stat => {
      inventoryMap[stat._id.toString()] = {
        quantity: stat.totalQuantity,
        expiryDate: stat.earliestExpiry
      };
    });

    // Filter medicines that have stock and add stock info
    const medicinesWithStock = medicines
      .map(med => {
        const stock = inventoryMap[med._id.toString()];
        const latestMrp = stock?.latestMrp || med.defaultSellingPrice || med.latestInventoryMrp || 0;
        return {
          ...med.toObject(),
          quantity: stock?.quantity || 0,
          expiryDate: stock?.earliestExpiry || null,
          latestInventoryMrp: latestMrp,
          defaultSellingPrice: latestMrp
        };
      })
      .filter(med => med.quantity > 0)
      .slice(0, parseInt(limit));

    res.status(200).json({
      success: true,
      data: medicinesWithStock
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error searching medicines',
      error: error.message
    });
  }
};

// @desc    Search ALL medicines for Purchase module (NO inventory filter)
// @route   GET /api/medicines/search-all
// @access  Private
exports.searchAllMedicines = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 1) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const escapedQuery = escapeRegex(q);

    // Search medicines without checking inventory - Purchase module should see ALL medicines
    const medicines = await Medicine.find({
      isDeleted: false,
      status: 'ACTIVE',
      $or: [
        { medicineName: { $regex: escapedQuery, $options: 'i' } },
        { brandName: { $regex: escapedQuery, $options: 'i' } },
        { barcode: { $regex: escapedQuery, $options: 'i' } },
        { gtin: { $regex: escapedQuery, $options: 'i' } }
      ]
    })
      .select('medicineName brandName strength packSize manufacturer barcode baseUnit sellingUnit conversionFactor defaultSellingPrice status hsnCode hsnCodeString gstPercent')
      .populate('hsnCode', 'hsnCode gstPercent')
      .sort({ medicineName: 1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: medicines
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error searching medicines',
      error: error.message
    });
  }
};

// @desc    Get medicine by barcode
// @route   GET /api/medicines/barcode/:barcode
// @access  Private
exports.getMedicineByBarcode = async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      barcode: req.params.barcode,
      isDeleted: false,
      status: 'ACTIVE'
    }).populate('hsnCode', 'hsnCode gstPercent');

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found with this barcode'
      });
    }

    // Get stock from Inventory
    const inventoryStats = await Inventory.aggregate([
      {
        $match: {
          medicine: medicine._id,
          quantityAvailable: { $gt: 0 },
          expiryDate: { $gt: new Date() },
          status: 'ACTIVE',
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' },
          earliestExpiry: { $min: '$expiryDate' }
        }
      }
    ]);

    const stockInfo = inventoryStats[0] || { totalQuantity: 0, earliestExpiry: null };

    // Check if expired
    if (stockInfo.earliestExpiry && stockInfo.earliestExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This medicine has expired',
        data: {
          ...medicine.toObject(),
          quantity: stockInfo.totalQuantity,
          expiryDate: stockInfo.earliestExpiry
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...medicine.toObject(),
        quantity: stockInfo.totalQuantity,
        expiryDate: stockInfo.earliestExpiry
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting medicine',
      error: error.message
    });
  }
};

// @desc    Add new medicine (Product Master - no stock)
// @route   POST /api/medicines
// @access  Private/Admin
exports.addMedicine = async (req, res) => {
  try {
    const {
      medicineName,
      brandName,
      strength,
      packSize,
      manufacturer,
      barcode,
      gtin,
      hsnCode,
      hsnCodeString,
      gstPercent,
      defaultSellingPrice,
      reorderLevel,
      status,
      // Unit Conversion fields (Part 2, 8)
      baseUnit,
      sellingUnit,
      conversionFactor,
      allowDecimal,
      // More Options fields (Part 4)
      askDose,
      salt,
      colorType,
      packing,
      decimalAllowed,
      itemType
    } = req.body;
    const normalizedMedicineName = normalizeWhitespace(medicineName);
    const normalizedBrandName = normalizeOptionalText(brandName);
    const normalizedStrength = normalizeOptionalText(strength);
    const normalizedPackSize = normalizeOptionalText(packSize);
    const normalizedManufacturer = normalizeOptionalText(manufacturer);
    const normalizedBarcode = barcode ? String(barcode).trim() : '';
    const normalizedGtin = gtin ? String(gtin).trim() : '';
    const normalizedSalt = normalizeOptionalText(salt);
    const normalizedColorType = normalizeOptionalText(colorType);
    const normalizedPacking = normalizeOptionalText(packing);

    if (normalizedMedicineName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Medicine name must be at least 2 characters'
      });
    }

    if (normalizedBarcode && !isValidBarcode(normalizedBarcode)) {
      return res.status(400).json({
        success: false,
        message: 'Barcode must be 8 to 14 digits'
      });
    }

    if (normalizedGtin && !isValidGTIN(normalizedGtin)) {
      return res.status(400).json({
        success: false,
        message: 'GTIN must be 8 to 14 digits'
      });
    }

    if ((baseUnit && !sellingUnit) || (!baseUnit && sellingUnit)) {
      return res.status(400).json({
        success: false,
        message: 'Base unit and selling unit must be provided together'
      });
    }

    // Validate conversionFactor (Part 8)
    if (conversionFactor !== undefined && conversionFactor !== null && conversionFactor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Conversion factor must be greater than 0'
      });
    }

    if (defaultSellingPrice !== undefined && defaultSellingPrice !== null && defaultSellingPrice !== '' && !isNonNegativeNumber(defaultSellingPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Default selling price cannot be negative'
      });
    }

    if (reorderLevel !== undefined && reorderLevel !== null && !isNonNegativeInteger(reorderLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Reorder level must be 0 or higher'
      });
    }

    // Check for duplicate barcode
    if (barcode) {
      const existingBarcode = await Medicine.findOne({
        barcode: normalizedBarcode,
        isDeleted: false
      });

      if (existingBarcode) {
        return res.status(400).json({
          success: false,
          message: 'Medicine with this barcode already exists'
        });
      }
    }

    // Check for duplicate GTIN
    if (gtin) {
      const existingGtin = await Medicine.findOne({
        gtin: normalizedGtin,
        isDeleted: false
      });

      if (existingGtin) {
        return res.status(400).json({
          success: false,
          message: 'Medicine with this GTIN already exists'
        });
      }
    }

    // If HSN code is provided, fetch and validate
    let hsnRef = null;
    let finalGstPercent = gstPercent || 12;
    
    if (hsnCode) {
      hsnRef = await HSN.findById(hsnCode);
      if (!hsnRef) {
        // Try finding by HSN code string
        hsnRef = await HSN.findOne({ hsnCode: hsnCodeString, isDeleted: false, status: 'ACTIVE' });
      }
      if (hsnRef) {
        finalGstPercent = hsnRef.gstPercent;
      }
    }

    const medicine = await Medicine.create({
      medicineName: normalizedMedicineName,
      // Allow null values for optional fields (Part 1)
      brandName: normalizedBrandName,
      strength: normalizedStrength,
      packSize: normalizedPackSize,
      manufacturer: normalizedManufacturer,
      barcode: normalizedBarcode || null,
      gtin: normalizedGtin || null,
      hsnCode: hsnRef ? hsnRef._id : null,
      hsnCodeString: hsnCodeString || (hsnRef ? hsnRef.hsnCode : null),
      gstPercent: finalGstPercent,
      defaultSellingPrice: defaultSellingPrice === '' || defaultSellingPrice === undefined || defaultSellingPrice === null ? null : Number(defaultSellingPrice),
      reorderLevel: reorderLevel === undefined || reorderLevel === null || reorderLevel === '' ? 10 : Number(reorderLevel),
      status: status || 'ACTIVE',
      // Unit Conversion fields (Part 2)
      baseUnit: baseUnit || null,
      sellingUnit: sellingUnit || null,
      conversionFactor: conversionFactor || 1,
      allowDecimal: allowDecimal || false,
      // More Options fields (Part 4)
      askDose: askDose || false,
      salt: normalizedSalt,
      colorType: normalizedColorType,
      packing: normalizedPacking,
      decimalAllowed: decimalAllowed || false,
      itemType: itemType || null
    });

    // Populate HSN if exists
    if (medicine.hsnCode) {
      await medicine.populate('hsnCode', 'hsnCode description gstPercent');
    }

    res.status(201).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error adding medicine',
      error: error.message
    });
  }
};


// @desc    Update medicine (Product Master only)
// @route   PUT /api/medicines/:id
// @access  Private/Admin
exports.updateMedicine = async (req, res) => {
  try {
    const {
      medicineName,
      brandName,
      strength,
      packSize,
      manufacturer,
      barcode,
      gtin,
      hsnCode,
      hsnCodeString,
      gstPercent,
      defaultSellingPrice,
      reorderLevel,
      status,
      // Unit Conversion fields (Part 2, 8)
      baseUnit,
      sellingUnit,
      conversionFactor,
      allowDecimal,
      // More Options fields (Part 4)
      askDose,
      salt,
      colorType,
      packing,
      decimalAllowed,
      itemType
    } = req.body;
    const normalizedMedicineName = medicineName !== undefined ? normalizeWhitespace(medicineName) : undefined;
    const normalizedBrandName = brandName !== undefined ? normalizeOptionalText(brandName) : undefined;
    const normalizedStrength = strength !== undefined ? normalizeOptionalText(strength) : undefined;
    const normalizedPackSize = packSize !== undefined ? normalizeOptionalText(packSize) : undefined;
    const normalizedManufacturer = manufacturer !== undefined ? normalizeOptionalText(manufacturer) : undefined;
    const normalizedBarcode = barcode !== undefined ? String(barcode || '').trim() : undefined;
    const normalizedGtin = gtin !== undefined ? String(gtin || '').trim() : undefined;
    const normalizedSalt = salt !== undefined ? normalizeOptionalText(salt) : undefined;
    const normalizedColorType = colorType !== undefined ? normalizeOptionalText(colorType) : undefined;
    const normalizedPacking = packing !== undefined ? normalizeOptionalText(packing) : undefined;

    if (normalizedMedicineName !== undefined && normalizedMedicineName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Medicine name must be at least 2 characters'
      });
    }

    if (normalizedBarcode && !isValidBarcode(normalizedBarcode)) {
      return res.status(400).json({
        success: false,
        message: 'Barcode must be 8 to 14 digits'
      });
    }

    if (normalizedGtin && !isValidGTIN(normalizedGtin)) {
      return res.status(400).json({
        success: false,
        message: 'GTIN must be 8 to 14 digits'
      });
    }

    // Validate conversionFactor (Part 8)
    if (conversionFactor !== undefined && conversionFactor !== null && conversionFactor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Conversion factor must be greater than 0'
      });
    }

    if (defaultSellingPrice !== undefined && defaultSellingPrice !== null && defaultSellingPrice !== '' && !isNonNegativeNumber(defaultSellingPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Default selling price cannot be negative'
      });
    }

    if (reorderLevel !== undefined && reorderLevel !== null && !isNonNegativeInteger(reorderLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Reorder level must be 0 or higher'
      });
    }

    let medicine = await Medicine.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    const resolvedBaseUnit = baseUnit !== undefined ? baseUnit : medicine.baseUnit;
    const resolvedSellingUnit = sellingUnit !== undefined ? sellingUnit : medicine.sellingUnit;

    if ((resolvedBaseUnit && !resolvedSellingUnit) || (!resolvedBaseUnit && resolvedSellingUnit)) {
      return res.status(400).json({
        success: false,
        message: 'Base unit and selling unit must be provided together'
      });
    }

    // Check for duplicate barcode (excluding current medicine)
    if (normalizedBarcode && normalizedBarcode !== medicine.barcode) {
      const existingBarcode = await Medicine.findOne({
        barcode: normalizedBarcode,
        isDeleted: false,
        _id: { $ne: req.params.id }
      });

      if (existingBarcode) {
        return res.status(400).json({
          success: false,
          message: 'Medicine with this barcode already exists'
        });
      }
    }

    if (normalizedGtin && normalizedGtin !== medicine.gtin) {
      const existingGtin = await Medicine.findOne({
        gtin: normalizedGtin,
        isDeleted: false,
        _id: { $ne: req.params.id }
      });

      if (existingGtin) {
        return res.status(400).json({
          success: false,
          message: 'Medicine with this GTIN already exists'
        });
      }
    }

    // If HSN code is provided, fetch and validate
    let hsnRef = medicine.hsnCode;
    let finalGstPercent = gstPercent || medicine.gstPercent;
    
    if (hsnCode || hsnCodeString) {
      const hsnQuery = hsnCode ? { _id: hsnCode } : { hsnCode: hsnCodeString, isDeleted: false, status: 'ACTIVE' };
      hsnRef = await HSN.findOne(hsnQuery);
      if (hsnRef) {
        finalGstPercent = hsnRef.gstPercent;
      }
    }

    // Update fields - handle null values for optional fields (Part 1)
    medicine.medicineName = normalizedMedicineName || medicine.medicineName;
    medicine.brandName = normalizedBrandName !== undefined ? normalizedBrandName : medicine.brandName;
    medicine.strength = normalizedStrength !== undefined ? normalizedStrength : medicine.strength;
    medicine.packSize = normalizedPackSize !== undefined ? normalizedPackSize : medicine.packSize;
    medicine.manufacturer = normalizedManufacturer !== undefined ? normalizedManufacturer : medicine.manufacturer;
    medicine.barcode = normalizedBarcode !== undefined ? (normalizedBarcode || null) : medicine.barcode;
    medicine.gtin = normalizedGtin !== undefined ? (normalizedGtin || null) : medicine.gtin;
    medicine.hsnCode = hsnRef ? hsnRef._id : medicine.hsnCode;
    medicine.hsnCodeString = hsnCodeString || (hsnRef ? hsnRef.hsnCode : medicine.hsnCodeString);
    medicine.gstPercent = finalGstPercent;
    if (defaultSellingPrice !== undefined) {
      medicine.defaultSellingPrice = defaultSellingPrice === '' || defaultSellingPrice === null ? null : Number(defaultSellingPrice);
    }
    medicine.reorderLevel = reorderLevel !== undefined ? reorderLevel : medicine.reorderLevel;
    medicine.status = status || medicine.status;

    // Unit Conversion fields (Part 2)
    if (baseUnit !== undefined) medicine.baseUnit = baseUnit || null;
    if (sellingUnit !== undefined) medicine.sellingUnit = sellingUnit || null;
    if (conversionFactor !== undefined) medicine.conversionFactor = conversionFactor || 1;
    if (allowDecimal !== undefined) medicine.allowDecimal = allowDecimal;

    // More Options fields (Part 4)
    if (askDose !== undefined) medicine.askDose = askDose;
    if (normalizedSalt !== undefined) medicine.salt = normalizedSalt;
    if (normalizedColorType !== undefined) medicine.colorType = normalizedColorType;
    if (normalizedPacking !== undefined) medicine.packing = normalizedPacking;
    if (decimalAllowed !== undefined) medicine.decimalAllowed = decimalAllowed;
    if (itemType !== undefined) medicine.itemType = itemType || null;

    await medicine.save();

    // Get current stock from Inventory
    const inventoryStats = await Inventory.aggregate([
      { $match: { medicine: medicine._id, isDeleted: false } },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' }
        }
      }
    ]);

    const stockInfo = inventoryStats[0] || { totalQuantity: 0 };

    // Populate HSN if exists
    await medicine.populate('hsnCode', 'hsnCode description gstPercent');

    res.status(200).json({
      success: true,
      data: {
        ...medicine.toObject(),
        quantity: stockInfo.totalQuantity
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error updating medicine',
      error: error.message
    });
  }
};

// @desc    Delete medicine (soft delete)
// @route   DELETE /api/medicines/:id
// @access  Private/Admin
exports.deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Check if medicine has stock in Inventory
    const inventoryStats = await Inventory.aggregate([
      { $match: { medicine: medicine._id, isDeleted: false } },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' }
        }
      }
    ]);

    const totalStock = inventoryStats[0]?.totalQuantity || 0;

    if (totalStock > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete medicine with existing stock. Please reduce stock first.'
      });
    }

    medicine.isDeleted = true;
    medicine.barcode = `deleted_${Date.now()}_${medicine.barcode || ''}`;
    await medicine.save();

    res.status(200).json({
      success: true,
      message: 'Medicine deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error deleting medicine',
      error: error.message
    });
  }
};

// @desc    Get low stock medicines
// @route   GET /api/medicines/alerts/low-stock
// @access  Private
exports.getLowStockMedicines = async (req, res) => {
  try {
    // Aggregate to get total stock per medicine
    const inventoryStats = await Inventory.aggregate([
      { $match: { isDeleted: false, status: 'ACTIVE' } },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' }
        }
      }
    ]);

    // Create map of medicine ID to quantity
    const stockMap = {};
    inventoryStats.forEach(stat => {
      stockMap[stat._id.toString()] = stat.totalQuantity;
    });

    // Get all active medicines
    const medicines = await Medicine.find({
      isDeleted: false,
      status: 'ACTIVE'
    }).populate('hsnCode', 'hsnCode gstPercent');

    // Filter medicines where stock <= reorderLevel
    const lowStockMedicines = medicines
      .filter(med => {
        const quantity = stockMap[med._id.toString()] || 0;
        return quantity <= med.reorderLevel;
      })
      .map(med => ({
        ...med.toObject(),
        quantity: stockMap[med._id.toString()] || 0
      }))
      .sort((a, b) => a.quantity - b.quantity);

    res.status(200).json({
      success: true,
      count: lowStockMedicines.length,
      data: lowStockMedicines
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting low stock medicines',
      error: error.message
    });
  }
};

// @desc    Get expiring medicines (within specified days, default 90 days)
// @route   GET /api/medicines/alerts/expiring
// @access  Private
exports.getExpiringMedicines = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const daysNum = parseInt(days) || 90;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysNum);

    // Get inventory items expiring within specified days
    const expiringInventory = await Inventory.find({
      isDeleted: false,
      status: 'ACTIVE',
      expiryDate: { $lte: expiryDate, $gt: new Date() },
      quantityAvailable: { $gt: 0 }
    })
    .populate('medicine', 'medicineName brandName strength packSize reorderLevel')
    .populate('supplier', 'supplierName')
    .sort({ expiryDate: 1 });

    res.status(200).json({
      success: true,
      count: expiringInventory.length,
      data: expiringInventory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting expiring medicines',
      error: error.message
    });
  }
};

// @desc    Get expired medicines
// @route   GET /api/medicines/alerts/expired
// @access  Private
exports.getExpiredMedicines = async (req, res) => {
  try {
    // Get expired inventory items
    const expiredInventory = await Inventory.find({
      isDeleted: false,
      expiryDate: { $lt: new Date() },
      quantityAvailable: { $gt: 0 }
    })
    .populate('medicine', 'medicineName brandName strength packSize')
    .populate('supplier', 'supplierName')
    .sort({ expiryDate: -1 });

    res.status(200).json({
      success: true,
      count: expiredInventory.length,
      data: expiredInventory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting expired medicines',
      error: error.message
    });
  }
};

// @desc    Get inventory report
// @route   GET /api/medicines/report/inventory
// @access  Private/Admin
exports.getInventoryReport = async (req, res) => {
  try {
    const medicines = await Medicine.find({ isDeleted: false })
      .populate('hsnCode', 'hsnCode gstPercent')
      .sort({ medicineName: 1 });

    // Get all inventory data
    const inventoryStats = await Inventory.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' },
          totalValue: { $sum: { $multiply: ['$quantityAvailable', '$purchasePrice'] } },
          earliestExpiry: { $min: '$expiryDate' },
          latestExpiry: { $max: '$expiryDate' },
          batchCount: { $sum: 1 }
        }
      }
    ]);

    const inventoryMap = {};
    inventoryStats.forEach(stat => {
      inventoryMap[stat._id.toString()] = {
        quantity: stat.totalQuantity,
        totalValue: stat.totalValue || 0,
        earliestExpiry: stat.earliestExpiry,
        latestExpiry: stat.latestExpiry,
        batchCount: stat.batchCount
      };
    });

    // Calculate totals
    let totalStockValue = 0;
    let totalRetailValue = 0;
    let lowStockCount = 0;
    let expiredCount = 0;
    let expiringCount = 0;

    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    const medicinesWithStock = medicines.map(med => {
      const inv = inventoryMap[med._id.toString()] || { quantity: 0, totalValue: 0, earliestExpiry: null, latestExpiry: null, batchCount: 0 };
      const stockValue = inv.quantity * (med.defaultSellingPrice || 0);
      const retailValue = inv.quantity * (med.defaultSellingPrice || 0);

      
      totalStockValue += stockValue;
      totalRetailValue += retailValue;
      
      if (inv.quantity > 0 && inv.quantity <= med.reorderLevel) lowStockCount++;
      if (inv.earliestExpiry && inv.earliestExpiry < new Date()) expiredCount++;
      if (inv.earliestExpiry && inv.earliestExpiry <= ninetyDaysFromNow && inv.earliestExpiry > new Date()) expiringCount++;

      return {
        ...med.toObject(),
        quantity: inv.quantity,
        stockValue,
        retailValue,
        expiryDate: inv.earliestExpiry,
        latestExpiry: inv.latestExpiry,
        batchCount: inv.batchCount
      };
    });

    res.status(200).json({
      success: true,
      data: {
        medicines: medicinesWithStock,
        summary: {
          totalMedicines: medicines.length,
          totalStockValue,
          totalRetailValue,
          lowStockCount,
          expiredCount,
          expiringCount
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error generating inventory report',
      error: error.message
    });
  }
};

// @desc    Get medicine brands (for filter)
// @route   GET /api/medicines/brands
// @access  Private
exports.getBrands = async (req, res) => {
  try {
    const brands = await Medicine.distinct('brandName', { isDeleted: false });

    res.status(200).json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting brands',
      error: error.message
    });
  }
};

// @desc    Get dashboard summary
// @route   GET /api/medicines/dashboard/summary
// @access  Private
exports.getDashboardSummary = async (req, res) => {
  try {
    // Total medicines
    const totalMedicines = await Medicine.countDocuments({ isDeleted: false, status: 'ACTIVE' });

    // Get inventory stats
    const inventoryStats = await Inventory.aggregate([
      { $match: { isDeleted: false, status: 'ACTIVE' } },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' }
        }
      }
    ]);

    // Low stock count
    const stockMap = {};
    inventoryStats.forEach(stat => {
      stockMap[stat._id.toString()] = stat.totalQuantity;
    });

    const lowStockMeds = await Medicine.find({ isDeleted: false, status: 'ACTIVE' });
    const lowStockCount = lowStockMeds.filter(med => (stockMap[med._id.toString()] || 0) <= med.reorderLevel).length;

    // Expiring within 90 days
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    
    const expiringCount = await Inventory.countDocuments({
      isDeleted: false,
      status: 'ACTIVE',
      expiryDate: { $lte: ninetyDaysFromNow, $gt: new Date() },
      quantityAvailable: { $gt: 0 }
    });

    // Expired count
    const expiredCount = await Inventory.countDocuments({
      isDeleted: false,
      expiryDate: { $lt: new Date() },
      quantityAvailable: { $gt: 0 }
    });

    res.status(200).json({
      success: true,
      data: {
        totalMedicines,
        lowStockCount,
        expiringCount,
        expiredCount
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting dashboard summary',
      error: error.message
    });
  }
};
