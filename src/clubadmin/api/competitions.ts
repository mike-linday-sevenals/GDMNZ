// ============================================================================
// File: competitions.ts
// Path: src/clubadmin/api/competitions.ts
// Description:
// Club-admin scoped Competition API
// ============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Competition, CompetitionDay, Species } from "@/types";

// ============================================================================
// LOCAL API TYPES
// ============================================================================

export type CompetitionListItem = {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
};

export type CompetitionTypeRow = {
    id: string;
    name: string;
    description: string | null;
};

export type CompModeRow = {
    id: string;
    name: string;
};

export type PrizeModeRow = {
    id: string;
    name: string;
};

export type CompetitionSpeciesRow = {
    id: string;
    species: Species;
};

// ============================================================================
// SUPABASE INIT
// ============================================================================

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

function safeUrl(u?: string | null) {
    if (!u || typeof u !== "string") return null;
    try {
        return new URL(u.trim()).toString();
    } catch {
        return null;
    }
}

const url = safeUrl(rawUrl);
const key = rawKey?.trim() || null;

export const client: SupabaseClient | null =
    url && key ? createClient(url, key) : null;

// ============================================================================
// HELPERS
// ============================================================================

function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

async function getOrganisationClubCode(organisationId: string): Promise<string> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("organisation")
        .select("club_code")
        .eq("organisation_id", organisationId)
        .maybeSingle();

    if (error) throw error;
    if (!data?.club_code) throw new Error("Club code missing");

    return data.club_code.toLowerCase();
}

export async function canDeleteCompetition(
    competitionId: string
): Promise<boolean> {
    if (!client) throw new Error("Supabase not ready");

    const { count, error } = await client
        .from("competition_competitor")
        .select("*", { count: "exact", head: true })
        .eq("competition_id", competitionId);

    if (error) throw error;

    return (count ?? 0) === 0;
}


// ============================================================================
// COMPETITIONS
// ============================================================================

export async function listCompetitions(
    organisationId: string
): Promise<CompetitionListItem[]> {
    if (!client) return [];

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
        .eq("is_primary", true)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => {
        const c = Array.isArray(row.competition)
            ? row.competition[0]
            : row.competition;

        return {
            id: c.id,
            name: c.name,
            starts_at: c.starts_at,
            ends_at: c.ends_at,
        };
    });
}

export async function addCompetition(
    organisationId: string,
    payload: {
        name: string;
        starts_at: string;
        ends_at: string;
        competition_type_id: string | null;
        comp_mode_id: string | null;
        prize_mode_id: string | null;
    }
) {
    if (!client) throw new Error("Supabase not configured");

    const clubCode = await getOrganisationClubCode(organisationId);
    const slug = `${clubCode}-${slugify(payload.name)}`;

    const { data: competition, error } = await client
        .from("competition")
        .insert({
            ...payload,
            public_results_slug: slug,
        })
        .select()
        .single();

    if (error) throw error;

    await client.from("competition_organisation").insert({
        competition_id: competition.id,
        organisation_id: organisationId,
        is_primary: true,
        role: "HOST",
    });

    return competition;
}

export async function getCompetition(
    organisationId: string,
    competitionId: string
): Promise<Competition> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition_organisation")
        .select(`
            competition:competition_id (
                id,
                name,
                starts_at,
                ends_at,
                competition_type:competition_type_id ( id, name, description ),
                comp_mode:comp_mode_id ( id, name ),
                prize_mode:prize_mode_id ( id, name )
            )
        `)
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (error) throw error;
    if (!data?.competition) throw new Error("Competition not found");

    const c = Array.isArray(data.competition)
        ? data.competition[0]
        : data.competition;

    const competitionType = Array.isArray(c.competition_type)
        ? c.competition_type[0]
        : c.competition_type;

    const compMode = Array.isArray(c.comp_mode)
        ? c.comp_mode[0]
        : c.comp_mode;

    const prizeMode = Array.isArray(c.prize_mode)
        ? c.prize_mode[0]
        : c.prize_mode;

    return {
        id: c.id,
        name: c.name,
        starts_at: c.starts_at,
        ends_at: c.ends_at,

        competition_type: competitionType ?? null,
        comp_mode: compMode ?? null,
        prize_mode: prizeMode ?? null,

        competition_type_id: competitionType?.id ?? null,
        comp_mode_id: compMode?.id ?? null,
        prize_mode_id: prizeMode?.id ?? null,
    };
}

