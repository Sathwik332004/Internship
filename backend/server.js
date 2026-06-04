const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { autoDisposeExpiredInventory } = require('./services/inventoryDisposalService');
const { checkAndCreateReorderPOs } = require('./services/reorderService');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const supplierRoutes = require('./routes/suppliers');
const purchaseRoutes = require('./routes/purchases');
const purchaseReturnRoutes = require('./routes/purchaseReturns');
const billRoutes = require('./routes/bills');
const salesReturnRoutes = require('./routes/salesReturns');
const assetRoutes = require('./routes/assets');
const hsnRoutes = require('./routes/hsn');
const inventoryRoutes = require('./routes/inventory');
const notificationRoutes = require('./routes/notifications');
const prescriptionRoutes = require('./routes/prescriptions');
const auditLogRoutes = require('./routes/auditLogs');
const staffAttendanceRoutes = require('./routes/staffAttendance');
const purchaseOrderRoutes = require('./routes/purchaseOrders');

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  }
}));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/purchase-returns', purchaseReturnRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/sales-returns', salesReturnRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/hsn', hsnRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/staff-attendance', staffAttendanceRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Medical Store API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const runAutoDisposal = async () => {
  try {
    const result = await autoDisposeExpiredInventory();
    if (result.disposedCount > 0) {
      console.log(`Auto-disposed ${result.disposedUnits} expired units across ${result.disposedCount} batches`);
    }
  } catch (error) {
    console.error('Auto disposal failed:', error.message);
  }
};

runAutoDisposal();

const autoDisposalIntervalMinutes = parseInt(process.env.AUTO_DISPOSAL_INTERVAL_MINUTES || '60', 10);
setInterval(runAutoDisposal, Math.max(autoDisposalIntervalMinutes, 1) * 60 * 1000);

// Auto reorder check — runs on startup then every N hours (default 6)
const runAutoReorderCheck = async () => {
  try {
    const result = await checkAndCreateReorderPOs();
    if (result.createdCount > 0) {
      console.log(`Auto reorder: created ${result.createdCount} draft PO(s) for ${result.itemCount} low-stock item(s)`);
    }
  } catch (error) {
    console.error('Auto reorder check failed:', error.message);
  }
};

runAutoReorderCheck();
const reorderIntervalHours = parseInt(process.env.REORDER_CHECK_INTERVAL_HOURS || '6', 10);
setInterval(runAutoReorderCheck, Math.max(reorderIntervalHours, 1) * 60 * 60 * 1000);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Logged Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
