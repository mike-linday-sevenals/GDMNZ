// ============================================================================
//  src/services/api.ts — FINAL FULLY-WORKING VERSION
// ============================================================================

import type {
    Competition,
    Competitor,
    FishJoined,
    Settings,
    Species
} from "@/types";
import { DEFAULT_SETTINGS, DEFAULT_SPECIES, STORE_KEYS } from "@/utils";
import { createClient, SupabaseClient } from "@supabase/supabase-js";



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

export async function fetchCompetitionFees(
    organisationId: string,
    competitionId: string
) {
    return await getCompetitionFees(organisationId, competitionId);
}


export type BoatType = "Launch" | "Trailer" | "Charter";


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
    return data ?? [];
}

export async function listPrizeModes() {
    if (!client) return [];

    const { data, error } = await client
        .from("prize_mode")
        .select("id, name")
        .order("name");

    if (error) throw error;
    return data ?? [];
}


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
        })) as Species[];
    }

    const { data, error } = await client
        .from("species")
        .select("id, name, is_measure")
        .order("name");

    if (error) throw error;
    return data as Species[];
}

export type CompetitionSpeciesRow = {
    id: string;
    species: Species;
};

export async function listCompetitionSpecies(
    organisationId: string,
    competitionId: string
): Promise<CompetitionSpeciesRow[]> {
    if (!client) throw new Error("Supabase not ready");

    /* ------------------------------------------------------------------
       1️⃣ Verify competition belongs to this organisation
       ------------------------------------------------------------------ */
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("competition_id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) return [];

    /* ------------------------------------------------------------------
       2️⃣ Load species for this competition
       ------------------------------------------------------------------ */
    const { data, error } = await client
        .from("competition_species")
        .select(`
            id,
            species:species_id (
                id,
                name,
                is_measure
            )
        `)
        .eq("competition_id", competitionId)
        .order("species_id");

    if (error) throw error;

    /* ------------------------------------------------------------------
       3️⃣ Normalise Supabase join shape
       ------------------------------------------------------------------ */
    return (data ?? []).map((row: any) => ({
        id: row.id,
        species: Array.isArray(row.species)
            ? row.species[0]
            : row.species
    }));
}



export async function listCompetitions(organisationId?: string) {
    if (!client) return [];

    // 🔐 If no organisation provided, return nothing (safety)
    if (!organisationId) return [];

    const { data, error } = await client
        .from("competition_organisation")
        .select(`
            competition:competition_id (
                id,
                name,
                starts_at,
                ends_at
            )
        `)
        .eq("organisation_id", organisationId)
        .order("competition(starts_at)", { ascending: true });

    if (error) throw error;

    return (data || [])
        .map((row: any) =>
            Array.isArray(row.competition)
                ? row.competition[0]
                : row.competition
        )
        .filter(Boolean);
}


export async function addCompetition(
    organisationId: string,
    payload: {
        name: string;
        starts_at: string;
        ends_at: string;
    }
) {
    if (!client) throw new Error("Supabase not configured.");

    // 1️⃣ Create the competition
    const { data: competition, error: compErr } = await client
        .from("competition")
        .insert({
            name: payload.name,
            starts_at: payload.starts_at,
            ends_at: payload.ends_at
        })
        .select()
        .single();

    if (compErr) throw compErr;

    // 2️⃣ Link competition to organisation
    const { error: linkErr } = await client
        .from("competition_organisation")
        .insert({
            competition_id: competition.id,
            organisation_id: organisationId,
            is_primary: true,
            role: "HOST"
        });

    if (linkErr) throw linkErr;

    return competition;
}



export async function getCompetition(
    organisationId: string | null,
    competitionId: string
): Promise<Competition> {
    if (!client) throw new Error("Supabase not ready");

    if (!organisationId) {
        throw new Error("Organisation ID is required");
    }

    const { data, error } = await client
        .from("competition_organisation")
        .select(`
            competition:competition_id (
                id,
                name,
                starts_at,
                ends_at,
                comp_mode: comp_mode_id ( id, name ),
                prize_mode: prize_mode_id ( id, name )
            )
        `)
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (error) throw error;
    if (!data || !data.competition) {
        throw new Error("Competition not found for this organisation");
    }

    const comp = Array.isArray(data.competition)
        ? data.competition[0]
        : data.competition;

    const compMode = Array.isArray(comp.comp_mode)
        ? comp.comp_mode[0]
        : comp.comp_mode;

    const prizeMode = Array.isArray(comp.prize_mode)
        ? comp.prize_mode[0]
        : comp.prize_mode;

    return {
        id: comp.id,
        name: comp.name,
        starts_at: comp.starts_at,
        ends_at: comp.ends_at,
        comp_mode: compMode ?? null,
        prize_mode: prizeMode ?? null,
        comp_mode_id: compMode?.id ?? null,
        prize_mode_id: prizeMode?.id ?? null,
    };
}

// ============================================================================
// PRIZES
// - Backwards compatible with combined → split transition
// ============================================================================

export async function listPrizesForCompetition(
    organisationId: string,
    competitionId: string
) {
    if (!client) return [];

    /* ------------------------------------------------------------------
       1️⃣ Load competition to determine prize mode
       ------------------------------------------------------------------ */
    const { data: compLink, error: compErr } = await client
        .from("competition_organisation")
        .select(`
            competition:competition_id (
                id,
                prize_mode:prize_mode_id ( name )
            )
        `)
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (compErr) throw compErr;
    if (!compLink || !compLink.competition) return [];

    // 🔑 Normalise Supabase join shape
    const competition: any = Array.isArray(compLink.competition)
        ? compLink.competition[0]
        : compLink.competition;

    const prizeMode: string | null =
        Array.isArray(competition.prize_mode)
            ? competition.prize_mode[0]?.name ?? null
            : competition.prize_mode?.name ?? null;

    /* ------------------------------------------------------------------
       2️⃣ Load all active prizes for competition
       ------------------------------------------------------------------ */
    const { data: prizes, error } = await client
        .from("prize")
        .select("*")
        .eq("competition_id", competitionId)
        .eq("active", true);

    if (error) throw error;
    if (!prizes || prizes.length === 0) return [];

    /* ------------------------------------------------------------------
       3️⃣ If NOT split → return as-is
       ------------------------------------------------------------------ */
    if (prizeMode !== "split") {
        return prizes;
    }

    /* ------------------------------------------------------------------
       4️⃣ Detect whether split prizes already exist
       ------------------------------------------------------------------ */
    const hasSplitPrizes = prizes.some(
        (p: any) => p.for_category === "junior" || p.for_category === "adult"
    );

    if (hasSplitPrizes) {
        return prizes;
    }

    /* ------------------------------------------------------------------
       5️⃣ Fallback: duplicate combined prizes as junior + adult
       ------------------------------------------------------------------ */
    const combined = prizes.filter(
        (p: any) => p.for_category === "combined"
    );

    const junior = combined.map((p: any) => ({
        ...p,
        for_category: "junior",
        _fallback: true,
    }));

    const adult = combined.map((p: any) => ({
        ...p,
        for_category: "adult",
        _fallback: true,
    }));

    return [...junior, ...adult];
}



export async function saveCompetitionSpecies(
    organisationId: string,
    competitionId: string,
    speciesIds: number[]
) {
    if (!client) throw new Error("Supabase not ready");

    const { data: link, error } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (error) throw error;
    if (!link) {
        throw new Error("Competition does not belong to this organisation");
    }

    await client
        .from("competition_species")
        .delete()
        .eq("competition_id", competitionId);

    if (!speciesIds.length) return [];

    const rows = speciesIds.map(speciesId => ({
        competition_id: competitionId,
        species_id: speciesId
    }));

    const { data, error: insertErr } = await client
        .from("competition_species")
        .insert(rows)
        .select();

    if (insertErr) throw insertErr;
    return data ?? [];
}




export async function updateCompetition(
    organisationId: string,
    competitionId: string,
    patch: any
) {
    if (!client) throw new Error("Supabase not ready");

    /* ------------------------------------------------------------------
       1️⃣ Verify competition belongs to this organisation
       ------------------------------------------------------------------ */
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) {
        throw new Error("Competition does not belong to this organisation");
    }

    /* ------------------------------------------------------------------
       2️⃣ Update competition
       ------------------------------------------------------------------ */
    const { data, error } = await client
        .from("competition")
        .update({
            name: patch.name,
            starts_at: patch.starts_at,
            ends_at: patch.ends_at,
            comp_mode_id: patch.comp_mode_id ?? null,
            prize_mode_id: patch.prize_mode_id ?? null
        })
        .eq("id", competitionId)
        .select()
        .single();

    if (error) throw error;
    return data;
}


