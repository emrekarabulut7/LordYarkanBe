import express from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Bildirimleri getir
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('Bildirim getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirimler getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

// Bildirimi okundu olarak işaretle
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Bildirim okundu olarak işaretlendi'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Bildirim güncellenirken bir hata oluştu'
    });
  }
});

// Tüm bildirimleri okundu olarak işaretle
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Tüm bildirimler okundu olarak işaretlendi'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Bildirimler güncellenirken bir hata oluştu'
    });
  }
});

// Bildirimleri sil
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Bildirim silindi'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Bildirim silinirken bir hata oluştu'
    });
  }
});

export default router 