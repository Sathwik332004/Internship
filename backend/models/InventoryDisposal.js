const mongoose = require('mongoose');

const inventoryDisposalSchema = new mongoose.Schema({
  inventory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null
  },
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    default: null
  },
  batchNumber: {
    type: String,
    default: '',
    trim: true,
    uppercase: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  quantityDisposed: {
    type: Number,
    required: true,
    min: 0.0001
  },
  quantityBefore: {
    type: Number,
    required: true,
    min: 0
  },
  quantityAfter: {
    type: Number,
    required: true,
    min: 0
  },
  purchasePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  mrp: {
    type: Number,
    default: 0,
    min: 0
  },
  disposalReason: {
    type: String,
    enum: ['DAMAGED', 'EXPIRED', 'OTHER'],
    required: true
  },
  source: {
    type: String,
    enum: ['MANUAL', 'AUTO_EXPIRY'],
    default: 'MANUAL'
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  disposedAt: {
    type: Date,
    default: Date.now
  },
  disposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

inventoryDisposalSchema.index({ disposedAt: -1 });
inventoryDisposalSchema.index({ medicine: 1, disposedAt: -1 });
inventoryDisposalSchema.index({ disposalReason: 1, source: 1 });

module.exports = mongoose.model('InventoryDisposal', inventoryDisposalSchema);
