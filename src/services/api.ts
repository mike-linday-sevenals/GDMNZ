// src/services/api.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS, DEFAULT_SPECIES, STORE_KEYS } from '@/utils'
import type { Settings, Species, Competitor, FishJoined } from '@/types'

// ---- helpers (local fallback) ----
function loadLocal<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as T) : structuredClone(fallback)
    } catch {
        return structuredClone(fallback)
    }
}
function saveLocal<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value))
}
const uid = () =>
    (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)

function safeUrl(u?: string | null) {
    if (!u || typeof u !== 'string') return null
    const s = u.trim()
    if (!s) return null
    try {
        return new URL(s).toString()
    } catch {
        return null
    }
}

// ---- env + client ----
const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined
const url = safeUrl(rawUrl)
const key = rawKey && rawKey.trim() ? rawKey.trim() : null
export const client: SupabaseClient | null = url && key ? createClient(url, key) : null

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

/* ===================================================================================
   SETTINGS
   =================================================================================== */

// Ensure we update the single settings row (create if missing)
async function getSettingsRowId(c: SupabaseClient): Promise<string> {
    const { data, error } = await c.from('settings').select('id').limit(1).maybeSingle()
    if (error) throw error
    if (data?.id) return data.id as string

    // create a blank row so future updates succeed
    const { data: created, error: insErr } = await c.from('settings').insert({}).select('id').single()
    if (insErr) throw insErr
    return created.id as string
}

export async function fetchSettings(): Promise<Settings> {
    if (!client) return structuredClone(DEFAULT_SETTINGS)

    const { data, error } = await client
        .from('settings')
        .select('early_bird_cutoff, time_visible, time_required, comp_mode, prize_mode, active_species_ids')
        .limit(1)
        .maybeSingle()

    if (error) {
        console.warn('[settings] fetch error', error)
        return structuredClone(DEFAULT_SETTINGS)
    }
    if (!data) return structuredClone(DEFAULT_SETTINGS)

    return {
        earlyBirdCutoff: data.early_bird_cutoff || DEFAULT_SETTINGS.earlyBirdCutoff,
        fees: DEFAULT_SETTINGS.fees,
        decimals: DEFAULT_SETTINGS.decimals,
        showTime: data.time_visible ?? DEFAULT_SETTINGS.showTime,
        requireTime: data.time_required ?? DEFAULT_SETTINGS.requireTime,
        compMode: (data.comp_mode || DEFAULT_SETTINGS.compMode) as Settings['compMode'],
        prizeMode: (data.prize_mode || DEFAULT_SETTINGS.prizeMode) as Settings['prizeMode'],
        activeSpeciesIds: Array.isArray(data.active_species_ids) ? data.active_species_ids : undefined,
    }
}

export async function updateSettings(payload: Partial<{
    earlyBirdCutoff: string | undefined
    compMode: 'weight' | 'measure'
    showTime: boolean
    requireTime: boolean
    prizeMode: 'combined' | 'split'
    activeSpeciesIds: number[]
}>): Promise<void> {
    if (!client) return

    const rowId = await getSettingsRowId(client)

    const patch: any = {}
    if ('earlyBirdCutoff' in payload) patch.early_bird_cutoff = payload.earlyBirdCutoff || null
    if ('compMode' in payload) patch.comp_mode = payload.compMode
    if ('showTime' in payload) patch.time_visible = payload.showTime
    if ('requireTime' in payload) patch.time_required = payload.requireTime
    if ('prizeMode' in payload) patch.prize_mode = payload.prizeMode
    if ('activeSpeciesIds' in payload) patch.active_species_ids = payload.activeSpeciesIds ?? null

    const { data, error } = await client
        .from('settings')
        .update(patch)
        .eq('id', rowId)
    if (error) throw error
}

/* ===================================================================================
   SPECIES
   =================================================================================== */
export async function listSpecies(): Promise<Species[]> {
    if (!client) return DEFAULT_SPECIES.map((n, i) => ({ id: i + 1, name: n }))
    const { data, error } = await client.from('species').select('id,name,is_measure').order('name')
    if (error || !data?.length) return DEFAULT_SPECIES.map((n, i) => ({ id: i + 1, name: n }))
    return data as any
}

