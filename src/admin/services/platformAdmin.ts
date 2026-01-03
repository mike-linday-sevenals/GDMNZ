import { supabase } from "../../services/supabase";

// services file you already have
export async function listOrganisations() {
    return supabase
        .from("organisation")
        .select("*")
        .order("organisation_name");
}
