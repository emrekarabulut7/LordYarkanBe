import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { supabase } from '../config/supabase.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    console.log('Login isteği:', { email }) // Şifreyi loglamıyoruz

    // Email ve şifre kontrolü
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email ve şifre gerekli'
      })
    }

    // Kullanıcıyı Supabase'den bul
    console.log('Supabase sorgusu başlıyor...')
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    console.log('Supabase yanıtı:', { user, error })

    if (error || !user) {
      console.log('Kullanıcı bulunamadı hatası:', error)
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      })
    }

    // Şifre kontrolü
    const validPassword = await bcrypt.compare(password, user.password)
    console.log('Şifre kontrolü:', { validPassword })

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz şifre'
      })
    }

    // JWT token oluştur
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        username: user.username 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    console.log('Token oluşturuldu')

    // Başarılı yanıt
    res.json({
      success: true,
      message: 'Giriş başarılı',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      }
    })

  } catch (error) {
    console.error('Login hatası detayı:', error)
    console.error('Stack trace:', error.stack)
    res.status(500).json({
      success: false,
      message: 'Giriş yapılırken bir hata oluştu',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, phone } = req.body

    // Gerekli alanları kontrol et
    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: 'Tüm alanları doldurun'
      })
    }

    // Email kullanımda mı kontrol et
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu email adresi zaten kullanımda'
      })
    }

    // Şifreyi hashle
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Kullanıcıyı oluştur
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          username,
          phone: phone || null
        }
      ])
      .select()
      .single()

    if (error) {
      throw error
    }

    // JWT token oluştur ve otomatik login yap
    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    // Başarılı yanıt
    res.status(201).json({
      success: true,
      message: 'Kayıt başarılı',
      data: {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username
        }
      }
    })

  } catch (error) {
    console.error('Kayıt hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Kayıt olurken bir hata oluştu',
      error: error.message
    })
  }
})

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Token geçerli ise başarılı yanıt dön
    res.json({
      success: true,
      message: 'Başarıyla çıkış yapıldı'
    });
  } catch (error) {
    console.error('Çıkış hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Çıkış yapılırken bir hata oluştu',
      error: error.message
    });
  }
})

// Token kontrolü için endpoint
router.get('/verify-token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username
      }
    }
  })
})

// Kullanıcı profili endpoint'i
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Token'dan gelen kullanıcı ID'si ile kullanıcıyı bul
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username, phone, created_at')
      .eq('id', req.user.id)
      .single()

    if (error) {
      throw error
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      })
    }

    // Kullanıcının ilanlarını getir
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, title, status, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (listingsError) {
      throw listingsError
    }

    res.json({
      success: true,
      data: {
        ...user,
        listings: listings || []
      }
    })

  } catch (error) {
    console.error('Profil getirme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Profil bilgileri getirilirken bir hata oluştu',
      error: error.message
    })
  }
})

export default router 