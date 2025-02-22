import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import listingsRouter from './routes/listings.js';
import userProfileRouter from './routes/userProfiles.js';
import authRouter from './routes/auth.js';
import notificationsRouter from './routes/notifications.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Routes
app.use('/api/listings', listingsRouter);
app.use('/api/user-profiles', userProfileRouter);
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Sunucu hatası oluştu'
  });
});

const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app; 