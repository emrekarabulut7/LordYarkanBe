import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Debug için environment variables'ları kontrol et
console.log('Supabase URL:', process.env.SUPABASE_URL)
console.log('Supabase Key var mı:', !!process.env.SUPABASE_SERVICE_KEY)
console.log('Supabase Key ilk 10 karakter:', process.env.SUPABASE_SERVICE_KEY?.substring(0, 10))

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Test connection
supabase.from('users').select('count', { count: 'exact' })
  .then(({ count, error }) => {
    if (error) {
      console.error('Supabase bağlantı hatası:', error)
    } else {
      console.log('Supabase bağlantısı başarılı, toplam kullanıcı sayısı:', count)
    }
  }) 