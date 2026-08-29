require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const docsRoutes = require('./routes/docs');
const authRoutes = require('./routes/auth');

const app = express();

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost',
  'https://code-doc-generator-vert.vercel.app'
];

// ✅ CORS MIDDLEWARE FIRST!
app.use(cors({
  origin: function(origin, callback) {
    console.log('Request origin:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true
}));

// ✅ Body Parser SECOND
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ Routes THIRD
app.use('/api/auth', authRoutes);
app.use('/api', docsRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.log('✗ MongoDB connection failed:', err.message));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    message: 'Server is running',
    timestamp: new Date(),
    status: 'ok'
  });
});

// Basic route for testing
app.get('/', (req, res) => {
  res.json({
    message: 'AI Code Documentation Generator API',
    endpoints: {
      health: '/api/health',
      generateDocs: 'POST /api/generate-docs',
      generateComments: 'POST /api/generate-comments',
      generateReadme: 'POST /api/generate-readme',
      getDocs: 'GET /api/docs',
      getDocById: 'GET /api/docs/:id'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Test: http://localhost:${PORT}/api/health\n`);
});