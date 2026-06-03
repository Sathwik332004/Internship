const mongoose = require('mongoose');

const staffAttendanceSchema = new mongoose.Schema({
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
  dateKey: {
    type: String,
    required: true,
    trim: true
  },
  shiftName: {
    type: String,
    trim: true,
    default: 'General'
  },
  scheduledStart: {
    type: String,
    trim: true,
    default: ''
  },
  scheduledEnd: {
    type: String,
    trim: true,
    default: ''
  },
  checkInAt: {
    type: Date,
    default: null
  },
  checkOutAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['PRESENT', 'COMPLETED'],
    default: 'PRESENT'
  },
  notes: {
    type: String,
    trim: true,
    default: ''
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

staffAttendanceSchema.index({ staff: 1, dateKey: 1 }, { unique: true });
staffAttendanceSchema.index({ dateKey: -1, staffName: 1 });

staffAttendanceSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('StaffAttendance', staffAttendanceSchema);
