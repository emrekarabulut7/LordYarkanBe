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

// Listings route
app.get('/api/listings/active-and-sold', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        title: 'Test İlan 1',
        description: 'Test açıklama 1',
        price: 100,
        currency: 'TL',
        status: 'active'
      },
      {
        id: 2,
        title: 'Test İlan 2',
        description: 'Test açıklama 2',
        price: 200,
        currency: 'TL',
        status: 'sold'
      }
    ]
  })
})

// Featured listings route
app.get('/api/listings/featured', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        title: 'Öne Çıkan İlan 1',
        description: 'Test açıklama 1',
        price: 100,
        currency: 'TL',
        status: 'active',
        featured: true
      },
      {
        id: 2,
        title: 'Öne Çıkan İlan 2',
        description: 'Test açıklama 2',
        price: 200,
        currency: 'TL',
        status: 'active',
        featured: true
      }
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route bulunamadı',
    path: req.originalUrl
  })
})

export default app 