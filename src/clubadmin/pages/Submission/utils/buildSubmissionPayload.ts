// ============================================================================
// Build submission payload (UI → API contract)
// ============================================================================

import { buildPriorityTimestamp } from "./priorityTimestamp";
import type { SportCatchDraft } from "../SubmissionContext";

// ============================================================================
// Types
// ============================================================================

type FishingDiscipline = "sport" | "game" | "general";

// ============================================================================
// Builder
// ============================================================================

export function buildSubmissionPayload({
    competitionId,
    discipline,
    draft,
    competitorId,
    boatName,
    boatType,
    divisionId,
}: {
    competitionId: string;
    discipline: FishingDiscipline;
    draft: SportCatchDraft;
    competitorId: string;
    boatName: string | null;
    boatType: string | null;
    divisionId?: string | null;
}) {
    // ------------------------------------------------------------------
    // Derive time caught (domain-correct)
    // ------------------------------------------------------------------

    const timeCaught =
        draft.landed_time ??
        draft.hooked_time ??
        "00:00";

    // ------------------------------------------------------------------
    // Build payload
    // ------------------------------------------------------------------

    return {
        // --------------------------------------------------------------
        // Competition context
        // --------------------------------------------------------------

        competition_id: competitionId,
        division_id: divisionId ?? null,

        // --------------------------------------------------------------
        // Competitor / boat
        // --------------------------------------------------------------

        competitor_id: competitorId,
        boat_name: boatName,
        boat_type: boatType,

        // --------------------------------------------------------------
        // Catch details
        // --------------------------------------------------------------

        fishing_discipline: discipline,

        species_id: draft.species_id,
        species_name: draft.species_name,

        outcome: "weighed",

        weight_kg: draft.weight_kg,
        length_cm: null,
        estimated_weight_kg: draft.estimated_weight_kg,

        tag_number: null,
        tag_authority: null,

        date_caught: draft.date_caught,
        time_caught: timeCaught,

        priority_timestamp: buildPriorityTimestamp(
            draft.date_caught,
            timeCaught
        ),

        // --------------------------------------------------------------
        // Metadata
        // --------------------------------------------------------------

        gender: null,
        notes: draft.notes ?? null,

        source: "ui",
        is_provisional: false,
        is_valid: true,
        used_for_result: false,
        result_id: null,
    };
}
