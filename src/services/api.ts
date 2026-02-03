// ============================================================================
//  src/services/api.ts — FINAL FULLY-WORKING VERSION
// ============================================================================

import type {
    Competition,
    Competitor,
    FishJoined,
    Settings,
    Species,
    JoinBoatPayload,
    JoinBoatResult
} from "@/types";
import { DEFAULT_SETTINGS, DEFAULT_SPECIES } from "@/utils";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Add this re-export so callers can import the types from "@/services/api".
export type { JoinBoatPayload, JoinBoatResult } from "@/types";

export type BoatType = "Launch" | "Trailer" | "Charter";
export type PersonCategory = "adult" | "junior" | "senior" | "";

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

    const patch: Record<string, any> = {};
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

export async function listFishTypes(): Promise<{ id: string; name: string }[]> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("fish_type")
        .select("fish_type_id, name")
        .eq("is_active", true)
        .order("name");

    if (error) throw error;

    return (data ?? []).map(row => ({
        id: row.fish_type_id,
        name: row.name,
    }));
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

    // 1️⃣ Verify competition belongs to this organisation
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("competition_id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) return [];

    // 2️⃣ Load species for this competition
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

    // 3️⃣ Normalise Supabase join shape
    return (data ?? []).map((row: any) => ({
        id: row.id,
        species: Array.isArray(row.species)
            ? row.species[0]
            : row.species
    }));
}

// ============================================================================
// COMPETITIONS (ORG-SCOPED)
// ============================================================================

