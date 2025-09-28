import { createClient } from '@supabase/supabase-js';
const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
export async function listPrizes() {
    const { data, error } = await sb
        .from('prize')
        .select('*')
        .order('species_id', { ascending: true })
        .order('for_category', { ascending: true })
        .order('rank', { ascending: true });
    if (error)
        throw error;
    return data;
}
export async function createPrizeRow(p) {
    const { data, error } = await sb.from('prize').insert(p).select().single();
    if (error)
        throw error;
    return data;
}
export async function updatePrizeRow(id, patch) {
    const { data, error } = await sb.from('prize').update(patch).eq('id', id).select().single();
    if (error)
        throw error;
    return data;
}
export async function deletePrizeRow(id) {
    const { error } = await sb.from('prize').delete().eq('id', id);
    if (error)
        throw error;
}
/** helpers */
export async function getNextRank(species_id, for_category) {
    const { data, error } = await sb
        .from('prize')
        .select('rank')
        .eq('species_id', species_id)
        .eq('for_category', for_category)
        .order('rank', { ascending: false })
        .limit(1)
        .single();
    // PGRST116 = no rows
    if (error && error.code !== 'PGRST116')
        throw error;
    return data?.rank ? data.rank + 1 : 1;
}
