import express from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken } from '../middleware/auth.js'

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
    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:users (
          username,
          email
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({
      success: true,
      data: listings
    })

  } catch (error) {
    console.error('İlanları getirme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'İlanlar getirilirken bir hata oluştu',
      error: error.message
    })
  }
})

// Tekil ilan getir - ÖNEMLİ: En sonda olmalı
router.get('/:id', async (req, res) => {
  try {
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
      .single()

    if (error) throw error
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı'
      })
    }

    res.json({
      success: true,
      data: listing
    })

  } catch (error) {
    console.error('İlan getirme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'İlan getirilirken bir hata oluştu',
      error: error.message
    })
  }
})

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

export default router 