import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase.js'

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    console.log('Auth header:', authHeader) // Debug için

    const token = authHeader && authHeader.split(' ')[1]
    console.log('Token:', token) // Debug için

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token bulunamadı'
      })
    }

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('Decoded token:', decoded) // Debug için

    // Kullanıcı bilgilerini getir
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single()

    console.log('User data:', user) // Debug için
    console.log('User error:', error) // Debug için

    if (error || !user) {
      return res.status(403).json({
        success: false,
        message: 'Geçersiz token'
      })
    }

    // Kullanıcı bilgilerini request'e ekle
    req.user = user
    next()

  } catch (error) {
    console.error('Auth hatası:', error)
    return res.status(403).json({
      success: false,
      message: 'Geçersiz token'
    })
  }
}

// Admin middleware'i buraya taşıyalım
export const isAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bu işlem için admin yetkisi gerekiyor'
    })
  }
  next()
} 