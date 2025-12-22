// ============================================================================
//  src/services/api.ts — FINAL FULLY-WORKING VERSION
// ============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, DEFAULT_SPECIES, STORE_KEYS } from "@/utils";
import type {
    Settings,
    Species,
    Competitor,
    FishJoined,
    Competition
} from "@/types";



// ============================================================================
// HELPERS (LOCAL FALLBACK)
// ============================================================================

function loadLocal<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : structuredClone(fallback);
    } catch {
        return structuredClone(fallback);
    }
}

function saveLocal<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value));
}

const uid = () =>
    (crypto as any).randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

function safeUrl(u?: string | null) {
    if (!u || typeof u !== "string") return null;
    const s = u.trim();
    if (!s) return null;
    try {
        return new URL(s).toString();
    } catch {
        return null;
    }
}

export async function fetchCompetitionFees(competitionId: string) {
    return await getCompetitionFees(competitionId);
}

export type BoatType = "Launch" | "Trailer" | "Charter";


// ============================================================================
// SUPABASE INITIALISATION
// ============================================================================

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const url = safeUrl(rawUrl);
const key = rawKey && rawKey.trim() ? rawKey.trim() : null;

export const client: SupabaseClient | null =
    url && key ? createClient(url, key) : null;

if (!client) {
    console.warn(
        "[WOSC] Supabase disabled — using LOCAL fallback. Create .env.local with:\n" +
        "VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=..."
    );
}

// ============================================================================
// CURRENT COMPETITION (LEGACY)
// ============================================================================

async function getCurrentCompetitionId(): Promise<string> {
    if (!client) return "local-only";

    const today = new Date().toISOString().slice(0, 10);

    const { data: active } = await client
        .from("competition")
        .select("id, starts_at, ends_at")
        .lte("starts_at", today)
        .gte("ends_at", today)
        .order("starts_at", { ascending: false })
        .limit(1);

    if (active?.length) return active[0].id;

    const { data: latest } = await client
        .from("competition")
        .select("id")
        .order("starts_at", { ascending: false })
        .limit(1);

    if (!latest?.length) throw new Error("No competitions found");
    return latest[0].id;
}

// ============================================================================
// SETTINGS
// ============================================================================

async function getSettingsRowId(c: SupabaseClient): Promise<string> {
    const { data } = await c
        .from("settings")
        .select("id")
        .limit(1)
        .maybeSingle();

    if (data?.id) return data.id;

    const { data: created, error } = await c
        .from("settings")
        .insert({})
        .select("id")
        .single();

    if (error) throw error;
    return created.id;
}

export async function fetchSettings(): Promise<Settings> {
    if (!client) return structuredClone(DEFAULT_SETTINGS);

    const { data } = await client
        .from("settings")
        .select(
            "early_bird_cutoff, time_visible, time_required, comp_mode, prize_mode, active_species_ids"
        )
        .limit(1)
        .maybeSingle();

    if (!data) return structuredClone(DEFAULT_SETTINGS);

    return {
        earlyBirdCutoff: data.early_bird_cutoff || DEFAULT_SETTINGS.earlyBirdCutoff,
        fees: DEFAULT_SETTINGS.fees,
        decimals: DEFAULT_SETTINGS.decimals,
        showTime: data.time_visible ?? DEFAULT_SETTINGS.showTime,
        requireTime: data.time_required ?? DEFAULT_SETTINGS.requireTime,
        compMode: data.comp_mode ?? DEFAULT_SETTINGS.compMode,
        prizeMode: data.prize_mode ?? DEFAULT_SETTINGS.prizeMode,
        activeSpeciesIds: data.active_species_ids ?? [],
    };
}

export async function updateSettings(payload: Partial<Settings>) {
    if (!client) return;

    const rowId = await getSettingsRowId(client);

    const patch: any = {};
    if ("earlyBirdCutoff" in payload) patch.early_bird_cutoff = payload.earlyBirdCutoff || null;
    if ("compMode" in payload) patch.comp_mode = payload.compMode;
    if ("showTime" in payload) patch.time_visible = payload.showTime;
    if ("requireTime" in payload) patch.time_required = payload.requireTime;
    if ("prizeMode" in payload) patch.prize_mode = payload.prizeMode;
    if ("activeSpeciesIds" in payload) patch.active_species_ids = payload.activeSpeciesIds ?? null;

    await client.from("settings").update(patch).eq("id", rowId);
}

