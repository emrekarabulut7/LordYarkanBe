import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase.js'

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token gerekli'
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
    console.error('Auth middleware error:', error)
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
} 