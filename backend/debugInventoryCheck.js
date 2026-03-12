const mongoose = require('mongoose');
const Inventory = require('./models/Inventory');
const Medicine = require('./models/Medicine');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const med = await Medicine.findOne({ medicineName: /VITAMIN D/i });
    console.log('medicine', med ? med._id.toString() : 'not found', med ? med.medicineName : '');
    if (!med) {
      await mongoose.disconnect();
      return;
    }
    const now = new Date();
    const inv = await Inventory.find({ medicine: med._id, isDeleted: false }).lean();
    console.log('all rows', inv.length);
    inv.forEach(i => console.log('row', i.batchNumber, i.quantityAvailable, i.status, i.expiryDate));
    const invOk = await Inventory.find({ medicine: med._id, isDeleted: false, expiryDate: { $gte: now }, quantityAvailable: { $gt: 0 } }).lean();
    console.log('ok rows', invOk.length);
    invOk.forEach(i => console.log('ok', i.batchNumber, i.quantityAvailable, i.status, i.expiryDate));
    await mongoose.disconnect();
  } catch (e) {
    console.error('error', e);
    await mongoose.disconnect();
    process.exit(1);
  }
})();