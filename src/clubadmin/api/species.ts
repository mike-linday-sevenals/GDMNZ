// ============================================================================
// File: species.ts
// Path: src/clubadmin/api/species.ts
// Description:
// Club-admin scoped Species & Fish Type API
// - Global species lookups
// - Competition-type → fish-type resolution
// - Competition ↔ species persistence
// ============================================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Species } from "@/types";

// ============================================================================
// SUPABASE INIT (mirrors competitions.ts intentionally)
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
// TYPES
// ============================================================================

export type CompetitionSpeciesRow = {
    id: string;
    species: Species;
};

export type FishType = {
    fish_type_id: string;
    name: string;
};

// ============================================================================
// GLOBAL SPECIES
// ============================================================================

/**
 * Returns all active species.
 * NOTE: This is intentionally minimal and mirrors existing behaviour.
 * Extended filtering should use listSpeciesByFishTypes().
 */
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
            species_category:species_category_id (
                id,
                name
            )
        `)
        .order("name");

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
        ...row,
        species_category: Array.isArray(row.species_category)
            ? row.species_category[0]
            : row.species_category,
    }));
}


// ============================================================================
// COMPETITION TYPE → FISH TYPE
// ============================================================================

/**
 * Returns the fish types allowed for a given competition type.
 * This is driven by competition_type_fish_type.
 */
export async function listFishTypesForCompetitionType(
    competitionTypeId: string
): Promise<FishType[]> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition_type_fish_type")
        .select(`
            fish_type:fish_type_id (
                fish_type_id,
                name
            )
        `)
        .eq("competition_type_id", competitionTypeId);

    if (error) throw error;

    return (data ?? []).map((row: any) =>
        Array.isArray(row.fish_type)
            ? row.fish_type[0]
            : row.fish_type
    );
}

// ============================================================================
// SPECIES FILTERED BY FISH TYPE
// ============================================================================

/**
 * Returns species filtered by one or more fish types.
 * Used for discipline-based configuration (Game / Sport / etc).
 */
export async function listSpeciesByFishTypes(
    fishTypeIds: string[]
): Promise<Species[]> {
    if (!client) throw new Error("Supabase not ready");
    if (!fishTypeIds.length) return [];

    const { data, error } = await client
        .from("species")
        .select(`
            id,
            name,
            is_measure,
            fish_type_id,
            species_category_id,
            species_category:species_category_id (
                species_category_id,
                name
            )
        `)
        .in("fish_type_id", fishTypeIds)
        .eq("is_active", true)
        .order("name");

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
        ...row,
        species_category: Array.isArray(row.species_category)
            ? row.species_category[0]
            : row.species_category,
    }));
}


// ============================================================================
// COMPETITION ↔ SPECIES (PERSISTENCE)
// ============================================================================

/**
 * Returns the species currently configured for a competition.
 * NOTE: organisationId is accepted for signature parity, but not used yet.
 */
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

/**
 * Replaces all species for a competition.
 * Safe, idempotent, and mirrors existing behaviour in competitions.ts.
 */
export async function saveCompetitionSpecies(
    organisationId: string,
    competitionId: string,
    speciesIds: number[]
) {
    if (!client) throw new Error("Supabase not ready");

    // Clear existing species
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
// END OF FILE
// ============================================================================