export async function updateCompetition(
    organisationId: string,
    competitionId: string,
    patch: Partial<Competition>
) {
    if (!client) throw new Error("Supabase not ready");

    const { error } = await client
        .from("competition")
        .update({
            name: patch.name,
            starts_at: patch.starts_at,
            ends_at: patch.ends_at,
            competition_type_id: patch.competition_type_id ?? null,
            comp_mode_id: patch.comp_mode_id ?? null,
            prize_mode_id: patch.prize_mode_id ?? null,
        })
        .eq("id", competitionId);

    if (error) throw error;
}

export async function deleteCompetition(
    competitionId: string
) {
    if (!client) throw new Error("Supabase not ready");

    // HARD SAFETY CHECK
    const { count } = await client
        .from("competition_competitor")
        .select("*", { count: "exact", head: true })
        .eq("competition_id", competitionId);

    if ((count ?? 0) > 0) {
        throw new Error("Competition has registrations and cannot be deleted");
    }

    await client.from("competition_day").delete().eq("competition_id", competitionId);
    await client.from("competition_species").delete().eq("competition_id", competitionId);
    await client.from("competition_division").delete().eq("competition_id", competitionId);
    await client.from("competition_briefing").delete().eq("competition_id", competitionId);
    await client.from("competition_fees").delete().eq("competition_id", competitionId);
    await client.from("prize").delete().eq("competition_id", competitionId);
    await client.from("competition_organisation").delete().eq("competition_id", competitionId);
    await client.from("competition").delete().eq("id", competitionId);
}


// ============================================================================
// LOOKUPS
// ============================================================================

export async function listCompetitionTypes(): Promise<CompetitionTypeRow[]> {
    if (!client) return [];
    const { data, error } = await client
        .from("competition_type")
        .select("id, name, description")
        .order("name");
    if (error) throw error;
    return data ?? [];
}

export async function listCompModes(): Promise<CompModeRow[]> {
    if (!client) return [];
    const { data, error } = await client
        .from("comp_mode")
        .select("id, name")
        .order("name");
    if (error) throw error;
    return data ?? [];
}

export async function listPrizeModes(): Promise<PrizeModeRow[]> {
    if (!client) return [];
    const { data, error } = await client
        .from("prize_mode")
        .select("id, name")
        .order("name");
    if (error) throw error;
    return data ?? [];
}

// ============================================================================
// COMPETITION DAYS
// - Preserves legacy fields
// - Guarantees at least one day
// - Supports sort_order + cutoff times
// - Safe against duplicate inserts / reloads
// ============================================================================

export async function listCompetitionDays(
    organisationId: string,
    competitionId: string
): Promise<CompetitionDay[]> {
    if (!client) throw new Error("Supabase not ready");

    // 1️⃣ Load existing days first
    const { data, error } = await client
        .from("competition_day")
        .select("*")
        .eq("competition_id", competitionId)
        .order("sort_order", { ascending: true })
        .order("day_date", { ascending: true });

    if (error) throw error;

    // 2️⃣ If days already exist, return them
    if (data && data.length > 0) {
        return data;
    }

    // 3️⃣ Otherwise, attempt to create Day 1
    const today = new Date().toISOString().slice(0, 10);

    const { error: insertErr } = await client
        .from("competition_day")
        .insert({
            competition_id: competitionId,
            day_date: today,
            sort_order: 1,
            fishing_start_type: "None",
            fishing_end_type: "None",
            weighin_type: "None",
            overnight_allowed: false,
        });

    // ⛑ Ignore duplicate key errors (race / reload safety)
    if (insertErr && insertErr.code !== "23505") {
        throw insertErr;
    }

    // 4️⃣ Re-fetch after insert (or if it already existed)
    const { data: retry, error: retryErr } = await client
        .from("competition_day")
        .select("*")
        .eq("competition_id", competitionId)
        .order("sort_order", { ascending: true })
        .order("day_date", { ascending: true });

    if (retryErr) throw retryErr;

    return retry ?? [];
}

