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
/* List prizes for a competition (split-aware) */
/* -------------------------------------------------- */
export async function listPrizesForCompetition(
    organisationId: string,
    competitionId: string
): Promise<PrizeRow[]> {
    /* --------------------------------------------------
       1️⃣ Load competition prize mode
       -------------------------------------------------- */
    const { data: compLink, error: compErr } = await supabase
        .from("competition_organisation")
        .select(`
            competition:competition_id (
                id,
                prize_mode:prize_mode_id ( name )
            )
        `)
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (compErr) throw compErr;
    if (!compLink?.competition) return [];

    const competition: any = Array.isArray(compLink.competition)
        ? compLink.competition[0]
        : compLink.competition;

    const prizeMode: string | null =
        Array.isArray(competition.prize_mode)
            ? competition.prize_mode[0]?.name ?? null
            : competition.prize_mode?.name ?? null;

    /* --------------------------------------------------
       2️⃣ Load all active prizes
       -------------------------------------------------- */
    const { data: prizes, error } = await supabase
        .from("prize")
        .select("*")
        .eq("competition_id", competitionId)
        .neq("active", false)
        .order("rank", { ascending: true });

    if (error) throw error;
    if (!prizes || prizes.length === 0) return [];

    /* --------------------------------------------------
       3️⃣ Combined competitions → return as-is
       -------------------------------------------------- */
    if (prizeMode !== "split") {
        return prizes as PrizeRow[];
    }

    /* --------------------------------------------------
       4️⃣ If split prizes already exist → return as-is
       -------------------------------------------------- */
    const hasSplitPrizes = prizes.some(
        (p: any) => p.for_category === "junior" || p.for_category === "adult"
    );

    if (hasSplitPrizes) {
        return prizes as PrizeRow[];
    }

    /* --------------------------------------------------
       5️⃣ Fallback: duplicate combined prizes
       -------------------------------------------------- */
    const combined = prizes.filter(
        (p: any) => p.for_category === "combined"
    );

    const junior = combined.map((p: any) => ({
        ...p,
        for_category: "junior" as Category,
        _fallback: true,
    }));

    const adult = combined.map((p: any) => ({
        ...p,
        for_category: "adult" as Category,
        _fallback: true,
    }));

    return [...junior, ...adult] as PrizeRow[];
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
