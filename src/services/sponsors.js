// src/services/sponsors.ts
import { supabase } from '@/services/db';
// Create a sponsor (master)
export async function createSponsor(name) {
    const { data, error } = await supabase
        .from('sponsors')
        .insert({ name })
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
// Default-group levels (fallback to all active if no default)
export async function fetchDefaultGroupLevels() {
    const { data: group, error: gErr } = await supabase
        .from('sponsor_group')
        .select('id')
        .eq('is_default', true)
        .maybeSingle();
    if (gErr)
        throw gErr;
    const query = supabase.from('sponsor_level')
        .select('id,label,group_id,sort_order')
        .eq('active', true)
        .order('sort_order');
    if (group?.id)
        query.eq('group_id', group.id);
    const { data, error } = await query;
    if (error)
        throw error;
    return data ?? [];
}
// Link sponsor to competition
export async function addSponsorToCompetition(input) {
    const { error } = await supabase.from('competition_sponsor').insert({
        competition_id: input.competition_id,
        sponsor_id: input.sponsor_id,
        level_id: input.level_id,
        display_order: input.display_order ?? null,
        blurb: input.blurb ?? null
    });
    if (error)
        throw error;
}
// List configured sponsors for a competition
export async function listCompetitionSponsors(competition_id) {
    const { data, error } = await supabase
        .from('vw_competition_sponsors') // or build the join inline if you didn’t add the view
        .select('*')
        .eq('competition_id', competition_id)
        .order('display_order', { ascending: true });
    if (error)
        throw error;
    return data ?? [];
}
