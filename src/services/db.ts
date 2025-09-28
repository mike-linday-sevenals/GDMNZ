// src/services/db.ts
import { createClient } from '@supabase/supabase-js'

const clean = (v?: string) => (v ?? '').trim().replace(/^['"]|['"];?$/g, '')

export const supabase = createClient(
  clean(import.meta.env.VITE_SUPABASE_URL),
  clean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  { auth: { persistSession: true } }
)
