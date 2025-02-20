const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const notificationsRoutes = require('./routes/notifications.js');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/notifications', notificationsRoutes);

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'API is working' });
});

module.exports = app; 