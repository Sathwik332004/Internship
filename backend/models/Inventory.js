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

  hsnCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HSN',
    sparse: true
  },

  hsnCodeString: {
    type: String,
    sparse: true,
    trim: true
  },

  gstPercent: {
    type: Number,
    min: 0,
    max: 28,
    default: 12
  },

  qrCode: {
    type: String
  },

  qrCodeData: {
    type: String
  },

  status: {
    type: String,
    enum: ['ACTIVE', 'EXHAUSTED', 'EXPIRED'],
    default: 'ACTIVE'
  },

  isDeleted: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});


// ================= INDEXES =================

// Unique batch per medicine
inventorySchema.index({ medicine: 1, batchNumber: 1 }, { unique: true });

// FIFO queries
inventorySchema.index({ medicine: 1, expiryDate: 1 });

// Stock filtering
inventorySchema.index({ quantityAvailable: 1 });

// Expiry alerts
inventorySchema.index({ expiryDate: 1, quantityAvailable: 1 });


// ================= VIRTUALS =================

inventorySchema.virtual('isExpired').get(function () {
  return this.expiryDate < new Date();
});

inventorySchema.virtual('daysUntilExpiry').get(function () {
  const today = new Date();
  const expiry = new Date(this.expiryDate);
  const diffTime = expiry - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

inventorySchema.virtual('isExpiringSoon').get(function () {
  const days = this.daysUntilExpiry;
  return days > 0 && days <= 90;
});


// ================= MIDDLEWARE =================

inventorySchema.pre('save', function(next) {

  if (this.quantityAvailable <= 0) {
    this.status = 'EXHAUSTED';
  } 
  else if (this.expiryDate < new Date()) {
    this.status = 'ACTIVE';
  } 
  else {
    this.status = 'ACTIVE';
  }

  next();
});


// ================= STATIC METHODS =================

inventorySchema.statics.getFIFOStock = async function (medicineId) {

  return this.find({
    medicine: medicineId,
    quantityAvailable: { $gt: 0 },
    expiryDate: { $gt: new Date() },
    status: 'ACTIVE'
  }).sort({ expiryDate: 1 });

};


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


// ================= SETTINGS =================

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });


module.exports = mongoose.model('Inventory', inventorySchema);