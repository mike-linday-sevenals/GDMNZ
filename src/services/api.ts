// src/services/api.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS, DEFAULT_SPECIES, STORE_KEYS } from '@/utils'
import type { Settings, Species, Competitor, FishJoined } from '@/types'

// ---- helpers (local fallback) ----
function loadLocal<T>(key:string, fallback:T): T {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : structuredClone(fallback)
  } catch {
    return structuredClone(fallback)
  }
}
function saveLocal<T>(key:string, value:T){
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2)

type RawSpeciesRow = { id: number; name: string; is_measure?: boolean | null }
type RawCompetitorRow = {
  id: string | number
  full_name: string
  category: 'adult' | 'junior'
  boat?: string | null
  email?: string | null
  phone?: string | null
  paid_on: string
  created_at?: string | null
}
type LocalFishRow = {
  id: string
  competitor_id: Competitor['id']
  species_id: number
  weight_kg?: number | null
  length_cm?: number | null
  time_caught?: string | null
  created_at?: string
}
type RawFishJoinedRow = {
  id: string | number
  weight_kg?: number | null
  length_cm?: number | null
  time_caught?: string | null
  created_at?: string | null
  competitor?: RawCompetitorRow | null
  species?: RawSpeciesRow | null
}

const mapSpecies = (row: RawSpeciesRow): Species => ({
  id: row.id,
  name: row.name,
  is_measure: row.is_measure ?? undefined,
})

const mapCompetitor = (row: RawCompetitorRow): Competitor => ({
  id: row.id,
  full_name: row.full_name,
  category: row.category,
  boat: row.boat ?? null,
  email: row.email ?? null,
  phone: row.phone ?? null,
  paid_on: row.paid_on,
  created_at: row.created_at ?? undefined,
})

function safeUrl(u?: string | null){
  if (!u || typeof u !== 'string') return null
  const s = u.trim()
  if (!s) return null
  try { return new URL(s).toString() } catch { return null }
}

// ---- env + client ----
const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined
const url = safeUrl(rawUrl)
const key = (rawKey && rawKey.trim()) ? rawKey.trim() : null
const client: SupabaseClient | null = (url && key) ? createClient(url, key) : null

if (!client) {
  console.warn(
    '[WOSC] Supabase disabled — using LOCAL fallback. To enable DB, create .env.local with:\n' +
    'VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...'
  )
}

// Small helper: pick the current competition (running today; else latest by start date)
async function getCurrentCompetitionId(): Promise<string> {
  if (!client) return 'local-only'
  const today = new Date().toISOString().slice(0, 10)
  let { data, error } = await client
    .from('competition')
    .select('id, starts_at, ends_at')
    .lte('starts_at', today)
    .gte('ends_at', today)
    .order('starts_at', { ascending: false })
    .limit(1)
  if (error) throw error
  if (data?.length) return data[0].id

  const { data: latest, error: err2 } = await client
    .from('competition')
    .select('id')
    .order('starts_at', { ascending: false })
    .limit(1)
  if (err2) throw err2
  if (!latest?.length) throw new Error('No competitions found')
  return latest[0].id
}

// ===================================================================================
// SETTINGS
// ===================================================================================
export async function fetchSettings(): Promise<Settings> {
  const fallback = structuredClone(DEFAULT_SETTINGS) as Settings
  if (!client) return fallback

  const { data, error } = await client.from('settings').select('*').limit(1).maybeSingle()
  if (error) { console.warn('[settings] fetch error', error); return fallback }
  if (!data) return fallback

  return {
    ...fallback,
    earlyBirdCutoff: data.early_bird_cutoff || fallback.earlyBirdCutoff,
    showTime: data.time_visible ?? fallback.showTime,
    requireTime: data.time_required ?? fallback.requireTime,
    compMode: (data.comp_mode || fallback.compMode),
    prizeMode: (data.prize_mode || fallback.prizeMode)
  }
}

export async function updateSettings(payload: Partial<{
  earlyBirdCutoff: string | undefined
  compMode: 'weight'|'measure'
  showTime: boolean
  requireTime: boolean
  prizeMode: 'combined'|'split'
}>): Promise<void> {
  if (!client) return
  const patch: Record<string, unknown> = {}
  if ('earlyBirdCutoff' in payload) patch.early_bird_cutoff = payload.earlyBirdCutoff || null
  if ('compMode' in payload)       patch.comp_mode = payload.compMode
  if ('showTime' in payload)       patch.time_visible = payload.showTime
  if ('requireTime' in payload)    patch.time_required = payload.requireTime
  if ('prizeMode' in payload)      patch.prize_mode = payload.prizeMode

  const { error } = await client.from('settings').update(patch).neq('id', null)
  if (error) throw error
}

