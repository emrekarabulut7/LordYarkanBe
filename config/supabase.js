import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

console.log('Supabase Yapılandırması:', {
  url: process.env.SUPABASE_URL,
  keyExists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  keyFirstChars: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10)
})

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase yapılandırma bilgileri eksik')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Test bağlantısı
supabase.from('users').select('count').then(({ data, error }) => {
  if (error) {
    console.error('Supabase bağlantı hatası:', error)
  } else {
    console.log('Supabase bağlantısı başarılı')
  }
}) 