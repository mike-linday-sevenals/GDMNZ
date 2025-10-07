// src/services/db.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const clean = (v?: string) => (v ?? '').trim().replace(/^['"]|['"];?$/g, '')

const url = clean(import.meta.env.VITE_SUPABASE_URL)
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const supabase: SupabaseClient | null = (url && key)
  ? createClient(url, key, { auth: { persistSession: true } })
  : null

if (!supabase) {
  console.warn('[WOSC] Supabase env vars missing — data features will use local fallbacks.')
}
