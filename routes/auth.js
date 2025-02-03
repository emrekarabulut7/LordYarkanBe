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

    // JWT token oluştur - role bilgisini ekle
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role // role bilgisini token'a ekle
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    console.log('Token oluşturuldu')

    // Başarılı yanıt - role bilgisini ekle
    res.json({
      success: true,
      message: 'Giriş başarılı',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
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
    const { username, email, password } = req.body;

    // Email formatını kontrol et
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        success: false,
        message: 'Geçerli bir email adresi giriniz'
      });
    }

    // Kullanıcı zaten var mı kontrol et
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select()
      .or(`email.eq.${email},username.eq.${username}`)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu email veya kullanıcı adı zaten kullanılıyor'
      });
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    // Kullanıcıyı oluştur
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          username,
          email,
          password: hashedPassword
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Kayıt başarılı',
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });

  } catch (error) {
    console.error('Kayıt hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kayıt sırasında bir hata oluştu',
      error: error.message
    });
  }
});

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

// Admin middleware ekle
export const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu işlem için admin yetkisi gerekiyor'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Yetki kontrolü sırasında bir hata oluştu'
    });
  }
};

// Admin endpoint'leri
router.delete('/listings/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'İlan başarıyla silindi'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'İlan silinirken bir hata oluştu',
      error: error.message
    });
  }
});

router.put('/listings/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { error } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'İlan başarıyla güncellendi'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'İlan güncellenirken bir hata oluştu',
      error: error.message
    });
  }
});

export default router 