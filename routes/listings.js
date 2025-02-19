import express from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken, isAdmin } from '../middleware/auth.js'
import { listingCleanupJob } from '../jobs/listingCleanup.js'

const router = express.Router()

// Aktif ve satılan ilanları getir (Bu endpoint'i üste alıyoruz)
router.get('/active-and-sold', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:user_id (
          id,
          username
        )
      `)
      .in('status', ['active', 'sold']) // Sadece active ve sold durumundaki ilanları getir
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('İlanları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlanlar getirilirken bir hata oluştu'
    });
  }
});

// Öne çıkan ilanları getir
router.get('/featured', async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:user_id (
          id,
          username
        )
      `)
      .eq('status', 'active') // Sadece aktif ilanları getir
      .order('created_at', { ascending: false }) // En yeni ilanlar
      .limit(6); // En fazla 6 ilan

    if (error) {
      console.error('Supabase hatası:', error);
      throw error;
    }

    // Her ilanın resimlerini normalize et ve kullanıcı bilgilerini ekle
    const normalizedListings = listings.map(listing => {
      // Eğer images array'i varsa onu kullan, yoksa image_url'i array içinde döndür
      const normalizedImages = listing.images || [listing.image_url];
      
      return {
        ...listing,
        images: normalizedImages.filter(Boolean) // null veya undefined değerleri filtrele
      };
    });

    res.json({
      success: true,
      data: normalizedListings
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
    const { 
      server, 
      category, 
      listingType, 
      title, 
      description, 
      price, 
      currency, 
      phone, 
      discord, 
      images, 
      contactType 
    } = req.body;

    // Supabase storage'a resimleri yükle
    const imageUrls = [];
    for (const imageBase64 of images) {
      const { data, error } = await supabase.storage
        .from('listing-images')
        .upload(
          `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`,
          Buffer.from(imageBase64.split(',')[1], 'base64'),
          {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false
          }
        );

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('listing-images')
        .getPublicUrl(data.path);

      imageUrls.push(publicUrl);
    }

    // Veritabanına kaydet - status'u 'pending' olarak ayarla
    const { data, error } = await supabase
      .from('listings')
      .insert([
        {
          user_id: req.user.id,
          server,
          category,
          listing_type: listingType,
          title,
          description,
          price,
          currency,
          phone,
          discord,
          images: imageUrls,
          contact_type: contactType,
          status: 'pending' // İlan durumunu 'pending' olarak ayarla
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Admin'e bildirim gönder
    const { error: notifError } = await supabase
      .from('notifications')
      .insert([{
        user_id: null, // Admin bildirimi olduğunu belirtmek için null
        title: 'Yeni İlan Onay Bekliyor',
        message: `"${title}" başlıklı yeni bir ilan onay bekliyor.`,
        type: 'admin',
        read: false,
        listing_id: data.id,
        created_at: new Date().toISOString()
      }]);

    if (notifError) {
      console.error('Admin bildirimi oluşturma hatası:', notifError);
    }

    // Kullanıcıya bildirim gönder
    const { error: userNotifError } = await supabase
      .from('notifications')
      .insert([{
        user_id: req.user.id,
        title: 'İlanınız İnceleniyor',
        message: 'İlanınız admin onayına gönderildi. Onaylandıktan sonra yayınlanacaktır.',
        type: 'info',
        read: false,
        listing_id: data.id,
        created_at: new Date().toISOString()
      }]);

    if (userNotifError) {
      console.error('Kullanıcı bildirimi oluşturma hatası:', userNotifError);
    }

    res.json({
      success: true,
      message: 'İlan başarıyla oluşturuldu ve admin onayına gönderildi',
      data
    });

  } catch (error) {
    console.error('İlan oluşturma hatası:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'İlan oluşturulurken bir hata oluştu'
    });
  }
});

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
router.get('/', async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('listings')
      .select('*')
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
      message: 'İlanlar getirilirken bir hata oluştu'
    });
  }
});

// Kullanıcının ilanlarını getir
router.get('/user/:id', authenticateToken, async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('listings')
      .select('*')  // images kolonu zaten listings tablosunda var
      .eq('user_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: listings
    });

  } catch (error) {
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
    // Join işlemini manuel yapalım
    const { data: listings, error } = await supabase
      .from('deleted_listings')
      .select('*')
      .order('deleted_at', { ascending: false });

    if (error) throw error;

    // Kullanıcı bilgilerini ayrıca getirelim
    const listingsWithUsers = await Promise.all(listings.map(async (listing) => {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('id', listing.user_id)
        .single();

      return {
        ...listing,
        images: listing.images || [listing.image_url],
        username: userError ? 'Bilinmeyen Kullanıcı' : userData?.username
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
      message: 'Silinen ilanlar getirilirken bir hata oluştu'
    });
  }
});

// İlan silme endpoint'i
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Silme isteği:', { id, user: req.user });

    // Önce ilanı getir
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('İlan getirme hatası:', fetchError);
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı'
      });
    }

    // İlanı silmek isteyen kişinin ilan sahibi veya admin olduğunu kontrol et
    if (listing.user_id !== req.user.id && req.user.role !== 'admin') {
      console.log('Yetki hatası:', { 
        listingUserId: listing.user_id, 
        requestUserId: req.user.id, 
        userRole: req.user.role 
      });
      return res.status(403).json({
        success: false,
        message: 'Bu işlem için yetkiniz yok'
      });
    }

    // Silinmiş ilanlar tablosuna kaydet
    const { error: archiveError } = await supabase
      .from('deleted_listings')
      .insert([{
        id: listing.id,
        user_id: listing.user_id,
        server: listing.server,
        category: listing.category,
        listing_type: listing.listing_type,
        title: listing.title,
        description: listing.description,
        price: listing.price,
        currency: listing.currency,
        phone: listing.phone,
        discord: listing.discord,
        images: listing.images,
        contact_type: listing.contact_type,
        status: listing.status,
        created_at: listing.created_at,
        deleted_at: new Date().toISOString(),
        deleted_by: req.user.id
      }]);

    if (archiveError) {
      console.error('Arşivleme hatası:', archiveError);
      throw archiveError;
    }

    // İlanı sil
    const { error: deleteError } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Silme hatası:', deleteError);
      throw deleteError;
    }

    // Kullanıcıya bildirim gönder
    if (listing.user_id !== req.user.id) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert([{
          user_id: listing.user_id,
          title: 'İlanınız Silindi',
          message: `"${listing.title}" başlıklı ilanınız ${req.user.role === 'admin' ? 'admin' : 'moderatör'} tarafından silindi.`,
          type: 'warning',
          read: false,
          created_at: new Date().toISOString()
        }]);

      if (notifError) {
        console.error('Bildirim hatası:', notifError);
      }
    }

    console.log('İlan başarıyla silindi:', id);
    res.json({
      success: true,
      message: 'İlan başarıyla silindi'
    });

  } catch (error) {
    console.error('İlan silme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlan silinirken bir hata oluştu'
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
      await listingCleanupJob();
      
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