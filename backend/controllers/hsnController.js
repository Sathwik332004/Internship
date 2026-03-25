const HSN = require('../models/HSN');
const {
  isValidHSN,
  normalizeWhitespace
} = require('../utils/validation');

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
    const normalizedHsnCode = String(hsnCode || '').trim();
    const normalizedDescription = normalizeWhitespace(description);

    if (!isValidHSN(normalizedHsnCode)) {
      return res.status(400).json({
        success: false,
        message: 'HSN code must be 4 to 8 digits'
      });
    }

    if (normalizedDescription.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Description must be at least 3 characters'
      });
    }

    if (![0, 5, 12, 18, 28].includes(Number(gstPercent))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GST percentage'
      });
    }

    // Check for duplicate HSN code
    const existingHSN = await HSN.findOne({
      hsnCode: normalizedHsnCode,
      isDeleted: false
    });

    if (existingHSN) {
      return res.status(400).json({
        success: false,
        message: 'HSN code already exists'
      });
    }

    const hsn = await HSN.create({
      hsnCode: normalizedHsnCode,
      description: normalizedDescription,
      gstPercent: Number(gstPercent),
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
      if (!isValidHSN(req.body.hsnCode)) {
        return res.status(400).json({
          success: false,
          message: 'HSN code must be 4 to 8 digits'
        });
      }

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

    if (description !== undefined) {
      const normalizedDescription = normalizeWhitespace(description);
      if (normalizedDescription.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Description must be at least 3 characters'
        });
      }
      hsn.description = normalizedDescription;
    }

    if (gstPercent !== undefined) {
      if (![0, 5, 12, 18, 28].includes(Number(gstPercent))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid GST percentage'
        });
      }
      hsn.gstPercent = Number(gstPercent);
    }

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

    const archivedHsnCode = `deleted_${Date.now()}_${hsn.hsnCode}`;

    // Soft delete the record and free up the original HSN code for reuse.
    // Use an update query so the archived code does not fail the live-code validators.
    await HSN.updateOne(
      { _id: hsn._id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          hsnCode: archivedHsnCode
        }
      }
    );

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
