// ============================================================================
// File: randomLists.ts
// Path: src/clubadmin/api/randomLists.ts
// Description:
//  - Random list API helpers (Supabase v2)
//  - Randomisation (MT19937)
//  - Draw-next logic (RPC)
// ============================================================================

import { client } from "@/services/api";
import { shuffleWithMT, type ShuffleItem } from "@/services/randomListRandomiser";

// ============================================================================
// Types (local view models)
// ============================================================================

export type RandomList = {
    id: string;
    seed_int: number;
    randomised_at: string | null;
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
// Randomise list (MT19937 + RPC persistence)
// ============================================================================

export async function randomiseRandomList(
    randomListId: string
): Promise<void> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    // ------------------------------------------------------------------
    // Load list
    // ------------------------------------------------------------------

    const { data: list, error: listError } = await client
        .from("random_list")
        .select("id, seed_int, randomised_at")
        .eq("id", randomListId)
        .single();

    if (listError) throw listError;
    if (!list) throw new Error("Random list not found");

    const typedList = list as RandomList;

    if (typedList.randomised_at) {
        throw new Error("Random list already randomised");
    }

    // ------------------------------------------------------------------
    // Load entries
    // ------------------------------------------------------------------

    const { data: entries, error: entryError } = await client
        .from("random_list_entry")
        .select("id")
        .eq("random_list_id", randomListId);

    if (entryError) throw entryError;
    if (!entries || entries.length === 0) {
        throw new Error("No entries to randomise");
    }

    const typedEntries = entries as RandomListEntry[];

    // ------------------------------------------------------------------
    // Shuffle using MT19937
    // ------------------------------------------------------------------

    const shuffled = shuffleWithMT(
        typedEntries as ShuffleItem[],
        typedList.seed_int
    );

    // ------------------------------------------------------------------
    // Persist order (RPC = atomic + auditable)
    // ------------------------------------------------------------------

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
// Draw next entry (one-at-a-time, no repeats)
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

    // No more entries to draw
    if (!data || data.length === 0) {
        return null;
    }

    return data[0] as DrawnEntry;
}
