// ============================================================================
// File: teamCaptain.ts
// Path: src/clubadmin/api/teamCaptain.ts
// Description:
// Team Captain API (AUTHORITATIVE)
// - One captain per boat per competition
// - Captain can be:
//   • a fishing competitor (competitor_id)
//   • OR a non-fishing person (display_name)
// - Never both, never neither
// ============================================================================

import { client } from "@/services/api";

// ============================================================================
// TYPES
// ============================================================================

export type TeamCaptain = {
    id: string;
    competition_id: string;
    boat_number: string;
    competitor_id: string | null;
    display_name: string | null;
    created_at: string;
};

export type TeamCaptainInput = {
    competitionId: string;
    boatNumber: string;
    competitor_id?: string | null;
    display_name?: string | null;
};

// ============================================================================
// INTERNAL VALIDATION
// ============================================================================

function validateCaptainInput(input: TeamCaptainInput) {
    const hasCompetitor = !!input.competitor_id;
    const hasName =
        !!input.display_name && input.display_name.trim().length > 0;

    if (hasCompetitor === hasName) {
        throw new Error(
            "Team Captain must have either competitor_id OR display_name (but not both)"
        );
    }
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get the team captain for a boat in a competition
 */
export async function getTeamCaptainForBoat(
    competitionId: string,
    boatNumber: string
): Promise<TeamCaptain | null> {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("team_captain")
        .select("*")
        .eq("competition_id", competitionId)
        .eq("boat_number", boatNumber)
        .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    return data ?? null;
}

// ============================================================================
// WRITE (UPSERT)
// ============================================================================

/**
 * Set (or replace) the team captain for a boat
 * - Exactly one captain per boat per competition
 * - Overwrites existing captain if present
 */
export async function setTeamCaptainForBoat(
    input: TeamCaptainInput
): Promise<TeamCaptain> {
    if (!client) throw new Error("Supabase not ready");

    validateCaptainInput(input);

    const payload = {
        competition_id: input.competitionId,
        boat_number: input.boatNumber,
        competitor_id: input.competitor_id ?? null,
        display_name: input.display_name?.trim() ?? null,
    };

    const { data, error } = await client
        .from("team_captain")
        .upsert(payload, {
            onConflict: "competition_id,boat_number",
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Remove the team captain from a boat
 * (boat still exists, anglers unaffected)
 */
export async function clearTeamCaptainForBoat(
    competitionId: string,
    boatNumber: string
): Promise<void> {
    if (!client) throw new Error("Supabase not ready");

    const { error } = await client
        .from("team_captain")
        .delete()
        .eq("competition_id", competitionId)
        .eq("boat_number", boatNumber);

    if (error) throw error;
}
