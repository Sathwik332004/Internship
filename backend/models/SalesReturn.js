const mongoose = require('mongoose');

const salesReturnItemSchema = new mongoose.Schema({
  originalItemIndex: {
    type: Number,
    required: true,
    min: 0
  },
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  medicineName: {
    type: String,
    required: true
  },
  brandName: {
    type: String,
    default: null
  },
  batchNumber: {
    type: String,
    required: true
  },
  inventoryBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    default: null
  },
  expiryDate: {
    type: Date,
    required: true
  },
  originalQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  originalUnitQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  returnQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  returnUnitQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  gstPercent: {
    type: Number,
    default: 0,
    min: 0
  },
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
  baseAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  }
});

const salesReturnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true
    },
    bill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      required: true
    },
    invoiceNumber: {
      type: String,
      required: true
    },
    returnDate: {
      type: Date,
      default: Date.now
    },
    customerName: {
      type: String,
      trim: true,
      default: null
    },
    customerPhone: {
      type: String,
      trim: true,
      default: null
    },
    reason: {
      type: String,
      trim: true,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      default: null
    },
    items: {
      type: [salesReturnItemSchema],
      default: []
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
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
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

salesReturnSchema.index({ bill: 1, createdAt: -1 });

salesReturnSchema.statics.generateReturnNumber = async function generateReturnNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const prefix = `SR/${year}${month}${day}`;

  const lastReturn = await this.findOne({
    returnNumber: new RegExp(`^${prefix}`)
  }).sort({ returnNumber: -1 });

  if (!lastReturn) {
    return `${prefix}/0001`;
  }

  const lastNumber = parseInt(lastReturn.returnNumber.split('/').pop(), 10);
  const nextNumber = String(lastNumber + 1).padStart(4, '0');
  return `${prefix}/${nextNumber}`;
};

module.exports = mongoose.model('SalesReturn', salesReturnSchema);
