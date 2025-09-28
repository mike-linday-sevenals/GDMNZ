// src/services/api.ts
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS, DEFAULT_SPECIES, STORE_KEYS } from '@/utils';
// ---- helpers (local fallback) ----
function loadLocal(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : structuredClone(fallback);
    }
    catch {
        return structuredClone(fallback);
    }
}
function saveLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
function safeUrl(u) {
    if (!u || typeof u !== 'string')
        return null;
    const s = u.trim();
    if (!s)
        return null;
    try {
        return new URL(s).toString();
    }
    catch {
        return null;
    }
}
// ---- env + client ----
const rawUrl = import.meta.env?.VITE_SUPABASE_URL;
const rawKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
const url = safeUrl(rawUrl);
const key = (rawKey && rawKey.trim()) ? rawKey.trim() : null;
const client = (url && key) ? createClient(url, key) : null;
if (!client) {
    console.warn('[WOSC] Supabase disabled — using LOCAL fallback. To enable DB, create .env.local with:\n' +
        'VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...');
}
// Small helper: pick the current competition (running today; else latest by start date)
async function getCurrentCompetitionId() {
    if (!client)
        return 'local-only';
    const today = new Date().toISOString().slice(0, 10);
    let { data, error } = await client
        .from('competition')
        .select('id, starts_at, ends_at')
        .lte('starts_at', today)
        .gte('ends_at', today)
        .order('starts_at', { ascending: false })
        .limit(1);
    if (error)
        throw error;
    if (data?.length)
        return data[0].id;
    const { data: latest, error: err2 } = await client
        .from('competition')
        .select('id')
        .order('starts_at', { ascending: false })
        .limit(1);
    if (err2)
        throw err2;
    if (!latest?.length)
        throw new Error('No competitions found');
    return latest[0].id;
}
// ===================================================================================
// SETTINGS
// ===================================================================================
export async function fetchSettings() {
    if (!client)
        return structuredClone(DEFAULT_SETTINGS);
    const { data, error } = await client.from('settings').select('*').limit(1).maybeSingle();
    if (error) {
        console.warn('[settings] fetch error', error);
        return structuredClone(DEFAULT_SETTINGS);
    }
    if (!data)
        return structuredClone(DEFAULT_SETTINGS);
    return {
        earlyBirdCutoff: data.early_bird_cutoff || DEFAULT_SETTINGS.earlyBirdCutoff,
        fees: DEFAULT_SETTINGS.fees,
        decimals: DEFAULT_SETTINGS.decimals,
        showTime: data.time_visible ?? DEFAULT_SETTINGS.showTime,
        requireTime: data.time_required ?? DEFAULT_SETTINGS.requireTime,
        compMode: (data.comp_mode || DEFAULT_SETTINGS.compMode),
        prizeMode: (data.prize_mode || DEFAULT_SETTINGS.prizeMode)
    };
}
export async function updateSettings(payload) {
    if (!client)
        return;
    const patch = {};
    if ('earlyBirdCutoff' in payload)
        patch.early_bird_cutoff = payload.earlyBirdCutoff || null;
    if ('compMode' in payload)
        patch.comp_mode = payload.compMode;
    if ('showTime' in payload)
        patch.time_visible = payload.showTime;
    if ('requireTime' in payload)
        patch.time_required = payload.requireTime;
    if ('prizeMode' in payload)
        patch.prize_mode = payload.prizeMode;
    const { error } = await client.from('settings').update(patch).neq('id', null);
    if (error)
        throw error;
}
// ===================================================================================
// SPECIES
// ===================================================================================
export async function listSpecies() {
    if (!client)
        return DEFAULT_SPECIES.map((n, i) => ({ id: i + 1, name: n }));
    const { data, error } = await client.from('species').select('id,name,is_measure').order('name');
    if (error || !data?.length)
        return DEFAULT_SPECIES.map((n, i) => ({ id: i + 1, name: n }));
    return data;
}
// ===================================================================================
// COMPETITORS
// ===================================================================================
export async function listCompetitors() {
    if (!client)
        return loadLocal(STORE_KEYS.competitors, []);
    const { data, error } = await client
        .from('competitor')
        .select('id,full_name,category,boat,email,phone,paid_on,created_at')
        .order('created_at', { ascending: false });
    if (error)
        throw error;
    return data;
}
export async function addCompetitor(payload) {
    if (!client) {
        const list = loadLocal(STORE_KEYS.competitors, []);
        const row = { ...payload, id: uid(), created_at: new Date().toISOString() };
        list.push(row);
        saveLocal(STORE_KEYS.competitors, list);
        return row;
    }
    const { data, error } = await client.from('competitor').insert(payload).select().single();
    if (error)
        throw error;
    return data;
}
export async function deleteCompetitors(ids) {
    if (!client) {
        const list = loadLocal(STORE_KEYS.competitors, []);
        saveLocal(STORE_KEYS.competitors, list.filter(x => !ids.includes(x.id)));
        const fish = loadLocal(STORE_KEYS.fish, []);
        saveLocal(STORE_KEYS.fish, fish.filter(x => !ids.includes(x.competitor_id)));
        return;
    }
    const { error } = await client.from('competitor').delete().in('id', ids);
    if (error)
        throw error;
}
// ===================================================================================
// FISH
// ===================================================================================
export async function addFish(payload) {
    if (!client) {
        const rows = loadLocal(STORE_KEYS.fish, []);
        const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
        rows.push(row);
        saveLocal(STORE_KEYS.fish, rows);
        return row;
    }
    const { data, error } = await client.from('fish').insert(payload).select().single();
    if (error)
        throw error;
    return data;
}
export async function deleteFish(ids) {
    if (!client) {
        const rows = loadLocal(STORE_KEYS.fish, []);
        saveLocal(STORE_KEYS.fish, rows.filter(x => !ids.includes(x.id)));
        return;
    }
    const { error } = await client.from('fish').delete().in('id', ids);
    if (error)
        throw error;
}
export async function listFishJoined() {
    if (!client) {
        const fish = loadLocal(STORE_KEYS.fish, []);
        const comps = loadLocal(STORE_KEYS.competitors, []);
        const species = await listSpecies();
        const sById = new Map(species.map(s => [s.id, s]));
        const cById = new Map(comps.map(c => [c.id, c]));
        return fish.map(f => ({
            id: f.id,
            weight_kg: f.weight_kg,
            length_cm: f.length_cm,
            time_caught: f.time_caught,
            created_at: f.created_at,
            species: sById.get(f.species_id) || null,
            competitor: cById.get(f.competitor_id) ? {
                id: cById.get(f.competitor_id).id,
                full_name: cById.get(f.competitor_id).full_name,
                category: cById.get(f.competitor_id).category,
                boat: cById.get(f.competitor_id).boat,
                paid_on: cById.get(f.competitor_id).paid_on
            } : null
        }));
    }
    const { data, error } = await client.from('fish').select(`
      id, weight_kg, length_cm, time_caught, created_at,
      competitor:competitor_id(id, full_name, category, boat, paid_on),
      species:species_id(id, name)
  `).order('created_at', { ascending: false });
    if (error)
        throw error;
    return data;
}
export async function listSponsors() {
    if (!client)
        return loadLocal(STORE_KEYS.sponsors, []);
    // 1) find current competition
    const competition_id = await getCurrentCompetitionId();
    // 2) fetch sponsor_id list for this competition
    const { data: cs, error: csErr } = await client
        .from('competition_sponsor')
        .select('sponsor_id, display_order')
        .eq('competition_id', competition_id);
    if (csErr)
        throw csErr;
    if (!cs?.length)
        return [];
    // 3) fetch sponsor master rows
    const ids = Array.from(new Set(cs.map(r => r.sponsor_id)));
    const { data: sponsors, error: sErr } = await client
        .from('sponsors')
        .select('id,name')
        .in('id', ids);
    if (sErr)
        throw sErr;
    // 4) order by display_order then name
    const orderMap = new Map();
    cs.forEach(r => orderMap.set(r.sponsor_id, r.display_order ?? 9999));
    return (sponsors ?? [])
        .slice()
        .sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999) ||
        a.name.localeCompare(b.name));
}
export async function createSponsor(name) {
    if (!client) {
        const list = loadLocal(STORE_KEYS.sponsors, []);
        const row = { id: uid(), name: name.trim() };
        const next = [...list, row].sort((a, b) => a.name.localeCompare(b.name));
        saveLocal(STORE_KEYS.sponsors, next);
        return row;
    }
    // 1) master sponsor
    const { data: sponsor, error: sErr } = await client
        .from('sponsors')
        .insert({ name: name.trim() })
        .select('id,name')
        .single();
    if (sErr)
        throw sErr;
    // 2) link to current competition (no level/order/blurb by default)
    const competition_id = await getCurrentCompetitionId();
    const { error: linkErr } = await client
        .from('competition_sponsor')
        .insert({ competition_id, sponsor_id: sponsor.id });
    if (linkErr && linkErr.code !== '23505') { // ignore unique dup if you added a unique index
        throw linkErr;
    }
    return sponsor;
}
export async function updateSponsor(id, name) {
    if (!client) {
        const list = loadLocal(STORE_KEYS.sponsors, []);
        const next = list.map(s => s.id === id ? { ...s, name: name.trim() } : s);
        saveLocal(STORE_KEYS.sponsors, next);
        return next.find(s => s.id === id);
    }
    const { data, error } = await client
        .from('sponsors')
        .update({ name: name.trim() })
        .eq('id', id)
        .select('id,name')
        .single();
    if (error)
        throw error;
    return data;
}
export async function deleteSponsor(id) {
    if (!client) {
        const list = loadLocal(STORE_KEYS.sponsors, []);
        saveLocal(STORE_KEYS.sponsors, list.filter(s => s.id !== id));
        return;
    }
    // remove links first (FK friendly), then master
    const competition_id = await getCurrentCompetitionId();
    const { error: linkErr } = await client
        .from('competition_sponsor')
        .delete()
        .eq('competition_id', competition_id)
        .eq('sponsor_id', id);
    if (linkErr)
        throw linkErr;
    const { error } = await client.from('sponsors').delete().eq('id', id);
    if (error)
        throw error;
}
export async function listPrizes() {
    if (!client)
        return loadLocal(STORE_KEYS.prizes, []);
    const { data, error } = await client
        .from('prize')
        .select('id, rank, label, species_id, sponsor_id, sponsor, for_category, active')
        .order('rank', { ascending: true });
    if (error)
        throw error;
    return data;
}
export async function createPrize(payload) {
    if (!client) {
        const rows = loadLocal(STORE_KEYS.prizes, []);
        const row = { ...payload, id: uid() };
        saveLocal(STORE_KEYS.prizes, [...rows, row]);
        return { id: row.id };
    }
    const { data, error } = await client
        .from('prize')
        .insert(payload)
        .select('id')
        .single();
    if (error)
        throw error;
    return data;
}
export async function updatePrize(id, patch) {
    if (!client) {
        const rows = loadLocal(STORE_KEYS.prizes, []);
        const next = rows.map(r => r.id === id ? { ...r, ...patch } : r);
        saveLocal(STORE_KEYS.prizes, next);
        return;
    }
    const { error } = await client.from('prize').update(patch).eq('id', id);
    if (error)
        throw error;
}
export async function deletePrize(id) {
    if (!client) {
        const rows = loadLocal(STORE_KEYS.prizes, []);
        saveLocal(STORE_KEYS.prizes, rows.filter(r => r.id !== id));
        return;
    }
    const { error } = await client.from('prize').delete().eq('id', id);
    if (error)
        throw error;
}