export async function addCompetitionDay(
    competitionId: string
): Promise<CompetitionDay> {
    if (!client) throw new Error("Supabase not ready");

    const { data: existing } = await client
        .from("competition_day")
        .select("day_date, sort_order")
        .eq("competition_id", competitionId)
        .order("sort_order", { ascending: true });

    let newDate = new Date().toISOString().slice(0, 10);
    let sortOrder = 1;

    if (existing && existing.length) {
        const last = existing[existing.length - 1];
        const d = new Date(last.day_date);
        d.setDate(d.getDate() + 1);
        newDate = d.toISOString().slice(0, 10);
        sortOrder = (last.sort_order ?? existing.length) + 1;
    }

    const { data, error } = await client
        .from("competition_day")
        .insert({
            competition_id: competitionId,
            day_date: newDate,
            sort_order: sortOrder,
            fishing_start_type: "None",
            fishing_end_type: "None",
            weighin_type: "None",
            overnight_allowed: false,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateCompetitionDay(
    dayId: string,
    patch: Partial<CompetitionDay>
) {
    if (!client) throw new Error("Supabase not ready");

    const { error } = await client
        .from("competition_day")
        .update({
            day_date: patch.day_date,
            sort_order: patch.sort_order,
            fishing_start_type: patch.fishing_start_type,
            fishing_start_time: patch.fishing_start_time,
            fishing_end_type: patch.fishing_end_type,
            fishing_end_time: patch.fishing_end_time,
            overnight_allowed: patch.overnight_allowed,
            weighin_type: patch.weighin_type,
            weighin_start_time: patch.weighin_start_time,
            weighin_end_time: patch.weighin_end_time,
            weighin_cutoff_time: patch.weighin_cutoff_time,
            notes: patch.notes,
        })
        .eq("id", dayId);

    if (error) throw error;
}

export async function deleteCompetitionDay(dayId: string) {
    if (!client) return;

    const { error } = await client
        .from("competition_day")
        .delete()
        .eq("id", dayId);

    if (error) throw error;
}

// ============================================================================
// SPECIES
// ============================================================================

export async function listSpecies(): Promise<Species[]> {
    if (!client) return [];

    const { data, error } = await client
        .from("species")
        .select(`
            id,
            name,
            is_measure,
            fish_type_id,
            species_category_id,
            species_category (
                id,
                name
            )
        `)
        .order("name");

    if (error) throw error;
    return (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        is_measure: row.is_measure,
        fish_type_id: row.fish_type_id,
        species_category_id: row.species_category_id,
        species_category: Array.isArray(row.species_category)
            ? {
                species_category_id: row.species_category[0]?.id,
                name: row.species_category[0]?.name,
            }
            : {
                species_category_id: row.species_category?.id,
                name: row.species_category?.name,
            },
    }));

}


// ============================================================================
// COMPETITION SPECIES
// ============================================================================

export async function listCompetitionSpecies(
    organisationId: string,
    competitionId: string
): Promise<CompetitionSpeciesRow[]> {
    if (!client) throw new Error("Supabase not ready");

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

    return (data ?? []).map((row: any) => ({
        id: row.id,
        species: Array.isArray(row.species)
            ? row.species[0]
            : row.species,
    }));
}

export async function saveCompetitionSpecies(
    organisationId: string,
    competitionId: string,
    speciesIds: number[]
) {
    if (!client) throw new Error("Supabase not ready");

    await client
        .from("competition_species")
        .delete()
        .eq("competition_id", competitionId);

    if (!speciesIds.length) return [];

    const rows = speciesIds.map((id) => ({
        competition_id: competitionId,
        species_id: id,
    }));

    const { data, error } = await client
        .from("competition_species")
        .insert(rows)
        .select();

    if (error) throw error;
    return data ?? [];
}

// ============================================================================
// COMPETITION BRIEFING
// ============================================================================

export async function getCompetitionBriefing(
    organisationId: string,
    competitionId: string
) {
    if (!client) throw new Error("Supabase not ready");

    const { data: link } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

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

    const { data: link } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

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

export type CompetitionFees = {
    id: string;
    competition_id: string;
    earlybird_fee_adult: number | null;
    earlybird_fee_junior: number | null;
    earlybird_cutoff_date: string | null;
    full_fee_adult: number | null;
    full_fee_junior: number | null;
    nonmember_fee_adult: number | null;
    nonmember_fee_junior: number | null;
    extra?: any;
};

export async function getCompetitionFees(
    organisationId: string,
    competitionId: string
): Promise<CompetitionFees | null> {
    if (!client) throw new Error("Supabase not ready");

    const { data: link } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (!link) return null;

    let { data, error } = await client
        .from("competition_fees")
        .select("*")
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    if (!data) {
        const { data: created, error: insertErr } = await client
            .from("competition_fees")
            .insert({
                competition_id: competitionId,
            })
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
    patch: Partial<CompetitionFees>
) {
    if (!client) throw new Error("Supabase not ready");

    const { data: link } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (!link) throw new Error("Competition does not belong to organisation");

    const { data, error } = await client
        .from("competition_fees")
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
// PRIZES (REQUIRED FOR PRIZE GIVING)
// ============================================================================

export async function listPrizesForCompetition(
    organisationId: string,
    competitionId: string
) {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("prize")
        .select(`
            id,
            competition_id,
            species_id,
            rank,
            label,
            sponsor,
            division_id,
            division:division_id (
                id,
                code,
                name,
                sort_order,
                is_default
            )
        `)
        .eq("competition_id", competitionId)
        .order("rank");

    if (error) throw error;
    return data ?? [];
}

// ============================================================================
// END OF FILE
// ============================================================================
