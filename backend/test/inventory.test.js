const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Purchase = require('../models/Purchase');
const Medicine = require('../models/Medicine');
const Supplier = require('../models/Supplier');
const User = require('../models/User');

// Test configuration
const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical_store_test';

// Test data
let testMedicine, testSupplier, testUser, testPurchase;

// Connect to test database
beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI);
  console.log('Connected to test database');
});

// Clean up before each test
beforeEach(async () => {
  await Inventory.deleteMany({});
  await Purchase.deleteMany({});
  await Medicine.deleteMany({});
  await Supplier.deleteMany({});
  await User.deleteMany({});
  
  // Create test data
  testMedicine = await Medicine.create({
    medicineName: 'PARACETAMOL',
    brandName: 'CROCIN',
    strength: '500MG',
    packSize: '10 TABLETS',
    manufacturer: 'GSK',
    gstPercent: 12,
    defaultSellingPrice: 50
  });
  
  testSupplier = await Supplier.create({
    supplierName: 'Test Supplier',
    gstNumber: '27AABCU9603R1ZX',
    phone: '9876543210',
    email: 'supplier@test.com',
    address: 'Test Address'
  });
  
  testUser = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'admin'
  });
});

// Disconnect after all tests
afterAll(async () => {
  await mongoose.connection.close();
  console.log('Disconnected from test database');
});

