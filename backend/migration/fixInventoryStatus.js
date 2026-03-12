const mongoose = require('mongoose');
require('../config/db');
const Inventory = require('../models/Inventory');

async function fixInventoryStatus() {
  console.log('Starting inventory status fix...');
  
  try {
    // Find all inventory items that have stock but are marked as EXPIRED
    const expiredWithStock = await Inventory.find({
      quantityAvailable: { $gt: 0 },
      status: 'EXPIRED'
    });
    
    console.log(`Found ${expiredWithStock.length} items with stock but marked as EXPIRED`);
    
    // Update them to ACTIVE
    for (const item of expiredWithStock) {
      const oldStatus = item.status;
      item.status = 'ACTIVE';
      await item.save();
      console.log(`Updated ${item.batchNumber}: ${oldStatus} -> ACTIVE`);
    }
    
    // Also check for items with stock but no status set
    const noStatusWithStock = await Inventory.find({
      quantityAvailable: { $gt: 0 },
      status: { $exists: false }
    });
    
    console.log(`Found ${noStatusWithStock.length} items with stock but no status`);
    
    for (const item of noStatusWithStock) {
      item.status = 'ACTIVE';
      await item.save();
      console.log(`Set ACTIVE for ${item.batchNumber}`);
    }
    
    console.log('Inventory status fix completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing inventory status:', error);
    process.exit(1);
  }
}

fixInventoryStatus();
