const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Medicine = require('../models/Medicine');

// @desc    Get all inventory items (batch-wise stock)
// @route   GET /api/inventory
// @access  Private
exports.getInventory = async (req, res) => {
  try {
    const { 
      search, 
      page = 1, 
      limit = 50,
      sortBy = 'expiryDate',
      sortOrder = 'asc',
      lowStock,
      expiringSoon
    } = req.query;

    let query = {};

    // Search by medicine name or batch number
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const medicines = await Medicine.find({
        medicineName: searchRegex,
        isDeleted: false
      });
      const medicineIds = medicines.map(m => m._id);
      
      query.$or = [
        { medicine: { $in: medicineIds } },
        { batchNumber: searchRegex }
      ];
    }

    // Filter by low stock
    if (lowStock === 'true') {
      const inventoryItems = await Inventory.aggregate([
        { $match: { isDeleted: false, status: 'ACTIVE' } },
        {
          $group: {
            _id: '$medicine',
            totalQuantity: { $sum: '$quantityAvailable' }
          }
        }
      ]);

      const stockMap = {};
      inventoryItems.forEach(item => {
        stockMap[item._id.toString()] = item.totalQuantity;
      });

      const lowStockMeds = await Medicine.find({
        isDeleted: false,
        status: 'ACTIVE',
        $expr: {
          $lte: [
            { $ifNull: [stockMap[{$toString: '$_id'}], 0] },
            '$reorderLevel'
          ]
        }
      });

      query.medicine = { $in: lowStockMeds.map(m => m._id) };
    }

    // Filter by expiring soon (within 90 days)
    if (expiringSoon === 'true') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90);
      query.expiryDate = { $lte: futureDate, $gt: new Date() };
      query.quantityAvailable = { $gt: 0 };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const inventory = await Inventory.find(query)
      .populate('medicine', 'medicineName brandName strength baseUnit sellingUnit conversionFactor reorderLevel')
      .populate('supplier', 'supplierName')
      .populate('purchase', 'purchaseNumber supplierInvoiceNumber')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    const total = await Inventory.countDocuments(query);

    // Get medicine stock totals for reorder level comparison
    const stockTotals = await Inventory.aggregate([
      { $match: { isDeleted: false, status: 'ACTIVE' } },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' }
        }
      }
    ]);

    const stockMap = {};
    stockTotals.forEach(item => {
      if (item._id) {
        stockMap[item._id.toString()] = item.totalQuantity;
      }
    });

    // Add stock info and status indicators
    const enrichedInventory = inventory.map(item => {
      const itemObj = item.toObject();
      const medicineId = itemObj.medicine?._id?.toString() || itemObj.medicine?.toString();
      const totalStock = stockMap[medicineId] || 0;
      const reorderLevel = itemObj.medicine?.reorderLevel || 10;
      
      // Calculate days until expiry
      const today = new Date();
      const expiry = new Date(itemObj.expiryDate);
      const diffTime = expiry - today;
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...itemObj,
        totalStock,
        isLowStock: totalStock <= reorderLevel,
        isExpiringSoon: daysUntilExpiry > 0 && daysUntilExpiry <= 90,
        daysUntilExpiry
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedInventory.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: enrichedInventory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting inventory',
      error: error.message
    });
  }
};

// @desc    Get single inventory item
// @route   GET /api/inventory/:id
// @access  Private
exports.getInventoryItem = async (req, res) => {
  try {
    const inventory = await Inventory.findOne({
      _id: req.params.id,
      isDeleted: false
    })
      .populate('medicine')
      .populate('supplier')
      .populate('purchase');

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: inventory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting inventory item',
      error: error.message
    });
  }
};

