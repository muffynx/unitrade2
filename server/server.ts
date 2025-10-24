// server/server.ts
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

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

// ✅ Convert PORT to number (important for TypeScript)
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [
            'https://unitrade-blue.vercel.app',
            'https://www.unitrade-blue.vercel.app',
          ]
        : ['http://localhost:5173', 'http://localhost:3000','https://unitrade-yrd9.onrender.com','https://www.unitrade-blue.vercel.app'],
    credentials: true,
  })
);

app.use(express.json());

// MongoDB Connection
if (!process.env.MONGODB_URI) {
  throw new Error('❌ MONGODB_URI is not defined in environment variables');
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
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

// Root Route
app.get('/', (_req, res) => {
  res.send('<h1>✅ UniTrade API is running successfully on Render</h1>');
});

// ✅ Proper listen for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
