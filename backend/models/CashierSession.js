const mongoose = require('mongoose');

const cashierSessionSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  staffName: {
    type: String,
    required: true,
    trim: true
  },
  attendance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StaffAttendance',
    default: null
  },
  openedAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date,
    default: null
  },
  openingCash: {
    type: Number,
    default: 0,
    min: 0
  },
  closingCash: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN'
  },
  billCount: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
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

cashierSessionSchema.index({ staff: 1, status: 1, openedAt: -1 });
cashierSessionSchema.index({ openedAt: -1 });

cashierSessionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CashierSession', cashierSessionSchema);