// ============================================================================
// SPECIES — GLOBAL TABLE
// ============================================================================

export async function listSpecies(): Promise<Species[]> {
    if (!client) {
        return DEFAULT_SPECIES.map((name, i) => ({
            id: i + 1,
            name,
            is_measure: false
        }));
    }

    const { data, error } = await client
        .from("species")
        .select("id, name, is_measure")
        .order("name");

    if (error) throw error;
    return data as Species[];
}

// ============================================================================
// COMPETITION-SPECIFIC SPECIES
// ============================================================================

export type CompetitionSpeciesRow = {
    id: string;
    species: Species;
};

export async function listCompetitionSpecies(
    competitionId: string
): Promise<CompetitionSpeciesRow[]> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition_species")
        .select(`
            id,
            species: species_id ( id, name, is_measure )
        `)
        .eq("competition_id", competitionId)
        .order("species_id");

    if (error) throw error;

    return (data || []).map((row: any) => ({
        id: row.id,
        species: Array.isArray(row.species) ? row.species[0] : row.species
    }));
}

export async function saveCompetitionSpecies(
    competitionId: string,
    speciesIds: number[]
) {
    if (!client) throw new Error("Supabase not ready");

    await client.from("competition_species").delete().eq("competition_id", competitionId);

    if (!speciesIds.length) return [];

    const rows = speciesIds.map(sid => ({
        competition_id: competitionId,
        species_id: sid
    }));

    const { data, error } = await client
        .from("competition_species")
        .insert(rows)
        .select();

    if (error) throw error;
    return data;
}

// ============================================================================
// COMPETITION — HEADER
// ============================================================================

export async function listCompetitions() {
    if (!client) return [];

    const { data, error } = await client
        .from("competition")
        .select("id, name, starts_at, ends_at")
        .order("starts_at");

    if (error) throw error;
    return data;
}

