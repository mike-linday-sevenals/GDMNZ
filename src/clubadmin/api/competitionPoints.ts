// ============================================================================
// File: competitionPoints.ts
// Path: src/clubadmin/api/competitionPoints.ts
// Description:
// Competition points configuration API (Supabase RPC based)
// ============================================================================

import { client } from "@/services/api";

// ============================================================================
// TYPES
// ============================================================================

export type CompetitionPointsRuleDTO = {
    fishing_discipline: "game" | "sport";
    outcome: "tagged_released" | "landed";

    species_category_id?: string;
    species_group_code?: string;

    points_mode: "flat" | "weight";
    points_value: number;
    divide_by_line_weight: boolean;

    priority: number;
};

export type SaveCompetitionPointsPayload = {
    rules: CompetitionPointsRuleDTO[];
};

// ============================================================================
// INTERNAL GUARD
// ============================================================================

function requireClient() {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }
    return client;
}

// ============================================================================
// API
// ============================================================================

export async function listCompetitionPoints(
    competitionId: string
): Promise<CompetitionPointsRuleDTO[]> {
    const supabase = requireClient();

    const { data, error } = await supabase
        .from("competition_points_value")
        .select(`
            fishing_discipline,
            outcome,
            species_category_id,
            species_group_code,
            points_mode,
            points_value,
            divide_by_line_weight,
            priority
        `)
        .eq("competition_id", competitionId)
        .order("priority", { ascending: true });

    if (error) throw error;

    return data as CompetitionPointsRuleDTO[];
}

export async function saveCompetitionPoints(
    competitionId: string,
    payload: SaveCompetitionPointsPayload
): Promise<void> {
    const supabase = requireClient();

    const { error } = await supabase.rpc(
        "save_competition_points",
        {
            p_competition_id: competitionId,
            p_rules: payload.rules,
        }
    );

    if (error) throw error;
}
