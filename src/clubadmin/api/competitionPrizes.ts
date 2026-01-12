// ============================================================================
// File: competitionPrizes.ts
// Path: src/clubadmin/api/competitionPrizes.ts
// Description:
// API wrapper for competition_prize_definition (V2)
// - Uses Supabase if configured (client from competitions.ts)
// - Falls back to localStorage if Supabase not ready
// ============================================================================

import { client } from "./competitions";

// ============================================================================
// TYPES
// ============================================================================

export type ScopeKind = "competition" | "briefing" | "day";
export type PrizeType = "species" | "spot";
export type TargetKind = "species" | "species_category" | "spot";
export type ResultMethod = "weighed" | "measured";
export type AwardRule = "ranked" | "first";
export type OutcomeFilter = "any" | "landed" | "tagged_released";

export type PriorityTimestampSource = "weighin_at" | "time_caught" | "created_at";

export type PrizeDefinitionRow = {
    id: string;
    competition_id: string;

    scope_kind: ScopeKind;
    competition_day_id: string | null;
    division_id: string | null;

    prize_type: PrizeType;
    target_kind: TargetKind;

    species_id: number | null;
    species_category_id: string | null;
    spot_label: string | null;

    result_method: ResultMethod | null;
    award_rule: AwardRule;
    place: number;

    outcome_filter: OutcomeFilter | null;
    min_weight_kg: string | null;
    min_length_cm: string | null;
    priority_timestamp_source: PriorityTimestampSource | null;

    display_name: string;
    description: string | null;

    sort_order: number;
    active: boolean;

    created_at: string;
    updated_at: string;
};

// ============================================================================
// LOCAL FALLBACK (when Supabase not configured)
// ============================================================================

function key(competitionId: string) {
    return `wosc_prize_definitions:${competitionId}`;
}

function load<T>(k: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(k);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function save<T>(k: string, value: T) {
    localStorage.setItem(k, JSON.stringify(value));
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizeRow(r: any): PrizeDefinitionRow {
    // Supabase returns numeric as number (sometimes) and numeric columns may come as string.
    // Our UI types use string|null for numeric fields, so coerce safely.
    return {
        id: r.id,
        competition_id: r.competition_id,

        scope_kind: r.scope_kind,
        competition_day_id: r.competition_day_id ?? null,
        division_id: r.division_id ?? null,

        prize_type: r.prize_type,
        target_kind: r.target_kind,

        species_id: r.species_id ?? null,
        species_category_id: r.species_category_id ?? null,
        spot_label: r.spot_label ?? null,

        result_method: r.result_method ?? null,
        award_rule: r.award_rule,
        place: typeof r.place === "number" ? r.place : Number(r.place ?? 0),

        outcome_filter: r.outcome_filter ?? null,
        min_weight_kg: r.min_weight_kg == null ? null : String(r.min_weight_kg),
        min_length_cm: r.min_length_cm == null ? null : String(r.min_length_cm),
        priority_timestamp_source: r.priority_timestamp_source ?? null,

        display_name: r.display_name ?? "",
        description: r.description ?? null,

        sort_order:
            typeof r.sort_order === "number" ? r.sort_order : Number(r.sort_order ?? 0),
        active: !!r.active,

        created_at: r.created_at,
        updated_at: r.updated_at,
    };
}

// ============================================================================
// API
// ============================================================================

/**
 * List prize definitions for a competition.
 * - Returns ALL rows (active + inactive) in stable UI order.
 */
export async function listPrizeDefinitions(
    competitionId: string
): Promise<PrizeDefinitionRow[]> {
    // Fallback mode
    if (!client) {
        const rows = load<PrizeDefinitionRow[]>(key(competitionId), []);
        return rows.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }

    const { data, error } = await client
        .from("competition_prize_definition")
        .select("*")
        .eq("competition_id", competitionId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map(normalizeRow);
}

/**
 * Create prize definitions.
 * - Inserts the provided rows (expects ids/timestamps provided by UI for now).
 * - Returns void (UI refetches after insert).
 */
export async function createPrizeDefinitions(
    competitionId: string,
    defs: PrizeDefinitionRow[]
): Promise<void> {
    if (!defs.length) return;

    // Defensive: ensure competition_id is set correctly
    const payload = defs.map((d) => ({
        ...d,
        competition_id: competitionId,
    }));

    // Fallback mode
    if (!client) {
        const existing = load<PrizeDefinitionRow[]>(key(competitionId), []);
        save(key(competitionId), [...existing, ...payload]);
        return;
    }

    const { error } = await client
        .from("competition_prize_definition")
        .insert(payload);

    if (error) throw error;
}

/**
 * Optional convenience: replace all prize definitions for a competition.
 * (Not used by UI yet, but handy during development)
 */
export async function replacePrizeDefinitions(
    competitionId: string,
    defs: PrizeDefinitionRow[]
): Promise<void> {
    // Fallback mode
    if (!client) {
        save(key(competitionId), defs.map((d) => ({ ...d, competition_id: competitionId })));
        return;
    }

    // Delete then insert (simple, predictable; add transaction later if needed)
    const { error: delErr } = await client
        .from("competition_prize_definition")
        .delete()
        .eq("competition_id", competitionId);

    if (delErr) throw delErr;

    if (!defs.length) return;

    const { error: insErr } = await client
        .from("competition_prize_definition")
        .insert(defs.map((d) => ({ ...d, competition_id: competitionId })));

    if (insErr) throw insErr;
}

// ============================================================================
// MUTATIONS
// ============================================================================

export async function setPrizeDefinitionActive(
    competitionId: string,
    prizeDefinitionId: string,
    active: boolean
): Promise<void> {
    // Fallback mode
    if (!client) {
        const rows = load<PrizeDefinitionRow[]>(key(competitionId), []);
        const next = rows.map((r) =>
            r.id === prizeDefinitionId
                ? { ...r, active, updated_at: new Date().toISOString() }
                : r
        );
        save(key(competitionId), next);
        return;
    }

    const { error } = await client
        .from("competition_prize_definition")
        .update({
            active,
            updated_at: new Date().toISOString(),
        })
        .eq("id", prizeDefinitionId);

    if (error) throw error;
}



// ============================================================================
// END OF FILE
// ============================================================================
