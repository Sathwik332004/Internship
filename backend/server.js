const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const supplierRoutes = require('./routes/suppliers');
const purchaseRoutes = require('./routes/purchases');
const billRoutes = require('./routes/bills');
const assetRoutes = require('./routes/assets');
const hsnRoutes = require('./routes/hsn');
const inventoryRoutes = require('./routes/inventory');

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/hsn', hsnRoutes);
app.use('/api/inventory', inventoryRoutes);

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

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Logged Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
