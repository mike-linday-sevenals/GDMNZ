import { supabase } from "./db";

export type PublicResultRow = {
    id: string | number;
    day: 1 | 2;
    species: string;
    category?: string | null;
    angler: string;
    team?: string | null;
    weight_kg: number | null;
    length_cm?: number | null;
    submitted_at: string;
};

export async function getPublicResults(day: 1 | 2 | null): Promise<PublicResultRow[]> {
    try {
        let q = supabase.from("vw_wosc_public_results").select("*").order("weight_kg", { ascending: false });
        if (day) q = q.eq("day", day);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as PublicResultRow[];
    } catch {
        return [];
    }
}
