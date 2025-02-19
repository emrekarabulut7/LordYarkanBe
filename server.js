import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import authRoutes from './routes/auth.js'
import listingsRoutes from './routes/listings.js'
import notificationsRoutes from './routes/notifications.js'
import { listingCleanupJob, startListingCleanupJob } from './jobs/listingCleanup.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Cache kontrolü middleware
app.use((req, res, next) => {
  // API endpoint'lerine göre cache süresini ayarla
  const cacheDuration = req.path.includes('/listings/') ? 300 : 0; // 5 dakika
  
  if (cacheDuration > 0) {
    res.set('Cache-Control', `public, max-age=${cacheDuration}, s-maxage=${cacheDuration}`);
  } else {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  
  next();
});

// CORS ayarları
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// OPTIONS istekleri için preflight handler
app.options('*', cors());

app.use(express.json())

// Routes
app.use('/api', authRoutes)
app.use('/api', listingsRoutes)
app.use('/api', notificationsRoutes)

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API çalışıyor' });
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route bulunamadı',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({
    success: false,
    message: 'Sunucu hatası',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  })
})

// Her saat başı kontrol et
setInterval(listingCleanupJob, 60 * 60 * 1000)

// İlk çalıştırma
startListingCleanupJob()

// Server'ı başlat
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log('Environment:', process.env.NODE_ENV)
  console.log('CORS origins:', ['http://localhost:3000', 'https://www.lordyarkan.com', 'https://lordyarkan.com'])
})

export default app 