const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: '../.env' });
}
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: './backend/.env' });
}
if (!process.env.MONGODB_URI) {
  dotenv.config();
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for migration');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const migrateMedicineFields = async () => {
  try {
    await connectDB();

    const db = mongoose.connection.db;
    const collection = db.collection('medicines');

    console.log('Starting migration...');

    // Step 1: Migrate sellingPrice to defaultSellingPrice
    const updateResult = await collection.updateMany(
      { sellingPrice: { $exists: true } },
      [
        {
          $set: {
            defaultSellingPrice: '$sellingPrice'
          }
        },
        {
          $unset: [
            'sellingPrice',
            'purchasePrice',
            'quantity',
            'expiryDate',
            'batchNumber',
            'createdAt',
            'updatedAt'
          ]
        }
      ]
    );

    console.log(`Migration complete:`);
    console.log(`- Documents modified: ${updateResult.modifiedCount}`);
    console.log(`- Documents matched: ${updateResult.matchedCount}`);

    // Step 2: Verify migration
    const remainingWithOldFields = await collection.countDocuments({
      $or: [
        { sellingPrice: { $exists: true } },
        { purchasePrice: { $exists: true } },
        { quantity: { $exists: true } },
        { expiryDate: { $exists: true } },
        { batchNumber: { $exists: true } }
      ]
    });

    if (remainingWithOldFields > 0) {
      console.log(`\n⚠️ Warning: ${remainingWithOldFields} documents still have old fields`);
    } else {
      console.log('\n✅ All documents migrated successfully');
    }

    // Step 3: Show sample of migrated document
    const sample = await collection.findOne({});
    if (sample) {
      console.log('\n📋 Sample migrated document:');
      console.log(JSON.stringify(sample, null, 2));
    }

    console.log('\n========================================');
    console.log('Migration completed successfully!');
    console.log('========================================');
    console.log('\nNext steps:');
    console.log('1. Restart your application');
    console.log('2. Verify the Medicine model works correctly');
    console.log('3. Test API endpoints');
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateMedicineFields();
