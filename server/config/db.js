const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn('[DB] MONGODB_URI not set — skipping database connection');
      return;
    }
    await mongoose.connect(uri);
    console.log('[DB] MongoDB connected successfully');
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
