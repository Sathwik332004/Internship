const Supplier = require('../models/Supplier');
const {
  isValidEmail,
  isValidGST,
  isValidPhone,
  normalizeEmail,
  normalizeOptionalText,
  normalizePhone,
  normalizeUppercase,
  normalizeWhitespace
} = require('../utils/validation');

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private
exports.getSuppliers = async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 20 } = req.query;

    let query = { isDeleted: false };

    if (search) {
      query.$or = [
        { supplierName: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const suppliers = await Supplier.find(query)
      .sort({ supplierName: 1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Supplier.countDocuments(query);

    res.status(200).json({
      success: true,
      count: suppliers.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: suppliers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting suppliers',
      error: error.message
    });
  }
};

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// @access  Private
exports.getSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting supplier',
      error: error.message
    });
  }
};

// @desc    Add new supplier
// @route   POST /api/suppliers
// @access  Private/Admin
exports.addSupplier = async (req, res) => {
  try {
    const {
      supplierName,
      contactPerson,
      email,
      phone,
      address,
      gstNumber,
      state,
      isActive
    } = req.body;

    const normalizedSupplierName = normalizeWhitespace(supplierName);
    const normalizedContactPerson = normalizeOptionalText(contactPerson);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const normalizedAddress = normalizeOptionalText(address);
    const normalizedGst = normalizeUppercase(gstNumber);
    const normalizedState = normalizeOptionalText(state);

    if (normalizedSupplierName.length < 2) {
      return res.status(400).json({ success: false, message: 'Supplier name must be at least 2 characters' });
    }

    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be 10 digits' });
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email' });
    }

    if (normalizedGst && !isValidGST(normalizedGst)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid GST number' });
    }

    if (normalizedGst && !normalizedState) {
      return res.status(400).json({ success: false, message: 'State is required when GST number is provided' });
    }

    const supplier = await Supplier.create({
      supplierName: normalizedSupplierName,
      contactPerson: normalizedContactPerson,
      email: normalizedEmail || undefined,
      phone: normalizedPhone,
      address: normalizedAddress,
      gstNumber: normalizedGst || '',
      state: normalizedState,
      isActive: isActive !== false
    });

    res.status(201).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error adding supplier',
      error: error.message
    });
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private/Admin
exports.updateSupplier = async (req, res) => {
  try {
    const {
      supplierName,
      contactPerson,
      email,
      phone,
      address,
      gstNumber,
      state,
      isActive
    } = req.body;

    let supplier = await Supplier.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const normalizedSupplierName = supplierName !== undefined ? normalizeWhitespace(supplierName) : supplier.supplierName;
    const normalizedContactPerson = contactPerson !== undefined ? normalizeOptionalText(contactPerson) : supplier.contactPerson;
    const normalizedEmail = email !== undefined ? normalizeEmail(email) : supplier.email;
    const normalizedPhone = phone !== undefined ? normalizePhone(phone) : supplier.phone;
    const normalizedAddress = address !== undefined ? normalizeOptionalText(address) : supplier.address;
    const normalizedGst = gstNumber !== undefined ? normalizeUppercase(gstNumber) : supplier.gstNumber;
    const normalizedState = state !== undefined ? normalizeOptionalText(state) : supplier.state;

    if (normalizedSupplierName.length < 2) {
      return res.status(400).json({ success: false, message: 'Supplier name must be at least 2 characters' });
    }

    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be 10 digits' });
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email' });
    }

    if (normalizedGst && !isValidGST(normalizedGst)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid GST number' });
    }

    if (normalizedGst && !normalizedState) {
      return res.status(400).json({ success: false, message: 'State is required when GST number is provided' });
    }

    supplier.supplierName = normalizedSupplierName;
    supplier.contactPerson = normalizedContactPerson;
    supplier.email = normalizedEmail || undefined;
    supplier.phone = normalizedPhone;
    supplier.address = normalizedAddress;
    supplier.gstNumber = normalizedGst || '';
    supplier.state = normalizedState;
    if (isActive !== undefined) supplier.isActive = isActive;

    await supplier.save();

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error updating supplier',
      error: error.message
    });
  }
};

// @desc    Delete supplier (soft delete)
// @route   DELETE /api/suppliers/:id
// @access  Private/Admin
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    supplier.isDeleted = true;
    supplier.supplierName = `deleted_${Date.now()}_${supplier.supplierName}`;
    await supplier.save();

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error deleting supplier',
      error: error.message
    });
  }
};
