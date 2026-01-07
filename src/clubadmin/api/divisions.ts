import { client } from "./competitions";

/**
 * List divisions linked to a competition
 */
export async function listCompetitionDivisions(competitionId: string) {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data, error } = await client
        .from("competition_division")
        .select(`
            division:division_id (
                id,
                code,
                name,
                sort_order
            )
        `)
        .eq("competition_id", competitionId);

    if (error) throw error;

    return (data ?? []).map((d: any) => d.division);
}

/**
 * Replace all divisions for a competition
 */
export async function saveCompetitionDivisions(
    competitionId: string,
    divisionIds: string[]
) {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    // 1️⃣ Remove existing links
    const { error: deleteErr } = await client
        .from("competition_division")
        .delete()
        .eq("competition_id", competitionId);

    if (deleteErr) throw deleteErr;

    // 2️⃣ Insert new links (if any)
    if (divisionIds.length > 0) {
        const rows = divisionIds.map((divisionId) => ({
            competition_id: competitionId,
            division_id: divisionId,
        }));

        const { error: insertErr } = await client
            .from("competition_division")
            .insert(rows);

        if (insertErr) throw insertErr;
    }
}
/**
 * List ALL divisions in the system
 */
export async function listDivisions() {
    if (!client) {
        throw new Error("Supabase client not initialised");
    }

    const { data, error } = await client
        .from("division")
        .select("id, code, name, sort_order")
        .order("sort_order");

    if (error) throw error;

    return data ?? [];
}
