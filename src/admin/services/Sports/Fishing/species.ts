import { supabase } from "@/services/supabase";

/* ============================================================================
   TYPES
   ========================================================================== */

export type LookupRow = {
    id: string;
    name: string;
};

export type SpeciesAdminRow = {
    id: number;
    name: string;
    fish_type: string | null;
    category: string | null;
    environment: string | null;
    result_method: string | null;
    outcome: string | null;
    is_active: boolean;
};

export type SpeciesFormRow = {
    id: number;
    name: string;
    is_measure: boolean; // REQUIRED BY DB
    fish_type_id: string;
    species_category_id: string | null;
    fishing_environment_id: string;
    primary_result_method_id: string;
    typical_outcome_id: string;
    is_active: boolean;
};

/* ============================================================================
   LIST (ADMIN VIEW)
   ========================================================================== */

export async function listSpeciesAdmin(): Promise<SpeciesAdminRow[]> {
    const { data, error } = await supabase
        .from("species_admin_view")
        .select(
            `
            id,
            name,
            fish_type,
            category,
            environment,
            result_method,
            outcome,
            is_active
        `
        )
        .order("fish_type")
        .order("category")
        .order("name");

    if (error) {
        console.error("listSpeciesAdmin failed", error);
        throw error;
    }

    return data ?? [];
}

/* ============================================================================
   GET SINGLE (EDIT)
   ========================================================================== */

export async function getSpeciesById(id: number): Promise<SpeciesFormRow> {
    const { data, error } = await supabase
        .from("species")
        .select(
            `
            id,
            name,
            is_measure,
            fish_type_id,
            species_category_id,
            fishing_environment_id,
            primary_result_method_id,
            typical_outcome_id,
            is_active
        `
        )
        .eq("id", id)
        .single();

    if (error) {
        console.error("getSpeciesById failed", { id, error });
        throw error;
    }

    return data;
}

/* ============================================================================
   UPSERT (STRICT + SAFE)
   ========================================================================== */

export async function upsertSpecies(
    payload: Omit<SpeciesFormRow, "id">,
    id?: number
) {
    const dbPayload = {
        name: payload.name.trim(),
        is_measure: payload.is_measure, // 🔒 ALWAYS PERSIST
        fish_type_id: payload.fish_type_id,
        species_category_id: payload.species_category_id,
        fishing_environment_id: payload.fishing_environment_id,
        primary_result_method_id: payload.primary_result_method_id,
        typical_outcome_id: payload.typical_outcome_id,
        is_active: payload.is_active,
    };

    if (id !== undefined) {
        const { data, error } = await supabase
            .from("species")
            .update(dbPayload)
            .eq("id", id)
            .select(); // 🔴 REQUIRED

        if (error) {
            console.error("Species UPDATE failed", { id, dbPayload, error });
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error(
                `Species UPDATE affected 0 rows (id=${id}). Likely RLS or auth issue.`
            );
        }

        return data[0];
    }

    const { data, error } = await supabase
        .from("species")
        .insert(dbPayload)
        .select(); // 🔴 REQUIRED

    if (error) {
        console.error("Species INSERT failed", { dbPayload, error });
        throw error;
    }

    if (!data || data.length === 0) {
        throw new Error("Species INSERT affected 0 rows.");
    }

    return data[0];
}

/* ============================================================================
   LOOKUPS (NORMALISED IDS)
   ========================================================================== */

export async function listFishTypes(): Promise<LookupRow[]> {
    const { data, error } = await supabase
        .from("fish_type")
        .select("id:fish_type_id, name")
        .eq("is_active", true)
        .order("name");

    if (error) throw error;
    return data ?? [];
}

export async function listSpeciesCategories(): Promise<LookupRow[]> {
    const { data, error } = await supabase
        .from("species_category")
        .select("id:species_category_id, name")
        .eq("is_active", true)
        .order("name");

    if (error) throw error;
    return data ?? [];
}

export async function listFishingEnvironments(): Promise<LookupRow[]> {
    const { data, error } = await supabase
        .from("fishing_environment")
        .select("id:fishing_environment_id, name")
        .eq("is_active", true)
        .order("name");

    if (error) throw error;
    return data ?? [];
}

export async function listResultMethods(): Promise<LookupRow[]> {
    const { data, error } = await supabase
        .from("result_method")
        .select("id:result_method_id, name")
        .eq("is_active", true)
        .order("name");

    if (error) throw error;
    return data ?? [];
}

export async function listTypicalOutcomes(): Promise<LookupRow[]> {
    const { data, error } = await supabase
        .from("typical_outcome")
        .select("id:typical_outcome_id, name")
        .eq("is_active", true)
        .order("name");

    if (error) throw error;
    return data ?? [];
}
