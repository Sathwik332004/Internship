const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['LOW_STOCK', 'EXPIRY_WARNING', 'EXPIRED', 'PENDING_PAYMENT'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

notificationSchema.index({ type: 1, referenceId: 1 }, { unique: true });
notificationSchema.index({ isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
