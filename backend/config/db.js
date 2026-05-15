const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = process.env.MONGODB_DB_NAME
      ? { dbName: process.env.MONGODB_DB_NAME }
      : {};

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
