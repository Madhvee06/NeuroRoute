const mongoose = require('mongoose');
require('dotenv').config();

// Connects to MongoDB using the URI in .env (MONGODB_URI).
// Call connectDB() once from server.js on startup.
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🗄️  Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

mongoose.connection.on('error', (err) => {
  console.error('Unexpected MongoDB error:', err.message);
});

module.exports = connectDB;
