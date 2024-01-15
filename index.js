const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const axios = require('axios');
const conf = require('./config.json');
// a
const app = express();
const port = 3003;

const mongoURI = conf.MONGO;

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

// Create MongoDB models
const IdModel = mongoose.model('Id', {
    id: String,
    created: String,
    updated: String,
});

const CounterModel = mongoose.model('Counter', {
    keyname: String,
    count: { type: Number, default: 0 },
    created: String,
    updated: String,
});

// Thingys
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// Rate limiting middleware
const limiter = rateLimit({
    windowMs:  10 * 1000,
    max: 10000,
});
app.use(limiter);

// Generate a random 24-character ID with "RUBY_" at the start
app.get('/id', async (req, res) => {
    const randomId = 'RUBY_' + generateRandomId(24);
    const timestamp = new Date().toISOString();

    // Save to MongoDB
    const idDocument = new IdModel({ id: randomId, created: timestamp, updated: timestamp });
    await idDocument.save();

    res.json({ id: randomId });
});

// If key doesn't exist, create it. If it exists, then make its number go up by one
app.get('/counter/set', async (req, res) => {
    const { keyname } = req.query;

    // Find or create counter in MongoDB
    const counter = await CounterModel.findOneAndUpdate(
        { keyname },
        { $inc: { count: 1 }, $setOnInsert: { created: new Date().toISOString() } },
        { upsert: true, new: true }
    );

    res.json({ keyname, count: counter.count });
});

// Gets the value of a key without making its number go up by one
app.get('/counter/get', async (req, res) => {
    const { keyname } = req.query;

    // Find counter in MongoDB
    const counter = await CounterModel.findOne({ keyname });

    if (counter) {
        res.json({ keyname, count: counter.count });
    } else {
        res.json({ keyname, count: 0 });
    }
});

// New route to handle the specified curl command using axios
app.post('/generateContent', async (req, res) => {
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + conf.GEMINI_KEY;

    if (req.body.text === null || req.body.text === undefined || req.body.text === "") return res.send("No text")

    try {
        const response = await axios.post(apiUrl, {
            contents: [
                {
                    parts: [
                        {
                            text: req.body.text || 'DEFAULT TEXT PARAMETER',
                        },
                    ],
                },
            ],
        });

        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Helper function to generate a random ID
function generateRandomId(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomId = '';

    for (let i = 0; i < length; i++) {
        if (i > 0 && i % 4 === 0) {
            // Insert hyphen every 4 characters (adjust as needed)
            randomId += '-';
        }
        randomId += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return randomId;
}

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