// ===================================================================================
// SPECIES
// ===================================================================================
export async function listSpecies(): Promise<Species[]> {
  if (!client) return DEFAULT_SPECIES.map((n,i)=>({id:i+1, name:n}))
  const { data, error } = await client.from('species').select('id,name,is_measure').order('name')
  if (error || !data?.length) return DEFAULT_SPECIES.map((n,i)=>({id:i+1, name:n}))
  return (data as RawSpeciesRow[]).map(mapSpecies)
}

// ===================================================================================
// COMPETITORS
// ===================================================================================
export async function listCompetitors(): Promise<Competitor[]> {
  if (!client) return loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
  const { data, error } = await client
    .from('competitor')
    .select('id,full_name,category,boat,email,phone,paid_on,created_at')
    .order('created_at', {ascending:false})
  if (error) throw error
  return (data as RawCompetitorRow[]).map(mapCompetitor)
}

export async function addCompetitor(payload: Omit<Competitor,'id'|'created_at'>): Promise<Competitor> {
  if (!client) {
    const list = loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
    const row: Competitor = { ...payload, id: uid(), created_at: new Date().toISOString() }
    list.push(row); saveLocal(STORE_KEYS.competitors, list); return row
  }
  const { data, error } = await client
    .from('competitor')
    .insert(payload)
    .select('id,full_name,category,boat,email,phone,paid_on,created_at')
    .single()
  if (error) throw error
  return mapCompetitor(data as RawCompetitorRow)
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

// ===================================================================================
// FISH
// ===================================================================================
export async function addFish(payload: {
  competitor_id:string|number,
  species_id:number,
  weight_kg?:number|null,
  length_cm?:number|null,
  time_caught?:string|null
}) {
  if (!client) {
    const rows = loadLocal<LocalFishRow[]>(STORE_KEYS.fish, [])
    const row: LocalFishRow = { id: uid(), created_at: new Date().toISOString(), ...payload }
    rows.push(row); saveLocal(STORE_KEYS.fish, rows); return row
  }
  const { data, error } = await client.from('fish').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteFish(ids:(string|number)[]): Promise<void> {
  if (!client) {
    const rows = loadLocal<LocalFishRow[]>(STORE_KEYS.fish, [])
    saveLocal(STORE_KEYS.fish, rows.filter(x=>!ids.includes(x.id)))
    return
  }
  const { error } = await client.from('fish').delete().in('id', ids as any)
  if (error) throw error
}

export async function listFishJoined(): Promise<FishJoined[]> {
  if (!client) {
    const fish = loadLocal<LocalFishRow[]>(STORE_KEYS.fish, [])
    const comps = loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
    const species = await listSpecies()
    const sById = new Map(species.map(s=>[s.id, s]))
    const cById = new Map(comps.map(c=>[c.id, c]))
    return fish.map(f => {
      const competitor = cById.get(f.competitor_id)
      return {
        id: f.id,
        weight_kg: f.weight_kg ?? null,
        length_cm: f.length_cm ?? null,
        time_caught: f.time_caught ?? null,
        created_at: f.created_at ?? null,
        species: sById.get(f.species_id) ?? null,
        competitor: competitor ? {
          id: competitor.id,
          full_name: competitor.full_name,
          category: competitor.category,
          boat: competitor.boat ?? null,
          paid_on: competitor.paid_on
        } : null
      } satisfies FishJoined
    })
  }

  const { data, error } = await client.from('fish').select(`
      id, weight_kg, length_cm, time_caught, created_at,
      competitor:competitor_id(id, full_name, category, boat, paid_on),
      species:species_id(id, name)
  `).order('created_at', { ascending: false })
  if (error) throw error
  return ((data as RawFishJoinedRow[] | null | undefined) ?? []).map(row => ({
    id: row.id,
    weight_kg: row.weight_kg ?? null,
    length_cm: row.length_cm ?? null,
    time_caught: row.time_caught ?? null,
    created_at: row.created_at ?? null,
    species: row.species ? mapSpecies(row.species) : null,
    competitor: row.competitor ? {
      id: row.competitor.id,
      full_name: row.competitor.full_name,
      category: row.competitor.category,
      boat: row.competitor.boat ?? null,
      paid_on: row.competitor.paid_on
    } : null
  }))
}

// ===================================================================================
// SPONSORS (competition-scoped for Admin)
// Tables:
//   sponsors(id uuid pk, name text)
//   competition_sponsor(id uuid pk, competition_id uuid, sponsor_id uuid, level_id uuid null,
//                       display_order int4 null, blurb text null)
// ===================================================================================
export type Sponsor = { id: string; name: string }

// LOCAL fallback storage shape (simple array)
type LocalSponsors = Sponsor[]

export async function listSponsors(): Promise<Sponsor[]> {
  if (!client) return loadLocal<LocalSponsors>(STORE_KEYS.sponsors, [])

  // 1) find current competition
  const competition_id = await getCurrentCompetitionId()

  // 2) fetch sponsor_id list for this competition
  const { data: cs, error: csErr } = await client
    .from('competition_sponsor')
    .select('sponsor_id, display_order')
    .eq('competition_id', competition_id)
  if (csErr) throw csErr

  if (!cs?.length) return []

  // 3) fetch sponsor master rows
  const ids = Array.from(new Set(cs.map(r => r.sponsor_id)))
  const { data: sponsors, error: sErr } = await client
    .from('sponsors')
    .select('id,name')
    .in('id', ids as string[])
  if (sErr) throw sErr

  // 4) order by display_order then name
  const orderMap = new Map<string, number>()
  cs.forEach(r => orderMap.set(r.sponsor_id, r.display_order ?? 9999))
  return (sponsors ?? [])
    .slice()
    .sort((a:any,b:any) =>
      (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999) ||
      a.name.localeCompare(b.name)
    ) as Sponsor[]
}

export async function createSponsor(name: string): Promise<Sponsor> {
  if (!client) {
    const list = loadLocal<LocalSponsors>(STORE_KEYS.sponsors, [])
    const row = { id: uid(), name: name.trim() }
    const next = [...list, row].sort((a,b)=>a.name.localeCompare(b.name))
    saveLocal(STORE_KEYS.sponsors, next)
    return row
  }

  // 1) master sponsor
  const { data: sponsor, error: sErr } = await client
    .from('sponsors')
    .insert({ name: name.trim() })
    .select('id,name')
    .single()
  if (sErr) throw sErr

  // 2) link to current competition (no level/order/blurb by default)
  const competition_id = await getCurrentCompetitionId()
  const { error: linkErr } = await client
    .from('competition_sponsor')
    .insert({ competition_id, sponsor_id: sponsor.id })
  if (linkErr && linkErr.code !== '23505') { // ignore unique dup if you added a unique index
    throw linkErr
  }

  return sponsor as Sponsor
}

export async function updateSponsor(id: string, name: string): Promise<Sponsor> {
  if (!client) {
    const list = loadLocal<LocalSponsors>(STORE_KEYS.sponsors, [])
    const next = list.map(s => s.id===id ? { ...s, name: name.trim() } : s)
    saveLocal(STORE_KEYS.sponsors, next)
    return next.find(s=>s.id===id)! as Sponsor
  }
  const { data, error } = await client
    .from('sponsors')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id,name')
    .single()
  if (error) throw error
  return data as Sponsor
}

export async function deleteSponsor(id: string): Promise<void> {
  if (!client) {
    const list = loadLocal<LocalSponsors>(STORE_KEYS.sponsors, [])
    saveLocal(STORE_KEYS.sponsors, list.filter(s=>s.id!==id))
    return
  }
  // remove links first (FK friendly), then master
  const competition_id = await getCurrentCompetitionId()
  const { error: linkErr } = await client
    .from('competition_sponsor')
    .delete()
    .eq('competition_id', competition_id)
    .eq('sponsor_id', id)
  if (linkErr) throw linkErr

  const { error } = await client.from('sponsors').delete().eq('id', id)
  if (error) throw error
}

// ===================================================================================
// PRIZES
// ===================================================================================
export type Prize = {
  id: string
  rank: number
  label: string | null
  species_id: number | null
  sponsor_id: string | null
  sponsor?: string | null // legacy text label
  for_category: 'adult' | 'junior' | 'combined' | null
  active: boolean | null
}

export async function listPrizes(): Promise<Prize[]> {
  if (!client) return loadLocal<Prize[]>(STORE_KEYS.prizes, [])
  const { data, error } = await client
    .from('prize')
    .select('id, rank, label, species_id, sponsor_id, sponsor, for_category, active')
    .order('rank', { ascending: true })
  if (error) throw error
  return data as Prize[]
}

export async function createPrize(payload: Omit<Prize, 'id'>): Promise<{ id: string }> {
  if (!client) {
    const rows = loadLocal<Prize[]>(STORE_KEYS.prizes, [])
    const row = { ...payload, id: uid() } as Prize
    saveLocal(STORE_KEYS.prizes, [...rows, row])
    return { id: row.id }
  }
  const { data, error } = await client
    .from('prize')
    .insert(payload as any)
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

export async function updatePrize(id: string, patch: Partial<Prize>): Promise<void> {
  if (!client) {
    const rows = loadLocal<Prize[]>(STORE_KEYS.prizes, [])
    const next = rows.map(r => r.id===id ? { ...r, ...patch } : r)
    saveLocal(STORE_KEYS.prizes, next)
    return
  }
  const { error } = await client.from('prize').update(patch as any).eq('id', id)
  if (error) throw error
}

export async function deletePrize(id: string): Promise<void> {
  if (!client) {
    const rows = loadLocal<Prize[]>(STORE_KEYS.prizes, [])
    saveLocal(STORE_KEYS.prizes, rows.filter(r=>r.id!==id))
    return
  }
  const { error } = await client.from('prize').delete().eq('id', id)
  if (error) throw error
}
