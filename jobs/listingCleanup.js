import { supabase } from '../config/supabase.js';

// İlan temizleme işini pasif hale getiriyoruz
export const listingCleanupJob = async () => {
  // Şimdilik pasif
  return;

  /* Önceki kod:
  try {
    const { data: expiredListings, error } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('Süresi dolmuş ilanları getirirken hata:', error);
      return;
    }

    for (const listing of expiredListings) {
      const { error: updateError } = await supabase
        .from('listings')
        .update({ status: 'expired' })
        .eq('id', listing.id);

      if (updateError) {
        console.error(`İlan güncellenirken hata (ID: ${listing.id}):`, updateError);
      }
    }

    console.log(`${expiredListings.length} adet süresi dolmuş ilan güncellendi`);
  } catch (error) {
    console.error('İlan temizleme işlemi sırasında hata:', error);
  }
  */
};

// Cron job'ı da pasif hale getiriyoruz
export const startListingCleanupJob = () => {
  // Şimdilik pasif
  return;

  /* Önceki kod:
  cron.schedule('0 0 * * *', () => {
    console.log('İlan temizleme işi başlatılıyor...');
    listingCleanupJob();
  });
  */
}; 