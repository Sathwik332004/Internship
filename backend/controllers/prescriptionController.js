const mongoose = require('mongoose');
const Prescription = require('../models/Prescription');
const Bill = require('../models/Bill');

const normalizeMedicineRows = (medicines = []) => {
  if (!Array.isArray(medicines)) {
    return [];
  }

  return medicines
    .map((medicine) => ({
      medicineName: String(medicine.medicineName || '').trim(),
      dosage: String(medicine.dosage || '').trim(),
      duration: String(medicine.duration || '').trim(),
      quantity: Math.max(parseInt(medicine.quantity, 10) || 1, 1)
    }))
    .filter((medicine) => medicine.medicineName);
};

const getPrescriptionPayload = (body = {}) => ({
  patientName: String(body.patientName || '').trim(),
  patientPhone: String(body.patientPhone || '').trim(),
  doctorName: String(body.doctorName || '').trim(),
  doctorLicense: String(body.doctorLicense || '').trim(),
  medicines: normalizeMedicineRows(body.medicines),
  notes: String(body.notes || '').trim(),
  status: ['PENDING', 'DISPENSED', 'PARTIAL'].includes(body.status) ? body.status : 'PENDING'
});

const findBillByInput = async (billInput) => {
  const value = String(billInput || '').trim();
  if (!value) {
    return null;
  }

  const query = { isDeleted: false };
  if (mongoose.Types.ObjectId.isValid(value)) {
    query.$or = [
      { _id: value },
      { invoiceNumber: value }
    ];
  } else {
    query.invoiceNumber = value;
  }

  return Bill.findOne(query).select('_id invoiceNumber customerName');
};

// @desc    Create prescription
// @route   POST /api/prescriptions
// @access  Private
exports.createPrescription = async (req, res) => {
  try {
    const payload = getPrescriptionPayload(req.body);

    if (!payload.patientName || !payload.doctorName) {
      return res.status(400).json({
        success: false,
        message: 'Patient name and doctor name are required'
      });
    }

    const prescription = await Prescription.create({
      ...payload,
      createdBy: req.user.id
    });

    const populatedPrescription = await Prescription.findById(prescription._id)
      .populate('createdBy', 'name')
      .populate('billId', 'invoiceNumber grandTotal billDate');

    res.status(201).json({
      success: true,
      data: populatedPrescription
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error creating prescription',
      error: error.message
    });
  }
};

// @desc    Get all prescriptions
// @route   GET /api/prescriptions
// @access  Private
exports.getAllPrescriptions = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = { isDeleted: false };

    if (status && ['PENDING', 'DISPENSED', 'PARTIAL'].includes(status)) {
      query.status = status;
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { patientName: searchRegex },
        { patientPhone: searchRegex },
        { prescriptionNumber: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const prescriptions = await Prescription.find(query)
      .populate('createdBy', 'name')
      .populate('billId', 'invoiceNumber grandTotal billDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Prescription.countDocuments(query);

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: prescriptions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting prescriptions',
      error: error.message
    });
  }
};

// @desc    Get prescription by id
// @route   GET /api/prescriptions/:id
// @access  Private
exports.getPrescriptionById = async (req, res) => {
  try {
    const prescription = await Prescription.findOne({
      _id: req.params.id,
      isDeleted: false
    })
      .populate('createdBy', 'name')
      .populate('billId', 'invoiceNumber grandTotal billDate customerName');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting prescription',
      error: error.message
    });
  }
};

// @desc    Update prescription
// @route   PUT /api/prescriptions/:id
// @access  Private
exports.updatePrescription = async (req, res) => {
  try {
    const payload = getPrescriptionPayload(req.body);

    if (!payload.patientName || !payload.doctorName) {
      return res.status(400).json({
        success: false,
        message: 'Patient name and doctor name are required'
      });
    }

    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      payload,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name')
      .populate('billId', 'invoiceNumber grandTotal billDate');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error updating prescription',
      error: error.message
    });
  }
};

// @desc    Link bill to prescription
// @route   PUT /api/prescriptions/:id/link-bill
// @access  Private
exports.linkBillToPrescription = async (req, res) => {
  try {
    const billInput = req.body.billId || req.body.billNumber || req.body.invoiceNumber;
    const bill = await findBillByInput(billInput);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      {
        billId: bill._id,
        status: 'DISPENSED'
      },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name')
      .populate('billId', 'invoiceNumber grandTotal billDate');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error linking bill to prescription',
      error: error.message
    });
  }
};

// @desc    Soft delete prescription
// @route   DELETE /api/prescriptions/:id
// @access  Private
exports.deletePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Prescription deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error deleting prescription',
      error: error.message
    });
  }
};
