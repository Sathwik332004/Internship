const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
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
  packSize: {
    type: String,
    default: ''
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
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  looseQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  packQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  unitQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  // HSN Code
  hsnCode: {
    type: String,
    trim: true
  },
  gstPercent: {
    type: Number,
    required: true,
    min: 0
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
  // GST amounts
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
  // Base amount before tax
  baseAmount: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  }
});

const billSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  billDate: {
    type: Date,
    default: Date.now
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  // Customer address/state for GST calculation
  customerState: {
    type: String,
    trim: true
  },
  customerAddress: {
    type: String,
    trim: true
  },
  doctorName: {
    type: String,
    trim: true
  },
  doctorRegNo: {
    type: String,
    trim: true
  },
  // GST type: interstate or intrastate
  isInterstate: {
    type: Boolean,
    default: false
  },
  items: [billItemSchema],
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
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMode: {
    type: String,
    enum: ['CASH', 'UPI', 'CARD', 'BANK'],
    default: 'CASH'
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
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
billSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Generate invoice number
billSchema.statics.generateInvoiceNumber = async function () {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const prefix = `INV/${year}${month}${day}`;
  
  const lastBill = await this.findOne({
    invoiceNumber: new RegExp(`^${prefix}`)
  }).sort({ invoiceNumber: -1 });

  if (!lastBill) {
    return `${prefix}/0001`;
  }

  const lastNumber = parseInt(lastBill.invoiceNumber.split('/').pop());
  const newNumber = String(lastNumber + 1).padStart(4, '0');
  return `${prefix}/${newNumber}`;
};

// Static method to get daily sales
billSchema.statics.getDailySales = async function (date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const result = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$grandTotal' },
        totalGst: { $sum: '$totalGst' },
        totalCgst: { $sum: '$totalCgst' },
        totalSgst: { $sum: '$totalSgst' },
        totalIgst: { $sum: '$totalIgst' },
        totalBills: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalSales: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalBills: 0 };
};

// Static method to get sales by date range with GST breakdown
billSchema.statics.getSalesWithGst = async function (startDate, endDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const result = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$grandTotal' },
        totalBaseAmount: { $sum: '$subtotal' },
        totalGst: { $sum: '$totalGst' },
        totalCgst: { $sum: '$totalCgst' },
        totalSgst: { $sum: '$totalSgst' },
        totalIgst: { $sum: '$totalIgst' },
        totalBills: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalSales: 0, totalBaseAmount: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalBills: 0 };
};

module.exports = mongoose.model('Bill', billSchema);
