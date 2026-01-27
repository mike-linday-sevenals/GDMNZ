// ============================================================================
// src/clubadmin/api/submission.ts
// Catch submission API (raw capture + submit contract)
// ============================================================================

import { client } from "@/services/api";

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export type FishingDiscipline = "sport" | "game" | "mixed";
export type SubmissionOutcome = "landed" | "tagged_released" | null;

// ============================================================================
// STRICT SUBMIT CONTRACT (UI → API)
// ----------------------------------------------------------------------------
// IMPORTANT:
// - competition_day_id is NO LONGER accepted from the UI
// - It is derived server-side from (competition_id + date_caught)
// ============================================================================

export type CatchSubmissionSubmitPayload = {
    // ------------------------------------------------------------------
    // Identity & scope (REQUIRED)
    // ------------------------------------------------------------------
    competition_id: string;
    division_id: string | null;
    competitor_id: string;

    // ------------------------------------------------------------------
    // Snapshot fields
    // ------------------------------------------------------------------
    boat_name: string;                 // required by schema (may be "")
    boat_type: string | null;
    fishing_discipline: FishingDiscipline;

    // ------------------------------------------------------------------
    // Species
    // ------------------------------------------------------------------
    species_id: number;
    species_name: string;

    gender: string | null;

    // ------------------------------------------------------------------
    // Outcome & measurement
    // ------------------------------------------------------------------
    outcome: SubmissionOutcome;

    weight_kg: number | null;
    length_cm: number | null;
    estimated_weight_kg: number | null;

    // ------------------------------------------------------------------
    // Game fishing only
    // ------------------------------------------------------------------
    tag_number: string | null;
    tag_authority: string | null;

    // ------------------------------------------------------------------
    // Catch timing
    // ------------------------------------------------------------------
    date_caught: string;               // YYYY-MM-DD
    time_caught: string | null;        // HH:mm[:ss]
    priority_timestamp: string;        // ISO timestamptz (derived in UI)

    hooked_time: string | null;
    landed_time: string | null;

    // ------------------------------------------------------------------
    // Context / metadata
    // ------------------------------------------------------------------
    skipper_name: string | null;
    location: string | null;
    notes: string | null;

    source: "ui" | "import" | "admin";
};

// ============================================================================
// RAW DB INSERT TYPE (mirrors catch_submission table)
// ----------------------------------------------------------------------------
// Nullable by design — used by imports, admin tools, migrations.
// ============================================================================

export type CatchSubmissionInsert = {
    competition_id: string | null;
    competition_day_id: string | null;
    division_id: string | null;

    competitor_id: string;

    boat_name: string | null;
    boat_type: string | null;

    fishing_discipline: FishingDiscipline;

    species_id: number | null;
    species_name: string | null;

    gender: string | null;

    outcome: SubmissionOutcome;

    weight_kg: number | null;
    length_cm: number | null;
    estimated_weight_kg: number | null;

    tag_number: string | null;
    tag_authority: string | null;

    date_caught: string;
    time_caught: string | null;
    priority_timestamp: string;

    hooked_time: string | null;
    landed_time: string | null;
    skipper_name: string | null;
    location: string | null;

    notes: string | null;

    source: "ui" | "import" | "admin";

    is_provisional: boolean;
    is_valid: boolean;
    used_for_result: boolean;
};

// ============================================================================
// INTERNAL: Resolve competition day (AUTHORITATIVE)
// ============================================================================

async function resolveCompetitionDayId(
    competitionId: string,
    dateCaught: string
): Promise<string> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data, error } = await client
        .from("competition_day")
        .select("id")
        .eq("competition_id", competitionId)
        .eq("day_date", dateCaught)
        .single();

    if (error || !data) {
        throw new Error(
            "No competition day exists for the selected catch date"
        );
    }

    return data.id;
}

// ============================================================================
// SUBMIT (UI-FACING — AUTHORITATIVE PATH)
// ----------------------------------------------------------------------------
// - Derives competition_day_id server-side
// - Enforces workflow defaults
// - Rejects invalid dates cleanly
// ============================================================================

export async function createCatchSubmission(
    payload: CatchSubmissionSubmitPayload
) {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    // ------------------------------------------------------------------
    // Resolve competition day (CANONICAL RULE)
    // ------------------------------------------------------------------
    const competition_day_id = await resolveCompetitionDayId(
        payload.competition_id,
        payload.date_caught
    );

    // ------------------------------------------------------------------
    // Build insert payload
    // ------------------------------------------------------------------
    const insert: CatchSubmissionInsert = {
        ...payload,

        competition_day_id,

        // Workflow defaults
        is_provisional: true,
        is_valid: false,
        used_for_result: false,
    };

    const { data, error } = await client
        .from("catch_submission")
        .insert(insert)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

// ============================================================================
// RAW INSERT (ADMIN / IMPORT USE ONLY)
// ----------------------------------------------------------------------------
// - NO derivation
// - NO validation
// - Caller is responsible for correctness
// ============================================================================

export async function insertCatchSubmission(
    payload: CatchSubmissionInsert
) {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data, error } = await client
        .from("catch_submission")
        .insert(payload)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}
