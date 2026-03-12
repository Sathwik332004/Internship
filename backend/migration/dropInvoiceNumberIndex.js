/**
 * Migration Script: Drop old invoiceNumber unique index
 * 
 * This script removes the old unique index on invoiceNumber field from the purchases collection.
 * The invoiceNumber field has been replaced with supplierInvoiceNumber.
 * 
 * Run with: node backend/migration/dropInvoiceNumberIndex.js
 */

const mongoose = require('mongoose');

async function dropInvoiceNumberIndex() {
  try {
    // Connect to MongoDB (using Atlas connection string provided by user)
    const mongoUri = 'mongodb+srv://sathwikpn4_db_user:ouVAheMhLzBbHaN2@cluster0.yqqgx0x.mongodb.net/?appName=Cluster0';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const purchasesCollection = db.collection('purchases');

    // List all indexes on the purchases collection
    const indexes = await purchasesCollection.indexes();
    console.log('\nCurrent indexes on purchases collection:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Check if invoiceNumber index exists
    const invoiceNumberIndex = indexes.find(idx => idx.key.invoiceNumber !== undefined);
    
    if (invoiceNumberIndex) {
      console.log(`\nFound invoiceNumber index: ${invoiceNumberIndex.name}`);
      
      // Drop the index
      await purchasesCollection.dropIndex(invoiceNumberIndex.name);
      console.log(`✓ Successfully dropped index: ${invoiceNumberIndex.name}`);
    } else {
      console.log('\n✓ No invoiceNumber index found - nothing to drop');
    }

    // Verify indexes after removal
    const updatedIndexes = await purchasesCollection.indexes();
    console.log('\nUpdated indexes on purchases collection:');
    updatedIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    if (error.codeName === 'IndexNotFound') {
      console.log('\n✓ Index already removed or not found');
    } else {
      console.error('\n✗ Error during migration:', error.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
dropInvoiceNumberIndex();

