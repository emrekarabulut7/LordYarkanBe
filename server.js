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
const port = process.env.PORT || 5000

// CORS ayarları
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://lordyarkan.com',
    'https://www.lordyarkan.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Tüm rotalar için OPTIONS isteklerini handle et
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// Cache kontrolü middleware'i
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': corsOptions.origin,
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  next();
});

// Routes
app.use('/listings', listingsRoutes)
app.use('/auth', authRoutes)
app.use('/notifications', notificationsRoutes)

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API çalışıyor' })
})

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
setInterval(listingCleanupJob, 60 * 60 * 1000);

// İlk çalıştırma
startListingCleanupJob();

// Vercel için handler
export default app

// Local development için
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server ${port} portunda çalışıyor`)
  })
} 