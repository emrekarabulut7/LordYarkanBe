import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

// CORS ayarları
app.use(cors())

app.use(express.json())

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API çalışıyor' })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route bulunamadı',
    path: req.originalUrl
  })
})

export default app 