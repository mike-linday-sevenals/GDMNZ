// ============================================================================
// File: boatPoints.ts
// Path: src/clubadmin/api/boatPoints.ts
// Description:
//  - Boat points viewer support (rows + grouping)
//  - Uses RPC: get_boat_points_rows(competition_id, competition_day_id)
// ============================================================================

import { client } from "@/services/api";

// ============================================================================
// TYPES
// ============================================================================

export type BoatPointsFishRow = {
    boat: string | null;

    competitor_id: string;
    competitor_name: string | null;
    angler_number: string | null;
    boat_number: string | null;

    fishing_discipline: string;

    species_id: number;
    species_name: string | null;

    outcome: string | null;
    weight_kg: number | null;

    fish_points: number | null;
    counted_for_points: boolean | null;

    used_for_result: boolean | null;
    is_provisional: boolean | null;
    is_valid: boolean | null;

    date_caught: string | null; // YYYY-MM-DD
    time_caught: string | null; // HH:MM:SS
    priority_timestamp: string | null;
};

export type BoatPointsBoatRow = {
    boat: string;

    boat_points: number;

    marlin_tr: number;       // tagged_released fish that scored (>0)
    tuna_weighed: number;    // landed tuna fish that scored (>0)
    marlin_weighed: number;  // landed marlin fish that scored (>0)

    total_fish: number;      // fish that contributed points

    fish: BoatPointsFishRow[]; // fish that contributed points
};

// ============================================================================
// INTERNAL
// ============================================================================

function requireClient() {
    if (!client) throw new Error("Supabase client not initialised");
    return client;
}

function num(v: unknown) {
    const x = typeof v === "number" ? v : Number(v);
    return Number.isFinite(x) ? x : 0;
}

function has(hay?: string | null, needle?: string) {
    return !!hay && !!needle && hay.toLowerCase().includes(needle.toLowerCase());
}

// ============================================================================
// API
// ============================================================================

/**
 * Fetch raw scoring rows for a competition. If competitionDayId is null, returns all days.
 */
export async function listBoatPointsRows(
    competitionId: string,
    competitionDayId: string | null
): Promise<BoatPointsFishRow[]> {
    const supabase = requireClient();

    const { data, error } = await supabase.rpc("get_boat_points_rows", {
        p_competition_id: competitionId,
        p_competition_day_id: competitionDayId ?? null,
    });

    if (error) throw error;
    return (data ?? []) as BoatPointsFishRow[];
}

/**
 * Group rows into boats and compute totals.
 * - Only rows with fish_points > 0 contribute to totals.
 * - Optional: onlyOfficial will only include used_for_result rows.
 */
export function buildBoatPoints(
    rows: BoatPointsFishRow[],
    opts: { onlyOfficial: boolean }
): BoatPointsBoatRow[] {
    const byBoat = new Map<string, BoatPointsBoatRow>();

    for (const r of rows) {
        if (opts.onlyOfficial && !r.used_for_result) continue;

        const pts = num(r.fish_points);
        if (pts <= 0) continue; // ✅ only fish that actually scored

        const boatName = (r.boat ?? "").trim() || "Unknown Boat";

        if (!byBoat.has(boatName)) {
            byBoat.set(boatName, {
                boat: boatName,
                boat_points: 0,
                marlin_tr: 0,
                tuna_weighed: 0,
                marlin_weighed: 0,
                total_fish: 0,
                fish: [],
            });
        }

        const b = byBoat.get(boatName)!;

        b.boat_points += pts;
        b.total_fish += 1;
        b.fish.push(r);

        // Marlin T&R in your scoring config is effectively "tagged_released fish that scored"
        if (r.outcome === "tagged_released") {
            b.marlin_tr += 1;
        } else {
            if (has(r.species_name, "tuna")) b.tuna_weighed += 1;
            if (has(r.species_name, "marlin")) b.marlin_weighed += 1;
        }
    }

    // sort fish inside each boat by points desc, then most recent
    for (const b of byBoat.values()) {
        b.fish.sort((a, c) => {
            const dp = num(c.fish_points) - num(a.fish_points);
            if (dp !== 0) return dp;

            const ta = a.priority_timestamp ? new Date(a.priority_timestamp).getTime() : 0;
            const tc = c.priority_timestamp ? new Date(c.priority_timestamp).getTime() : 0;
            return tc - ta;
        });
    }

    // sort boats by total points desc, then name
    return Array.from(byBoat.values()).sort((a, b) => {
        const dp = b.boat_points - a.boat_points;
        if (dp !== 0) return dp;
        return a.boat.localeCompare(b.boat);
    });
}
