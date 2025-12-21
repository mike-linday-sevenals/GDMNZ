import { createClient } from "@supabase/supabase-js";

// same env vars as api.ts
const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

export type Category = "combined" | "adult" | "junior";

export type PrizeRow = {
    id: string;
    competition_id: string;
    species_id: number;
    rank: number;
    label: string | null;
    for_category: Category | null;

    sponsor_id: string | null;

    // legacy column (read-only)
    sponsor: string | null;

    active: boolean | null;
    created_at: string;
};

/* -------------------------------------------------- */
/* List prizes for a competition */
/* -------------------------------------------------- */
export async function listPrizesForCompetition(
    competitionId: string
): Promise<PrizeRow[]> {
    const { data, error } = await supabase
        .from("prize")
        .select("*")
        .eq("competition_id", competitionId)
        .neq("active", false)
        .order("rank", { ascending: true });

    if (error) throw error;
    return data ?? [];
}

/* -------------------------------------------------- */
/* Create / update prize */
/* -------------------------------------------------- */
export async function upsertPrize(input: {
    id?: string;
    competition_id: string;
    species_id: number;
    rank: number;
    label: string | null;
    for_category: Category;
    sponsor_id: string | null;
}) {
    const { error } = await supabase.from("prize").upsert(
        {
            id: input.id,
            competition_id: input.competition_id,
            species_id: input.species_id,
            rank: input.rank,
            label: input.label,
            for_category: input.for_category,
            sponsor_id: input.sponsor_id,
            active: true,
        },
        { onConflict: "id" }
    );

    if (error) throw error;
}

/* -------------------------------------------------- */
/* Soft delete prize */
/* -------------------------------------------------- */
export async function removePrizeRow(id: string) {
    const { error } = await supabase
        .from("prize")
        .update({ active: false })
        .eq("id", id);

    if (error) throw error;
}