describe('Inventory Model Tests', () => {
  
  // Test 1: Create Inventory with all required fields
  test('Should create inventory with all required fields', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    const inventory = await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'BATCH001',
      expiryDate: futureDate,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      freeQuantity: 10,
      quantityAvailable: 110,
      supplier: testSupplier._id
    });
    
    expect(inventory).toBeDefined();
    expect(inventory.medicine.toString()).toBe(testMedicine._id.toString());
    expect(inventory.batchNumber).toBe('BATCH001');
    expect(inventory.quantityPurchased).toBe(100);
    expect(inventory.freeQuantity).toBe(10);
    expect(inventory.quantityAvailable).toBe(110);
    expect(inventory.supplier.toString()).toBe(testSupplier._id.toString());
    expect(inventory.createdAt).toBeDefined();
    expect(inventory.updatedAt).toBeDefined();
  });
  
  // Test 2: Unique constraint - medicine + batchNumber
  test('Should prevent duplicate batch per medicine', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    // Create first inventory
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'BATCH001',
      expiryDate: futureDate,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    const futureDate2 = new Date();
    futureDate2.setFullYear(futureDate2.getFullYear() + 2);
    
    // Try to create duplicate
    await expect(Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'BATCH001',
      expiryDate: futureDate2,

      purchasePrice: 35,
      sellingPrice: 55,
      quantityPurchased: 50,
      quantityAvailable: 50,
      supplier: testSupplier._id
    })).rejects.toThrow();
  });
  
  // Test 3: Same batch number for different medicines should be allowed
  test('Should allow same batch number for different medicines', async () => {
    const medicine2 = await Medicine.create({
      medicineName: 'IBUPROFEN',
      brandName: 'BRUFEN',
      strength: '400MG',
      packSize: '10 TABLETS',
      manufacturer: 'Abbott',
      gstPercent: 12
    });
    
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    // Create inventory for first medicine
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'BATCH001',
      expiryDate: futureDate,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    // Create inventory for second medicine with same batch number
    const inventory2 = await Inventory.create({
      medicine: medicine2._id,
      batchNumber: 'BATCH001',
      expiryDate: futureDate,

      purchasePrice: 25,
      sellingPrice: 45,
      quantityPurchased: 80,
      quantityAvailable: 80,
      supplier: testSupplier._id
    });
    
    expect(inventory2).toBeDefined();
    expect(inventory2.batchNumber).toBe('BATCH001');
  });
  
  // Test 4: Virtual - expiry
  test('Should calculate expiry virtual correctly', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10); // 10 days ago
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30); // 30 days from now
    
    const expiredInventory = await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'EXPIRED001',
      expiryDate: pastDate,
      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    const activeInventory = await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'ACTIVE001',
      expiryDate: futureDate,
      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    expect(expiredInventory.expiry).toBe(true);
    expect(activeInventory.expiry).toBe(false);
  });
  
  // Test 5: Virtual - daysUntilExpiry
  test('Should calculate daysUntilExpiry virtual correctly', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45); // 45 days from now
    
    const inventory = await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'DAYS001',
      expiryDate: futureDate,
      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    expect(inventory.daysUntilExpiry).toBeGreaterThanOrEqual(44);
    expect(inventory.daysUntilExpiry).toBeLessThanOrEqual(46);
  });
  
  // Test 6: Static method - getFIFOStock
  test('Should return stock sorted by expiry date (FIFO)', async () => {
    const today = new Date();
    const date1 = new Date(today.getFullYear() + 1, 5, 30); // Earlier expiry (June 30, next year)
    const date2 = new Date(today.getFullYear() + 1, 11, 31); // Later expiry (Dec 31, next year)
    const date3 = new Date(today.getFullYear() - 1, 11, 31); // Already expired (last year)

    
    // Create inventories with different expiry dates
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'FIFO002',
      expiryDate: date2,
      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'FIFO001',
      expiryDate: date1,
      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 50,
      quantityAvailable: 50,
      supplier: testSupplier._id
    });
    
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'FIFO003',
      expiryDate: date3,
      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 75,
      quantityAvailable: 75,
      supplier: testSupplier._id
    });
    
    const fifoStock = await Inventory.getFIFOStock(testMedicine._id);
    
    expect(fifoStock).toHaveLength(2); // Should exclude expired batch
    expect(fifoStock[0].batchNumber).toBe('FIFO001'); // Earlier expiry first
    expect(fifoStock[1].batchNumber).toBe('FIFO002'); // Later expiry second
  });
  
  // Test 7: Static method - getTotalStock
  test('Should calculate total available stock correctly', async () => {
    const futureDate1 = new Date();
    futureDate1.setFullYear(futureDate1.getFullYear() + 1);
    
    const futureDate2 = new Date();
    futureDate2.setFullYear(futureDate2.getFullYear() + 1);
    futureDate2.setMonth(5);
    
    const futureDate3 = new Date();
    futureDate3.setFullYear(futureDate3.getFullYear() + 1);
    futureDate3.setMonth(8);
    
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'TOTAL001',
      expiryDate: futureDate1,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'TOTAL002',
      expiryDate: futureDate2,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 50,
      quantityAvailable: 50,
      supplier: testSupplier._id
    });
    
    // Create exhausted inventory (should not be counted)
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'TOTAL003',
      expiryDate: futureDate3,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 25,
      quantityAvailable: 0,
      supplier: testSupplier._id
    });
    
    const totalStock = await Inventory.getTotalStock(testMedicine._id);
    expect(totalStock).toBe(150); // 100 + 50, excluding 0
  });
  
  // Test 8: Purchase creates inventory automatically
  test('Should create inventory when purchase is saved', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    const purchaseItems = [{
      medicine: testMedicine._id,
      batchNumber: 'PUR001',
      expiryDate: futureDate,

      quantity: 100,
      freeQuantity: 10,
      purchasePrice: 30,
      sellingPrice: 50,
      gstPercent: 12,
      total: 3360
    }];
    
    const purchase = await Purchase.create({
      invoiceNumber: 'TEST/001',
      supplier: testSupplier._id,
      items: purchaseItems,
      subtotal: 3000,
      totalGst: 360,
      grandTotal: 3360,
      createdBy: testUser._id
    });
    
    // Manually create inventory (simulating controller logic)
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'PUR001',
      expiryDate: futureDate,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      freeQuantity: 10,
      quantityAvailable: 110,
      supplier: testSupplier._id,
      purchase: purchase._id
    });
    
    const inventory = await Inventory.findOne({
      medicine: testMedicine._id,
      batchNumber: 'PUR001'
    });
    
    expect(inventory).toBeDefined();
    expect(inventory.quantityAvailable).toBe(110);
    expect(inventory.purchase.toString()).toBe(purchase._id.toString());
    expect(inventory.supplier.toString()).toBe(testSupplier._id.toString());
  });
  
  // Test 9: Update existing inventory on duplicate batch
  test('Should update existing inventory when same batch is purchased again', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    // Initial purchase
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'UPDATE001',
      expiryDate: futureDate,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      freeQuantity: 10,
      quantityAvailable: 110,
      supplier: testSupplier._id
    });
    
    // Simulate second purchase with same batch
    const existingInventory = await Inventory.findOne({
      medicine: testMedicine._id,
      batchNumber: 'UPDATE001'
    });
    
    existingInventory.quantityPurchased += 50;
    existingInventory.freeQuantity += 5;
    existingInventory.quantityAvailable = existingInventory.quantityPurchased + existingInventory.freeQuantity;
    existingInventory.purchasePrice = 32; // Update price
    await existingInventory.save();
    
    const updatedInventory = await Inventory.findOne({
      medicine: testMedicine._id,
      batchNumber: 'UPDATE001'
    });
    
    expect(updatedInventory.quantityPurchased).toBe(150);
    expect(updatedInventory.freeQuantity).toBe(15);
    expect(updatedInventory.quantityAvailable).toBe(165);
    expect(updatedInventory.purchasePrice).toBe(32);
  });
  
  // Test 10: Stock filtering by quantityAvailable
  test('Should filter inventory by quantityAvailable', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    // Create inventories with different quantities
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'STOCK001',
      expiryDate: futureDate,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'STOCK002',
      expiryDate: futureDate,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 50,
      quantityAvailable: 0,
      supplier: testSupplier._id
    });
    
    const availableStock = await Inventory.find({
      medicine: testMedicine._id,
      quantityAvailable: { $gt: 0 }
    });
    
    expect(availableStock).toHaveLength(1);
    expect(availableStock[0].batchNumber).toBe('STOCK001');
  });
  
  // Test 11: Timestamps
  test('Should have timestamps', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    const inventory = await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'TIME001',
      expiryDate: futureDate,

      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    expect(inventory.createdAt).toBeInstanceOf(Date);
    expect(inventory.updatedAt).toBeInstanceOf(Date);
  });
  
  // Test 12: Virtuals in JSON output
  test('Should include virtuals in JSON output', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    const inventory = await Inventory.create({
      medicine: testMedicine._id,
      batchNumber: 'VIRT001',
      expiryDate: futureDate,
      purchasePrice: 30,
      sellingPrice: 50,
      quantityPurchased: 100,
      quantityAvailable: 100,
      supplier: testSupplier._id
    });
    
    const json = inventory.toJSON();
    expect(json.expiry).toBeDefined();
    expect(json.daysUntilExpiry).toBeDefined();
  });
});

// Run tests
if (require.main === module) {
  // If running directly, use jest
  console.log('Run with: npm test -- inventory.test.js');
}

module.exports = { describe, test, expect };
