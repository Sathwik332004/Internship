const mongoose = require('mongoose');

const hsnSchema = new mongoose.Schema({
  hsnCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 4,
    maxlength: 8,
    validate: {
      validator: function(v) {
        return /^\d{4,8}$/.test(v);
      },
      message: 'HSN code must be 4-8 digits'
    }
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  gstPercent: {
    type: Number,
    required: true,
    min: 0,
    max: 28,
    default: 12
  },
  cgstPercent: {
    type: Number,
    min: 0,
    max: 14,
    default: 0
  },
  sgstPercent: {
    type: Number,
    min: 0,
    max: 14,
    default: 0
  },
  igstPercent: {
    type: Number,
    min: 0,
    max: 28,
    default: 0
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

// Calculate tax components based on GST
hsnSchema.pre('save', function(next) {
  // For intrastate (same state): CGST = SGST = GST/2
  // For interstate: IGST = GST
  this.cgstPercent = this.gstPercent / 2;
  this.sgstPercent = this.gstPercent / 2;
  this.igstPercent = this.gstPercent;
  next();
});

// Index for searching
hsnSchema.index({ hsnCode: 'text', description: 'text' });

module.exports = mongoose.model('HSN', hsnSchema);
