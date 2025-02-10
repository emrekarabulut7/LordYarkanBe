const supabase = require('../config/supabase');
const multer = require('multer');
const upload = multer().single('image');

// @desc    Yeni ilan oluştur
// @route   POST /api/listings/create
// @access  Private
exports.createListing = async (req, res) => {
  try {
    upload(req, res, async function(err) {
      if (err) {
        console.error('Multer hatası:', err);
        return res.status(400).json({
          success: false,
          message: 'Görsel yükleme hatası',
          error: err.message
        });
      }

      try {
        // Kullanıcının aktif ilan sayısını kontrol et
        const { data: activeListings, error: countError } = await supabase
          .from('listings')
          .select('id, status')
          .eq('user_id', req.user.id)
          .eq('status', 'active');

        if (countError) throw countError;

        // Kesin kontrol
        const activeCount = activeListings?.length || 0;
        
        if (activeCount >= 5) {
          return res.status(403).json({
            success: false,
            message: 'Maximum ilan limitine ulaştınız (5/5). Yeni ilan vermek için lütfen eski ilanlarınızdan birini silin veya kapatın.'
          });
        }

        // İlanı veritabanına kaydet
        const { data: listing, error: insertError } = await supabase
          .from('listings')
          .insert({
            user_id: req.user.id,
            server: req.body.server,
            category: req.body.category,
            listing_type: req.body.listingType,
            title: req.body.title,
            description: req.body.description,
            price: parseFloat(req.body.price),
            currency: req.body.currency,
            phone: req.body.phone,
            discord: req.body.discord || null,
            contact_type: req.body.contactType,
            status: 'active',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('Veritabanı hatası:', insertError);
          throw insertError;
        }

        // Görsel varsa yükle
        if (req.body.image) {
          const base64Data = req.body.image.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const fileName = `${listing.id}.jpg`;
          
          const { error: uploadError } = await supabase.storage
            .from('listing-images')
            .upload(`images/${fileName}`, buffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.error('Görsel yükleme hatası:', uploadError);
          } else {
            // Görsel URL'ini güncelle
            const { data: { publicUrl } } = supabase.storage
              .from('listing-images')
              .getPublicUrl(`images/${fileName}`);

            const { error: updateError } = await supabase
              .from('listings')
              .update({ image_url: publicUrl })
              .eq('id', listing.id);

            if (updateError) {
              console.error('Görsel URL güncelleme hatası:', updateError);
            }
          }
        }

        res.status(201).json({
          success: true,
          data: listing,
          message: 'İlan başarıyla oluşturuldu'
        });

      } catch (error) {
        console.error('İlan oluşturma hatası:', error);
        res.status(500).json({
          success: false,
          message: 'İlan oluşturulurken bir hata oluştu',
          error: error.message
        });
      }
    });
  } catch (error) {
    console.error('Genel hata:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    });
  }
};

// @desc    Tüm ilanları getir
// @route   GET /api/listings
// @access  Public
exports.getListings = async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
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
};

// @desc    Kullanıcının ilanlarını getir
// @route   GET /api/listings/user/:userId
// @access  Private
exports.getUserListings = async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('listings')
      .select('*')
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: listings
    });

  } catch (error) {
    console.error('Kullanıcı ilanları getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlanlar getirilirken bir hata oluştu',
      error: error.message
    });
  }
};

// @desc    İlan onaylama/reddetme
// @route   PUT /api/listings/:id/approve
// @access  Admin
exports.approveListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Eğer onaylama işlemi ise aktif ilan sayısını kontrol et
    if (status === 'active') {
      // Önce ilanın sahibini bul
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('user_id')
        .eq('id', id)
        .single();

      if (listingError) throw listingError;

      // Kullanıcının aktif ilan sayısını kontrol et
      const { data: activeListings, error: countError } = await supabase
        .from('listings')
        .select('id')
        .eq('user_id', listing.user_id)
        .eq('status', 'active');

      if (countError) throw countError;

      if (activeListings?.length >= 5) {
        return res.status(403).json({
          success: false,
          message: 'Maximum ilan limitine ulaştınız (5/5). Yeni ilan vermek için lütfen eski ilanlarınızdan birini silin veya kapatın.'
        });
      }
    }

    // İlanı güncelle
    const { data, error } = await supabase
      .from('listings')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: `İlan başarıyla ${status === 'active' ? 'onaylandı' : 'reddedildi'}`
    });

  } catch (error) {
    console.error('İlan onaylama hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İlan onaylanırken bir hata oluştu',
      error: error.message
    });
  }
}; 