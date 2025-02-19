import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { supabase } from '../config/supabase.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login isteği:', { email });

    // Email ve şifre kontrolü
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email ve şifre gerekli'
      });
    }

    // Kullanıcıyı Supabase'den bul
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Şifre kontrolü
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz şifre'
      });
    }

    // JWT token oluştur
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Şifreyi response'dan çıkar
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Giriş başarılı',
      data: {
        token,
        user: userWithoutPassword
      }
    });

  } catch (error) {
    console.error('Login hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Giriş yapılırken bir hata oluştu'
    });
  }
});

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    // Telefon numarası validasyonu
    const phoneRegex = /^05[0-9]{9}$/;  // 05 ile başlayan ve toplam 11 haneli
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Telefon numarası 05 ile başlamalı ve 11 haneli olmalıdır'
      });
    }

    // Email validasyonu
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Geçerli bir email adresi giriniz'
      });
    }

    // Kullanıcı adı ve şifre kontrolü
    if (!username || username.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı adı en az 3 karakter olmalıdır'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Şifre en az 6 karakter olmalıdır'
      });
    }

    // Email, kullanıcı adı ve telefon kontrolü
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${email},username.eq.${username},phone.eq.${phone}`);

    if (existingUser?.length > 0) {
      // Hangi alanın kullanımda olduğunu kontrol et
      const existingEmail = existingUser.find(user => user.email === email);
      const existingUsername = existingUser.find(user => user.username === username);
      const existingPhone = existingUser.find(user => user.phone === phone);

      let message = '';
      if (existingEmail) message = 'Bu email adresi zaten kullanımda';
      else if (existingUsername) message = 'Bu kullanıcı adı zaten kullanımda';
      else if (existingPhone) message = 'Bu telefon numarası zaten kullanımda';

      return res.status(400).json({
        success: false,
        message
      });
    }

    // Şifreyi hash'le
    const hashedPassword = await bcrypt.hash(password, 10);

    // Kullanıcıyı kaydet
    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          username,
          email,
          phone,
          password: hashedPassword,
          role: 'user'
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Kayıt başarılı'
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

router.get('/users/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Kullanıcıları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcılar getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

router.put('/users/:id/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, phone, role, password } = req.body;

    // Güncelleme verilerini hazırla
    const updateData = {
      username,
      email,
      phone,
      role,
      updated_at: new Date().toISOString()
    };

    // Eğer yeni şifre varsa, hash'le ve ekle
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Şifreyi response'dan çıkar
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Kullanıcı başarıyla güncellendi',
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Kullanıcı güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı güncellenirken bir hata oluştu',
      error: error.message
    });
  }
});

// Token doğrulama endpoint'i
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Geçersiz token'
    });
  }
});

export default router 