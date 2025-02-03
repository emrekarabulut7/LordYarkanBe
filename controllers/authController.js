const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// @desc    Kullanıcı kaydı
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { email, password, username, phone } = req.body;

    // Email kontrolü
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu email adresi zaten kullanımda'
      });
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    // Kullanıcıyı kaydet
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          username,
          phone
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // JWT token oluştur
    const token = jwt.sign(
      { id: newUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          phone: newUser.phone
        },
        token
      }
    });

  } catch (error) {
    console.error('Kayıt hatası:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Kullanıcı girişi
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kullanıcıyı bul
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(400).json({
        success: false,
        message: 'Email veya şifre hatalı'
      });
    }

    // Şifreyi kontrol et
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Email veya şifre hatalı'
      });
    }

    // JWT token oluştur
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          phone: user.phone
        },
        token
      }
    });

  } catch (error) {
    console.error('Giriş hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Giriş yapılırken bir hata oluştu'
    });
  }
};

// @desc    Kullanıcı çıkışı
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Başarıyla çıkış yapıldı'
    });
  } catch (error) {
    console.error('Çıkış hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Çıkış yapılırken bir hata oluştu'
    });
  }
};

// @desc    Kullanıcı bilgilerini getir
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username, phone, created_at, password')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı bilgileri alınamadı'
      });
    }

    // Şifreyi maskeleme
    user.password = '••••••••';

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Profil bilgileri hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
};

// @desc    Kullanıcı bilgilerini güncelle
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, newPassword } = req.body;

    console.log('Şifre güncelleme isteği:', { userId }); // Debug log

    // Önce kullanıcıyı bul
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Kullanıcı bulma hatası:', userError);
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Mevcut şifreyi kontrol et
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mevcut şifre hatalı'
      });
    }

    // Yeni şifreyi hashle
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    console.log('Şifre güncelleniyor...'); // Debug log

    // Şifreyi güncelle
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Şifre güncelleme hatası:', updateError);
      return res.status(400).json({
        success: false,
        message: 'Şifre güncellenirken bir hata oluştu',
        error: updateError.message
      });
    }

    console.log('Şifre başarıyla güncellendi'); // Debug log

    res.json({
      success: true,
      message: 'Şifre başarıyla güncellendi'
    });

  } catch (error) {
    console.error('Şifre güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Sunucu hatası',
      error: error.stack // Hata stack'ini de gönder (development'ta)
    });
  }
}; 