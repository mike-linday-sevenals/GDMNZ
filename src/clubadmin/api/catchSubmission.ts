// ============================================================================
//  src/clubadmin/api/catchSubmission.ts
// ============================================================================

import { client } from "@/services/api";

export type CatchSubmissionInsert = {
    competition_id: string;
    competition_day_id: string | null;
    division_id: string | null;

    competitor_id: string;
    boat_name: string | null;
    boat_type: string | null;

    fishing_discipline: "sport" | "game" | "general";

    species_id: number | null;
    species_name: string | null;

    outcome: "weighed" | "tagged_released" | "landed";

    weight_kg: number | null;
    length_cm: number | null;
    estimated_weight_kg: number | null;

    tag_number: string | null;
    tag_authority: string | null;

    date_caught: string;
    time_caught: string | null;
    priority_timestamp: string;

    gender: string | null;
    notes: string | null;

    source: "ui" | "import" | "admin";
    is_provisional: boolean;
    is_valid: boolean;
    used_for_result: boolean;
    result_id: string | null;
};

export async function insertCatchSubmission(
    payload: CatchSubmissionInsert
): Promise<void> {
    if (!client) throw new Error("Supabase not ready");

    const { error } = await client
        .from("catch_submission")
        .insert(payload);

    if (error) throw error;
}
