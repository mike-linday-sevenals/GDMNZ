import { supabase } from "./db";

export type PublicResultRow = {
    public_results_slug: string;
    competition_name: string;
    day: number;
    day_date: string;
    angler: string;
    species: string;
    weight_kg: number | null;
};

export async function getPublicResultsBySlug(
    slug: string,
    day: number | null
) {
    let q = supabase
        .from("vw_public_competition_results")
        .select("*")
        .eq("public_results_slug", slug)
        .order("day")
        .order("weight_kg", { ascending: false });

    if (day !== null) {
        q = q.eq("day", day);
    }

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []) as PublicResultRow[];
}
