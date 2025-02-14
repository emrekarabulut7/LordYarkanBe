import { supabase } from '../config/supabase.js';

export const cleanupExpiredListings = async () => {
  try {
    console.log('İlan temizleme işlemi başlatıldı...');

    // 24 saat önce oluşturulan ilanları bul
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() - 24);

    console.log('Kontrol tarihi:', expirationDate.toISOString());

    // Süresi dolan aktif ilanları getir
    const { data: expiredListings, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .lte('created_at', expirationDate.toISOString());

    if (fetchError) {
      console.error('İlanları getirme hatası:', fetchError);
      throw fetchError;
    }

    console.log('Bulunan ilanlar:', expiredListings);

    if (!expiredListings?.length) {
      console.log('Süresi dolan ilan bulunamadı');
      return;
    }

    console.log(`${expiredListings.length} adet süresi dolan ilan bulundu`);

    // Her ilan için silme işlemi yap
    for (const listing of expiredListings) {
      console.log('İşlenen ilan:', listing.id);

      try {
        // Önce deleted_listings tablosuna ekle
        const { error: insertError } = await supabase
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
            status: 'expired',
            created_at: listing.created_at,
            updated_at: listing.updated_at,
            deleted_at: new Date().toISOString(),
            deleted_by: null // Otomatik silme
          }]);

        if (insertError) {
          console.error(`İlan ${listing.id} arşivleme hatası:`, insertError);
          continue;
        }

        // Sonra orijinal ilanı sil
        const { error: deleteError } = await supabase
          .from('listings')
          .delete()
          .eq('id', listing.id);

        if (deleteError) {
          console.error(`İlan ${listing.id} silme hatası:`, deleteError);
          continue;
        }

        // En son bildirim gönder
        const { error: notifError } = await supabase
          .from('notifications')
          .insert([{
            user_id: listing.user_id,
            title: 'İlanınızın Süresi Doldu',
            message: `"${listing.title}" başlıklı ilanınızın süresi doldu ve otomatik olarak kaldırıldı.`,
            type: 'info',
            read: false,
            created_at: new Date().toISOString()
          }]);

        if (notifError) {
          console.error(`İlan ${listing.id} bildirim hatası:`, notifError);
        }

        console.log(`İlan ${listing.id} başarıyla temizlendi`);

      } catch (error) {
        console.error(`İlan ${listing.id} işleme hatası:`, error);
      }
    }

    console.log('İlan temizleme işlemi tamamlandı');

  } catch (error) {
    console.error('İlan temizleme genel hatası:', error);
  }
}; 