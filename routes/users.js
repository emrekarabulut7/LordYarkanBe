import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// Kullanıcı bilgilerini getir (public endpoint)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, role, created_at')
      .eq('id', userId)
      .single();

    if (error) throw error;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Kullanıcı bilgileri getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı bilgileri alınırken bir hata oluştu'
    });
  }
});

export default router; 