import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase.js'

export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token bulunamadı'
      })
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Geçersiz token'
        })
      }
      req.user = user
      next()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Token doğrulama hatası'
    })
  }
}

// Admin middleware'i buraya taşıyalım
export const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bu işlem için admin yetkisi gerekiyor'
    })
  }
  next()
} 