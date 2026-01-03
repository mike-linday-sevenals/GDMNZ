import { supabase } from "@/services/supabase";

/* ============================================================================
   TYPES
   ========================================================================== */
export type Organisation = {
    organisation_id: string;
    organisation_name: string;
    status_id: number;
    created_at: string;
    updated_at: string | null;
};

/* ============================================================================
   QUERIES
   ========================================================================== */
export async function listOrganisations(): Promise<Organisation[]> {
    const { data, error } = await supabase
        .from("organisation")
        .select("*")
        .order("organisation_name");

    if (error) {
        console.error("Failed to load organisations", error);
        throw error;
    }

    return data ?? [];
}
