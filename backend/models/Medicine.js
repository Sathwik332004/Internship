const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
{
  medicineName: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },

  // Optional fields
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
    trim: true,
    sparse: true
  },

  gtin: {
    type: String,
    trim: true,
    sparse: true
  },

  // HSN reference (GST comes from HSN collection)
  hsnCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HSN',
    sparse: true
  },

  // Backup HSN string
  hsnCodeString: {
    type: String,
    trim: true,
    sparse: true
  },

  // Unit Conversion System
  baseUnit: {
    type: String,
    trim: true,
    default: null
  },

  sellingUnit: {
    type: String,
    trim: true,
    default: null
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

  // More Options
  askDose: {
    type: Boolean,
    default: false
  },

  salt: {
    type: String,
    trim: true,
    default: null
  },

  colorType: {
    type: String,
    trim: true,
    default: null
  },

  packing: {
    type: String,
    trim: true,
    default: null
  },

  decimalAllowed: {
    type: Boolean,
    default: false
  },

  itemType: {
    type: String,
    trim: true,
    default: null
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

},
{
  timestamps: true
}
);


// ================= INDEXES =================

// Text search index
medicineSchema.index({ medicineName: "text", brandName: "text" });


// Include virtuals
medicineSchema.set("toJSON", { virtuals: true });
medicineSchema.set("toObject", { virtuals: true });


// ================= GST CALCULATION =================

medicineSchema.statics.calculateGST = function (gstPercent) {
  return {
    cgst: gstPercent / 2,
    sgst: gstPercent / 2,
    igst: gstPercent
  };
};


module.exports = mongoose.model("Medicine", medicineSchema);