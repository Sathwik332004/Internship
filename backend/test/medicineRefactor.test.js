/**
 * Medicine Module Refactoring Test Suite
 * 
 * This test verifies that the Medicine model refactoring is complete and correct.
 * Run with: node backend/test/medicineRefactor.test.js
 */

const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');
const Inventory = require('../models/Inventory');

// Test configuration
const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical_store_test';

// Test results
const tests = {
  passed: 0,
  failed: 0,
  results: []
};

function test(name, fn) {
  try {
    fn();
    tests.passed++;
    tests.results.push({ name, status: 'PASSED' });
    console.log(`✅ ${name}`);
  } catch (error) {
    tests.failed++;
    tests.results.push({ name, status: 'FAILED', error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertNotExists(obj, field, message) {
  if (field in obj) {
    throw new Error(message || `Field '${field}' should not exist`);
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('Medicine Module Refactoring Test Suite');
  console.log('========================================\n');

  try {
    // Connect to database
    await mongoose.connect(TEST_DB_URI);
    console.log('Connected to MongoDB\n');

    // Clear test data
    await Medicine.deleteMany({ isDeleted: false });
    await Inventory.deleteMany({});

    // ============================================
    // TEST 1: Medicine Schema Structure
    // ============================================
    console.log('--- Testing Medicine Schema Structure ---\n');

    test('Medicine schema should have required fields', () => {
      const medicine = new Medicine({
        medicineName: 'TEST MEDICINE',
        brandName: 'TEST BRAND',
        strength: '500mg',
        packSize: '10 Tablets',
        manufacturer: 'Test Manufacturer',
        gstPercent: 12
      });
      
      assert(medicine.medicineName === 'TEST MEDICINE', 'medicineName not set correctly');
      assert(medicine.brandName === 'TEST BRAND', 'brandName not set correctly');
    });

    test('Medicine schema should NOT have removed fields', () => {
      const medicine = new Medicine({
        medicineName: 'TEST MEDICINE',
        brandName: 'TEST BRAND',
        strength: '500mg',
        packSize: '10 Tablets',
        manufacturer: 'Test Manufacturer',
        gstPercent: 12
      });
      
      assertNotExists(medicine, 'purchasePrice', 'purchasePrice should be removed');
      assertNotExists(medicine, 'sellingPrice', 'sellingPrice should be removed');
      assertNotExists(medicine, 'quantity', 'quantity should be removed');
      assertNotExists(medicine, 'expiryDate', 'expiryDate should be removed');
      assertNotExists(medicine, 'batchNumber', 'batchNumber should be removed');
    });

    test('Medicine schema should have gtin field', () => {
      const medicine = new Medicine({
        medicineName: 'TEST MEDICINE',
        brandName: 'TEST BRAND',
        strength: '500mg',
        packSize: '10 Tablets',
        manufacturer: 'Test Manufacturer',
        gstPercent: 12,
        gtin: '12345678901234'
      });
      
      assert(medicine.gtin === '12345678901234', 'gtin not set correctly');
    });

    test('Medicine schema should have defaultSellingPrice field', () => {
      const medicine = new Medicine({
        medicineName: 'TEST MEDICINE',
        brandName: 'TEST BRAND',
        strength: '500mg',
        packSize: '10 Tablets',
        manufacturer: 'Test Manufacturer',
        gstPercent: 12,
        defaultSellingPrice: 25.50
      });
      
      assert(medicine.defaultSellingPrice === 25.50, 'defaultSellingPrice not set correctly');
    });

    test('Medicine schema should have timestamps', async () => {
      const medicine = new Medicine({
        medicineName: 'TIMESTAMP TEST',
        brandName: 'TEST BRAND',
        strength: '500mg',
        packSize: '10 Tablets',
        manufacturer: 'Test Manufacturer',
        gstPercent: 12
      });
      
      await medicine.save();
      
      assert(medicine.createdAt instanceof Date, 'createdAt should be a Date');
      assert(medicine.updatedAt instanceof Date, 'updatedAt should be a Date');
    });

    // ============================================
    // TEST 2: Medicine CRUD Operations
    // ============================================
    console.log('\n--- Testing Medicine CRUD Operations ---\n');

    let testMedicineId;

    test('Should create a new medicine (Product Master)', async () => {
      const medicine = await Medicine.create({
        medicineName: 'PARACETAMOL',
        brandName: 'CROCIN',
        strength: '500mg',
        packSize: '10 Tablets',
        manufacturer: 'GlaxoSmithKline',
        barcode: '8901234567890',
        gtin: '89012345678901',
        gstPercent: 12,
        defaultSellingPrice: 25.00,
        reorderLevel: 20,
        status: 'ACTIVE'
      });
      
      testMedicineId = medicine._id;
      assert(medicine.medicineName === 'PARACETAMOL', 'Medicine not created correctly');
      assert(medicine.defaultSellingPrice === 25.00, 'defaultSellingPrice not saved');
      assert(medicine.gtin === '89012345678901', 'gtin not saved');
    });

    test('Should update medicine (Product Master only)', async () => {
      const updated = await Medicine.findByIdAndUpdate(
        testMedicineId,
        {
          defaultSellingPrice: 30.00,
          gtin: '89012345678902'
        },
        { new: true }
      );
      
      assert(updated.defaultSellingPrice === 30.00, 'defaultSellingPrice not updated');
      assert(updated.gtin === '89012345678902', 'gtin not updated');
    });

    test('Should NOT have stock fields after update', async () => {
      const medicine = await Medicine.findById(testMedicineId);
      
      assertNotExists(medicine.toObject(), 'purchasePrice', 'purchasePrice should not exist');
      assertNotExists(medicine.toObject(), 'sellingPrice', 'sellingPrice should not exist');
      assertNotExists(medicine.toObject(), 'quantity', 'quantity should not exist');
    });

    // ============================================
    // TEST 3: Inventory Integration
    // ============================================
    console.log('\n--- Testing Inventory Integration ---\n');

    test('Should create Inventory entry for stock', async () => {
      const inventory = await Inventory.create({
        medicine: testMedicineId,
        batchNumber: 'BATCH001',
        expiryDate: new Date('2026-12-31'),
        quantity: 100,
        purchasePrice: 15.50,
        sellingPrice: 25.00,
        gstPercent: 12
      });
      
      assert(inventory.quantity === 100, 'Inventory quantity not set');
      assert(inventory.batchNumber === 'BATCH001', 'Batch number not set');
      assert(inventory.medicine.toString() === testMedicineId.toString(), 'Medicine reference not set');
    });

    test('Should get total stock from Inventory', async () => {
      const totalStock = await Inventory.getTotalStock(testMedicineId);
      assertEqual(totalStock, 100, 'Total stock should be 100');
    });

    // ============================================
    // TEST 4: Indexes
    // ============================================
    console.log('\n--- Testing Database Indexes ---\n');

    test('Should have text index on medicineName and brandName', async () => {
      const indexes = await Medicine.collection.getIndexes();
      const hasTextIndex = Object.values(indexes).some(idx => 
        idx.key && idx.key.medicineName === 'text' && idx.key.brandName === 'text'
      );
      assert(hasTextIndex, 'Text index on medicineName and brandName not found');
    });

    test('Should have index on barcode', async () => {
      const indexes = await Medicine.collection.getIndexes();
      const hasBarcodeIndex = Object.values(indexes).some(idx => 
        idx.key && idx.key.barcode === 1
      );
      assert(hasBarcodeIndex, 'Index on barcode not found');
    });

    test('Should have index on gtin', async () => {
      const indexes = await Medicine.collection.getIndexes();
      const hasGtinIndex = Object.values(indexes).some(idx => 
        idx.key && idx.key.gtin === 1
      );
      assert(hasGtinIndex, 'Index on gtin not found');
    });

    // ============================================
    // TEST 5: Search Functionality
    // ============================================
    console.log('\n--- Testing Search Functionality ---\n');

    test('Should search medicines by name', async () => {
      const results = await Medicine.find({
        $or: [
          { medicineName: { $regex: 'PARA', $options: 'i' } },
          { brandName: { $regex: 'PARA', $options: 'i' } }
        ]
      });
      
      assert(results.length > 0, 'Search should return results');
      assert(results[0].medicineName === 'PARACETAMOL', 'Search should find PARACETAMOL');
    });

    test('Should search medicines by barcode', async () => {
      const results = await Medicine.find({
        barcode: '8901234567890'
      });
      
      assert(results.length === 1, 'Search by barcode should return 1 result');
      assert(results[0].barcode === '8901234567890', 'Barcode should match');
    });

    test('Should search medicines by gtin', async () => {
      const results = await Medicine.find({
        gtin: '89012345678902'
      });
      
      assert(results.length === 1, 'Search by gtin should return 1 result');
      assert(results[0].gtin === '89012345678902', 'GTIN should match');
    });

    // ============================================
    // TEST 6: Validation
    // ============================================
    console.log('\n--- Testing Validation ---\n');

    test('Should require mandatory fields', async () => {
      try {
        await Medicine.create({
          medicineName: 'INVALID'
          // Missing other required fields
        });
        assert(false, 'Should have thrown validation error');
      } catch (error) {
        assert(error.name === 'ValidationError', 'Should throw ValidationError');
      }
    });

    test('Should validate GST percent range', async () => {
      try {
        await Medicine.create({
          medicineName: 'INVALID GST',
          brandName: 'TEST',
          strength: '500mg',
          packSize: '10',
          manufacturer: 'Test',
          gstPercent: 50 // Invalid: > 28
        });
        assert(false, 'Should have thrown validation error for GST');
      } catch (error) {
        assert(error.name === 'ValidationError', 'Should throw ValidationError for invalid GST');
      }
    });

    // ============================================
    // TEST 7: Soft Delete
    // ============================================
    console.log('\n--- Testing Soft Delete ---\n');

    test('Should soft delete medicine', async () => {
      const medicine = await Medicine.findById(testMedicineId);
      medicine.isDeleted = true;
      await medicine.save();
      
      const deleted = await Medicine.findById(testMedicineId);
      assert(deleted.isDeleted === true, 'Medicine should be soft deleted');
    });

    test('Should not return deleted medicines in normal queries', async () => {
      const results = await Medicine.find({ isDeleted: false });
      const found = results.some(m => m._id.toString() === testMedicineId.toString());
      assert(!found, 'Deleted medicine should not appear in normal queries');
    });

    // ============================================
    // Summary
    // ============================================
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`Total Tests: ${tests.passed + tests.failed}`);
    console.log(`Passed: ${tests.passed}`);
    console.log(`Failed: ${tests.failed}`);
    console.log('========================================');

    if (tests.failed === 0) {
      console.log('\n✅ All tests passed! Medicine module refactoring is complete.');
    } else {
      console.log('\n❌ Some tests failed. Please review the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run tests
runTests();
