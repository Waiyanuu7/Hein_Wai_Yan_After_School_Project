const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection String - REPLACE WITH YOUR MONGODB ATLAS CONNECTION STRING
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://studentuser:Hsuismyqueen2@cluster0.hrswdej.mongodb.net/';
const DB_NAME = 'afterschool';

let db;

// Connect to MongoDB
MongoClient.connect(MONGODB_URI)
    .then(client => {
        console.log('Connected');
        db = client.db(DB_NAME);
    })
    .catch(error => {
        console.error('error:', error);
        process.exit(1);
    });

// Middleware - Logger (logs all requests)
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
});

// CORS Middleware (allows requests from GitHub Pages)
app.use(cors());

// Body Parser Middleware
app.use(express.json());

// Static File Middleware (serves lesson images)
app.use('/images', (req, res, next) => {
    const imagePath = path.join(__dirname, 'public', 'images', req.url);
    
    fs.access(imagePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log(`Image not found: ${imagePath}`);
            res.status(404).json({ error: 'Image not found' });
        } else {
            express.static(path.join(__dirname, 'public', 'images'))(req, res, next);
        }
    });
});

// ==================== REST API ROUTES ====================

// GET route - Retrieve all lessons
app.get('/lessons', async (req, res) => {
    try {
        const lessons = await db.collection('lessons').find({}).toArray();
        res.json(lessons);
    } catch (error) {
        console.error('Error fetching lessons:', error);
        res.status(500).json({ error: 'Failed to fetch lessons' });
    }
});

// GET route - Search lessons (Challenge Component)
app.get('/search', async (req, res) => {
    try {
        const searchTerm = req.query.q || '';
        
        if (!searchTerm) {
            const lessons = await db.collection('lessons').find({}).toArray();
            return res.json(lessons);
        }

        // Search across multiple fields using regex (case-insensitive)
        const searchRegex = new RegExp(searchTerm, 'i');
        
        const lessons = await db.collection('lessons').find({
            $or: [
                { subject: searchRegex },
                { location: searchRegex },
                { price: isNaN(searchTerm) ? null : parseInt(searchTerm) }
            ]
        }).toArray();
        
        res.json(lessons);
    } catch (error) {
        console.error('Error searching lessons:', error);
        res.status(500).json({ error: 'Failed to search lessons' });
    }
});

// POST route - Create a new order
app.post('/orders', async (req, res) => {
    try {
        const order = {
            name: req.body.name,
            phone: req.body.phone,
            lessonIDs: req.body.lessonIDs,
            numberOfSpaces: req.body.numberOfSpaces,
            orderDate: new Date()
        };

        const result = await db.collection('orders').insertOne(order);
        
        res.status(201).json({
            message: 'Order created successfully',
            orderId: result.insertedId,
            order: order
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// PUT route - Update lesson spaces
app.put('/lessons/:id', async (req, res) => {
    try {
        const lessonId = req.params.id;
        const { space } = req.body;

        if (space === undefined) {
            return res.status(400).json({ error: 'Space value is required' });
        }

        const result = await db.collection('lessons').updateOne(
            { _id: new ObjectId(lessonId) },
            { $set: { space: space } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Lesson not found' });
        }

        res.json({
            message: 'Lesson updated successfully',
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error updating lesson:', error);
        res.status(500).json({ error: 'Failed to update lesson' });
    }
});

// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'After School Classes API',
        endpoints: {
            'GET /lessons': 'Get all lessons',
            'GET /search?q=term': 'Search lessons',
            'POST /orders': 'Create a new order',
            'PUT /lessons/:id': 'Update lesson spaces'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
