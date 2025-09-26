import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS, DEFAULT_SPECIES, STORE_KEYS } from '@/utils'
import type { Settings, Species, Competitor, FishJoined } from '@/types'

function loadLocal<T>(key:string, fallback:T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : structuredClone(fallback) }
  catch { return structuredClone(fallback) }
}
function saveLocal<T>(key:string, value:T){ localStorage.setItem(key, JSON.stringify(value)) }
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)

// --- Robust env handling: fall back to local mode if URL/key are missing or invalid ---
function safeUrl(u?: string | null){
  if (!u || typeof u !== 'string') return null
  const s = u.trim()
  if (!s) return null
  try { return new URL(s).toString() } catch { return null }
}

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined
const url = safeUrl(rawUrl)
const key = (rawKey && rawKey.trim()) ? rawKey.trim() : null

const client: SupabaseClient | null = (url && key) ? createClient(url, key) : null

if (!client) {
  console.warn('[WOSC] Supabase disabled — using LOCAL fallback (env missing/invalid). To enable DB, create .env.local with:',
    '\nVITE_SUPABASE_URL=your_url',
    '\nVITE_SUPABASE_ANON_KEY=your_key')
}

export async function fetchSettings(): Promise<Settings> {
  if (!client) return structuredClone(DEFAULT_SETTINGS)
  const { data, error } = await client.from('settings').select('*').limit(1).maybeSingle()
  if (error) { console.warn(error); return structuredClone(DEFAULT_SETTINGS) }
  if (!data) return structuredClone(DEFAULT_SETTINGS)
  return {
    earlyBirdCutoff: data.early_bird_cutoff || DEFAULT_SETTINGS.earlyBirdCutoff,
    fees: DEFAULT_SETTINGS.fees,
    decimals: DEFAULT_SETTINGS.decimals,
    showTime: data.time_visible ?? DEFAULT_SETTINGS.showTime,
    requireTime: data.time_required ?? DEFAULT_SETTINGS.requireTime,
    compMode: (data.comp_mode || DEFAULT_SETTINGS.compMode),
    prizeMode: (data.prize_mode || DEFAULT_SETTINGS.prizeMode)
  }
}

export async function listSpecies(): Promise<Species[]> {
  if (!client) return DEFAULT_SPECIES.map((n,i)=>({id:i+1, name:n}))
  const { data, error } = await client.from('species').select('id,name,is_measure').order('name')
  if (error || !data?.length) return DEFAULT_SPECIES.map((n,i)=>({id:i+1, name:n}))
  return data
}

export async function listCompetitors(): Promise<Competitor[]> {
  if (!client) return loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
  const { data, error } = await client.from('competitor').select('id,full_name,category,boat,email,phone,paid_on,created_at').order('created_at', {ascending:false})
  if (error) throw error
  return data
}

export async function addCompetitor(payload: Omit<Competitor,'id'|'created_at'>): Promise<Competitor> {
  if (!client) {
    const list = loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
    const row: Competitor = { ...payload, id: uid(), created_at: new Date().toISOString() }
    list.push(row); saveLocal(STORE_KEYS.competitors, list); return row
  }
  const { data, error } = await client.from('competitor').insert(payload as any).select().single()
  if (error) throw error
  return data as any
}

export async function deleteCompetitors(ids: (string|number)[]): Promise<void> {
  if (!client) {
    const list = loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
    saveLocal(STORE_KEYS.competitors, list.filter(x=>!ids.includes(x.id)))
    const fish = loadLocal<any[]>(STORE_KEYS.fish, [])
    saveLocal(STORE_KEYS.fish, fish.filter(x=>!ids.includes(x.competitor_id)))
    return
  }
  const { error } = await client.from('competitor').delete().in('id', ids as any)
  if (error) throw error
}

export async function addFish(payload: { competitor_id:string|number, species_id:number, weight_kg?:number|null, length_cm?:number|null, time_caught?:string|null }) {
  if (!client) {
    const rows = loadLocal<any[]>(STORE_KEYS.fish, [])
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload }
    rows.push(row); saveLocal(STORE_KEYS.fish, rows); return row
  }
  const { data, error } = await client.from('fish').insert(payload as any).select().single()
  if (error) throw error
  return data
}

export async function deleteFish(ids:(string|number)[]): Promise<void> {
  if (!client) {
    const rows = loadLocal<any[]>(STORE_KEYS.fish, [])
    saveLocal(STORE_KEYS.fish, rows.filter(x=>!ids.includes(x.id)))
    return
  }
  const { error } = await client.from('fish').delete().in('id', ids as any)
  if (error) throw error
}

export async function listFishJoined(): Promise<FishJoined[]> {
  if (!client) {
    const fish = loadLocal<any[]>(STORE_KEYS.fish, [])
    const comps = loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
    const species = await listSpecies()
    const sById = new Map(species.map(s=>[s.id, s]))
    const cById = new Map(comps.map(c=>[c.id, c]))
    return fish.map(f => ({
      id: f.id,
      weight_kg: f.weight_kg,
      length_cm: f.length_cm,
      time_caught: f.time_caught,
      created_at: f.created_at,
      species: sById.get(f.species_id) || null,
      competitor: cById.get(f.competitor_id) ? {
        id: cById.get(f.competitor_id)!.id,
        full_name: cById.get(f.competitor_id)!.full_name,
        category: cById.get(f.competitor_id)!.category,
        boat: cById.get(f.competitor_id)!.boat,
        paid_on: cById.get(f.competitor_id)!.paid_on
      } : null
    })) as any
  }
  const { data, error } = await client.from('fish').select(`
      id, weight_kg, length_cm, time_caught, created_at,
      competitor:competitor_id(id, full_name, category, boat, paid_on),
      species:species_id(id, name)
  `).order('created_at', { ascending: false })
  if (error) throw error
  return data as any
}
