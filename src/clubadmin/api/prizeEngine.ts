// src/clubadmin/api/prizeEngine.ts

import { client } from "./competitions";

export type PrizeEnginePreviewRow = {
    rank: number; 
    catch_submission_id: string;
    competitor_id: string;
    competitor_name: string | null;

    species_id: number;
    species_name: string;
    species_category_id: string | null;
    species_category_name: string | null;

    competition_day_id: string | null;
    division_id: string | null;

    outcome: "landed" | "tagged_released" | null;

    weight_kg: number | null;
    length_cm: number | null;

    priority_timestamp: string;
    created_at: string;
};

export async function previewPrizeEngine(
    competitionId: string,
    prizeDefinitionId: string
): Promise<PrizeEnginePreviewRow[]> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client.rpc(
        "prize_engine_preview",
        {
            p_prize_definition_id: prizeDefinitionId,
        }
    );

    if (error) throw error;

    return (data ?? []) as PrizeEnginePreviewRow[];
}
