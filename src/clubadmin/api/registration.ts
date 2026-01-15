// ============================================================================
// File: registration.ts
// Path: src/clubadmin/api/registration.ts
// Description:
// Club-admin competition registration APIs
// - API owns angler_number + boat_number generation
// - competitor holds all numbering
// - competition_competitor holds competition + division only
// ============================================================================

import { client } from "@/services/api";

// ============================================================================
// TYPES
// ============================================================================

export type RegistrationCategory = "adult" | "junior";
export type BoatType = "Launch" | "Trailer" | "Charter";

// ============================================================================
// INTERNAL HELPERS (NUMBERING)
// ============================================================================

function extractSeq(num: string | null): number | null {
    if (!num) return null;

    // Expect formats like A26001 or B26012
    const m = num.match(/^[A-Z]\d{2}(\d+)$/);
    return m ? Number(m[1]) : null;
}

function yearYY(dateISO: string): string {
    return dateISO.slice(2, 4);
}

function pad(n: number, width = 3): string {
    return String(n).padStart(width, "0");
}

async function listCompetitionNumberContext(competitionId: string) {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competitor")
        .select(`
            angler_number,
            boat_number,
            boat,
            competition_competitor!inner ( competition_id )
        `)
        .eq("competition_competitor.competition_id", competitionId);

    if (error) throw error;
    return data ?? [];
}

async function generateNextAnglerNumber(
    competitionId: string,
    competitionStartDate: string
): Promise<string> {
    const rows = await listCompetitionNumberContext(competitionId);

    const maxSeq = Math.max(
        0,
        ...rows
            .map(r => extractSeq(r.angler_number))
            .filter((n): n is number => n !== null)
    );

    const yy = yearYY(competitionStartDate);
    return `A${yy}${pad(maxSeq + 1)}`;
}

async function resolveBoatNumber(
    competitionId: string,
    competitionStartDate: string,
    boatName: string
): Promise<string> {
    const rows = await listCompetitionNumberContext(competitionId);

    const existing = rows.find(
        r =>
            r.boat &&
            r.boat.trim().toLowerCase() === boatName.trim().toLowerCase()
    );

    if (existing?.boat_number) return existing.boat_number;

    const maxSeq = Math.max(
        0,
        ...rows
            .map(r => extractSeq(r.boat_number))
            .filter((n): n is number => n !== null)
    );

    const yy = yearYY(competitionStartDate);
    return `B${yy}${pad(maxSeq + 1)}`;
}

// ============================================================================
// SAFETY
// ============================================================================

export async function competitorHasResults(
    competitorId: string
): Promise<boolean> {
    if (!client) return false;

    const { data, error } = await client
        .from("fish")
        .select("id")
        .eq("competitor_id", competitorId)
        .limit(1);

    if (error) throw error;
    return (data?.length ?? 0) > 0;
}

// ============================================================================
// REGISTRATION (AUTHORITATIVE)
// ============================================================================

export async function registerCompetitorsForBoat(payload: {
    competitionId: string;
    competitionStartDate: string;
    boatName: string;
    boatType: BoatType;
    anglers: {
        full_name: string;
        category: RegistrationCategory;
        membership_no: string;
        paid_on: string | null;
        division_id: string;
    }[];
}): Promise<void> {
    if (!client) throw new Error("Supabase not ready");

    const boatNumber = await resolveBoatNumber(
        payload.competitionId,
        payload.competitionStartDate,
        payload.boatName
    );

    let nextAnglerNumber = await generateNextAnglerNumber(
        payload.competitionId,
        payload.competitionStartDate
    );

    for (const a of payload.anglers) {
        const { data: competitor, error: compErr } = await client
            .from("competitor")
            .insert({
                full_name: a.full_name.trim(),
                category: a.category,
                paid_on: a.paid_on,
                boat: payload.boatName.trim(),
                membership_no: a.membership_no.trim(),
                boat_type: payload.boatType,
                angler_number: nextAnglerNumber,
                boat_number: boatNumber,
                registration_date: new Date().toISOString().slice(0, 10),
            })
            .select("id")
            .single();

        if (compErr) throw compErr;

        const { error: linkErr } = await client
            .from("competition_competitor")
            .insert({
                competition_id: payload.competitionId,
                competitor_id: competitor.id,
                division_id: a.division_id,
            });

        if (linkErr) throw linkErr;

        const seq = extractSeq(nextAnglerNumber)! + 1;
        const yy = yearYY(payload.competitionStartDate);
        nextAnglerNumber = `A${yy}${pad(seq)}`;
    }
}

// ============================================================================
// READ
// ============================================================================

export async function listCompetitorsForCompetition(competitionId: string) {
    if (!client) throw new Error("Supabase not ready");

    const { data, error } = await client
        .from("competitor")
        .select(`
            id,
            registration_date,
            created_at,
            full_name,
            category,
            paid_on,
            boat,
            membership_no,
            boat_type,
            angler_number,
            boat_number,
            competition_competitor!inner ( competition_id )
        `)
        .eq("competition_competitor.competition_id", competitionId)
        .order("angler_number");

    if (error) throw error;
    return data ?? [];
}

// ============================================================================
// UPDATE COMPETITOR (NULL-SAFE, AUTHORITATIVE)
// ============================================================================

export async function updateCompetitor(
    id: string | number,
    patch: Partial<{
        full_name: string | null;
        category: RegistrationCategory;
        paid_on: string | null;
        membership_no: string | null;
        registration_date: string | null;
    }>
) {
    if (!client) throw new Error("Supabase not ready");

    const update: Record<string, any> = {};

    if (patch.full_name !== undefined)
        update.full_name = patch.full_name?.trim() ?? "";

    if (patch.category !== undefined)
        update.category = patch.category;

    if (patch.membership_no !== undefined)
        update.membership_no = patch.membership_no?.trim() ?? "";

    if (patch.paid_on !== undefined)
        update.paid_on = patch.paid_on;

    if (patch.registration_date !== undefined)
        update.registration_date = patch.registration_date;

    const { data, error } = await client
        .from("competitor")
        .update(update)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================================
// DELETE (SAFE)
// ============================================================================

export async function deleteCompetitorFromCompetition(
    competitionId: string,
    competitorId: string
): Promise<{ blocked: boolean }> {
    if (!client) throw new Error("Supabase not ready");

    const { data: fish } = await client
        .from("fish")
        .select("id")
        .eq("competitor_id", competitorId)
        .limit(1);

    if (fish && fish.length > 0) {
        return { blocked: true };
    }

    await client
        .from("competition_competitor")
        .delete()
        .eq("competition_id", competitionId)
        .eq("competitor_id", competitorId);

    await client
        .from("competitor")
        .delete()
        .eq("id", competitorId);

    return { blocked: false };
}
