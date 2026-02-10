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

    // NOTE: legacy / optional
    species_id?: number | null;

    // DB constraint requires EXACTLY ONE of these two:
    species_category_id?: string | null;
    species_group_code?: string | null;

    points_mode: "flat" | "weight";
    points_value: number;
    divide_by_line_weight: boolean;

    priority: number;
};

export type SaveCompetitionPointsPayload = {
    rules: CompetitionPointsRuleDTO[];
};

// ============================================================================
// VALIDATION (DB CHECK CONSTRAINT GUARD)
// competition_points_value_check requires EXACTLY ONE of:
//   species_category_id OR species_group_code
// ============================================================================
function validatePointsRules(rules: CompetitionPointsRuleDTO[]) {
    const invalid = rules.filter((r) => {
        const hasSpecies = r.species_id !== undefined && r.species_id !== null;

        const hasCat =
            r.species_category_id !== undefined &&
            r.species_category_id !== null &&
            String(r.species_category_id).trim().length > 0;

        const hasGroup =
            r.species_group_code !== undefined &&
            r.species_group_code !== null &&
            String(r.species_group_code).trim().length > 0;

        const count = [hasSpecies, hasCat, hasGroup].filter(Boolean).length;
        return count !== 1;
    });

    if (invalid.length > 0) {
        const sample = invalid.slice(0, 5).map((r) => ({
            fishing_discipline: r.fishing_discipline,
            outcome: r.outcome,
            species_id: r.species_id ?? null,
            species_category_id: r.species_category_id ?? null,
            species_group_code: r.species_group_code ?? null,
            priority: r.priority,
        }));

        throw new Error(
            `Invalid competition points rules: each rule MUST set exactly ONE of species_id OR species_category_id OR species_group_code. Offenders: ${JSON.stringify(
                sample
            )}`
        );
    }
}


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
        .select(
            `
            fishing_discipline,
            outcome,
            species_id,
            species_category_id,
            species_group_code,
            points_mode,
            points_value,
            divide_by_line_weight,
            priority
        `
        )
        .eq("competition_id", competitionId)
        .order("priority", { ascending: true });

    if (error) throw error;

    return (data ?? []) as CompetitionPointsRuleDTO[];
}

export async function saveCompetitionPoints(
    competitionId: string,
    payload: SaveCompetitionPointsPayload
): Promise<void> {
    // ✅ validate BEFORE we hit DB constraint
    validatePointsRules(payload.rules);

    const supabase = requireClient();

    const { error } = await supabase.rpc("save_competition_points", {
        p_competition_id: competitionId,
        p_rules: payload.rules,
    });

    if (error) throw error;
}
