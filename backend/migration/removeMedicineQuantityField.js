const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');

async function removeMedicineQuantityField() {
  console.log('Starting medicine quantity cleanup...');

  try {
    await connectDB();

    const result = await mongoose.connection.collection('medicines').updateMany(
      { quantity: { $exists: true } },
      { $unset: { quantity: '' } }
    );

    console.log(`Matched ${result.matchedCount || 0} medicine documents`);
    console.log(`Updated ${result.modifiedCount || 0} medicine documents`);
    console.log('Medicine quantity cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('Error removing quantity field from medicines:', error);
    process.exit(1);
  }
}

removeMedicineQuantityField();
