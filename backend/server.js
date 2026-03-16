const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { query } = require('./db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const chatRoutes = require('./routes/chat');
const uploadRoutes = require('./routes/upload');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (mobile apps, curl, Render health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
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
app.use('/', orderRoutes);

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

