import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ESM için __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// .env dosyasını yükle
const envPath = join(__dirname, '..', '.env')
dotenv.config({ path: envPath })

// Debug
console.log('Loading environment from:', envPath)
console.log('Current working directory:', process.cwd())
console.log('Environment variables:', {
  SUPABASE_URL: process.env.SUPABASE_URL ? '[SET]' : '[NOT SET]',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? '[SET]' : '[NOT SET]'
})

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(`
    Missing Supabase environment variables.
    Please check your .env file at: ${envPath}
    SUPABASE_URL: ${supabaseUrl ? '[SET]' : '[NOT SET]'}
    SUPABASE_SERVICE_KEY: ${supabaseServiceKey ? '[SET]' : '[NOT SET]'}
  `)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Test connection
supabase.from('listings').select('count', { count: 'exact' })
  .then(({ count, error }) => {
    if (error) {
      console.error('Supabase bağlantı hatası:', error)
    } else {
      console.log('Supabase bağlantısı başarılı, toplam ilan sayısı:', count)
    }
  })

export { supabase } 