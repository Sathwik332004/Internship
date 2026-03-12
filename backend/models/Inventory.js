const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  batchNumber: {
    type: String,
    required: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  mrp: {
    type: Number,
    min: 0
  },
  quantityPurchased: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  freeQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  quantityAvailable: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase'
  },
  // HSN Code reference
  hsnCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HSN',
    sparse: true
  },
  // Manual HSN code string for quick lookup
  hsnCodeString: {
    type: String,
    sparse: true,
    trim: true
  },
  // GST percentage
  gstPercent: {
    type: Number,
    min: 0,
    max: 28,
    default: 12
  },
  // QR Code for batch
  qrCode: {
    type: String // Base64 encoded QR code image
  },
  qrCodeData: {
    type: String // Raw data encoded in QR
  },
  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'EXHAUSTED', 'EXPIRED'],
    default: 'ACTIVE'
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Unique constraint: medicine + batchNumber
inventorySchema.index({ medicine: 1, batchNumber: 1 }, { unique: true });

// Index for FIFO queries (medicine + expiryDate)
inventorySchema.index({ medicine: 1, expiryDate: 1 });

// Index for stock filtering (quantityAvailable)
inventorySchema.index({ quantityAvailable: 1 });

// Index for HSN code lookup
inventorySchema.index({ hsnCode: 1 });
inventorySchema.index({ hsnCodeString: 1 });

// Index for expiry alerts
inventorySchema.index({ expiryDate: 1, quantityAvailable: 1 });

// Virtual for checking expiry
inventorySchema.virtual('isExpired').get(function () {
  return this.expiryDate < new Date();
});

// Virtual for days until expiry
inventorySchema.virtual('daysUntilExpiry').get(function () {
  const today = new Date();
  const expiry = new Date(this.expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for checking if expiring soon (within 90 days)
inventorySchema.virtual('isExpiringSoon').get(function () {
  const days = this.daysUntilExpiry;
  return days > 0 && days <= 90;
});

// Pre-save middleware to update status based on quantity and expiry
// CRITICAL FIX: Don't auto-mark as EXPIRED if there's still stock available
// Items with stock should remain ACTIVE so they can be used in billing
inventorySchema.pre('save', function(next) {
  if (this.quantityAvailable <= 0) {
    this.status = 'EXHAUSTED';
  } else if (this.expiryDate < new Date()) {
    // Keep ACTIVE if stock exists so billing can use it
    this.status = 'ACTIVE';
  } else {
    this.status = 'ACTIVE';
  }
  next();
});

// Static method to get FIFO stock for a medicine
inventorySchema.statics.getFIFOStock = async function (medicineId, quantityNeeded) {
  const availableStock = await this.find({
    medicine: medicineId,
    quantityAvailable: { $gt: 0 },
    expiryDate: { $gt: new Date() },
    status: 'ACTIVE'
  }).sort({ expiryDate: 1 }); // FIFO - earliest expiry first

  return availableStock;
};

// Static method to get total available stock for a medicine
inventorySchema.statics.getTotalStock = async function (medicineId) {
  const result = await this.aggregate([
    {
      $match: {
        medicine: new mongoose.Types.ObjectId(medicineId),
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

  return result.length > 0 ? result[0].totalQuantity : 0;
};

// Static method to get expiring inventory items (within specified days)
inventorySchema.statics.getExpiringItems = async function (days = 90) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    quantityAvailable: { $gt: 0 },
    expiryDate: { $lte: futureDate, $gt: new Date() },
    status: 'ACTIVE',
    isDeleted: false
  })
  .populate('medicine', 'medicineName brandName strength packSize')
  .populate('supplier', 'supplierName')
  .sort({ expiryDate: 1 });
};

// Static method to get low stock items
inventorySchema.statics.getLowStockItems = async function () {
  const inventoryStats = await this.aggregate([
    { $match: { isDeleted: false, status: 'ACTIVE' } },
    {
      $group: {
        _id: '$medicine',
        totalQuantity: { $sum: '$quantityAvailable' }
      }
    }
  ]);

  const stockMap = {};
  inventoryStats.forEach(stat => {
    stockMap[stat._id.toString()] = stat.totalQuantity;
  });

  // Get medicines with stock <= reorder level
  const Medicine = mongoose.model('Medicine');
  const lowStockMeds = await Medicine.find({
    isDeleted: false,
    status: 'ACTIVE'
  }).populate('supplier', 'supplierName');

  return lowStockMeds
    .filter(med => {
      const quantity = stockMap[med._id.toString()] || 0;
      return quantity <= med.reorderLevel;
    })
    .map(med => ({
      ...med.toObject(),
      currentStock: stockMap[med._id.toString()] || 0
    }));
};

// Ensure virtuals are included in JSON
inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);
