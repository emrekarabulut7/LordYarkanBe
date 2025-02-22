import express from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Kullanıcının bildirimlerini getir
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('Bildirimler alınırken hata:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirimler alınırken bir hata oluştu'
    });
  }
});

// Tüm bildirimleri okundu olarak işaretle
router.post('/mark-all-read', authenticateToken, async (req, res) => {
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
    console.error('Bildirim güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirimler güncellenirken bir hata oluştu'
    });
  }
});

// Bildirimi okundu olarak işaretle
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Bildirim güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirim güncellenirken bir hata oluştu'
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