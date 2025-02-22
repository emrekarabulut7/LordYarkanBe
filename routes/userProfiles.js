import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// Kullanıcı profil bilgilerini getir (public endpoint)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Kullanıcı temel bilgilerini getir
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        avatar_url,
        role,
        created_at,
        last_sign_in
      `)
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Kullanıcının ilan istatistiklerini getir
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('status')
      .eq('user_id', userId)
      .in('status', ['active', 'sold']);

    if (listingsError) throw listingsError;

    const stats = {
      active: listings.filter(item => item.status === 'active').length,
      sold: listings.filter(item => item.status === 'sold').length,
      total: listings.length
    };

    res.json({
      success: true,
      data: {
        ...user,
        stats
      }
    });

  } catch (error) {
    console.error('Kullanıcı profili getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı profili alınırken bir hata oluştu'
    });
  }
});

export default router; 