const Asset = require('../models/Asset');

// @desc    Get all assets
// @route   GET /api/assets
// @access  Private/Admin
exports.getAssets = async (req, res) => {
  try {
    const { type, status, condition, page = 1, limit = 20 } = req.query;

    let query = { isDeleted: false };

    if (type) {
      query.assetType = type;
    }

    if (status) {
      query.status = status;
    }

    if (condition) {
      query.condition = condition;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const assets = await Asset.find(query)
      .sort({ assetName: 1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Asset.countDocuments(query);

    res.status(200).json({
      success: true,
      count: assets.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: assets
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting assets',
      error: error.message
    });
  }
};

// @desc    Get single asset
// @route   GET /api/assets/:id
// @access  Private/Admin
exports.getAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error getting asset',
      error: error.message
    });
  }
};

// @desc    Add new asset
// @route   POST /api/assets
// @access  Private/Admin
exports.addAsset = async (req, res) => {
  try {
    const {
      assetName,
      assetType,
      purchaseDate,
      cost,
      condition,
      location,
      status,
      description
    } = req.body;

    const asset = await Asset.create({
      assetName,
      assetType,
      purchaseDate,
      cost,
      condition: condition || 'NEW',
      location,
      status: status || 'IN_USE',
      description
    });

    res.status(201).json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error adding asset',
      error: error.message
    });
  }
};

// @desc    Update asset
// @route   PUT /api/assets/:id
// @access  Private/Admin
exports.updateAsset = async (req, res) => {
  try {
    const {
      assetName,
      assetType,
      purchaseDate,
      cost,
      condition,
      location,
      status,
      description
    } = req.body;

    let asset = await Asset.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    asset.assetName = assetName || asset.assetName;
    asset.assetType = assetType || asset.assetType;
    asset.purchaseDate = purchaseDate || asset.purchaseDate;
    asset.cost = cost || asset.cost;
    asset.condition = condition || asset.condition;
    asset.location = location || asset.location;
    asset.status = status || asset.status;
    asset.description = description || asset.description;

    await asset.save();

    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error updating asset',
      error: error.message
    });
  }
};

// @desc    Delete asset (soft delete)
// @route   DELETE /api/assets/:id
// @access  Private/Admin
exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    asset.isDeleted = true;
    asset.assetName = `deleted_${Date.now()}_${asset.assetName}`;
    await asset.save();

    res.status(200).json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error deleting asset',
      error: error.message
    });
  }
};

// @desc    Get asset report
// @route   GET /api/assets/report
// @access  Private/Admin
exports.getAssetReport = async (req, res) => {
  try {
    const assets = await Asset.find({ isDeleted: false });

    const summary = assets.reduce(
      (acc, asset) => {
        acc.totalCost += asset.cost;
        if (asset.status === 'IN_USE') acc.inUse++;
        else if (asset.status === 'UNDER_REPAIR') acc.underRepair++;
        else if (asset.status === 'SCRAP') acc.scrap++;
        else if (asset.status === 'DISPOSED') acc.disposed++;
        return acc;
      },
      { totalCost: 0, inUse: 0, underRepair: 0, scrap: 0, disposed: 0 }
    );

    res.status(200).json({
      success: true,
      data: {
        assets,
        summary
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error generating asset report',
      error: error.message
    });
  }
};
