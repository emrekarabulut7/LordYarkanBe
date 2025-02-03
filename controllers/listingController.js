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
        console.log('Request body:', req.body);
        console.log('Request user:', req.user);

        // İlanı veritabanına kaydet
        const { data: listing, error: insertError } = await supabase
          .from('listings')
          .insert({
            user_id: req.user.id, // auth.uid() ile eşleşmeli
            server: req.body.server,
            category: req.body.category,
            title: req.body.title,
            description: req.body.description,
            price: parseFloat(req.body.price),
            currency: req.body.currency,
            phone: req.body.phone,
            discord: req.body.discord || null,
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
        if (req.file) {
          const fileBuffer = req.file.buffer;
          const fileExt = req.file.originalname.split('.').pop();
          const fileName = `${listing.id}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('listing-images')
            .upload(`images/${fileName}`, fileBuffer, {
              contentType: req.file.mimetype,
              upsert: true
            });

          if (uploadError) {
            console.error('Görsel yükleme hatası:', uploadError);
            // Görsel yükleme hatası olsa bile ilanı kaydet
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
          data: listing
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