import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Routes
import authRoutes from './routes/auth';
import productRoutes from './routes/product';
import favoritesRoutes from './routes/favorites';
import cartRoutes from './routes/cart';
import userRoutes from './routes/users';
import messageRoutes from './routes/messages';
import conversationRoutes from './routes/conversations';
import reportRoutes from './routes/reports';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/Notification';
import reviewRoutes from './routes/reviews';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// -------------------
// ✅ CORS Setup
// -------------------
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
    'https://unitrade-blue.vercel.app',
    'https://www.unitrade-blue.vercel.app',
    'https://unitrade-yrd9.onrender.com'
  ]
  : [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://unitrade-yrd9.onrender.com',
  ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman or server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

// ❌ Removed the problematic app.options('*', ...) block.
// The app.use(cors({...})) above is sufficient to handle preflight OPTIONS requests for all routes.

// -------------------
// Middleware
// -------------------
app.use(express.json());

// -------------------
// MongoDB Connection
// -------------------
if (!process.env.MONGODB_URI) {
  throw new Error('❌ MONGODB_URI is not defined');
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// -------------------
// API Routes
// -------------------
app.use('/api/auth', authRoutes);
app.use('/api/product', productRoutes);
app.use('/api/products', productRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// -------------------
// Serve React SPA (for production)
// -------------------
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/dist'); // adjust if your React build folder is elsewhere
  app.use(express.static(buildPath));

  // ✅ Catch-all route for React SPA
  app.get('/*', (_req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  // Root route for dev
  app.get('/', (_req, res) => {
    res.send('<h1>✅ UniTrade API is running successfully</h1>');
  });
}

// -------------------
// Start Server
// -------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
});
