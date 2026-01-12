// ============================================================================
// File: species.ts
// Path: src/clubadmin/api/species.ts
// Description:
// Club-admin scoped Species & Fish Type API
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

export type FishType = {
    fish_type_id: string;
    name: string;
};

// Shape required by PrizeWizardModal
export type CompetitionSpecies = {
    id: number;
    name: string;

    fish_type_id: string;
    fish_type_name: string; // ✅ IMPORTANT: human-readable label

    species_category_id: string | null;
    species_category: { name: string } | null;
};

// ============================================================================
// GLOBAL SPECIES
// ============================================================================

/**
 * Returns all active species with fish type + category.
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
                species_category_id,
                name
            )
        `)
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
// COMPETITION TYPE → FISH TYPE
// ============================================================================

/**
 * Returns the fish types allowed for a given competition type.
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
// COMPETITION ↔ SPECIES (CRITICAL FOR PRIZES)
// ============================================================================

/**
 * Returns the species configured for a competition.
 *
 * IMPORTANT:
 * - Includes fish_type_id AND fish_type_name
 * - Includes species_category for grouping
 * - Shape is consumed directly by PrizeWizardModal
 */
export async function listCompetitionSpecies(
    competitionId: string
): Promise<CompetitionSpecies[]> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competition_species")
        .select(`
            species:species_id (
                id,
                name,
                fish_type_id,
                fish_type:fish_type_id (
                    fish_type_id,
                    name
                ),
                species_category_id,
                species_category:species_category_id (
                    name
                )
            )
        `)
        .eq("competition_id", competitionId);

    if (error) throw error;

    return (data ?? []).map((row: any) => {
        const s = Array.isArray(row.species)
            ? row.species[0]
            : row.species;

        const fishType = Array.isArray(s.fish_type)
            ? s.fish_type[0]
            : s.fish_type;

        return {
            id: s.id,
            name: s.name,

            fish_type_id: s.fish_type_id,
            fish_type_name: fishType?.name ?? "Unknown fish type",

            species_category_id: s.species_category_id ?? null,
            species_category: s.species_category
                ? Array.isArray(s.species_category)
                    ? s.species_category[0]
                    : s.species_category
                : null,
        };
    });
}

// ============================================================================
// SAVE COMPETITION SPECIES
// ============================================================================

/**
 * Replaces all species for a competition.
 */
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
// END OF FILE
// ============================================================================