// @desc    Get inventory by medicine
// @route   GET /api/inventory/medicine/:medicineId
// @access  Private
exports.getInventoryByMedicine = async (req, res) => {
  try {
    const { medicineId } = req.params;
    const { includeZeroStock = 'false', batch } = req.query;

    // DEBUG: Log the medicine ID being queried
    console.log('[INVENTORY DEBUG] Fetching inventory for medicineId:', medicineId);
    console.log('[INVENTORY DEBUG] Query params:', { includeZeroStock, batch });

    let query = {
      medicine: medicineId,
      isDeleted: { $ne: true }
    };

    // Only include available quantity unless the caller explicitly asks for zero stock also.
    if (includeZeroStock !== 'true') {
      query.quantityAvailable = { $gt: 0 };
    }

    // Filter by batch number if provided (case-insensitive, normalized to uppercase)
    if (batch) {
      query.batchNumber = { $regex: new RegExp(`^${batch.toUpperCase().trim()}$`, 'i') };
    }

    // Only include items with available quantity when includeZeroStock is not true
    if (includeZeroStock !== 'true') {
      query.quantityAvailable = { $gt: 0 };
    }

    const inventory = await Inventory.find(query)
      .populate('supplier', 'supplierName')
      .populate('purchase', 'purchaseNumber')
      .sort({ expiryDate: 1 }); // FIFO - earliest expiry first

    // DEBUG: Log query results
    console.log('[INVENTORY DEBUG] Inventory found:', {
      medicineId,
      recordsFound: inventory?.length || 0,
      batches: inventory?.map(inv => ({
        batchNumber: inv.batchNumber,
        quantityAvailable: inv.quantityAvailable,
        expiryDate: inv.expiryDate,
        status: inv.status
      })) || []
    });

    res.status(200).json({
      success: true,
      count: inventory.length,
      data: inventory
    });
  } catch (error) {
    console.error('[INVENTORY DEBUG] Error getting inventory by medicine:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting inventory by medicine',
      error: error.message
    });
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private
exports.getLowStockItems = async (req, res) => {
  try {
    // Get total stock per medicine
    const stockTotals = await Inventory.aggregate([
      { $match: { isDeleted: false, status: 'ACTIVE' } },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' }
        }
      }
    ]);

    const stockMap = {};
    stockTotals.forEach(item => {
      if (item._id) {
        stockMap[item._id.toString()] = item.totalQuantity;
      }
    });

    // Get medicines with stock <= reorder level
    const medicines = await Medicine.find({
      isDeleted: false,
      status: 'ACTIVE'
    });

    const lowStockItems = medicines
      .filter(med => {
        const quantity = stockMap[med._id.toString()] || 0;
        return quantity <= med.reorderLevel;
      })
      .map(med => ({
        medicine: med,
        currentStock: stockMap[med._id.toString()] || 0,
        reorderLevel: med.reorderLevel
      }));

    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting low stock items',
      error: error.message
    });
  }
};

// @desc    Get expiring items
// @route   GET /api/inventory/expiring
// @access  Private
exports.getExpiringItems = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const inventory = await Inventory.find({
      isDeleted: false,
      quantityAvailable: { $gt: 0 },
      expiryDate: { $lte: futureDate, $gt: new Date() },
      status: 'ACTIVE'
    })
      .populate('medicine', 'medicineName brandName')
      .populate('supplier', 'supplierName')
      .sort({ expiryDate: 1 });

    // Calculate days until expiry for each item
    const enrichedInventory = inventory.map(item => {
      const itemObj = item.toObject();
      const today = new Date();
      const expiry = new Date(itemObj.expiryDate);
      const diffTime = expiry - today;
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...itemObj,
        daysUntilExpiry
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedInventory.length,
      data: enrichedInventory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting expiring items',
      error: error.message
    });
  }
};

// @desc    Get inventory statistics
// @route   GET /api/inventory/stats
// @access  Private
exports.getInventoryStats = async (req, res) => {
  try {
    // Total inventory value and count
    const valueStats = await Inventory.aggregate([
      { $match: { isDeleted: false, status: 'ACTIVE', quantityAvailable: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantityAvailable', '$purchasePrice'] } },
          totalItems: { $sum: '$quantityAvailable' },
          batchCount: { $sum: 1 }
        }
      }
    ]);

    // Total unique medicines with stock
    const uniqueMedicines = await Inventory.aggregate([
      { $match: { isDeleted: false, status: 'ACTIVE', quantityAvailable: { $gt: 0 } } },
      {
        $group: {
          _id: '$medicine'
        }
      },
      {
        $count: 'uniqueMedicineCount'
      }
    ]);

    // Low stock count - medicines where total stock <= reorder level
    const stockTotals = await Inventory.aggregate([
      { $match: { isDeleted: false, status: 'ACTIVE' } },
      {
        $group: {
          _id: '$medicine',
          totalQuantity: { $sum: '$quantityAvailable' }
        }
      }
    ]);

    const stockMap = {};
    stockTotals.forEach(item => {
      if (item._id) {
        stockMap[item._id.toString()] = item.totalQuantity;
      }
    });

    // Get medicines and filter by stock level in JavaScript
    const medicines = await Medicine.find({
      isDeleted: false,
      status: 'ACTIVE'
    });

    const lowStockCount = medicines.filter(med => {
      const quantity = stockMap[med._id.toString()] || 0;
      return quantity <= med.reorderLevel;
    }).length;

    // Expiring soon (within 90 days)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    const expiringCount = await Inventory.countDocuments({
      isDeleted: false,
      quantityAvailable: { $gt: 0 },
      expiryDate: { $lte: futureDate, $gt: new Date() },
      status: 'ACTIVE'
    });

    // Expired count
    const expiredCount = await Inventory.countDocuments({
      isDeleted: false,
      quantityAvailable: { $gt: 0 },
      expiryDate: { $lte: new Date() },
      status: 'EXPIRED'
    });

    res.status(200).json({
      success: true,
      data: {
        totalValue: valueStats[0]?.totalValue || 0,
        totalItems: valueStats[0]?.totalItems || 0,
        batchCount: valueStats[0]?.batchCount || 0,
        uniqueMedicineCount: uniqueMedicines[0]?.uniqueMedicineCount || 0,
        lowStockCount,
        expiringCount,
        expiredCount
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting inventory stats',
      error: error.message
    });
  }
};

