/**
 * Migration Script: Normalize Batch Numbers to Uppercase
 * 
 * This script normalizes all inventory batch numbers to uppercase to fix
 * the case sensitivity issue where "a100" and "A100" were treated as different batches.
 * 
 * Usage: node migration/normalizeBatchNumbers.js
 */

const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy_erp';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// Define Inventory Schema (inline to avoid model loading issues)
const inventorySchema = new mongoose.Schema({
  medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
  batchNumber: { type: String },
  expiryDate: { type: Date },
  quantityAvailable: { type: Number }
}, { collection: 'inventories' });

const Inventory = mongoose.model('Inventory', inventorySchema);

async function normalizeBatchNumbers() {
  try {
    console.log('\n📋 Starting batch number normalization...\n');

    // Find all inventory records
    const allInventory = await Inventory.find({ isDeleted: false });
    
    console.log(`Found ${allInventory.length} inventory records`);

    let updatedCount = 0;
    let duplicateCount = 0;
    let skippedCount = 0;

    // Group by medicine + normalized batch to find duplicates
    const batchMap = new Map();
    
    for (const inv of allInventory) {
      const normalizedBatch = inv.batchNumber ? inv.batchNumber.toUpperCase().trim() : '';
      const key = `${inv.medicine}-${normalizedBatch}`;
      
      if (!batchMap.has(key)) {
        batchMap.set(key, []);
      }
      batchMap.get(key).push(inv);
    }

    // Check for duplicates after normalization
    console.log('\n🔍 Checking for duplicates after normalization...\n');
    
    for (const [key, records] of batchMap) {
      if (records.length > 1) {
        console.log(`⚠️  Duplicate batch found for medicine ${records[0].medicine}:`);
        records.forEach(r => console.log(`   - ${r.batchNumber} (${r.quantityAvailable} stock)`));
        
        // Merge: Sum up quantities and keep the oldest record
        const totalQty = records.reduce((sum, r) => sum + r.quantityAvailable, 0);
        const sortedByExpiry = records.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        const masterRecord = sortedByExpiry[0];
        
        console.log(`   → Keeping: ${masterRecord.batchNumber} with ${totalQty} total stock`);
        
        // Update master record
        masterRecord.batchNumber = normalizedBatch;
        masterRecord.quantityAvailable = totalQty;
        await masterRecord.save();
        updatedCount++;
        
        // Delete other duplicates
        for (let i = 1; i < records.length; i++) {
          await Inventory.findByIdAndDelete(records[i]._id);
          duplicateCount++;
        }
      }
    }

    // Now normalize all remaining batch numbers
    console.log('\n🔄 Normalizing remaining batch numbers to uppercase...\n');
    
    const cursor = Inventory.find({ isDeleted: false }).cursor();
    
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const originalBatch = doc.batchNumber || '';
      const normalizedBatch = originalBatch.toUpperCase().trim();
      
      if (originalBatch !== normalizedBatch) {
        doc.batchNumber = normalizedBatch;
        await doc.save();
        updatedCount++;
        console.log(`   Updated: "${originalBatch}" → "${normalizedBatch}"`);
      } else {
        skippedCount++;
      }
    }

    console.log('\n✅ Batch normalization complete!');
    console.log(`   - Records updated: ${updatedCount}`);
    console.log(`   - Duplicates merged: ${duplicateCount}`);
    console.log(`   - Already normalized: ${skippedCount}`);

    // Verify the fix
    console.log('\n🔍 Verifying fix...\n');
    
    const testCases = await Inventory.find({ 
      batchNumber: { $in: ['A100', 'a100'] } 
    }).populate('medicine', 'medicineName');
    
    if (testCases.length > 0) {
      console.log('✅ Batch query test - Found records:');
      testCases.forEach(t => console.log(`   - ${t.medicine?.medicineName}: ${t.batchNumber} (${t.quantityAvailable} stock)`));
    } else {
      console.log('⚠️  No records found with batch "A100" or "a100"');
    }

  } catch (error) {
    console.error('❌ Error during normalization:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 MongoDB Disconnected');
    process.exit(0);
  }
}

// Run the migration
connectDB().then(() => normalizeBatchNumbers());

