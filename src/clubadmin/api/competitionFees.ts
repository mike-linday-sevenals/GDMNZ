// src/clubadmin/api/competitionFees.ts

import { client } from "@/services/api";

export type CompetitionFees = {
    id: string;
    competition_id: string;

    earlybird_fee_adult: number | null;
    earlybird_fee_junior: number | null;
    earlybird_cutoff_date: string | null;

    full_fee_adult: number | null;
    full_fee_junior: number | null;

    nonmember_fee_adult: number | null;
    nonmember_fee_junior: number | null;

    extra?: Record<string, any>;
};

/* ========================================================================
   READ — always returns a row (auto-creates if missing)
   ======================================================================== */
export async function getCompetitionFees(
    organisationId: string,
    competitionId: string
): Promise<CompetitionFees | null> {
    if (!client) return null;

    /* ------------------------------------------------------------------
       1️⃣ Verify competition belongs to this organisation
       ------------------------------------------------------------------ */
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) return null;

    /* ------------------------------------------------------------------
       2️⃣ Load existing fees (if any)
       ------------------------------------------------------------------ */
    const { data, error } = await client
        .from("competition_fees")
        .select("*")
        .eq("competition_id", competitionId)
        .maybeSingle();

    // Ignore "no row" error
    if (error && error.code !== "PGRST116") throw error;

    /* ------------------------------------------------------------------
       3️⃣ Auto-create default row if missing
       ------------------------------------------------------------------ */
    if (!data) {
        const { data: created, error: insertErr } = await client
            .from("competition_fees")
            .insert({
                competition_id: competitionId,
                earlybird_fee_adult: null,
                earlybird_fee_junior: null,
                earlybird_cutoff_date: null,
                full_fee_adult: null,
                full_fee_junior: null,
                nonmember_fee_adult: null,
                nonmember_fee_junior: null,
                extra: {},
            })
            .select()
            .single();

        if (insertErr) throw insertErr;
        return created;
    }

    return data;
}

/* ========================================================================
   WRITE — update or insert (safe upsert)
   ======================================================================== */
export async function upsertCompetitionFees(
    organisationId: string,
    competitionId: string,
    patch: Partial<CompetitionFees>
): Promise<CompetitionFees> {
    if (!client) throw new Error("Supabase not ready");

    /* ------------------------------------------------------------------
       1️⃣ Verify competition belongs to this organisation
       ------------------------------------------------------------------ */
    const { data: link, error: linkErr } = await client
        .from("competition_organisation")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (linkErr) throw linkErr;
    if (!link) {
        throw new Error("Competition does not belong to this organisation");
    }

    /* ------------------------------------------------------------------
       2️⃣ Update existing row if present
       ------------------------------------------------------------------ */
    const { data: existing } = await client
        .from("competition_fees")
        .select("id")
        .eq("competition_id", competitionId)
        .maybeSingle();

    if (existing) {
        const { data, error } = await client
            .from("competition_fees")
            .update(patch)
            .eq("competition_id", competitionId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /* ------------------------------------------------------------------
       3️⃣ Otherwise insert
       ------------------------------------------------------------------ */
    const { data, error } = await client
        .from("competition_fees")
        .insert({
            competition_id: competitionId,
            ...patch,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}
