// ============================================================================
// File: randomLists.ts
// Path: src/clubadmin/api/randomLists.ts
// Description:
//  - Random list API helpers (Supabase v2)
//  - List creation & population (ADMIN ONLY)
//  - Randomisation (MT19937)
//  - Draw-next logic (RPC, read-only mutation)
// ============================================================================

import { client } from "@/services/api";
import {
    shuffleWithMT,
    type ShuffleItem,
} from "@/services/randomListRandomiser";

// ============================================================================
// Types (API read models)
// ============================================================================

export type RandomList = {
    id: string;

    // RNG
    rng_algorithm: string | null;
    seed_raw: string | null;
    seed_int: number | null;

    // State
    randomised_at: string | null;
    status: string;

    // 🔒 DB-SAFE SCOPE ONLY
    scope_type: "competition" | "briefing";
    scope_day_id: null;
};

export type RandomListEntry = {
    id: string;
};

export type DrawnEntry = {
    entry_id: string;
    entry_name: string;
    random_order: number;
};

// ============================================================================
// INTERNAL — Resolve prize → DB-safe random list scope
// 🔒 SINGLE SOURCE OF TRUTH
//
// IMPORTANT:
// random_list does NOT support day-scoped rows.
// Day / briefing is a PRIZE concept, not a list concept.
// ============================================================================
function resolveRandomListScope(): {
    scope_type: "competition";
    scope_day_id: null;
} {
    return {
        scope_type: "competition",
        scope_day_id: null,
    };
}

// ============================================================================
// ADMIN: Ensure random list exists + populate entries
// ⚠️ DO NOT CALL FROM PRIZE GIVING DISPLAY
// ============================================================================

export async function ensureRandomListForPrize(params: {
    competitionId: string;
    prizeId: string;
}): Promise<{ random_list_id: string }> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { competitionId, prizeId } = params;

    // ------------------------------------------------------------------
    // Load prize definition
    // ------------------------------------------------------------------

    const { data: prize, error: prizeError } = await client
        .from("competition_prize_definition")
        .select(`
            id,
            prize_type,
            spot_label,
            description
        `)
        .eq("id", prizeId)
        .single();

    if (prizeError) throw prizeError;
    if (!prize) throw new Error("Prize not found");

    if (prize.prize_type !== "spot") {
        throw new Error("Random lists are only supported for spot prizes");
    }

    const scope = resolveRandomListScope();

    const isEarlyBird =
        (prize.spot_label ?? "").trim().toLowerCase() === "early bird";

    // ------------------------------------------------------------------
    // Find existing random list (ONE per prize per competition)
    // ------------------------------------------------------------------

    const { data: existingList } = await client
        .from("random_list")
        .select("id, randomised_at")
        .eq("competition_id", competitionId)
        .eq("scope_type", scope.scope_type)
        .is("scope_day_id", null)
        .eq("name", prize.spot_label ?? "Spot Prize")
        .maybeSingle();

    let randomListId: string;

    // ------------------------------------------------------------------
    // Create or reuse list
    // ------------------------------------------------------------------

    if (!existingList) {
        const { data: created, error: createError } = await client
            .from("random_list")
            .insert({
                competition_id: competitionId,
                name: prize.spot_label ?? "Spot Prize",
                description: prize.description ?? null,
                source_type: "query",
                rules_snapshot: JSON.stringify({
                    prize_id: prize.id,
                    prize_type: "spot",
                    spot_source: isEarlyBird ? "early_bird" : "general",
                }),
                rng_algorithm: "mt19937",
                scope_type: scope.scope_type,
                scope_day_id: null,
                win_limit_mode: "once_per_scope",
                status: "draft",
            })
            .select("id")
            .single();

        if (createError) throw createError;
        randomListId = created.id;
    } else {
        if (existingList.randomised_at) {
            throw new Error(
                "Random list already randomised and cannot be regenerated"
            );
        }

        randomListId = existingList.id;

        // Clear existing entries
        const { error: deleteError } = await client
            .from("random_list_entry")
            .delete()
            .eq("random_list_id", randomListId);

        if (deleteError) throw deleteError;
    }

    // ------------------------------------------------------------------
    // Resolve eligible competitors
    // ------------------------------------------------------------------

    let competitorsQuery = client
        .from("competition_competitor")
        .select(`
            competitor:competitor (
                id,
                full_name,
                is_early_bird
            )
        `)
        .eq("competition_id", competitionId);

    // 🎯 EARLY BIRD FILTER — ONLY PLACE THIS HAPPENS
    if (isEarlyBird) {
        competitorsQuery = competitorsQuery.eq(
            "competitor.is_early_bird",
            true
        );
    }

    const { data: competitors, error: competitorsError } =
        await competitorsQuery;

    if (competitorsError) throw competitorsError;

    if (!competitors || competitors.length === 0) {
        throw new Error(
            isEarlyBird
                ? "No early bird competitors found for this competition"
                : "No eligible competitors found"
        );
    }

    // ------------------------------------------------------------------
    // Insert entries
    // ------------------------------------------------------------------

    const entries = competitors.map((row: any) => {
        if (!row.competitor) return null;

        return {
            random_list_id: randomListId,
            source_id: row.competitor.id,
            display_name: row.competitor.full_name,
        };
    }).filter(Boolean);

    if (!entries.length) {
        throw new Error("No valid competitors to insert");
    }

    const { error: entryInsertError } = await client
        .from("random_list_entry")
        .insert(entries);

    if (entryInsertError) throw entryInsertError;

    return { random_list_id: randomListId };
}

