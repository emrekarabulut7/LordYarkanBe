import express from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken, isAdmin } from '../middleware/auth.js'
import { cleanupExpiredListings } from '../jobs/listingCleanup.js'

const router = express.Router()

// Aktif ve satılan ilanları getir (Bu endpoint'i üste alıyoruz)
router.get('/active-and-sold', async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:users(username)
      `)
      .in('status', ['active', 'sold']) // Aktif ve satılan ilanları getir
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('Aktif ve satılan ilanlar:', listings); // Debug için log

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

// Öne çıkan ilanları getir (Bu endpoint'i en üste alıyoruz)
router.get('/featured', async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:users(username)
      `)
      .eq('status', 'active') // Sadece aktif ilanları getir
      .order('created_at', { ascending: false }) // En yeni ilanlar
      .limit(6); // En fazla 6 ilan

    if (error) throw error;

    console.log('Öne çıkan ilanlar:', listings); // Debug için log ekleyelim

    res.json({
      success: true,
      data: listings
    });

  } catch (error) {
    console.error('Öne çıkan ilanları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlanlar getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

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

    // İlanı 'pending' statüsüyle oluştur
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
          status: 'pending' // Varsayılan olarak beklemede
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
      message: 'İlan başarıyla oluşturuldu ve onay bekliyor',
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

// İlanları listele (admin için tüm ilanları getir)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = supabase
      .from('listings')
      .select(`
        *,
        user:users (
          username,
          email
        )
      `)
      .order('created_at', { ascending: false });

    // Eğer admin değilse sadece aktif ilanları göster
    if (req.user?.role !== 'admin') {
      query = query.eq('status', 'active');
    }

    const { data: listings, error } = await query;

    if (error) throw error;

    // Admin için istatistikleri ekle
    if (req.user?.role === 'admin') {
      const stats = {
        total: listings.length,
        pending: listings.filter(l => l.status === 'pending').length,
        active: listings.filter(l => l.status === 'active').length,
        rejected: listings.filter(l => l.status === 'rejected').length,
        sold: listings.filter(l => l.status === 'sold').length,
        cancelled: listings.filter(l => l.status === 'cancelled').length
      };

      res.json({
        success: true,
        data: listings,
        stats
      });
    } else {
      res.json({
        success: true,
        data: listings
      });
    }

  } catch (error) {
    console.error('İlanları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlanlar getirilirken bir hata oluştu',
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

// Silinen ilanları getir
router.get('/deleted', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Silinen ilanları getir
    const { data: deletedListings, error: listingsError } = await supabase
      .from('deleted_listings')
      .select()
      .order('deleted_at', { ascending: false });

    if (listingsError) throw listingsError;

    // Her ilan için kullanıcı bilgisini ayrıca getir
    const listingsWithUsers = await Promise.all(deletedListings.map(async (listing) => {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('id', listing.user_id)
        .single();

      if (userError) {
        console.error('Kullanıcı bilgisi getirme hatası:', userError);
        return {
          ...listing,
          username: 'Bilinmeyen Kullanıcı'
        };
      }

      return {
        ...listing,
        username: userData?.username || 'Bilinmeyen Kullanıcı'
      };
    }));

    res.json({
      success: true,
      data: listingsWithUsers
    });

  } catch (error) {
    console.error('Silinen ilanları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Silinen ilanlar getirilirken bir hata oluştu',
      error: error.message
    });
  }
});

// İlan silme endpoint'i
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Önce ilanı al
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Silinen ilanı deleted_listings tablosuna kaydet
    const { data: deletedListing, error: insertError } = await supabase
      .from('deleted_listings')
      .insert([{
        original_id: listing.id,
        user_id: listing.user_id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        server: listing.server,
        price: listing.price,
        currency: listing.currency,
        phone: listing.phone,
        discord: listing.discord,
        image_url: listing.image_url,
        status: listing.status,
        created_at: listing.created_at,
        updated_at: listing.updated_at,
        deleted_by: req.user.id
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Eğer resim varsa, deleted_images tablosuna kaydet
    if (listing.image_url) {
      const { error: imageError } = await supabase
        .from('deleted_images')
        .insert({
          listing_id: deletedListing.id,
          image_url: listing.image_url
        });

      if (imageError) throw imageError;
    }

    // Orijinal ilanı sil
    const { error: deleteError } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);

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

// Tekil ilan getirme endpoint'i
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // İlanı getir
    const { data: listing, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:users(username)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı veya süresi dolmuş'
      });
    }

    // İlanın süresini kontrol et
    const createdAt = new Date(listing.created_at);
    const now = new Date();
    const diffInHours = Math.abs(now - createdAt) / 36e5; // Saat cinsinden fark

    if (diffInHours >= 24) {
      // İlan süresi dolmuşsa silme işlemini başlat
      await cleanupExpiredListings();
      
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

// İlan onaylama endpoint'i
router.put('/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log('İlan onaylama başladı:', { id, status });

    // Önce ilanı ve kullanıcı bilgisini al
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*, user:users(*)')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('İlan getirme hatası:', fetchError);
      throw fetchError;
    }

    console.log('İlan bulundu:', listing);

    // İlanı güncelle
    const { error: updateError } = await supabase
      .from('listings')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('İlan güncelleme hatası:', updateError);
      throw updateError;
    }

    // Bildirim oluştur
    const notificationData = {
      user_id: listing.user.id,
      title: 'İlan Durumu Güncellendi',
      message: status === 'active' 
        ? 'İlanınız onaylandı ve yayına alındı!'
        : 'İlanınız reddedildi. Lütfen düzenleyip tekrar deneyin.',
      type: status === 'active' ? 'success' : 'warning',
      read: false,
      listing_id: id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Bildirim verisi:', notificationData);

    // Bildirim oluşturma işlemini ayrı bir try-catch bloğuna al
    try {
      const { data: notification, error: notifError } = await supabase
        .from('notifications')
        .insert([notificationData])
        .select('*')
        .single();

      if (notifError) {
        console.error('Bildirim oluşturma hatası:', notifError);
        throw notifError;
      }

      console.log('Bildirim başarıyla oluşturuldu:', notification);

      res.json({
        success: true,
        message: `İlan ${status === 'active' ? 'onaylandı' : 'reddedildi'}`,
        data: {
          ...listing,
          status,
          notification
        }
      });
    } catch (notifError) {
      // Bildirim oluşturma hatası olsa bile ana işlemi tamamla
      console.error('Bildirim oluşturulamadı:', notifError);
      res.json({
        success: true,
        message: `İlan ${status === 'active' ? 'onaylandı' : 'reddedildi'} (bildirim gönderilemedi)`,
        data: {
          ...listing,
          status
        }
      });
    }

  } catch (error) {
    console.error('İlan onaylama hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlan onaylanırken bir hata oluştu',
      error: error.message
    });
  }
});

// İlan durumu güncelleme endpoint'i
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // İlanın kullanıcıya ait olduğunu kontrol et
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

    // Durumu güncelle
    const { data: updatedListing, error: updateError } = await supabase
      .from('listings')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'İlan durumu güncellendi',
      data: updatedListing
    });

  } catch (error) {
    console.error('İlan durumu güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlan durumu güncellenirken bir hata oluştu',
      error: error.message
    });
  }
});

export default router 