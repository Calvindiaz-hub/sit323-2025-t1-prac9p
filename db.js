const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

let db;

async function connectToDatabase() {
  if (db) return db;
  
  try {
    await client.connect();
    db = client.db(process.env.MONGODB_DB || 'appdb');
    console.log('Successfully connected to MongoDB');
    return db;
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  }
}

module.exports = { connectToDatabase };