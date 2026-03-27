const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  // HSN Code per purchase item
  hsnCode: {
    type: String,
    trim: true
  },
  hsnCodeRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HSN'
  },
  gstPercent: {
    type: Number,
    required: true,
    min: 0
  },
  // Unit from medicine
  unit: {
    type: String,
    default: null
  },
  baseUnit: {
    type: String,
    default: null
  },
  sellingUnit: {
    type: String,
    default: null
  },
  conversionFactor: {
    type: Number,
    default: 1
  },
  // Batch details
  batchNumber: {
    type: String,
    default: ''
  },
  expiryDate: {
    type: Date,
    required: true
  },
  // MRP
  mrp: {
    type: Number,
    min: 0,
    default: 0
  },
  // Prices
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  // Quantity
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  freeQuantity: {
    type: Number,
    default: 0
  },
  // Discount per item
  discountType: {
    type: String,
    enum: ['PERCENT', 'AMOUNT'],
    default: 'PERCENT'
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  // Calculations
  subtotal: {
    type: Number,
    default: 0
  },
  taxableAmount: {
    type: Number,
    default: 0
  },
  // GST breakdown
  cgstPercent: {
    type: Number,
    default: 0
  },
  sgstPercent: {
    type: Number,
    default: 0
  },
  igstPercent: {
    type: Number,
    default: 0
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  cgstAmount: {
    type: Number,
    default: 0
  },
  sgstAmount: {
    type: Number,
    default: 0
  },
  igstAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  }
});

const purchaseSchema = new mongoose.Schema({
  purchaseNumber: {
    type: String,
    required: true,
    unique: true
  },
  supplierInvoiceNumber: {
    type: String,
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  items: [purchaseItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  // GST breakdown
  totalGst: {
    type: Number,
    default: 0
  },
  totalCgst: {
    type: Number,
    default: 0
  },
  totalSgst: {
    type: Number,
    default: 0
  },
  totalIgst: {
    type: Number,
    default: 0
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  miscellaneousAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMode: {
    type: String,
    enum: ['CASH', 'UPI', 'CARD', 'CREDIT'],
    default: 'CASH'
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware
purchaseSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Generate purchase number (P000001 format)
purchaseSchema.statics.generatePurchaseNumber = async function () {
  const lastPurchase = await this.findOne({})
    .sort({ createdAt: -1 })
    .select('purchaseNumber');

  let nextNumber = 1;

  if (lastPurchase && lastPurchase.purchaseNumber) {
    const number = parseInt(lastPurchase.purchaseNumber.replace('P', ''));
    nextNumber = number + 1;
  }

  return 'P' + String(nextNumber).padStart(6, '0');
};

module.exports = mongoose.model('Purchase', purchaseSchema);
