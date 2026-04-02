const mongoose = require('mongoose');

const purchaseReturnItemSchema = new mongoose.Schema({
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
    default: ''
  },
  expiryDate: {
    type: Date,
    required: true
  },
  conversionFactor: {
    type: Number,
    default: 1,
    min: 1
  },
  originalQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  originalFreeQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  returnQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  returnFreeQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  returnUnitQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  returnFreeUnitQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  purchasePrice: {
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
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  taxableAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
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

const purchaseReturnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true
    },
    purchaseNumber: {
      type: String,
      required: true
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true
    },
    supplierName: {
      type: String,
      trim: true,
      required: true
    },
    supplierInvoiceNumber: {
      type: String,
      required: true
    },
    returnDate: {
      type: Date,
      default: Date.now
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
      type: [purchaseReturnItemSchema],
      default: []
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    taxableAmount: {
      type: Number,
      default: 0,
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

purchaseReturnSchema.index({ purchase: 1, createdAt: -1 });

purchaseReturnSchema.statics.generateReturnNumber = async function generateReturnNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const prefix = `PR/${year}${month}${day}`;

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

module.exports = mongoose.model('PurchaseReturn', purchaseReturnSchema);
