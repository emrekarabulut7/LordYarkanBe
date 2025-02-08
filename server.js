import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import authRoutes from './routes/auth.js'
import listingsRoutes from './routes/listings.js'
import notificationsRoutes from './routes/notifications.js'
import { cleanupExpiredListings } from './jobs/listingCleanup.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config()

const app = express()
const port = process.env.PORT || 5000

const corsOptions = {
  origin: [
    'https://www.lordyarkan.com',
    'https://lordyarkan.com',
    'http://localhost:3000'  // development için
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  maxAge: 86400 // CORS preflight cache süresi - 24 saat
};

// CORS ayarları
app.use(cors(corsOptions))

// OPTIONS istekleri için özel handler
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/listings', listingsRoutes)
app.use('/api/notifications', notificationsRoutes)

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
setInterval(cleanupExpiredListings, 60 * 60 * 1000);

// İlk çalıştırma
cleanupExpiredListings();

// Vercel için handler
export default app

// Local development için
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server ${port} portunda çalışıyor`)
  })
} 