// ============================================================================
// ADMIN: Randomise list (MT19937)
// ============================================================================

export async function randomiseRandomList(
    randomListId: string
): Promise<void> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data: list, error: listError } = await client
        .from("random_list")
        .select("id, seed_int, randomised_at")
        .eq("id", randomListId)
        .single();

    if (listError) throw listError;
    if (!list) throw new Error("Random list not found");

    if (list.randomised_at) {
        throw new Error("Random list already randomised");
    }

    const { data: entries, error: entryError } = await client
        .from("random_list_entry")
        .select("id")
        .eq("random_list_id", randomListId);

    if (entryError) throw entryError;
    if (!entries || entries.length === 0) {
        throw new Error("No entries to randomise");
    }

    const shuffled = shuffleWithMT(
        entries as ShuffleItem[],
        list.seed_int ?? undefined
    );

    const { error: rpcError } = await client.rpc(
        "persist_random_list_order",
        {
            p_random_list_id: randomListId,
            p_entries: shuffled.map((e, i) => ({
                id: e.id,
                random_order: i + 1,
            })),
        }
    );

    if (rpcError) throw rpcError;
}

// ============================================================================
// DISPLAY: Draw next entry (safe, idempotent)
// ============================================================================

export async function drawNextRandomListEntry(
    randomListId: string
): Promise<DrawnEntry | null> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data, error } = await client.rpc(
        "draw_next_random_list_entry",
        {
            p_random_list_id: randomListId,
        }
    );

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return data[0] as DrawnEntry;
}

// ============================================================================
// READ-ONLY: Get existing random list for a prize
// ============================================================================

export async function getRandomListForPrize(params: {
    competitionId: string;
    prizeId: string;
}): Promise<RandomList | null> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { competitionId, prizeId } = params;

    const { data: prize, error: prizeError } = await client
        .from("competition_prize_definition")
        .select(`spot_label`)
        .eq("id", prizeId)
        .single();

    if (prizeError) throw prizeError;
    if (!prize) return null;

    const { data: list, error } = await client
        .from("random_list")
        .select(`
            id,
            rng_algorithm,
            seed_raw,
            seed_int,
            randomised_at,
            status,
            scope_type,
            scope_day_id
        `)
        .eq("competition_id", competitionId)
        .eq("scope_type", "competition")
        .is("scope_day_id", null)
        .eq("name", prize.spot_label ?? "Spot Prize")
        .maybeSingle();

    if (error) throw error;
    return list ?? null;
}

// ============================================================================
// READ-ONLY: Load already drawn entries
// ============================================================================

export type DrawnListEntry = {
    entry_id: string;
    display_name: string;
    selected_order: number;
};

export async function listDrawnRandomListEntries(
    randomListId: string
): Promise<DrawnListEntry[]> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data, error } = await client
        .from("random_list_entry")
        .select(`
            id,
            display_name,
            selected_order
        `)
        .eq("random_list_id", randomListId)
        .not("selected_at", "is", null)
        .order("selected_order", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
        entry_id: row.id,
        display_name: row.display_name,
        selected_order: row.selected_order,
    }));
}
