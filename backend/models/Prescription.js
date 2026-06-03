const mongoose = require('mongoose');

const prescriptionMedicineSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: true,
    trim: true
  },
  dosage: {
    type: String,
    trim: true,
    default: ''
  },
  duration: {
    type: String,
    trim: true,
    default: ''
  },
  quantity: {
    type: Number,
    min: 1,
    default: 1
  }
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  prescriptionNumber: {
    type: String,
    unique: true,
    index: true
  },
  patientName: {
    type: String,
    required: true,
    trim: true
  },
  patientPhone: {
    type: String,
    trim: true,
    default: ''
  },
  doctorName: {
    type: String,
    required: true,
    trim: true
  },
  doctorLicense: {
    type: String,
    trim: true,
    default: ''
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    default: null
  },
  medicines: [prescriptionMedicineSchema],
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['PENDING', 'DISPENSED', 'PARTIAL'],
    default: 'PENDING'
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
  }
}, {
  timestamps: true
});

prescriptionSchema.pre('validate', async function(next) {
  if (this.prescriptionNumber) {
    return next();
  }

  try {
    const lastPrescription = await this.constructor.findOne({
      prescriptionNumber: /^RX-\d+$/
    })
      .sort({ createdAt: -1 })
      .select('prescriptionNumber');

    const lastNumber = lastPrescription?.prescriptionNumber
      ? parseInt(lastPrescription.prescriptionNumber.replace('RX-', ''), 10)
      : 0;

    this.prescriptionNumber = `RX-${String(lastNumber + 1).padStart(3, '0')}`;
    return next();
  } catch (error) {
    return next(error);
  }
});

prescriptionSchema.index({ patientName: 'text', patientPhone: 'text', prescriptionNumber: 'text' });
prescriptionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
