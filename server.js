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

// CORS ayarları
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));

// OPTIONS istekleri için preflight handler
app.options('*', cors());

app.use(express.json())

// Routes
app.use('/api', authRoutes)
app.use('/api', listingsRoutes)
app.use('/api', notificationsRoutes)

// Base path için yönlendirme
app.get('/', (req, res) => {
  res.json({ message: 'API çalışıyor' });
});

// Redirect www to non-www
app.use((req, res, next) => {
  if (req.hostname.startsWith('www.')) {
    return res.redirect(301, `https://lordyarkan.com${req.originalUrl}`);
  }
  next();
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