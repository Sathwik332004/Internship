const QRCode = require('qrcode');

/**
 * Generate QR code data for inventory batch
 * @param {Object} inventory - Inventory item
 * @param {Object} medicine - Medicine details
 * @returns {Object} - { qrCode: base64 image, qrCodeData: raw data string }
 */
const generateInventoryQRCode = async (inventory, medicine) => {
  const qrData = {
    medId: medicine._id.toString(),
    medName: medicine.medicineName,
    brandName: medicine.brandName,
    batch: inventory.batchNumber,
    expiry: inventory.expiryDate ? new Date(inventory.expiryDate).toISOString().split('T')[0] : null,
    mrp: inventory.mrp || inventory.sellingPrice,
    rate: inventory.sellingPrice,
    hsn: inventory.hsnCodeString || '',
    gst: inventory.gstPercent || 0
  };

  const qrCodeDataString = JSON.stringify(qrData);

  try {
    // Generate QR code as base64 image
    const qrCodeImage = await QRCode.toDataURL(qrCodeDataString, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    return {
      qrCode: qrCodeImage,
      qrCodeData: qrCodeDataString
    };
  } catch (error) {
    console.error('Error generating QR code:', error);
    return {
      qrCode: null,
      qrCodeData: qrCodeDataString
    };
  }
};

/**
 * Generate QR code for a single item (for billing)
 * @param {Object} item - Bill item or inventory item
 * @returns {String} - Base64 QR code image
 */
const generateSingleQRCode = async (item) => {
  try {
    const qrData = {
      medId: item.medicine?._id?.toString() || item.medicine?.toString(),
      medName: item.medicineName,
      batch: item.batchNumber,
      expiry: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : null,
      rate: item.rate,
      hsn: item.hsnCode || '',
      gst: item.gstPercent || 0
    };

    return await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 150,
      margin: 1
    });
  } catch (error) {
    console.error('Error generating single QR code:', error);
    return null;
  }
};

module.exports = {
  generateInventoryQRCode,
  generateSingleQRCode
};
