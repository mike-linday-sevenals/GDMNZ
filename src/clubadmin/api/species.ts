// ============================================================================
// File: species.ts
// Path: src/clubadmin/api/species.ts
// Description:
// Club-admin scoped Species & Fish Type API
// ============================================================================

import { client } from "@/services/api";

// ============================================================================
// TYPES
// ============================================================================

export type FishType = {
    fish_type_id: string;
    name: string;
};

export type SpeciesCategory = {
    species_category_id?: string;
    name: string;
};

export type Species = {
    id: number;
    name: string;
    is_measure: boolean;

    fish_type_id: string;
    species_category_id: string | null;
    species_category: SpeciesCategory | null;
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
// HELPERS
// ============================================================================

function unwrapOne<T>(maybe: T | T[] | null | undefined): T | null {
    if (!maybe) return null;
    return Array.isArray(maybe) ? maybe[0] ?? null : maybe;
}

function requireClient() {
    if (!client) throw new Error("Supabase client not ready");
    return client;
}

// ============================================================================
// GLOBAL SPECIES
// ============================================================================

/**
 * Returns all active species with category.
 */
export async function listSpecies(): Promise<Species[]> {
    const sb = requireClient();

    const { data, error } = await sb
        .from("species")
        .select(
            `
            id,
            name,
            is_measure,
            fish_type_id,
            species_category_id,
            species_category:species_category_id (
                species_category_id,
                name
            )
        `
        )
        .eq("is_active", true)
        .order("name");

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        is_measure: !!row.is_measure,
        fish_type_id: row.fish_type_id,
        species_category_id: row.species_category_id ?? null,
        species_category: unwrapOne<SpeciesCategory>(row.species_category),
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
    const sb = requireClient();

    const { data, error } = await sb
        .from("competition_type_fish_type")
        .select(
            `
            fish_type:fish_type_id (
                fish_type_id,
                name
            )
        `
        )
        .eq("competition_type_id", competitionTypeId);

    if (error) throw error;

    return (data ?? [])
        .map((row: any) => unwrapOne<FishType>(row.fish_type))
        .filter((x: FishType | null): x is FishType => !!x);
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
    const sb = requireClient();
    if (!fishTypeIds.length) return [];

    const { data, error } = await sb
        .from("species")
        .select(
            `
            id,
            name,
            is_measure,
            fish_type_id,
            species_category_id,
            species_category:species_category_id (
                species_category_id,
                name
            )
        `
        )
        .in("fish_type_id", fishTypeIds)
        .eq("is_active", true)
        .order("name");

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        is_measure: !!row.is_measure,
        fish_type_id: row.fish_type_id,
        species_category_id: row.species_category_id ?? null,
        species_category: unwrapOne<SpeciesCategory>(row.species_category),
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
    const sb = requireClient();

    const { data, error } = await sb
        .from("competition_species")
        .select(
            `
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
        `
        )
        .eq("competition_id", competitionId);

    if (error) throw error;

    return (data ?? [])
        .map((row: any) => {
            const s = unwrapOne<any>(row.species);
            if (!s) return null;

            const fishType = unwrapOne<any>(s.fish_type);

            return {
                id: s.id,
                name: s.name,

                fish_type_id: s.fish_type_id,
                fish_type_name: fishType?.name ?? "Unknown fish type",

                species_category_id: s.species_category_id ?? null,
                species_category: unwrapOne<{ name: string }>(s.species_category),
            } satisfies CompetitionSpecies;
        })
        .filter(
            (x: CompetitionSpecies | null): x is CompetitionSpecies => !!x
        );
}

// ============================================================================
// SAVE COMPETITION SPECIES
// ============================================================================

/**
 * Replaces all species for a competition.
 */
export async function saveCompetitionSpecies(
    _organisationId: string,
    competitionId: string,
    speciesIds: number[]
) {
    const sb = requireClient();

    const { error: delError } = await sb
        .from("competition_species")
        .delete()
        .eq("competition_id", competitionId);

    if (delError) throw delError;

    if (!speciesIds.length) return [];

    const rows = speciesIds.map((id) => ({
        competition_id: competitionId,
        species_id: id,
    }));

    const { data, error } = await sb
        .from("competition_species")
        .insert(rows)
        .select();

    if (error) throw error;
    return data ?? [];
}

// ============================================================================
// END OF FILE
// ============================================================================
