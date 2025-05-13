// app.js - Main application file with MongoDB integration
require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

const app = express();
app.use(express.json());

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'appdb';
let db;
let client;

// Connect to MongoDB
async function connectToDatabase() {
  if (db) return db;
  
  try {
    client = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 50,
      wtimeoutMS: 2500
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    
    // Create indexes if they don't exist
    await db.collection('items').createIndex({ name: 1 }, { unique: true });
    await db.collection('items').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // Optional TTL
    
    console.log('Successfully connected to MongoDB');
    return db;
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  }
}

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
  try {
    req.db = await connectToDatabase();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

// CRUD Operations

// Create - POST /items
app.post('/items', async (req, res) => {
  try {
    const { name, description, quantity } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }
    
    const result = await req.db.collection('items').insertOne({
      name,
      description,
      quantity: quantity || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    res.status(201).json({
      _id: result.insertedId,
      name,
      description,
      quantity: quantity || 0
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Item with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create item', details: err.message });
  }
});

// Read - GET /items
app.get('/items', async (req, res) => {
  try {
    const items = await req.db.collection('items')
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items', details: err.message });
  }
});

// Read One - GET /items/:id
app.get('/items/:id', async (req, res) => {
  try {
    const item = await req.db.collection('items')
      .findOne({ _id: new ObjectId(req.params.id) });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(item);
  } catch (err) {
    if (err.message.includes('ObjectId')) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    res.status(500).json({ error: 'Failed to fetch item', details: err.message });
  }
});

// Update - PUT /items/:id
app.put('/items/:id', async (req, res) => {
  try {
    const { name, description, quantity } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }
    
    const result = await req.db.collection('items')
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { 
          $set: { 
            name,
            description,
            quantity: quantity || 0,
            updatedAt: new Date()
          } 
        }
      );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({
      _id: req.params.id,
      name,
      description,
      quantity: quantity || 0
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Item with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update item', details: err.message });
  }
});

// Delete - DELETE /items/:id
app.delete('/items/:id', async (req, res) => {
  try {
    const result = await req.db.collection('items')
      .deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.status(204).end();
  } catch (err) {
    if (err.message.includes('ObjectId')) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    res.status(500).json({ error: 'Failed to delete item', details: err.message });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test the database connection
    await req.db.command({ ping: 1 });
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date() 
    });
  } catch (err) {
    res.status(503).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing server and MongoDB connection...');
  if (client) {
    await client.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Closing server and MongoDB connection...');
  if (client) {
    await client.close();
  }
  process.exit(0);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectToDatabase().catch(err => {
    console.error('Failed to connect to MongoDB on startup:', err);
    process.exit(1);
  });
});

module.exports = app; // For testing