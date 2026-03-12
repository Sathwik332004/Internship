const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },

  // Optional fields - can be null
  brandName: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },

  strength: {
    type: String,
    trim: true,
    default: null
  },

  packSize: {
    type: String,
    trim: true,
    default: null
  },

  manufacturer: {
    type: String,
    trim: true,
    default: null
  },

  barcode: {
    type: String,
    sparse: true,
    trim: true
  },

  gtin: {
    type: String,
    sparse: true,
    trim: true
  },

  // HSN Code reference - GST will be auto-linked from HSN
  hsnCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HSN',
    sparse: true
  },

  // Manual HSN code string for quick lookup (backup)
  hsnCodeString: {
    type: String,
    sparse: true,
    trim: true
  },

  // NOTE: GST fields removed - GST now comes only from HSN collection
  // GST is calculated per-purchase based on selected HSN code

  // Unit Conversion System (Part 2)
  baseUnit: {
    type: String,
    default: null,
    trim: true
  },
  sellingUnit: {
    type: String,
    default: null,
    trim: true
  },
  conversionFactor: {
    type: Number,
    default: 1,
    min: 1
  },
  allowDecimal: {
    type: Boolean,
    default: false
  },

  // More Options fields (Part 4)
  askDose: {
    type: Boolean,
    default: false
  },
  salt: {
    type: String,
    default: null,
    trim: true
  },
  colorType: {
    type: String,
    default: null,
    trim: true
  },
  packing: {
    type: String,
    default: null,
    trim: true
  },
  decimalAllowed: {
    type: Boolean,
    default: false
  },
  itemType: {
    type: String,
    default: null,
    trim: true
  },

  defaultSellingPrice: {
    type: Number,
    min: 0
  },

  reorderLevel: {
    type: Number,
    default: 10,
    min: 0
  },

  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },

  isDeleted: {
    type: Boolean,
    default: false,
    select: false
  }

}, {
  timestamps: true
});

// NOTE: GST is no longer stored in Medicine model
// GST is fetched from HSN collection during purchase
// calculateTax should now be called with GST percent as parameter

medicineSchema.index({ medicineName: 'text', brandName: 'text' });
medicineSchema.index({ barcode: 1 });
medicineSchema.index({ gtin: 1 });
medicineSchema.index({ hsnCode: 1 });
medicineSchema.index({ hsnCodeString: 1 });

// Ensure virtuals are included in JSON
medicineSchema.set('toJSON', { virtuals: true });
medicineSchema.set('toObject', { virtuals: true });

// Static method to calculate GST breakdown (Part 7 - IGST Support)
// For same state: CGST = GST/2, SGST = GST/2, IGST = 0
// For interstate: CGST = 0, SGST = 0, IGST = GST
medicineSchema.statics.calculateGST = function(gstPercent) {
  return {
    cgst: gstPercent / 2,
    sgst: gstPercent / 2,
    igst: gstPercent
  };
};

module.exports = mongoose.model('Medicine', medicineSchema);
