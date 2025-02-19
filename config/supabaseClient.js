import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Yapılandırma kontrolü
console.log('Supabase Yapılandırması:', {
  url: supabaseUrl,
  keyExists: !!supabaseServiceKey,
  keyFirstChars: supabaseServiceKey ? supabaseServiceKey.substring(0, 10) + '...' : null
})

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase yapılandırma bilgileri eksik')
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
})

// Test bağlantısı
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Supabase bağlantı hatası:', error)
  } else {
    console.log('Supabase bağlantısı başarılı')
  }
}) 