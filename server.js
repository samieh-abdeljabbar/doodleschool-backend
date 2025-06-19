const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1); // <-- Fixes rate limit warning on Railway and other cloud hosts

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Your OpenAI API key (stored securely in environment variables)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Rate limiting (optional, but recommended)
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10 // limit each IP to 10 requests per windowMs
});
app.use('/api/generate-coloring-page', limiter);

// Generate coloring page endpoint
app.post('/api/generate-coloring-page', async (req, res) => {
    try {
        const { prompt, size = "1024x1024" } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Call OpenAI API
        const response = await axios.post('https://api.openai.com/v1/images/generations', {
            prompt: prompt,
            n: 1,
            size: size,
            response_format: "url"
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const imageUrl = response.data.data[0].url;

        // Download the image and return it directly
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer'
        });

        res.set('Content-Type', 'image/png');
        res.send(imageResponse.data);

    } catch (error) {
        console.error('Error generating image:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            res.status(401).json({ error: 'Authentication failed' });
        } else if (error.response?.status === 429) {
            res.status(429).json({ error: 'Rate limit exceeded' });
        } else {
            res.status(500).json({ error: 'Failed to generate image' });
        }
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
