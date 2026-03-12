const HSN = require('../models/HSN');

// @desc    Get all HSN codes
// @route   GET /api/hsn
// @access  Private
exports.getHSNCodes = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;

    let query = { isDeleted: false };

    if (search) {
      query.$or = [
        { hsnCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const hsnCodes = await HSN.find(query)
      .sort({ hsnCode: 1 })
      .skip(skip)
      .limit(limitNum);

    const total = await HSN.countDocuments(query);

    res.status(200).json({
      success: true,
      count: hsnCodes.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: hsnCodes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting HSN codes',
      error: error.message
    });
  }
};

// @desc    Get single HSN code
// @route   GET /api/hsn/:id
// @access  Private
exports.getHSNCode = async (req, res) => {
  try {
    const hsn = await HSN.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!hsn) {
      return res.status(404).json({
        success: false,
        message: 'HSN code not found'
      });
    }

    res.status(200).json({
      success: true,
      data: hsn
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting HSN code',
      error: error.message
    });
  }
};

// @desc    Get HSN by code
// @route   GET /api/hsn/code/:hsnCode
// @access  Private
exports.getHSNByCode = async (req, res) => {
  try {
    const hsn = await HSN.findOne({
      hsnCode: req.params.hsnCode,
      isDeleted: false,
      status: 'ACTIVE'
    });

    if (!hsn) {
      return res.status(404).json({
        success: false,
        message: 'HSN code not found'
      });
    }

    res.status(200).json({
      success: true,
      data: hsn
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting HSN code',
      error: error.message
    });
  }
};

// @desc    Search HSN codes (for autocomplete)
// @route   GET /api/hsn/search
// @access  Private
exports.searchHSNCodes = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const hsnCodes = await HSN.find({
      isDeleted: false,
      status: 'ACTIVE',
      $or: [
        { hsnCode: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    })
      .sort({ hsnCode: 1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: hsnCodes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error searching HSN codes',
      error: error.message
    });
  }
};

// @desc    Add new HSN code
// @route   POST /api/hsn
// @access  Private/Admin
exports.createHSNCode = async (req, res) => {
  try {
    const { hsnCode, description, gstPercent, status } = req.body;

    // Check for duplicate HSN code
    const existingHSN = await HSN.findOne({
      hsnCode,
      isDeleted: false
    });

    if (existingHSN) {
      return res.status(400).json({
        success: false,
        message: 'HSN code already exists'
      });
    }

    const hsn = await HSN.create({
      hsnCode,
      description,
      gstPercent,
      status: status || 'ACTIVE'
    });

    res.status(201).json({
      success: true,
      data: hsn
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error creating HSN code',
      error: error.message
    });
  }
};

// @desc    Update HSN code
// @route   PUT /api/hsn/:id
// @access  Private/Admin
exports.updateHSNCode = async (req, res) => {
  try {
    const { description, gstPercent, status } = req.body;

    let hsn = await HSN.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!hsn) {
      return res.status(404).json({
        success: false,
        message: 'HSN code not found'
      });
    }

    // Check for duplicate HSN code (excluding current)
    if (req.body.hsnCode && req.body.hsnCode !== hsn.hsnCode) {
      const existingHSN = await HSN.findOne({
        hsnCode: req.body.hsnCode,
        isDeleted: false,
        _id: { $ne: req.params.id }
      });

      if (existingHSN) {
        return res.status(400).json({
          success: false,
          message: 'HSN code already exists'
        });
      }
    }

    hsn.description = description || hsn.description;
    hsn.gstPercent = gstPercent || hsn.gstPercent;
    hsn.status = status || hsn.status;

    await hsn.save();

    res.status(200).json({
      success: true,
      data: hsn
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error updating HSN code',
      error: error.message
    });
  }
};

// @desc    Delete HSN code (soft delete)
// @route   DELETE /api/hsn/:id
// @access  Private/Admin
exports.deleteHSNCode = async (req, res) => {
  try {
    const hsn = await HSN.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!hsn) {
      return res.status(404).json({
        success: false,
        message: 'HSN code not found'
      });
    }

    hsn.isDeleted = true;
    hsn.hsnCode = `deleted_${Date.now()}_${hsn.hsnCode}`;
    await hsn.save();

    res.status(200).json({
      success: true,
      message: 'HSN code deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error deleting HSN code',
      error: error.message
    });
  }
};
