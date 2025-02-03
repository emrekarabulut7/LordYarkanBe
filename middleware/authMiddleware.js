const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

exports.protect = async (req, res, next) => {
  try {
    let token;

    // Token'ı header'dan al
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Bu işlem için giriş yapmanız gerekiyor'
      });
    }

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kullanıcıyı bul
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz token'
      });
    }

    // Kullanıcıyı request'e ekle
    req.user = user;
    next();

  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Yetkilendirme hatası',
      error: error.message
    });
  }
}; 