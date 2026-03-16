const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { query } = require('./db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const chatRoutes = require('./routes/chat');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Artisan Marketplace API is running' });
});

app.get('/db-health', async (req, res) => {
  try {
    const result = await query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: result.rows[0] });
  } catch (err) {
    console.error('DB health check failed:', err.message);
    res.status(500).json({ status: 'error', message: 'Database not reachable' });
  }
});

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/chat', chatRoutes);
app.use('/upload', uploadRoutes);

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a different number.`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

