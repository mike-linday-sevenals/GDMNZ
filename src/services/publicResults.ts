import { supabase } from "./db";

/* ============================================================================
   PUBLIC RESULTS (from vw_public_competition_results)
   ============================================================================ */

export type AnglerCategory = "adult" | "junior";

export type PublicResultRow = {
    public_results_slug: string;
    competition_name: string;

    day: number;
    day_date: string;

    angler: string;
    category: AnglerCategory;

    species: string;

    weight_kg: number | null;
    length_cm: number | null;

    submitted_at: string;
    priority_timestamp: string;
};

/* ============================================================================
   Get public competition results by slug (+ optional day)
   ============================================================================ */

export async function getPublicResultsBySlug(
    slug: string,
    day: number | null
): Promise<PublicResultRow[]> {
    if (!supabase) {
        throw new Error("Supabase not ready");
    }

    // ---------------------------------------------------------------------
    // Base query
    // NOTE:
    // Ordering here is intentionally minimal.
    // Final deterministic ordering is handled in-memory.
    // ---------------------------------------------------------------------
    let q = supabase
        .from("vw_public_competition_results")
        .select("*")
        .eq("public_results_slug", slug);

    if (day !== null) {
        q = q.eq("day", day);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data ?? []) as PublicResultRow[];

    // ---------------------------------------------------------------------
    // Deterministic ordering:
    //  1️⃣ Day (asc)
    //  2️⃣ Species (asc)
    //  3️⃣ Weight OR Length (desc)
    //  4️⃣ Priority timestamp (asc) → tie-breaker
    // ---------------------------------------------------------------------
    return rows.sort((a, b) => {
        // Day
        if (a.day !== b.day) {
            return a.day - b.day;
        }

        // Species
        if (a.species !== b.species) {
            return a.species.localeCompare(b.species);
        }

        // Primary measure (weight first, fallback to length)
        const aMeasure = a.weight_kg ?? a.length_cm ?? 0;
        const bMeasure = b.weight_kg ?? b.length_cm ?? 0;

        if (aMeasure !== bMeasure) {
            return bMeasure - aMeasure;
        }

        // Tie-breaker: earliest priority_timestamp wins
        return (
            new Date(a.priority_timestamp).getTime() -
            new Date(b.priority_timestamp).getTime()
        );
    });
}
