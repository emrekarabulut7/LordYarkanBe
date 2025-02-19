import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import listingsRoutes from './routes/listings.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'API is working' });
});

export default app; 