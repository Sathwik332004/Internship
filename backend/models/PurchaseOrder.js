const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  medicineName: {
    type: String,
    trim: true
  },
  brandName: {
    type: String,
    trim: true
  },
  currentStock: {
    type: Number,
    default: 0,
    min: 0
  },
  reorderLevel: {
    type: Number,
    default: 0,
    min: 0
  },
  requestedQty: {
    type: Number,
    required: true,
    min: 1
  },
  lastPurchasePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: null
  }
}, { _id: true });

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    required: true,
    unique: true
  },

  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },

  // Denormalized for display even if supplier is later deleted
  supplierName: {
    type: String,
    trim: true
  },

  status: {
    type: String,
    enum: ['DRAFT', 'APPROVED', 'SENT', 'CANCELLED'],
    default: 'DRAFT'
  },

  items: [poItemSchema],

  notes: {
    type: String,
    trim: true
  },

  // AUTO = system-generated, MANUAL = created by user
  generatedBy: {
    type: String,
    enum: ['AUTO', 'MANUAL'],
    default: 'AUTO'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedAt: {
    type: Date
  },

  isDeleted: {
    type: Boolean,
    default: false,
    select: false
  }
}, {
  timestamps: true
});


// ================= INDEXES =================

purchaseOrderSchema.index({ status: 1, createdAt: -1 });
purchaseOrderSchema.index({ supplier: 1, status: 1 });


// ================= STATICS =================

purchaseOrderSchema.statics.generatePONumber = async function () {
  const last = await this.findOne({}).sort({ createdAt: -1 }).select('poNumber');
  let next = 1;
  if (last?.poNumber) {
    const num = parseInt(last.poNumber.replace('PO', ''), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return 'PO' + String(next).padStart(5, '0');
};


module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
