// ============================================================================
// File: prizeGiving.ts
// Path: src/clubadmin/api/prizeGiving.ts
// Description:
// Club-admin scoped Prize Giving API
// - Prize-driven (authoritative)
// - Results are neutral facts
// - Division comes from competition_results.division_id
// ============================================================================

import { client } from "./competitions";

// ============================================================================
// TYPES
// ============================================================================

export type Division = {
    id: string;
    code: string; // adult | junior | open
    name: string;
    sort_order: number;
};

export type Species = {
    id: number;
    name: string;
    is_measure: boolean;
};

export type Entry = {
    id: string;
    species_id: number;
    division_id: string;
    competitor_id: string;
    competitor_name: string;
    weight_kg: number | null;
    length_cm: number | null;
    priority_timestamp: string;
};

export type Prize = {
    id: string;
    species_id: number;
    division_id: string;
    rank: number;
    label: string | null;
    sponsor: string | null;
};

export type PrizeGivingData = {
    competition: {
        id: string;
        name: string;
        comp_mode: "weight" | "length";
    };
    species: Species[];
    divisions: Division[];
    entries: Entry[];
    prizes: Prize[];
};

// ============================================================================
// LOAD PRIZE GIVING DATA
// ============================================================================

export async function loadPrizeGivingData(
    organisationId: string,
    competitionId: string
): Promise<PrizeGivingData> {
    if (!client) throw new Error("Supabase client not initialised");

    /* --------------------------------------------------
       Competition (mode only)
    -------------------------------------------------- */
    const { data: compRow, error: compErr } = await client
        .from("competition_organisation")
        .select(`
            competition:competition_id (
                id,
                name,
                comp_mode:comp_mode_id ( name )
            )
        `)
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (compErr) throw compErr;
    if (!compRow?.competition) throw new Error("Competition not found");

    const competition = Array.isArray(compRow.competition)
        ? compRow.competition[0]
        : compRow.competition;

    const rawCompMode = Array.isArray(competition.comp_mode)
        ? competition.comp_mode[0]
        : competition.comp_mode;

    const compMode: "weight" | "length" =
        rawCompMode?.name === "Length" ? "length" : "weight";

    /* --------------------------------------------------
       Prizes (AUTHORITATIVE)
    -------------------------------------------------- */
    const { data: prizeRows, error: prizeErr } = await client
        .from("prize")
        .select(`
            id,
            species_id,
            division_id,
            rank,
            label,
            sponsor
        `)
        .eq("competition_id", competitionId)
        .eq("active", true)
        .order("rank");

    if (prizeErr) throw prizeErr;
    const prizes: Prize[] = prizeRows ?? [];

    /* --------------------------------------------------
       Divisions (derived from prizes)
    -------------------------------------------------- */
    const divisionIds = [...new Set(prizes.map(p => p.division_id))];

    const { data: divisions, error: divErr } = divisionIds.length
        ? await client
            .from("division")
            .select("id, code, name, sort_order")
            .in("id", divisionIds)
            .order("sort_order")
        : { data: [], error: null };

    if (divErr) throw divErr;

    /* --------------------------------------------------
       Species (derived from prizes)
    -------------------------------------------------- */
    const speciesIds = [...new Set(prizes.map(p => p.species_id))];

    const { data: species, error: speciesErr } = speciesIds.length
        ? await client
            .from("species")
            .select("id, name, is_measure")
            .in("id", speciesIds)
            .order("name")
        : { data: [], error: null };

    if (speciesErr) throw speciesErr;

    /* --------------------------------------------------
       Competition Results (NEUTRAL FACTS)
    -------------------------------------------------- */
    const { data: resultRows, error: resultErr } = await client
        .from("competition_results")
        .select(`
        id,
        species_id,
        division_id,
        weight_kg,
        length_cm,
        priority_timestamp,
        competitor:competitor!competition_results_competitor_id_fkey (
            id,
            full_name
        )
    `)
        .eq("competition_id", competitionId);


    if (resultErr) throw resultErr;

    const entries: Entry[] = (resultRows ?? []).map((r: any) => ({
        id: r.id,
        species_id: r.species_id,
        division_id: r.division_id,
        competitor_id: r.competitor.id,
        competitor_name: r.competitor.full_name,
        weight_kg: r.weight_kg ?? null,
        length_cm: r.length_cm ?? null,
        priority_timestamp: r.priority_timestamp,
    }));

    /* --------------------------------------------------
       Done
    -------------------------------------------------- */
    return {
        competition: {
            id: competition.id,
            name: competition.name,
            comp_mode: compMode,
        },
        species: species ?? [],
        divisions: divisions ?? [],
        entries,
        prizes,
    };
}
