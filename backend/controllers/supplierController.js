const Supplier = require('../models/Supplier');

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

    const supplier = await Supplier.create({
      supplierName,
      contactPerson,
      email,
      phone,
      address,
      gstNumber,
      state,
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

    supplier.supplierName = supplierName || supplier.supplierName;
    supplier.contactPerson = contactPerson || supplier.contactPerson;
    supplier.email = email || supplier.email;
    supplier.phone = phone || supplier.phone;
    supplier.address = address || supplier.address;
    supplier.gstNumber = gstNumber || supplier.gstNumber;
    supplier.state = state || supplier.state;
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
