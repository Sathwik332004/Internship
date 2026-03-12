const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Medicine = require('../models/Medicine');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const Bill = require('../models/Bill');
const Asset = require('../models/Asset');

// Try multiple paths for .env file
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
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const seedAllData = async () => {
  try {
    await connectDB();
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Medicine.deleteMany({});
    await Supplier.deleteMany({});
    await Purchase.deleteMany({});
    await Bill.deleteMany({});
    await Asset.deleteMany({});
    console.log('Existing data cleared');

    // Create Users
    console.log('Creating users...');
    const users = await User.create([
      { name: 'Admin', email: 'admin@medicalstore.com', password: 'admin123', role: 'admin', phone: '9876543210', isActive: true },
      { name: 'Dr. Priya Sharma', email: 'priya@medicalstore.com', password: 'staff123', role: 'staff', phone: '9876543211', isActive: true },
      { name: 'Rahul Patel', email: 'rahul@medicalstore.com', password: 'staff123', role: 'staff', phone: '9876543212', isActive: true },
      { name: 'Anita Desai', email: 'anita@medicalstore.com', password: 'staff123', role: 'staff', phone: '9876543213', isActive: false }
    ]);
    console.log(`${users.length} users created`);

    // Create Suppliers
    console.log('Creating suppliers...');
    const suppliers = await Supplier.create([
      { supplierName: 'MediCorp Pharmaceuticals', contactPerson: 'Rajesh Kumar', email: 'rajesh@medicorp.com', phone: '9988776655', address: '123 Industrial Area, Mumbai', gstNumber: '27AABCU9603R1ZX', state: 'Maharashtra', isActive: true },
      { supplierName: 'HealthCare Distributors', contactPerson: 'Sita Devi', email: 'sita@healthcare.com', phone: '9977553311', address: '456 Pharma Hub, Delhi', gstNumber: '07AABCU9603R1ZX', state: 'Delhi', isActive: true },
      { supplierName: 'LifeLine Medical Supplies', contactPerson: 'Amit Singh', email: 'amit@lifeline.com', phone: '9966332211', address: '789 Medical Complex, Bangalore', gstNumber: '29AABCU9603R1ZX', state: 'Karnataka', isActive: true },
      { supplierName: 'CureAll Pharma', contactPerson: 'Neha Gupta', email: 'neha@cureall.com', phone: '9955112233', address: '321 Health Park, Chennai', gstNumber: '33AABCU9603R1ZX', state: 'Tamil Nadu', isActive: true },
      { supplierName: 'Wellness Distributors', contactPerson: 'Vikram Rao', email: 'vikram@wellness.com', phone: '9944221133', address: '654 Care Center, Hyderabad', gstNumber: '36AABCU9603R1ZX', state: 'Telangana', isActive: false }
    ]);
    console.log(`${suppliers.length} suppliers created`);

    // Create Medicines (Product Master - no stock data)
    console.log('Creating medicines...');
    const medicines = await Medicine.create([
      { medicineName: 'PARACETAMOL', brandName: 'CROCIN', strength: '500mg', packSize: '10 Tablets', manufacturer: 'GlaxoSmithKline', barcode: '8901234567890', gtin: '89012345678901', gstPercent: 12, defaultSellingPrice: 25.00, reorderLevel: 20, status: 'ACTIVE' },
      { medicineName: 'IBUPROFEN', brandName: 'BRUFEN', strength: '400mg', packSize: '10 Tablets', manufacturer: 'Abbott', barcode: '8901234567891', gtin: '89012345678912', gstPercent: 12, defaultSellingPrice: 35.00, reorderLevel: 15, status: 'ACTIVE' },
      { medicineName: 'AMOXICILLIN', brandName: 'MOX', strength: '500mg', packSize: '6 Capsules', manufacturer: 'Sun Pharma', barcode: '8901234567892', gtin: '89012345678923', gstPercent: 12, defaultSellingPrice: 65.00, reorderLevel: 10, status: 'ACTIVE' },
      { medicineName: 'METFORMIN', brandName: 'GLYCOMET', strength: '500mg', packSize: '10 Tablets', manufacturer: 'USV', barcode: '8901234567893', gtin: '89012345678934', gstPercent: 12, defaultSellingPrice: 28.00, reorderLevel: 25, status: 'ACTIVE' },
      { medicineName: 'ATORVASTATIN', brandName: 'ATORVA', strength: '10mg', packSize: '10 Tablets', manufacturer: 'Zydus Cadila', barcode: '8901234567894', gtin: '89012345678945', gstPercent: 12, defaultSellingPrice: 78.00, reorderLevel: 12, status: 'ACTIVE' },
      { medicineName: 'OMEPRAZOLE', brandName: 'OMEE', strength: '20mg', packSize: '10 Capsules', manufacturer: 'Dr. Reddy\'s', barcode: '8901234567895', gtin: '89012345678956', gstPercent: 12, defaultSellingPrice: 48.00, reorderLevel: 15, status: 'ACTIVE' },
      { medicineName: 'AZITHROMYCIN', brandName: 'AZEE', strength: '500mg', packSize: '5 Tablets', manufacturer: 'Cipla', barcode: '8901234567896', gtin: '89012345678967', gstPercent: 12, defaultSellingPrice: 120.00, reorderLevel: 8, status: 'ACTIVE' },
      { medicineName: 'CETIRIZINE', brandName: 'CETZINE', strength: '10mg', packSize: '10 Tablets', manufacturer: 'GlaxoSmithKline', barcode: '8901234567897', gtin: '89012345678978', gstPercent: 12, defaultSellingPrice: 18.50, reorderLevel: 20, status: 'ACTIVE' },
      { medicineName: 'DICLOFENAC', brandName: 'VOVERAN', strength: '50mg', packSize: '10 Tablets', manufacturer: 'Novartis', barcode: '8901234567898', gtin: '89012345678989', gstPercent: 12, defaultSellingPrice: 42.00, reorderLevel: 15, status: 'ACTIVE' },
      { medicineName: 'RANITIDINE', brandName: 'RANTAC', strength: '150mg', packSize: '10 Tablets', manufacturer: 'J.B. Chemicals', barcode: '8901234567899', gtin: '89012345678990', gstPercent: 12, defaultSellingPrice: 25.00, reorderLevel: 18, status: 'INACTIVE' },
      { medicineName: 'SALBUTAMOL', brandName: 'ASTHALIN', strength: '4mg', packSize: '10 Tablets', manufacturer: 'Cipla', barcode: '8901234567900', gtin: '89012345679001', gstPercent: 12, defaultSellingPrice: 14.00, reorderLevel: 30, status: 'ACTIVE' },
      { medicineName: 'MULTIVITAMIN', brandName: 'SUPRADYN', strength: 'N/A', packSize: '15 Tablets', manufacturer: 'Bayer', barcode: '8901234567901', gtin: '89012345679012', gstPercent: 18, defaultSellingPrice: 135.00, reorderLevel: 10, status: 'ACTIVE' },
      { medicineName: 'INSULIN', brandName: 'HUMINSULIN', strength: '100IU/ml', packSize: '10ml Vial', manufacturer: 'Eli Lilly', barcode: '8901234567902', gtin: '89012345679023', gstPercent: 5, defaultSellingPrice: 350.00, reorderLevel: 5, status: 'ACTIVE' },
      { medicineName: 'AMLODIPINE', brandName: 'AMLOPRES', strength: '5mg', packSize: '10 Tablets', manufacturer: 'Cipla', barcode: '8901234567903', gtin: '89012345679034', gstPercent: 12, defaultSellingPrice: 36.00, reorderLevel: 22, status: 'ACTIVE' },
      { medicineName: 'PANTOPRAZOLE', brandName: 'PANTOCID', strength: '40mg', packSize: '10 Tablets', manufacturer: 'Sun Pharma', barcode: '8901234567904', gtin: '89012345679045', gstPercent: 12, defaultSellingPrice: 62.00, reorderLevel: 15, status: 'ACTIVE' }
    ]);

    console.log(`${medicines.length} medicines created`);

    // Create Assets
    console.log('Creating assets...');
    const assets = await Asset.create([
      { assetName: 'Refrigerator - Main Storage', assetType: 'ELECTRONICS', purchaseDate: new Date('2024-06-15'), cost: 45000, condition: 'NEW', location: 'Main Storage Room', status: 'IN_USE', description: 'Double door refrigerator for medicine storage' },
      { assetName: 'Computer System - Billing', assetType: 'ELECTRONICS', purchaseDate: new Date('2024-03-20'), cost: 55000, condition: 'NEW', location: 'Billing Counter', status: 'IN_USE', description: 'Desktop computer for billing operations' },
      { assetName: 'Display Racks - Front', assetType: 'FURNITURE', purchaseDate: new Date('2024-01-10'), cost: 25000, condition: 'GOOD', location: 'Front Store Area', status: 'IN_USE', description: 'Glass display racks for OTC products' },
      { assetName: 'Delivery Scooter', assetType: 'VEHICLE', purchaseDate: new Date('2023-11-05'), cost: 75000, condition: 'GOOD', location: 'Parking Area', status: 'IN_USE', description: 'Honda Activa for medicine delivery' },
      { assetName: 'Air Conditioner - 1.5 Ton', assetType: 'ELECTRONICS', purchaseDate: new Date('2024-05-12'), cost: 35000, condition: 'NEW', location: 'Main Hall', status: 'IN_USE', description: 'Split AC for customer comfort' },
      { assetName: 'Tablet Counting Machine', assetType: 'MACHINERY', purchaseDate: new Date('2024-02-28'), cost: 15000, condition: 'NEW', location: 'Dispensary', status: 'IN_USE', description: 'Electronic tablet counting machine' },
      { assetName: 'Office Chairs (Set of 4)', assetType: 'FURNITURE', purchaseDate: new Date('2023-12-15'), cost: 12000, condition: 'FAIR', location: 'Office Area', status: 'IN_USE', description: 'Ergonomic office chairs' },
      { assetName: 'Old Printer', assetType: 'ELECTRONICS', purchaseDate: new Date('2022-08-10'), cost: 8000, condition: 'POOR', location: 'Store Room', status: 'SCRAP', description: 'HP LaserJet printer - not working' }
    ]);
    console.log(`${assets.length} assets created`);

    // Create Purchases
    console.log('Creating purchases...');
    const purchases = await Purchase.create([
      { invoiceNumber: 'PUR/202501/0001', supplier: suppliers[0]._id, purchaseDate: new Date('2025-01-15'), items: [{ medicine: medicines[0]._id, batchNumber: 'CROC2024A', expiryDate: medicines[0].expiryDate, quantity: 100, freeQuantity: 10, purchasePrice: 15.50, sellingPrice: 25.00, gstPercent: 12, gstAmount: 186.00, total: 1736.00 }, { medicine: medicines[1]._id, batchNumber: 'BRU2024B', expiryDate: medicines[1].expiryDate, quantity: 50, freeQuantity: 5, purchasePrice: 22.00, sellingPrice: 35.00, gstPercent: 12, gstAmount: 132.00, total: 1232.00 }], subtotal: 2650.00, totalGst: 318.00, discountPercent: 5, discountAmount: 132.50, grandTotal: 2835.50, paymentMode: 'CREDIT', notes: 'Regular stock purchase', createdBy: users[0]._id },
      { invoiceNumber: 'PUR/202501/0002', supplier: suppliers[1]._id, purchaseDate: new Date('2025-01-20'), items: [{ medicine: medicines[2]._id, batchNumber: 'MOX2024C', expiryDate: medicines[2].expiryDate, quantity: 30, freeQuantity: 0, purchasePrice: 45.00, sellingPrice: 65.00, gstPercent: 12, gstAmount: 162.00, total: 1512.00 }, { medicine: medicines[3]._id, batchNumber: 'GLY2024D', expiryDate: medicines[3].expiryDate, quantity: 100, freeQuantity: 20, purchasePrice: 18.50, sellingPrice: 28.00, gstPercent: 12, gstAmount: 222.00, total: 2072.00 }], subtotal: 3400.00, totalGst: 384.00, discountPercent: 0, discountAmount: 0, grandTotal: 3784.00, paymentMode: 'UPI', notes: 'Urgent stock requirement', createdBy: users[1]._id },
      { invoiceNumber: 'PUR/202502/0001', supplier: suppliers[2]._id, purchaseDate: new Date('2025-02-05'), items: [{ medicine: medicines[4]._id, batchNumber: 'ATV2024E', expiryDate: medicines[4].expiryDate, quantity: 40, freeQuantity: 0, purchasePrice: 55.00, sellingPrice: 78.00, gstPercent: 12, gstAmount: 264.00, total: 2464.00 }, { medicine: medicines[5]._id, batchNumber: 'OME2024F', expiryDate: medicines[5].expiryDate, quantity: 60, freeQuantity: 6, purchasePrice: 32.00, sellingPrice: 48.00, gstPercent: 12, gstAmount: 230.40, total: 2150.40 }, { medicine: medicines[6]._id, batchNumber: 'AZE2024G', expiryDate: medicines[6].expiryDate, quantity: 25, freeQuantity: 0, purchasePrice: 85.00, sellingPrice: 120.00, gstPercent: 12, gstAmount: 255.00, total: 2380.00 }], subtotal: 6800.00, totalGst: 749.40, discountPercent: 3, discountAmount: 226.48, grandTotal: 7322.92, paymentMode: 'CASH', notes: 'Bulk purchase with discount', createdBy: users[0]._id },
      { invoiceNumber: 'PUR/202502/0002', supplier: suppliers[0]._id, purchaseDate: new Date('2025-02-12'), items: [{ medicine: medicines[7]._id, batchNumber: 'CET2024H', expiryDate: medicines[7].expiryDate, quantity: 80, freeQuantity: 8, purchasePrice: 12.00, sellingPrice: 18.50, gstPercent: 12, gstAmount: 115.20, total: 1075.20 }, { medicine: medicines[8]._id, batchNumber: 'VOV2024I', expiryDate: medicines[8].expiryDate, quantity: 50, freeQuantity: 0, purchasePrice: 28.00, sellingPrice: 42.00, gstPercent: 12, gstAmount: 168.00, total: 1568.00 }], subtotal: 2400.00, totalGst: 283.20, discountPercent: 0, discountAmount: 0, grandTotal: 2683.20, paymentMode: 'CARD', notes: 'Regular monthly purchase', createdBy: users[2]._id },
      { invoiceNumber: 'PUR/202502/0003', supplier: suppliers[3]._id, purchaseDate: new Date('2025-02-18'), items: [{ medicine: medicines[9]._id, batchNumber: 'RAN2024J', expiryDate: medicines[9].expiryDate, quantity: 100, freeQuantity: 10, purchasePrice: 16.50, sellingPrice: 25.00, gstPercent: 12, gstAmount: 198.00, total: 1848.00 }, { medicine: medicines[10]._id, batchNumber: 'AST2024K', expiryDate: medicines[10].expiryDate, quantity: 150, freeQuantity: 15, purchasePrice: 8.50, sellingPrice: 14.00, gstPercent: 12, gstAmount: 153.00, total: 1428.00 }], subtotal: 2800.00, totalGst: 351.00, discountPercent: 2, discountAmount: 63.02, grandTotal: 3087.98, paymentMode: 'CREDIT', notes: 'Credit purchase - 30 days', createdBy: users[1]._id },
      { invoiceNumber: 'PUR/202503/0001', supplier: suppliers[1]._id, purchaseDate: new Date('2025-03-01'), items: [{ medicine: medicines[11]._id, batchNumber: 'SUP2024L', expiryDate: medicines[11].expiryDate, quantity: 30, freeQuantity: 0, purchasePrice: 95.00, sellingPrice: 135.00, gstPercent: 18, gstAmount: 513.00, total: 3363.00 }, { medicine: medicines[12]._id, batchNumber: 'HUM2024M', expiryDate: medicines[12].expiryDate, quantity: 20, freeQuantity: 0, purchasePrice: 280.00, sellingPrice: 350.00, gstPercent: 5, gstAmount: 280.00, total: 5880.00 }], subtotal: 8900.00, totalGst: 793.00, discountPercent: 0, discountAmount: 0, grandTotal: 9693.00, paymentMode: 'UPI', notes: 'High value medicines', createdBy: users[0]._id },
      { invoiceNumber: 'PUR/202503/0002', supplier: suppliers[2]._id, purchaseDate: new Date('2025-03-10'), items: [{ medicine: medicines[13]._id, batchNumber: 'AML2024N', expiryDate: medicines[13].expiryDate, quantity: 100, freeQuantity: 10, purchasePrice: 24.00, sellingPrice: 36.00, gstPercent: 12, gstAmount: 288.00, total: 2688.00 }, { medicine: medicines[14]._id, batchNumber: 'PAN2024O', expiryDate: medicines[14].expiryDate, quantity: 50, freeQuantity: 5, purchasePrice: 42.00, sellingPrice: 62.00, gstPercent: 12, gstAmount: 252.00, total: 2352.00 }], subtotal: 4800.00, totalGst: 540.00, discountPercent: 4, discountAmount: 213.60, grandTotal: 5126.40, paymentMode: 'CASH', notes: 'Cash purchase with discount', createdBy: users[2]._id },
      { invoiceNumber: 'PUR/202503/0003', supplier: suppliers[0]._id, purchaseDate: new Date('2025-03-15'), items: [{ medicine: medicines[0]._id, batchNumber: 'CROC2024B', expiryDate: new Date('2027-06-30'), quantity: 200, freeQuantity: 20, purchasePrice: 15.00, sellingPrice: 25.00, gstPercent: 12, gstAmount: 360.00, total: 3360.00 }, { medicine: medicines[2]._id, batchNumber: 'MOX2024D', expiryDate: new Date('2027-04-15'), quantity: 50, freeQuantity: 0, purchasePrice: 44.00, sellingPrice: 65.00, gstPercent: 12, gstAmount: 264.00, total: 2464.00 }, { medicine: medicines[5]._id, batchNumber: 'OME2024G', expiryDate: new Date('2027-03-20'), quantity: 80, freeQuantity: 8, purchasePrice: 31.00, sellingPrice: 48.00, gstPercent: 12, gstAmount: 297.60, total: 2777.60 }], subtotal: 8200.00, totalGst: 921.60, discountPercent: 5, discountAmount: 456.08, grandTotal: 8665.52, paymentMode: 'CREDIT', notes: 'Large stock order', createdBy: users[0]._id }
    ]);
    console.log(`${purchases.length} purchases created`);

    // Create Bills
    console.log('Creating bills...');
    const bills = await Bill.create([
      { invoiceNumber: 'INV/20250205/0001', billDate: new Date('2025-02-05'), customerName: 'Ramesh Kumar', customerPhone: '9876543210', items: [{ medicine: medicines[0]._id, medicineName: medicines[0].medicineName, brandName: medicines[0].brandName, batchNumber: 'CROC2024A', expiryDate: medicines[0].expiryDate, quantity: 2, looseQuantity: 0, packQuantity: 2, unitQuantity: 2, rate: 25.00, gstPercent: 12, gstAmount: 6.00, discountPercent: 0, discountAmount: 0, total: 56.00 }, { medicine: medicines[7]._id, medicineName: medicines[7].medicineName, brandName: medicines[7].brandName, batchNumber: 'CET2024H', expiryDate: medicines[7].expiryDate, quantity: 1, looseQuantity: 0, packQuantity: 1, unitQuantity: 1, rate: 18.50, gstPercent: 12, gstAmount: 2.22, discountPercent: 0, discountAmount: 0, total: 20.72 }], subtotal: 68.50, totalGst: 8.22, discountPercent: 0, discountAmount: 0, grandTotal: 76.72, paymentMode: 'CASH', amountPaid: 76.72, balance: 0, createdBy: users[1]._id },
      { invoiceNumber: 'INV/20250206/0001', billDate: new Date('2025-02-06'), customerName: 'Sunita Devi', customerPhone: '9876543211', items: [{ medicine: medicines[2]._id, medicineName: medicines[2].medicineName, brandName: medicines[2].brandName, batchNumber: 'MOX2024C', expiryDate: medicines[2].expiryDate, quantity: 1, looseQuantity: 0, packQuantity: 1, unitQuantity: 1, rate: 65.00, gstPercent: 12, gstAmount: 7.80, discountPercent: 5, discountAmount: 3.25, total: 69.55 }], subtotal: 65.00, totalGst: 7.80, discountPercent: 5, discountAmount: 3.25, grandTotal: 69.55, paymentMode: 'UPI', amountPaid: 69.55, balance: 0, createdBy: users[1]._id },
      { invoiceNumber: 'INV/20250207/0001', billDate: new Date('2025-02-07'), customerName: 'Amit Sharma', customerPhone: '9876543212', items: [{ medicine: medicines[3]._id, medicineName: medicines[3].medicineName, brandName: medicines[3].brandName, batchNumber: 'GLY2024D', expiryDate: medicines[3].expiryDate, quantity: 3, looseQuantity: 0, packQuantity: 3, unitQuantity: 3, rate: 28.00, gstPercent: 12, gstAmount: 10.08, discountPercent: 0, discountAmount: 0, total: 94.08 }, { medicine: medicines[4]._id, medicineName: medicines[4].medicineName, brandName: medicines[4].brandName, batchNumber: 'ATV2024E', expiryDate: medicines[4].expiryDate, quantity: 1, looseQuantity: 0, packQuantity: 1, unitQuantity: 1, rate: 78.00, gstPercent: 12, gstAmount: 9.36, discountPercent: 0, discountAmount: 0, total: 87.36 }], subtotal: 162.00, totalGst: 19.44, discountPercent: 0, discountAmount: 0, grandTotal: 181.44, paymentMode: 'CARD', amountPaid: 181.44, balance: 0, createdBy: users[2]._id },
      { invoiceNumber: 'INV/20250208/0001', billDate: new Date('2025-02-08'), customerName: 'Priya Patel', customerPhone: '9876543213', items: [{ medicine: medicines[5]._id, medicineName: medicines[5].medicineName, brandName: medicines[5].brandName, batchNumber: 'OME2024F', expiryDate: medicines[5].expiryDate, quantity: 2, looseQuantity: 0, packQuantity: 2, unitQuantity: 2, rate: 48.00, gstPercent: 12, gstAmount: 11.52, discountPercent: 0, discountAmount: 0, total: 107.52 }, { medicine: medicines[1]._id, medicineName: medicines[1].medicineName, brandName: medicines[1].brandName, batchNumber: 'BRU2024B', expiryDate: medicines[1].expiryDate, quantity: 1, looseQuantity: 0, packQuantity: 1, unitQuantity: 1, rate: 35.00, gstPercent: 12, gstAmount: 4.20, discountPercent: 0, discountAmount: 0, total: 39.20 }], subtotal: 131.00, totalGst: 15.72, discountPercent: 2, discountAmount: 2.62, grandTotal: 144.10, paymentMode: 'CASH', amountPaid: 150.00, balance: 5.90, createdBy: users[1]._id },
      { invoiceNumber: 'INV/20250210/0001', billDate: new Date('2025-02-10'), customerName: 'Vikram Singh', customerPhone: '9876543214', items: [{ medicine: medicines[6]._id, medicineName: medicines[6].medicineName, brandName: medicines[6].brandName, batchNumber: 'AZE2024G', expiryDate: medicines[6].expiryDate, quantity: 1, looseQuantity: 0, packQuantity: 1, unitQuantity: 1, rate: 120.00, gstPercent: 12, gstAmount: 14.40, discountPercent: 0, discountAmount: 0, total: 134.40 }], subtotal: 120.00, totalGst: 14.40, discountPercent: 0, discountAmount: 0, grandTotal: 134.40, paymentMode: 'UPI', amountPaid: 134.40, balance: 0, createdBy: users[2]._id },
      { invoiceNumber: 'INV/20250212/0001', billDate: new Date('2025-02-12'), customerName: 'Neha Gupta', customerPhone: '9876543215', items: [{ medicine: medicines[8]._id, medicineName: medicines[8].medicineName, brandName: medicines[8].brandName, batchNumber: 'VOV2024I', expiryDate: medicines[8].expiryDate, quantity: 2, looseQuantity: 0, packQuantity: 2, unitQuantity: 2, rate: 42.00, gstPercent: 12, gstAmount: 10.08, discountPercent: 0, discountAmount: 0, total: 94.08 }, { medicine: medicines[10]._id, medicineName: medicines[10].medicineName, brandName: medicines[10].brandName, batchNumber: 'AST2024K', expiryDate: medicines[10].expiryDate, quantity: 3, looseQuantity: 0, packQuantity: 3, unitQuantity: 3, rate: 14.00, gstPercent: 12, gstAmount: 5.04, discountPercent: 0, discountAmount: 0, total: 47.04 }], subtotal: 126.00, totalGst: 15.12, discountPercent: 0, discountAmount: 0, grandTotal: 141.12, paymentMode: 'CASH', amountPaid: 141.12, balance: 0, createdBy: users[1]._id },
      { invoiceNumber: 'INV/20250215/0001', billDate: new Date('2025-02-15'), customerName: 'Suresh Verma', customerPhone: '9876543216', items: [{ medicine: medicines[11]._id, medicineName: medicines[11].medicineName, brandName: medicines[11].brandName, batchNumber: 'SUP2024L', expiryDate: medicines[11].expiryDate, quantity: 1, looseQuantity: 0, packQuantity: 1, unitQuantity: 1, rate: 135.00, gstPercent: 18, gstAmount: 24.30, discountPercent: 10, discountAmount: 13.50, total: 145.80 }], subtotal: 135.00, totalGst: 24.30, discountPercent: 10, discountAmount: 13.50, grandTotal: 145.80, paymentMode: 'CARD', amountPaid: 145.80, balance: 0, createdBy: users[2]._id },
      { invoiceNumber: 'INV/20250218/0001', billDate: new Date('2025-02-18'), customerName: 'Meera Reddy', customerPhone: '9876543217', items: [{ medicine: medicines[12]._id, medicineName: medicines[12].medicineName, brandName: medicines[12].brandName, batchNumber: 'HUM2024M', expiryDate: medicines[12].expiryDate, quantity: 1, looseQuantity: 0, packQuantity: 1, unitQuantity: 1, rate: 350.00, gstPercent: 5, gstAmount: 17.50, discountPercent: 0, discountAmount: 0, total: 367.50 }], subtotal: 350.00, totalGst: 17.50, discountPercent: 0, discountAmount: 0, grandTotal: 367.50, paymentMode: 'UPI', amountPaid: 367.50, balance: 0, createdBy: users[1]._id },
      { invoiceNumber: 'INV/20250220/0001', billDate: new Date('2025-02-20'), customerName: 'Arjun Nair', customerPhone: '9876543218', items: [{ medicine: medicines[13]._id, medicineName: medicines[13].medicineName, brandName: medicines[13].brandName, batchNumber: 'AML2024N', expiryDate: medicines[13].expiryDate, quantity: 2, looseQuantity: 0, packQuantity: 2, unitQuantity: 2, rate: 36.00, gstPercent: 12, gstAmount: 8.64, discountPercent: 0, discountAmount: 0, total: 80.64 }, { medicine: medicines[14]._id, medicineName: medicines[14].medicineName, brandName: medicines[14].brandName, batchNumber: 'PAN2024O', expiryDate: medicines[14].expiryDate, quantity: 1, looseQuantity: 0, packQuantity: 1, unitQuantity: 1, rate: 62.00, gstPercent: 12, gstAmount: 7.44, discountPercent: 5, discountAmount: 3.10, total: 66.34 }], subtotal: 134.00, totalGst: 16.08, discountPercent: 2.31, discountAmount: 3.10, grandTotal: 146.98, paymentMode: 'CASH', amountPaid: 150.00, balance: 3.02, createdBy: users[2]._id },
      { invoiceNumber: 'INV/20250222/0001', billDate: new Date('2025-02-22'), customerName: 'Kavita Joshi', customerPhone: '9876543219', items: [{ medicine: medicines[0]._id, medicineName: medicines[0].medicineName, brandName: medicines[0].brandName, batchNumber: 'CROC2024A', expiryDate: medicines[0].expiryDate, quantity: 5, looseQuantity: 0, packQuantity: 5, unitQuantity: 5, rate: 25.00, gstPercent: 12, gstAmount: 15.00, discountPercent: 0, discountAmount: 0, total: 140.00 }], subtotal: 125.00, totalGst: 15.00, discountPercent: 0, discountAmount: 0, grandTotal: 140.00, paymentMode: 'CASH', amountPaid: 140.00, balance: 0, createdBy: users[1]._id }
    ]);
    console.log(`${bills.length} bills created`);

    console.log('\n========================================');
    console.log('Sample data seeded successfully!');
    console.log('========================================');
    console.log('Summary:');
    console.log(`- Users: ${users.length}`);
    console.log(`- Suppliers: ${suppliers.length}`);
    console.log(`- Medicines: ${medicines.length}`);
    console.log(`- Assets: ${assets.length}`);
    console.log(`- Purchases: ${purchases.length}`);
    console.log(`- Bills: ${bills.length}`);
    console.log('========================================');
    console.log('\nLogin Credentials:');
    console.log('Admin: admin@medicalstore.com / admin123');
    console.log('Staff: priya@medicalstore.com / staff123');
    console.log('Staff: rahul@medicalstore.com / staff123');
    console.log('========================================\n');

    process.exit();
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedAllData();
