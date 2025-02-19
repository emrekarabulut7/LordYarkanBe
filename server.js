import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// CORS ayarları
app.use(cors())

app.use(express.json())

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API çalışıyor' })
})

// Tüm aktif ve satılmış ilanları getir
app.get('/api/listings/active-and-sold', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        id,
        user_id,
        server,
        category,
        title,
        description,
        price,
        currency,
        phone,
        discord,
        status,
        created_at,
        updated_at,
        contact_type,
        listing_type,
        images,
        is_featured
      `)
      .in('status', ['active', 'sold'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Listings error:', error);
    res.status(500).json({
      success: false,
      message: 'İlanlar getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

// Öne çıkan ilanları getir
app.get('/api/listings/featured', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        id,
        user_id,
        server,
        category,
        title,
        description,
        price,
        currency,
        phone,
        discord,
        status,
        created_at,
        updated_at,
        contact_type,
        listing_type,
        images,
        is_featured
      `)
      .eq('status', 'active')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Featured listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Öne çıkan ilanlar getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

// Kullanıcının ilanlarını getir
app.get('/api/listings/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('listings')
      .select(`
        id,
        user_id,
        server,
        category,
        title,
        description,
        price,
        currency,
        phone,
        discord,
        status,
        created_at,
        updated_at,
        contact_type,
        listing_type,
        images,
        is_featured
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('User listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı ilanları getirilirken bir hata oluştu',
      error: error.message
    });
  }
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