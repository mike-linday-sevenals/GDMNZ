import { client } from "@/services/api";
import type { Species } from "@/types";

export async function listSubmissionSpecies(
    competitionId: string
): Promise<Species[]> {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data, error } = await client
        .from("competition_species")
        .select(`
            species:species_id (
                id,
                name,
                is_measure,
                fish_type_id
            )
        `)
        .eq("competition_id", competitionId)
        .order("species_id");

    if (error) {
        throw error;
    }

    return (data ?? []).map((row: any) =>
        Array.isArray(row.species) ? row.species[0] : row.species
    );
}