// ============================================================================
// COMPETITION DAYS
// ============================================================================

export async function listCompetitionDays(
    organisationId: string,
    competitionId: string
) {
    if (!client) throw new Error("Supabase not ready");

    /* ------------------------------------------------------------------
       1️⃣ Verify competition belongs to this organisation
       ------------------------------------------------------------------ */
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) return []; // not this organisation → no data

    /* ------------------------------------------------------------------
       2️⃣ Load competition days
       ------------------------------------------------------------------ */
    let { data, error } = await client
        .from("competition_day")
        .select("*")
        .eq("competition_id", competitionId)
        .order("day_date");

    if (error) throw error;

    /* ------------------------------------------------------------------
       3️⃣ Auto-create Day 1 if none exist
       ------------------------------------------------------------------ */
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
// - Exactly ONE briefing per competition
// - Read NEVER creates rows
// - Write ALWAYS uses UPSERT
// ============================================================================

/* ------------------------------------------------------------------
   READ: Get competition briefing (read-only)
   ------------------------------------------------------------------ */
export async function getCompetitionBriefing(
    organisationId: string,
    competitionId: string
) {
    if (!client) throw new Error("Supabase not ready");

    // 🔐 Verify competition belongs to this organisation
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) return null;

    // 🔍 Fetch existing briefing (if any)
    const { data, error } = await client
        .from("competition_briefing")
        .select("*")
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    // ✅ IMPORTANT: no insert here
    return data ?? null;
}