export async function addCompetition(payload: {
    name: string;
    starts_at: string;
    ends_at: string;
}) {
    if (!client) throw new Error("Supabase not configured.");

    const { data, error } = await client
        .from("competition")
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getCompetition(params: { id: string }): Promise<Competition> {
    const id = params.id;
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition")
        .select(`
            id,
            name,
            starts_at,
            ends_at,
            comp_mode: comp_mode_id ( id, name ),
            prize_mode: prize_mode_id ( id, name )
        `)
        .eq("id", id)
        .single();

    if (error) throw error;

    const compMode = Array.isArray(data.comp_mode) ? data.comp_mode[0] : data.comp_mode;
    const prizeMode = Array.isArray(data.prize_mode) ? data.prize_mode[0] : data.prize_mode;

    return {
        id: data.id,
        name: data.name,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        comp_mode: compMode ?? null,
        prize_mode: prizeMode ?? null,
        comp_mode_id: compMode?.id ?? null,
        prize_mode_id: prizeMode?.id ?? null
    };
}

export async function updateCompetition(id: string, patch: any) {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition")
        .update({
            name: patch.name,
            starts_at: patch.starts_at,
            ends_at: patch.ends_at,
            comp_mode_id: patch.comp_mode_id ?? null,
            prize_mode_id: patch.prize_mode_id ?? null
        })
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}
// ============================================================================
// COMPETITION DAYS
// ============================================================================

export async function listCompetitionDays(competitionId: string) {
    if (!client) throw new Error("Supabase not ready");

    let { data, error } = await client
        .from("competition_day")
        .select("*")
        .eq("competition_id", competitionId)
        .order("day_date");

    if (error) throw error;

    // If no days exist → auto-create Day 1
    if (!data || data.length === 0) {
        const today = new Date().toISOString().slice(0, 10);

        const { data: created, error: insertErr } = await client
            .from("competition_day")
            .insert({
                competition_id: competitionId,
                day_date: today,
                fishing_start_type: "None",
                fishing_end_type: "None",
                weighin_type: "None",
                overnight_allowed: false
            })
            .select()
            .single();

        if (insertErr) throw insertErr;

        return [created];
    }

    return data;
}


export async function updateCompetitionDay(dayId: string, patch: any) {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition_day")
        .update(patch)
        .eq("id", dayId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function addCompetitionDay(competitionId: string) {
    if (!client) throw new Error("Supabase not ready");

    // Get existing days so we can avoid unique constraint errors
    const { data: existing } = await client
        .from("competition_day")
        .select("day_date")
        .eq("competition_id", competitionId)
        .order("day_date");

    let newDate = new Date().toISOString().slice(0, 10);

    if (existing && existing.length) {
        // pick the last date + 1 day
        const last = existing[existing.length - 1].day_date;
        const dt = new Date(last);
        dt.setDate(dt.getDate() + 1);
        newDate = dt.toISOString().slice(0, 10);
    }

    const { data, error } = await client
        .from("competition_day")
        .insert({
            competition_id: competitionId,
            day_date: newDate,
            fishing_start_type: "None",
            fishing_end_type: "None",
            weighin_type: "None",
            overnight_allowed: false
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}


export async function deleteCompetitionDay(id: string) {
    if (!client) return;

    const { error } = await client
        .from("competition_day")
        .delete()
        .eq("id", id);

    if (error) throw error;
}

// ============================================================================
// COMPETITION BRIEFING
// ============================================================================

export async function getCompetitionBriefing(competitionId: string) {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition_briefing")
        .select("*")
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    // If no row exists → create one automatically
    if (!data) {
        const { data: created, error: insertErr } = await client
            .from("competition_briefing")
            .insert({
                competition_id: competitionId,
                briefing_date: null,
                briefing_time: null,
                location: null,
                notes: null
            })
            .select()
            .single();

        if (insertErr) throw insertErr;
        return created;
    }

    return data;
}


export async function createCompetitionBriefing(competitionId: string) {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition_briefing")
        .insert({
            competition_id: competitionId,
            briefing_date: null,
            briefing_time: null,
            location: null,
            notes: null
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function upsertCompetitionBriefing(
    competitionId: string,
    patch: any
) {
    if (!client) throw new Error("Supabase not ready");

    const { data: existing } = await client
        .from("competition_briefing")
        .select("id")
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (existing) {
        const { data, error } = await client
            .from("competition_briefing")
            .update(patch)
            .eq("competition_id", competitionId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // insert new
    const { data, error } = await client
        .from("competition_briefing")
        .insert({
            competition_id: competitionId,
            ...patch
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================================
// COMPETITION FEES
// ============================================================================

export async function getCompetitionFees(competitionId: string) {
    if (!client) {
        const list = loadLocal<any[]>("competition_fees", []);
        return list.find(x => x.competition_id === competitionId) || null;
    }

    let { data, error } = await client
        .from("competition_fees")
        .select("*")
        .eq("competition_id", competitionId)
        .maybeSingle();

    // If Supabase throws PGRST116 (no row), we catch it by checking !data
    if (error && error.code !== "PGRST116") throw error;

    if (!data) {
        // Auto-create default fee row
        const defaultRow = {
            competition_id: competitionId,
            earlybird_fee_adult: null,
            earlybird_fee_junior: null,
            earlybird_cutoff_date: null,
            full_fee_adult: null,
            full_fee_junior: null,
            nonmember_fee_adult: null,
            nonmember_fee_junior: null,
            extra: {}
        };

        const { data: created, error: insertErr } = await client
            .from("competition_fees")
            .insert(defaultRow)
            .select()
            .single();

        if (insertErr) throw insertErr;
        return created;
    }

    return data;
}

export async function upsertCompetitionFees(competitionId: string, patch: any) {
    if (!client) {
        const list = loadLocal<any[]>("competition_fees", []);
        const existing = list.find(x => x.competition_id === competitionId);

        if (existing) {
            const updated = { ...existing, ...patch };
            saveLocal(
                "competition_fees",
                list.map(x => (x.competition_id === competitionId ? updated : x))
            );
            return updated;
        }

        const newRow = { id: uid(), competition_id: competitionId, ...patch };
        saveLocal("competition_fees", [...list, newRow]);
        return newRow;
    }

    const { data: exists } = await client
        .from("competition_fees")
        .select("id")
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (exists) {
        const { data, error } = await client
            .from("competition_fees")
            .update(patch)
            .eq("competition_id", competitionId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    const { data, error } = await client
        .from("competition_fees")
        .insert({
            competition_id: competitionId,
            ...patch
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================================
// MODES (comp_mode + prize_mode lookup tables)
// ============================================================================

export async function listCompModes() {
    if (!client) return [];
    const { data, error } = await client
        .from("comp_mode")
        .select("id, name")
        .order("name");

    if (error) throw error;
    return data || [];
}

export async function listPrizeModes() {
    if (!client) return [];
    const { data, error } = await client
        .from("prize_mode")
        .select("id, name")
        .order("name");

    if (error) throw error;
    return data || [];
}

// ============================================================================
// FISH — addFish / deleteFish / listFishJoined
// ============================================================================

export async function addFish(payload: {
    competitor_id: string | number;
    species_id: number;
    weight_kg?: number | null;
    length_cm?: number | null;
    time_caught?: string | null;
}) {
    if (!client) {
        const local = loadLocal<any[]>(STORE_KEYS.fish, []);
        const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
        local.push(row);
        saveLocal(STORE_KEYS.fish, local);
        return row;
    }

    const { data, error } = await client
        .from("fish")
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteFish(ids: (string | number)[]) {
    if (!client) {
        const local = loadLocal<any[]>(STORE_KEYS.fish, []);
        saveLocal(
            STORE_KEYS.fish,
            local.filter(f => !ids.includes(f.id))
        );
        return;
    }

    const { error } = await client
        .from("fish")
        .delete()
        .in("id", ids);

    if (error) throw error;
}

export async function listFishJoined(): Promise<FishJoined[]> {
    if (!client) {
        const fish = loadLocal<any[]>(STORE_KEYS.fish, []);
        const comps = loadLocal<Competitor[]>(STORE_KEYS.competitors, []);
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
            competitor: cById.get(f.competitor_id)
                ? {
                    id: cById.get(f.competitor_id)!.id,
                    full_name: cById.get(f.competitor_id)!.full_name,
                    category: cById.get(f.competitor_id)!.category,
                    boat: cById.get(f.competitor_id)!.boat,
                    paid_on: cById.get(f.competitor_id)!.paid_on
                }
                : null
        }));
    }

    const { data, error } = await client
        .from("fish")
        .select(`
            id,
            weight_kg,
            length_cm,
            time_caught,
            created_at,
            competitor:competitor_id ( id, full_name, category, boat,  membership_no, email, phone, paid_on, created_at ),
            species:species_id ( id, name )
        `)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
        id: row.id,
        weight_kg: row.weight_kg,
        length_cm: row.length_cm,
        time_caught: row.time_caught,
        created_at: row.created_at,
        competitor: Array.isArray(row.competitor) ? row.competitor[0] : row.competitor,
        species: Array.isArray(row.species) ? row.species[0] : row.species
    }));
}

// ============================================================================
// COMPETITORS — full legacy version
// ============================================================================

export async function listCompetitors(): Promise<Competitor[]> {
    if (!client) return loadLocal<Competitor[]>(STORE_KEYS.competitors, []);

    const { data, error } = await client
        .from("competitor")
        .select(`id,full_name,category,boat,membership_no,boat_type,email,phone,paid_on,created_at`)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Competitor[];
}

export async function addCompetitor(
    payload: Omit<Competitor, "id" | "created_at">
): Promise<Competitor> {
    if (!client) {
        const list = loadLocal<Competitor[]>(STORE_KEYS.competitors, []);
        const row: Competitor = {
            ...payload,
            id: uid(),
            created_at: new Date().toISOString()
        };
        list.push(row);
        saveLocal(STORE_KEYS.competitors, list);
        return row;
    }

    const { data, error } = await client
        .from("competitor")
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data as Competitor;
}

export async function updateCompetitor(
    id: string | number,
    patch: Partial<
        Pick<Competitor,
            "full_name" |
            "category" |
            "paid_on" |
            "membership_no" |
            "boat" 
        >
    >
): Promise<Competitor> {
    const norm: Partial<Competitor> = {};

    if (patch.full_name !== undefined)
        norm.full_name = patch.full_name.trim();

    if (patch.category !== undefined)
        norm.category = patch.category;

    if (patch.boat !== undefined)
        norm.boat = patch.boat.trim();

    if (patch.membership_no !== undefined)
        norm.membership_no = patch.membership_no.trim();

    if (patch.paid_on !== undefined)
        norm.paid_on = patch.paid_on ?? null;

    if (!client) {
        const list = loadLocal<Competitor[]>(STORE_KEYS.competitors, []);
        const i = list.findIndex(x => String(x.id) === String(id));
        if (i === -1) throw new Error("Competitor not found (local)");

        const updated = { ...list[i], ...norm };
        list[i] = updated;
        saveLocal(STORE_KEYS.competitors, list);
        return updated;
    }

    const { data, error } = await client
        .from("competitor")
        .update(norm)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data as Competitor;
}


export async function deleteCompetitors(ids: (string | number)[]): Promise<void> {
    if (!client) {
        const list = loadLocal<Competitor[]>(STORE_KEYS.competitors, []);
        saveLocal(
            STORE_KEYS.competitors,
            list.filter(x => !ids.includes(x.id))
        );

        const fish = loadLocal<any[]>(STORE_KEYS.fish, []);
        saveLocal(
            STORE_KEYS.fish,
            fish.filter(x => !ids.includes(x.competitor_id))
        );
        return;
    }

    const { error } = await client
        .from("competitor")
        .delete()
        .in("id", ids);

    if (error) throw error;
}
export async function listCompetitorsForCompetition(competitionId: string) {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition_competitor")
        .select(`
            competitor:competitor_id (
                id, full_name, category, boat,  boat_type, membership_no, email, phone, paid_on, created_at
            )
        `)
        .eq("competition_id", competitionId)
        .order("created_at");

    if (error) throw error;

    return data.map((row: any) =>
        Array.isArray(row.competitor) ? row.competitor[0] : row.competitor
    );
}

export async function addCompetitorToCompetition(
    competitionId: string,
    competitorId: string
) {
    if (!client) throw new Error("Supabase not ready");

    const { error } = await client
        .from("competition_competitor")
        .insert({
            competition_id: competitionId,
            competitor_id: competitorId
        });

    if (error) throw error;
}
// ============================================================================
// COMPETITION RESULTS
// ============================================================================

export async function addCompetitionResult(payload: {
    competition_id: string;
    competitor_id: string;
    species_id: number;
    weight_kg?: number | null;
    length_cm?: number | null;
    time_caught?: string | null;
}) {
    if (!client) throw new Error("Supabase not configured");

    const { data, error } = await client
        .from("competition_results")
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
}
export async function listCompetitionResults(competitionId: string) {
    if (!client) throw new Error("Supabase not configured");

    // Manually join species + competitor without FK metadata
    const { data, error } = await client
        .from("competition_results")
        .select(`
            id,
            weight_kg,
            length_cm,
            time_caught,
            created_at,
            competitor_id,
            species_id
        `)
        .eq("competition_id", competitionId)
        .order("created_at", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) return [];

    // Fetch competitors + species into maps
    const cIds = [...new Set(data.map(r => r.competitor_id))];
    const sIds = [...new Set(data.map(r => r.species_id))];

    const { data: compRows } = await client
        .from("competitor")
        .select("id, full_name, category, boat, paid_on")
        .in("id", cIds);

    const { data: spRows } = await client
        .from("species")
        .select("id, name")
        .in("id", sIds);

    const compMap = new Map(compRows?.map(c => [c.id, c]));
    const spMap = new Map(spRows?.map(s => [s.id, s]));

    return data.map(row => ({
        ...row,
        competitor: compMap.get(row.competitor_id) || null,
        species: spMap.get(row.species_id) || null
    }));
}
export async function listFishJoinedForCompetition(
    competitionId: string
): Promise<FishJoined[]> {

    // 🔑 NEVER throw — always return an array
    if (!client) {
        console.warn("[API] Supabase not configured — returning empty results");
        return [];
    }

    try {
        const { data, error } = await client
            .from("competition_results")
            .select(`
                id,
                competitor_id,
                species_id,
                weight_kg,
                length_cm,
                time_caught,
                created_at
            `)
            .eq("competition_id", competitionId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[API] Failed to load competition results", error);
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        const competitorIds = [...new Set(data.map(r => r.competitor_id))];
        const speciesIds = [...new Set(data.map(r => r.species_id))];

        const { data: compRows } = await client
            .from("competitor")
            .select("id, full_name, category, boat, paid_on")
            .in("id", competitorIds);

        const { data: spRows } = await client
            .from("species")
            .select("id, name")
            .in("id", speciesIds);

        const compMap = new Map(compRows?.map(c => [c.id, c]));
        const spMap = new Map(spRows?.map(s => [s.id, s]));

        return data.map(row => ({
            id: row.id,
            weight_kg: row.weight_kg,
            length_cm: row.length_cm,
            time_caught: row.time_caught,
            created_at: row.created_at,
            competitor: compMap.get(row.competitor_id) || null,
            species: spMap.get(row.species_id) || null
        }));
    } catch (err) {
        console.error("[API] Unexpected error loading competition results", err);
        return [];
    }
}
// ============================================================================
// SPONSORS
// ============================================================================

export type Sponsor = {
    id: string;
    name: string;
    logo_url?: string | null;
    website_url?: string | null;
    sponsor_group_id?: string | null;
    sponsor_level_id?: string | null;
    created_at?: string;
};

export async function listSponsors(): Promise<Sponsor[]> {
    if (!client) return [];

    const { data, error } = await client
        .from("sponsors")
        .select(`
            id,
            name,
            logo_url,
            website_url,
            sponsor_group_id,
            sponsor_level_id,
            created_at
        `)
        .order("name");

    if (error) throw error;
    return data || [];
}

export async function createSponsor(payload: {
    name: string;
    logo_url?: string | null;
    website_url?: string | null;
    sponsor_group_id?: string | null;
    sponsor_level_id?: string | null;
}): Promise<Sponsor> {
    if (!client) throw new Error("Supabase not configured");

    const { data, error } = await client
        .from("sponsors")
        .insert({
            name: payload.name.trim(),
            logo_url: payload.logo_url ?? null,
            website_url: payload.website_url ?? null,
            sponsor_group_id: payload.sponsor_group_id ?? null,
            sponsor_level_id: payload.sponsor_level_id ?? null
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateSponsor(
    id: string,
    patch: {
        name?: string;
        logo_url?: string | null;
        website_url?: string | null;
        sponsor_group_id?: string | null;
        sponsor_level_id?: string | null;
    }
): Promise<Sponsor> {
    if (!client) throw new Error("Supabase not configured");

    const update: any = {};

    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.logo_url !== undefined) update.logo_url = patch.logo_url;
    if (patch.website_url !== undefined) update.website_url = patch.website_url;
    if (patch.sponsor_group_id !== undefined)
        update.sponsor_group_id = patch.sponsor_group_id;
    if (patch.sponsor_level_id !== undefined)
        update.sponsor_level_id = patch.sponsor_level_id;

    const { data, error } = await client
        .from("sponsors")
        .update(update)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteSponsor(id: string): Promise<void> {
    if (!client) throw new Error("Supabase not configured");

    const { error } = await client
        .from("sponsors")
        .delete()
        .eq("id", id);

    if (error) throw error;
}

// ============================================================================
// BOATS — bulk update helpers
// ============================================================================

export async function updateBoatForCompetition(
    competitionId: string,
    oldBoatName: string,
    patch: {
        boat: string;
        boat_type: BoatType;
    }
): Promise<void> {
    if (!client) throw new Error("Supabase not ready");

    // 1. Get competitor IDs for this competition
    const { data: links, error: linkErr } = await client
        .from("competition_competitor")
        .select("competitor_id")
        .eq("competition_id", competitionId);

    if (linkErr) throw linkErr;
    if (!links || links.length === 0) return;

    const competitorIds = links.map(l => l.competitor_id);

    // 2. Bulk update competitors on this boat
    const { error } = await client
        .from("competitor")
        .update({
            boat: patch.boat.trim(),
            boat_type: patch.boat_type
        })
        .eq("boat", oldBoatName)
        .in("id", competitorIds);

    if (error) throw error;
}




// ============================================================================
// END OF FILE
// ============================================================================
