const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  assetName: {
    type: String,
    required: [true, 'Please provide asset name'],
    trim: true
  },
  assetType: {
    type: String,
    required: [true, 'Please provide asset type'],
    enum: ['FURNITURE', 'ELECTRONICS', 'VEHICLE', 'MACHINERY', 'OTHER'],
    default: 'OTHER'
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  cost: {
    type: Number,
    required: [true, 'Please provide cost'],
    min: 0
  },
  condition: {
    type: String,
    required: true,
    enum: ['NEW', 'GOOD', 'FAIR', 'POOR'],
    default: 'NEW'
  },
  location: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['IN_USE', 'UNDER_REPAIR', 'SCRAP', 'DISPOSED'],
    default: 'IN_USE'
  },
  description: {
    type: String,
    trim: true
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
assetSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Asset', assetSchema);
