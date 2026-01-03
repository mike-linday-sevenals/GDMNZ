import { supabase } from "@/services/supabase";

/* ============================================================================
   TYPES
   ========================================================================== */

export type Organisation = {
    organisation_id: string;
    organisation_name: string;
    status_id: number;
};

export type Person = {
    person_id: string;
    first_name: string;
    last_name: string;
    email?: string;
};

/* ============================================================================
   CONSTANTS
   ========================================================================== */

const STATUS_ACTIVE = 20;

/* ============================================================================
   ORGANISATIONS
   ========================================================================== */

export async function listOrganisations(): Promise<Organisation[]> {
    const { data, error } = await supabase
        .from("organisation")
        .select("*")
        .order("organisation_name");

    if (error) {
        console.error("listOrganisations failed", error);
        throw error;
    }

    return data ?? [];
}

export async function createOrganisation(
    name: string
): Promise<Organisation> {
    const { data, error } = await supabase
        .from("organisation")
        .insert({
            organisation_name: name,
            status_id: STATUS_ACTIVE,
        })
        .select()
        .single();

    if (error) {
        console.error("createOrganisation failed", error);
        throw error;
    }

    return data;
}

/* ============================================================================
   PEOPLE
   ========================================================================== */

export async function listPeople(): Promise<Person[]> {
    const { data, error } = await supabase
        .from("person")
        .select("*");

    if (error) {
        console.error("listPeople failed", error);
        throw error;
    }

    return data ?? [];
}