/* ------------------------------------------------------------------
   WRITE: Upsert competition briefing (create or update)
   ------------------------------------------------------------------ */
export async function upsertCompetitionBriefing(
    organisationId: string,
    competitionId: string,
    patch: {
        briefing_date?: string | null;
        briefing_time?: string | null;
        location?: string | null;
        notes?: string | null;
    }
) {
    if (!client) throw new Error("Supabase not ready");

    // 🔐 Verify competition belongs to this organisation
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) {
        throw new Error("Competition does not belong to this organisation");
    }

    // 💾 Atomic upsert (ONE row per competition)
    const { data, error } = await client
        .from("competition_briefing")
        .upsert(
            {
                competition_id: competitionId,
                ...patch,
            },
            { onConflict: "competition_id" }
        )
        .select()
        .single();

    if (error) throw error;
    return data;
}


// ============================================================================
// COMPETITION FEES
// ============================================================================

export async function getCompetitionFees(
    organisationId: string,
    competitionId: string
) {
    /* ------------------------------------------------------------------
       LOCAL FALLBACK
       ------------------------------------------------------------------ */
    if (!client) {
        const list = loadLocal<any[]>("competition_fees", []);
        return list.find(x => x.competition_id === competitionId) || null;
    }

    /* ------------------------------------------------------------------
       1️⃣ Verify competition belongs to this organisation
       ------------------------------------------------------------------ */
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) return null;

    /* ------------------------------------------------------------------
       2️⃣ Load existing fees (if any)
       ------------------------------------------------------------------ */
    let { data, error } = await client
        .from("competition_fees")
        .select("*")
        .eq("competition_id", competitionId)
        .maybeSingle();

    // Ignore "no row" error
    if (error && error.code !== "PGRST116") throw error;

    /* ------------------------------------------------------------------
       3️⃣ Auto-create default fee row if missing
       ------------------------------------------------------------------ */
    if (!data) {
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

export async function upsertCompetitionFees(
    organisationId: string,
    competitionId: string,
    patch: any
) {
    /* ------------------------------------------------------------------
       LOCAL FALLBACK
       ------------------------------------------------------------------ */
    if (!client) {
        const list = loadLocal<any[]>("competition_fees", []);
        const existing = list.find(x => x.competition_id === competitionId);

        if (existing) {
            const updated = { ...existing, ...patch };
            saveLocal(
                "competition_fees",
                list.map(x =>
                    x.competition_id === competitionId ? updated : x
                )
            );
            return updated;
        }

        const newRow = { id: uid(), competition_id: competitionId, ...patch };
        saveLocal("competition_fees", [...list, newRow]);
        return newRow;
    }

    /* ------------------------------------------------------------------
       1️⃣ Verify competition belongs to this organisation
       ------------------------------------------------------------------ */
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) {
        throw new Error("Competition does not belong to this organisation");
    }

    /* ------------------------------------------------------------------
       2️⃣ Update or insert fees
       ------------------------------------------------------------------ */
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
// PUBLIC — competitions (no org scope)
// ============================================================================

export async function listPublicCompetitions() {
    if (!client) return [];

    const { data, error } = await client
        .from("competition")
        .select("id, name, starts_at, public_results_slug")
        .order("starts_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

// ============================================================================
// PUBLIC — organisations (clubs)
// ============================================================================

export async function listPublicOrganisations() {
    if (!client) return [];

    const { data, error } = await client
        .from("organisation")
        .select("organisation_id, organisation_name, club_code")
        .order("organisation_name");

    if (error) throw error;
    return data || [];
}

// ============================================================================
// PUBLIC — competition lookup by public slug
// ============================================================================

export type PublicCompetition = {
    id: string;
    name: string;
    public_results_slug: string;
    prize_mode: {
        id: string;
        name: "combined" | "split";
    } | null;
};

export async function getCompetitionByPublicSlug(
    slug: string
): Promise<PublicCompetition | null> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition")
        .select(`
            id,
            name,
            public_results_slug,
            prize_mode:prize_mode_id (
                id,
                name
            )
        `)
        .eq("public_results_slug", slug)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const prizeMode =
        Array.isArray(data.prize_mode)
            ? data.prize_mode[0] ?? null
            : data.prize_mode ?? null;

    return {
        id: data.id,
        name: data.name,
        public_results_slug: data.public_results_slug,
        prize_mode: prizeMode
    };
}


// ============================================================================
// END OF FILE
// ============================================================================
