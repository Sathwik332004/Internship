const mongoose = require('mongoose');
const xlsx = require('xlsx');
const dotenv = require('dotenv');
const Medicine = require('../models/Medicine');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Map old columns to new schema
const columnMapping = {
  'Medicine Name': 'medicineName',
  'Generic Name': 'medicineName',
  'Brand Name': 'brandName',
  'Company': 'manufacturer',
  'Strength': 'strength',
  'Pack Size': 'packSize',
  'MRP': 'sellingPrice',
  'Rate': 'sellingPrice',
  'GST': 'gstPercent',
  'GST %': 'gstPercent',
  'Expiry': 'expiryDate',
  'Expiry Date': 'expiryDate',
  'Batch': 'batchNumber',
  'Batch No': 'batchNumber',
  'Barcode': 'barcode',
  'Quantity': 'quantity',
  'Qty': 'quantity',
  'Reorder Level': 'reorderLevel',
  'Min Stock': 'reorderLevel'
};

// Parse date from various formats
const parseDate = (dateValue) => {
  if (!dateValue) return null;
  
  if (dateValue instanceof Date) return dateValue;
  
  if (typeof dateValue === 'number') {
    const date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    return date;
  }
  
  const parsed = new Date(dateValue);
  if (!isNaN(parsed.getTime())) return parsed;
  
  return null;
};

// Parse number from various formats
const parseNumber = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

const importMedicines = async (filePath) => {
  try {
    await connectDB();

    console.log('Reading Excel file...');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet);

    console.log(`Found ${rawData.length} records to process`);

    const successRecords = [];
    const failedRecords = [];
    const duplicateRecords = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      
      try {
        const mappedData = {};
        
        for (const [oldColumn, newField] of Object.entries(columnMapping)) {
          if (row[oldColumn] !== undefined) {
            mappedData[newField] = row[oldColumn];
          }
        }

        if (!mappedData.medicineName || !mappedData.brandName) {
          failedRecords.push({
            row: i + 2,
            error: 'Missing required fields (medicineName or brandName)',
            data: row
          });
          continue;
        }

        const medicineData = {
          medicineName: String(mappedData.medicineName).toUpperCase().trim(),
          brandName: String(mappedData.brandName).toUpperCase().trim(),
          strength: mappedData.strength ? String(mappedData.strength).trim() : 'N/A',
          packSize: mappedData.packSize ? String(mappedData.packSize).trim() : 'N/A',
          manufacturer: mappedData.manufacturer ? String(mappedData.manufacturer).trim() : 'Unknown',
          barcode: mappedData.barcode ? String(mappedData.barcode).trim() : undefined,
          gstPercent: parseNumber(mappedData.gstPercent) || 12,
          purchasePrice: parseNumber(mappedData.purchasePrice) || 0,
          sellingPrice: parseNumber(mappedData.sellingPrice) || 0,
          quantity: parseNumber(mappedData.quantity) || 0,
          reorderLevel: parseNumber(mappedData.reorderLevel) || 10,
          expiryDate: parseDate(mappedData.expiryDate) || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          batchNumber: mappedData.batchNumber ? String(mappedData.batchNumber).trim() : `BATCH${Date.now()}`,
          status: 'ACTIVE'
        };

        if (medicineData.barcode) {
          const existing = await Medicine.findOne({
            barcode: medicineData.barcode,
            isDeleted: false
          });

          if (existing) {
            duplicateRecords.push({
              row: i + 2,
              barcode: medicineData.barcode,
              medicineName: medicineData.medicineName,
              brandName: medicineData.brandName
            });
            continue;
          }
        }

        const medicine = await Medicine.create(medicineData);
        successRecords.push({
          row: i + 2,
          id: medicine._id,
          medicineName: medicine.medicineName,
          brandName: medicine.brandName
        });

      } catch (rowError) {
        failedRecords.push({
          row: i + 2,
          error: rowError.message,
          data: row
        });
      }
    }

    console.log('\n=== Import Summary ===');
    console.log(`Total records: ${rawData.length}`);
    console.log(`Successful: ${successRecords.length}`);
    console.log(`Duplicates (skipped): ${duplicateRecords.length}`);
    console.log(`Failed: ${failedRecords.length}`);

    if (failedRecords.length > 0) {
      console.log('\n=== Failed Records ===');
      failedRecords.forEach(record => {
        console.log(`Row ${record.row}: ${record.error}`);
      });
    }

    if (duplicateRecords.length > 0) {
      console.log('\n=== Duplicate Records (Skipped) ===');
      duplicateRecords.forEach(record => {
        console.log(`Row ${record.row}: ${record.medicineName} (${record.barcode || 'no barcode'})`);
      });
    }

    console.log('\nImport completed!');
    process.exit();
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
};

const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node importMedicines.js <excel-file-path>');
  console.log('Example: node migration/importMedicines.js medicines.xlsx');
  process.exit();
}

importMedicines(filePath);