/* ===================================================================================
   COMPETITORS
   =================================================================================== */
export async function listCompetitors(): Promise<Competitor[]> {
    if (!client) return loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
    const { data, error } = await client
        .from('competitor')
        .select('id,full_name,category,boat,email,phone,paid_on,created_at')
        .order('created_at', { ascending: false })
    if (error) throw error
    return data as any
}

export async function addCompetitor(payload: Omit<Competitor, 'id' | 'created_at'>): Promise<Competitor> {
    if (!client) {
        const list = loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
        const row: Competitor = { ...payload, id: uid(), created_at: new Date().toISOString() }
        list.push(row)
        saveLocal(STORE_KEYS.competitors, list)
        return row
    }
    const { data, error } = await client.from('competitor').insert(payload as any).select().single()
    if (error) throw error
    return data as any
}

// ✨ NEW: update an existing competitor (inline edit support)
type CompetitorPatch = Partial<Pick<
    Competitor,
    'full_name' | 'category' | 'boat' | 'email' | 'phone' | 'paid_on'
>>

export async function updateCompetitor(
    id: string | number,
    patch: CompetitorPatch
): Promise<Competitor> {
    // normalise: trim strings; convert empty strings -> null for optional fields
    const norm: any = {}
    if ('full_name' in patch && patch.full_name != null) norm.full_name = String(patch.full_name).trim()
    if ('category' in patch && patch.category != null) norm.category = patch.category // 'adult' | 'junior'
    if ('boat' in patch) norm.boat = patch.boat != null && String(patch.boat).trim() !== '' ? String(patch.boat).trim() : null
    if ('email' in patch) norm.email = patch.email != null && String(patch.email).trim() !== '' ? String(patch.email).trim() : null
    if ('phone' in patch) norm.phone = patch.phone != null && String(patch.phone).trim() !== '' ? String(patch.phone).trim() : null
    if ('paid_on' in patch && patch.paid_on != null) norm.paid_on = patch.paid_on

    if (!client) {
        const list = loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
        const i = list.findIndex((x) => String(x.id) === String(id))
        if (i === -1) throw new Error('Competitor not found (local)')
        const updated = { ...list[i], ...norm } as Competitor
        list[i] = updated
        saveLocal(STORE_KEYS.competitors, list)
        return updated
    }

    const { data, error } = await client
        .from('competitor')
        .update(norm)
        .eq('id', id)
        .select('id,full_name,category,boat,email,phone,paid_on,created_at')
        .single()
    if (error) throw error
    return data as any
}

export async function deleteCompetitors(ids: (string | number)[]): Promise<void> {
    if (!client) {
        const list = loadLocal<Competitor[]>(STORE_KEYS.competitors, [])
        saveLocal(STORE_KEYS.competitors, list.filter((x) => !ids.includes(x.id)))
        const fish = loadLocal<any[]>(STORE_KEYS.fish, [])
        saveLocal(STORE_KEYS.fish, fish.filter((x) => !ids.includes(x.competitor_id)))
        return
    }
    const { error } = await client.from('competitor').delete().in('id', ids as any)
    if (error) throw error
}

/* ===================================================================================
   FISH
   =================================================================================== */
export async function addFish(payload: {
    competitor_id: string | number
    species_id: number
    weight_kg?: number | null
    length_cm?: number | null
    time_caught?: string | null
}) {
    if (!client) {
        const rows = loadLocal<any[]>(STORE_KEYS.fish, [])
        const row = { id: uid(), created_at: new Date().toISOString(), ...payload }
        rows.push(row)
        saveLocal(STORE_KEYS.fish, rows)
        return row
    }
    const { data, error } = await client.from('fish').insert(payload as any).select().single()
    if (error) throw error
    return data
}

