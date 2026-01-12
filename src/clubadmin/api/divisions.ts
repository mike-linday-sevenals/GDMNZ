// ============================================================================
// File: divisions.ts
// Path: src/clubadmin/api/divisions.ts
// Description:
// Division lookup + competition-division join APIs
// ============================================================================

import { client } from "./competitions";

// ============================================================================
// TYPES
// ============================================================================

export type Division = {
    id: string;
    code: string;
    name: string;
    sort_order: number;
};

// ============================================================================
// COMPETITION ↔ DIVISIONS
// ============================================================================

/**
 * List divisions linked to a competition
 */
export async function listCompetitionDivisions(
    competitionId: string
): Promise<Division[]> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data, error } = await client
        .from("competition_division")
        .select(`
            division:division_id (
                id,
                code,
                name,
                sort_order
            )
        `)
        .eq("competition_id", competitionId);

    if (error) throw error;

    return (data ?? []).map((row: any) =>
        Array.isArray(row.division) ? row.division[0] : row.division
    );
}

/**
 * Replace all divisions for a competition
 */
export async function saveCompetitionDivisions(
    competitionId: string,
    divisionIds: string[]
): Promise<void> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    // 1️⃣ Remove existing links
    const { error: deleteErr } = await client
        .from("competition_division")
        .delete()
        .eq("competition_id", competitionId);

    if (deleteErr) throw deleteErr;

    // 2️⃣ Insert new links
    if (divisionIds.length > 0) {
        const rows = divisionIds.map((divisionId) => ({
            competition_id: competitionId,
            division_id: divisionId,
        }));

        const { error: insertErr } = await client
            .from("competition_division")
            .insert(rows);

        if (insertErr) throw insertErr;
    }
}

// ============================================================================
// GLOBAL DIVISIONS
// ============================================================================

/**
 * List ALL divisions in the system
 */
export async function listDivisions(): Promise<Division[]> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data, error } = await client
        .from("division")
        .select("id, code, name, sort_order")
        .order("sort_order");

    if (error) throw error;

    return data ?? [];
}