export async function listCompetitions(organisationId?: string) {
    if (!client) return [];
    if (!organisationId) return [];

    const { data, error } = await client
        .from("competition_organisation")
        .select(`
            competition:competition_id (
                id,
                name,
                starts_at,
                ends_at,
                competition_type:competition_type_id (
                    code
                )
            )
        `)
        .eq("organisation_id", organisationId)
        .order("competition(starts_at)", { ascending: true });

    if (error) throw error;

    return (data || [])
        .map((row: any) => {
            const comp = Array.isArray(row.competition)
                ? row.competition[0]
                : row.competition;

            if (!comp) return null;

            const ct = Array.isArray(comp.competition_type)
                ? comp.competition_type[0]
                : comp.competition_type;

            return {
                id: comp.id,
                name: comp.name,
                starts_at: comp.starts_at,
                ends_at: comp.ends_at,
                competition_type_code: ct?.code ?? "mixed",
            };
        })
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
    if (!organisationId) throw new Error("Organisation ID is required");

    const { data, error } = await client
        .from("competition_organisation")
        .select(`
            competition:competition_id (
                id,
                name,
                starts_at,
                ends_at,
                public_results_slug,
                briefing_required,
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
        public_results_slug: comp.public_results_slug ?? null,
        briefing_required: !!comp.briefing_required,
        comp_mode: compMode ?? null,
        prize_mode: prizeMode ?? null,
        comp_mode_id: compMode?.id ?? null,
        prize_mode_id: prizeMode?.id ?? null,
    };
}

// ============================================================================
// PRIZES
// ============================================================================

export async function listPrizesForCompetition(
    organisationId: string,
    competitionId: string
) {
    if (!client) return [];

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

    const competition: any = Array.isArray(compLink.competition)
        ? compLink.competition[0]
        : compLink.competition;

    const prizeMode: string | null =
        Array.isArray(competition.prize_mode)
            ? competition.prize_mode[0]?.name ?? null
            : competition.prize_mode?.name ?? null;

    const { data: prizes, error } = await client
        .from("prize")
        .select("*")
        .eq("competition_id", competitionId)
        .eq("active", true);

    if (error) throw error;
    if (!prizes || prizes.length === 0) return [];

    if (prizeMode !== "split") {
        return prizes;
    }

    const hasSplitPrizes = prizes.some(
        (p: any) => p.for_category === "junior" || p.for_category === "adult"
    );

    if (hasSplitPrizes) {
        return prizes;
    }

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

// ============================================================================
// COMPETITION SPECIES
// ============================================================================

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

// ============================================================================
// COMPETITION UPDATE
// ============================================================================

export async function updateCompetition(
    organisationId: string,
    competitionId: string,
    patch: any
) {
    if (!client) throw new Error("Supabase not ready");

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

    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) return [];

    const { data, error } = await client
        .from("competition_day")
        .select("*")
        .eq("competition_id", competitionId)
        .order("day_date");

    if (error) throw error;

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

    const { data: existing } = await client
        .from("competition_day")
        .select("day_date")
        .eq("competition_id", competitionId)
        .order("day_date");

    let newDate = new Date().toISOString().slice(0, 10);

    if (existing && existing.length) {
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

export async function getCompetitionBriefing(
    organisationId: string,
    competitionId: string
) {
    if (!client) throw new Error("Supabase not ready");

    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) return null;

    const { data, error } = await client
        .from("competition_briefing")
        .select("*")
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    return data ?? null;
}

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
    if (!client) {
        const list = loadLocal<any[]>("competition_fees", []);
        return list.find(x => x.competition_id === competitionId) || null;
    }

    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) return null;

    const { data, error } = await client
        .from("competition_fees")
        .select("*")
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

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

export async function fetchCompetitionFees(
    organisationId: string,
    competitionId: string
) {
    return getCompetitionFees(organisationId, competitionId);
}

export async function upsertCompetitionFees(
    organisationId: string,
    competitionId: string,
    patch: any
) {
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
// COMPETITORS (LIST)
// ============================================================================

export async function listCompetitorsForCompetition(
    competitionId: string
): Promise<{
    id: string;
    registration_date: string;
    created_at: string;
    full_name: string;
    category: "adult" | "junior";
    paid_on: string | null;
    boat: string | null;
    membership_no: string | null;
    boat_type: "Launch" | "Trailer" | "Charter" | null;
    angler_number: string | null;
    boat_number: string | null;
}[]> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competitor")
        .select(`
            id,
            registration_date,
            created_at,
            full_name,
            category,
            paid_on,
            boat,
            membership_no,
            boat_type,
            angler_number,
            boat_number,
            competition_competitor!inner (
                competition_id
            )
        `)
        .eq("competition_competitor.competition_id", competitionId)
        .order("angler_number", { ascending: true });

    if (error) throw error;

    return data ?? [];
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

    const compMap = new Map((compRows ?? []).map(c => [c.id, c]));
    const spMap = new Map((spRows ?? []).map(s => [s.id, s]));

    return data.map(row => ({
        ...row,
        competitor: compMap.get(row.competitor_id) || null,
        species: spMap.get(row.species_id) || null
    }));
}

export async function listFishJoinedForCompetition(
    competitionId: string
): Promise<FishJoined[]> {
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

        const compMap = new Map((compRows ?? []).map(c => [c.id, c]));
        const spMap = new Map((spRows ?? []).map(s => [s.id, s]));

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

    const update: Record<string, any> = {};

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
// BOATS — BULK UPDATE HELPERS
// ============================================================================

export async function updateBoatForCompetition(
    competitionId: string,
    boatNumber: string,
    patch: {
        boat: string;
        boat_type?: BoatType;
    }
): Promise<void> {
    if (!client) throw new Error("Supabase not ready");

    const { data: links, error: linkErr } = await client
        .from("competition_competitor")
        .select("competitor_id")
        .eq("competition_id", competitionId);

    if (linkErr) throw linkErr;
    if (!links || links.length === 0) return;

    const competitorIds = links.map(l => l.competitor_id);

    const { error: updateErr } = await client
        .from("competitor")
        .update({
            boat: patch.boat.trim(),
            ...(patch.boat_type ? { boat_type: patch.boat_type } : {}),
        })
        .eq("boat_number", boatNumber)
        .in("id", competitorIds);

    if (updateErr) throw updateErr;
}

// ============================================================================
// COMPETITORS (CRUD)
// ============================================================================

export async function addCompetitor(payload: {
    full_name: string;
    category: "adult" | "junior";
    paid_on: string | null;
    boat: string;
    membership_no: string;
    boat_type?: "Launch" | "Trailer" | "Charter";
    registration_date?: string;
}): Promise<{ id: string }> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competitor")
        .insert({
            full_name: payload.full_name.trim(),
            category: payload.category,
            paid_on: payload.paid_on,
            boat: payload.boat.trim(),
            membership_no: payload.membership_no.trim(),
            boat_type: payload.boat_type ?? null,
            registration_date:
                payload.registration_date ??
                new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();

    if (error) throw error;
    return data;
}

export async function addCompetitorToCompetition(
    competitionId: string,
    competitorId: string
): Promise<void> {
    if (!client) throw new Error("Supabase not ready");

    const { error } = await client
        .from("competition_competitor")
        .insert({
            competition_id: competitionId,
            competitor_id: competitorId
        });

    if (error) throw error;
}

export async function updateCompetitor(
    id: string | number,
    patch: Partial<{
        full_name: string;
        category: "adult" | "junior";
        paid_on: string | null;
        membership_no: string;
        registration_date: string;
    }>
) {
    if (!client) throw new Error("Supabase not ready");

    const update: Record<string, any> = {};

    if (patch.full_name !== undefined)
        update.full_name = patch.full_name.trim();

    if (patch.category !== undefined)
        update.category = patch.category;

    if (patch.membership_no !== undefined)
        update.membership_no = patch.membership_no.trim();

    if (patch.paid_on !== undefined)
        update.paid_on = patch.paid_on;

    if (patch.registration_date !== undefined)
        update.registration_date = patch.registration_date;

    const { data, error } = await client
        .from("competitor")
        .update(update)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================================
// PUBLIC — COMPETITIONS & ORGS
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
// PUBLIC — COMPETITION LOOKUP
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

export async function getCompetitionBySlug(
    slug: string
): Promise<{ id: string; name: string } | null> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition")
        .select("id, name")
        .eq("public_results_slug", slug)
        .maybeSingle();

    if (error) throw error;
    return data ?? null;
}

// ============================================================================
// RPC: REGISTER / JOIN BOAT
// ============================================================================

export type RegisterBoatPayload = {
    competition_id: string;
    boat_name: string;
    boat_type?: BoatType | null;
    join_code?: string | null;
    skipper: {
        full_name: string;
        membership_no?: string | null;
        email?: string | null;
        phone?: string | null;
        category: PersonCategory;
    };
    team: {
        full_name: string;
        membership_no?: string | null;
        email?: string | null;
        phone?: string | null;
        category: PersonCategory;
    }[];
};

export type RegisterBoatResult = {
    boat_number: string;
    anglers: {
        competitor_id: string;
        full_name: string;
        angler_number: string;
    }[];
};

export async function registerBoatWithTeam(
    payload: RegisterBoatPayload
): Promise<RegisterBoatResult> {
    if (!client) throw new Error("Supabase not ready");

    const rpcPayload = {
        p_competition_id: payload.competition_id,
        p_boat_name: payload.boat_name,
        p_boat_type: payload.boat_type ?? null,
        p_join_code: payload.join_code ?? null,
        p_skipper: payload.skipper,
        p_team: payload.team ?? [],
    };

    console.debug("[API] register_boat_with_team payload", rpcPayload);

    const { data, error } = await client.rpc("register_boat_with_team", rpcPayload);

    if (error) throw error;
    if (!data) throw new Error("No data returned from register_boat_with_team");

    return data as RegisterBoatResult;
}

export async function joinBoat(
    payload: JoinBoatPayload
): Promise<JoinBoatResult> {
    if (!client) throw new Error("Supabase not ready");

    const rpcPayload = {
        p_competition_id: payload.competition_id,
        p_boat_number: payload.boat_number,
        p_boat_name: payload.boat_name ?? null,
        p_join_code: payload.join_code ?? null,
        p_member: payload.member,
    };

    console.debug("[API] join_boat payload", rpcPayload);

    const { data, error } = await client.rpc("join_boat", rpcPayload);

    if (error) throw error;
    if (!data) throw new Error("No data returned from join_boat");

    return data as JoinBoatResult;
}

// ============================================================================
// END OF FILE
// ============================================================================