export async function deleteFish(ids: (string | number)[]): Promise<void> {
    if (!client) {
        const rows = loadLocal<any[]>(STORE_KEYS.fish, [])
        saveLocal(STORE_KEYS.fish, rows.filter((x) => !ids.includes(x.id)))
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
        const sById = new Map(species.map((s) => [s.id, s]))
        const cById = new Map(comps.map((c) => [c.id, c]))
        return fish.map((f) => ({
            id: f.id,
            weight_kg: f.weight_kg,
            length_cm: f.length_cm,
            time_caught: f.time_caught,
            created_at: f.created_at,
            species: sById.get(f.species_id) || null,
            competitor: cById.get(f.competitor_id)
                ? {
                    id: cById.get(f.competitor_id)!.id,
                    full_name: cById.get(f.competitor_id)!.full_name,
                    category: cById.get(f.competitor_id)!.category,
                    boat: cById.get(f.competitor_id)!.boat,
                    paid_on: cById.get(f.competitor_id)!.paid_on,
                }
                : null,
        })) as any
    }

    const { data, error } = await client
        .from('fish')
        .select(
            `
      id, weight_kg, length_cm, time_caught, created_at,
      competitor:competitor_id(id, full_name, category, boat, paid_on),
      species:species_id(id, name)
    `
        )
        .order('created_at', { ascending: false })
    if (error) throw error
    return data as any
}

/* ===================================================================================
   SPONSORS (competition-scoped for Admin)
   Tables:
     sponsors(id uuid pk, name text)
     competition_sponsor(id uuid pk, competition_id uuid, sponsor_id uuid, level_id uuid null,
                         display_order int4 null, blurb text null)
   =================================================================================== */
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
    const ids = Array.from(new Set(cs.map((r) => r.sponsor_id)))
    const { data: sponsors, error: sErr } = await client
        .from('sponsors')
        .select('id,name')
        .in('id', ids as string[])
    if (sErr) throw sErr

    // 4) order by display_order then name
    const orderMap = new Map<string, number>()
    cs.forEach((r) => orderMap.set(r.sponsor_id, r.display_order ?? 9999))
    return (sponsors ?? [])
        .slice()
        .sort(
            (a: any, b: any) =>
                (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999) || a.name.localeCompare(b.name)
        ) as Sponsor[]
}

export async function createSponsor(name: string): Promise<Sponsor> {
    if (!client) {
        const list = loadLocal<LocalSponsors>(STORE_KEYS.sponsors, [])
        const row = { id: uid(), name: name.trim() }
        const next = [...list, row].sort((a, b) => a.name.localeCompare(b.name))
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
    if (linkErr && (linkErr as any).code !== '23505') {
        // ignore unique dup if you added a unique index
        throw linkErr
    }

    return sponsor as Sponsor
}

export async function updateSponsor(id: string, name: string): Promise<Sponsor> {
    if (!client) {
        const list = loadLocal<LocalSponsors>(STORE_KEYS.sponsors, [])
        const next = list.map((s) => (s.id === id ? { ...s, name: name.trim() } : s))
        saveLocal(STORE_KEYS.sponsors, next)
        return next.find((s) => s.id === id)! as Sponsor
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
        saveLocal(STORE_KEYS.sponsors, list.filter((s) => s.id !== id))
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

/* ===================================================================================
   PRIZES
   =================================================================================== */
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
    const { data, error } = await client.from('prize').insert(payload as any).select('id').single()
    if (error) throw error
    return data as { id: string }
}

export async function updatePrize(id: string, patch: Partial<Prize>): Promise<void> {
    if (!client) {
        const rows = loadLocal<Prize[]>(STORE_KEYS.prizes, [])
        const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
        saveLocal(STORE_KEYS.prizes, next)
        return
    }
    const { error } = await client.from('prize').update(patch as any).eq('id', id)
    if (error) throw error
}

export async function deletePrize(id: string): Promise<void> {
    if (!client) {
        const rows = loadLocal<Prize[]>(STORE_KEYS.prizes, [])
        saveLocal(STORE_KEYS.prizes, rows.filter((r) => r.id !== id))
        return
    }
    const { error } = await client.from('prize').delete().eq('id', id)
    if (error) throw error
}
