import express from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken, isAdmin } from '../middleware/auth.js'

const router = express.Router()

// İlan oluşturma endpoint'i
router.post('/create', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı girişi gerekli'
      })
    }

    const { server, category, title, description, price, currency, phone, discord, image } = req.body

    // Zorunlu alanları kontrol et
    if (!server || !category || !title || !description || !price || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Lütfen tüm zorunlu alanları doldurun'
      })
    }

    let image_url = null
    
    // Eğer base64 resim varsa
    if (image) {
      try {
        console.log('Resim yükleme başlıyor...')
        
        // Base64'ü buffer'a çevir
        const base64Data = image.split(',')[1]
        console.log('Base64 data uzunluğu:', base64Data?.length)
        
        const buffer = Buffer.from(base64Data, 'base64')
        console.log('Buffer oluşturuldu, boyut:', buffer.length)
        
        // Rastgele dosya adı oluştur
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        console.log('Dosya adı:', fileName)
        
        // Resmi Supabase storage'a yükle
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('listing-images')
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            cacheControl: '3600'
          })

        console.log('Upload yanıtı:', { uploadData, uploadError })

        if (uploadError) {
          console.error('Upload hatası:', uploadError)
          throw uploadError
        }

        // Public URL'i al
        const { data: urlData } = supabase
          .storage
          .from('listing-images')
          .getPublicUrl(fileName)

        console.log('Public URL:', urlData)
        image_url = urlData.publicUrl

        console.log('Resim yükleme başarılı:', image_url)
      } catch (error) {
        console.error('Resim yükleme detaylı hata:', error)
      }
    } else {
      console.log('Resim verisi bulunamadı')
    }

    // İlanı oluştur
    const { data: listing, error } = await supabase
      .from('listings')
      .insert([
        {
          user_id: req.user.id,
          server,
          category,
          title,
          description,
          price: parseFloat(price),
          currency: currency || 'TRY',
          phone,
          discord: discord || null,
          image_url,
          status: 'active'
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('İlan oluşturma DB hatası:', error)
      throw error
    }

    res.status(201).json({
      success: true,
      message: 'İlan başarıyla oluşturuldu',
      data: listing
    })

  } catch (error) {
    console.error('İlan oluşturma hatası:', error)
    res.status(500).json({
      success: false,
      message: 'İlan oluşturulurken bir hata oluştu',
      error: error.message
    })
  }
})

// Kullanıcının kendi ilanlarını getirme route'u
router.get('/my-listings', authenticateToken, async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:users(username)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: listings
    });

  } catch (error) {
    console.error('İlanları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlanlar getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

// İlanları listele
router.get('/', async (req, res) => {
  try {
    // 24 saat öncesinin tarihini hesapla
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:users (
          username,
          email
        )
      `)
      .gt('created_at', twentyFourHoursAgo) // Son 24 saatteki ilanları getir
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: listings
    });

  } catch (error) {
    console.error('İlanları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlanlar getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

// Tekil ilan getir
router.get('/:id', async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: listing, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:users (
          username,
          email,
          phone
        )
      `)
      .eq('id', req.params.id)
      .gt('created_at', twentyFourHoursAgo) // Son 24 saatteki ilanı getir
      .single();

    if (error || !listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı veya süresi dolmuş'
      });
    }

    res.json({
      success: true,
      data: listing
    });

  } catch (error) {
    console.error('İlan getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlan getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

// İlan silme route'u
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Önce ilanın var olduğunu ve kullanıcıya ait olduğunu kontrol et
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı veya bu işlem için yetkiniz yok'
      });
    }

    // Eğer resim varsa, önce storage'dan sil
    if (listing.image_url) {
      const fileName = listing.image_url.split('/').pop();
      await supabase.storage.from('listing-images').remove([fileName]);
    }

    // İlanı sil
    const { error: deleteError } = await supabase
      .from('listings')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: 'İlan başarıyla silindi'
    });

  } catch (error) {
    console.error('İlan silme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlan silinirken bir hata oluştu',
      error: error.message
    });
  }
});

// İlan düzenleme route'u
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, server, category, phone, discord } = req.body;

    // İlanın var olduğunu ve kullanıcıya ait olduğunu kontrol et
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı veya bu işlem için yetkiniz yok'
      });
    }

    // İlanı güncelle
    const { data: updatedListing, error: updateError } = await supabase
      .from('listings')
      .update({
        title,
        description,
        price: parseFloat(price),
        server,
        category,
        phone,
        discord: discord || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'İlan başarıyla güncellendi',
      data: updatedListing
    });

  } catch (error) {
    console.error('İlan güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlan güncellenirken bir hata oluştu',
      error: error.message
    });
  }
});

// Admin endpoint'leri
router.delete('/:id/admin', authenticateToken, isAdmin, async (req, res) => {
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
    console.error('İlan silme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlan silinirken bir hata oluştu',
      error: error.message
    });
  }
});

router.put('/:id/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // İlanı güncelle
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        title: updateData.title,
        description: updateData.description,
        price: parseFloat(updateData.price),
        server: updateData.server,
        category: updateData.category,
        status: updateData.status,
        phone: updateData.phone,
        discord: updateData.discord || null,
        currency: updateData.currency,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Güncellenmiş ilanı getir
    const { data: updatedListing, error: fetchError } = await supabase
      .from('listings')
      .select(`
        *,
        user:users (
          username,
          email
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    res.json({
      success: true,
      message: 'İlan başarıyla güncellendi',
      data: updatedListing
    });

  } catch (error) {
    console.error('İlan güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlan güncellenirken bir hata oluştu',
      error: error.message
    });
  }
});

// Kullanıcının ilanlarını getir
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Kullanıcının kendi ilanlarını veya admin ise tüm ilanları görebilir
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu ilanları görüntüleme yetkiniz yok'
      });
    }

    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:users(username)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Debug için log ekleyelim
    console.log('Kullanıcı ID:', userId);
    console.log('İstekte bulunan kullanıcı:', req.user);
    console.log('Bulunan ilanlar:', listings);

    res.json({
      success: true,
      data: listings
    });

  } catch (error) {
    console.error('İlanları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlanlar getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

export default router 