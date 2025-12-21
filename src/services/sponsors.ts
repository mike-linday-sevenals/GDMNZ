// src/services/sponsors.ts
import { supabase } from '@/services/db'

export type Sponsor = { id: string; name: string }
export type SponsorLevel = { id: string; label: string; group_id: string; sort_order: number }
export type CompetitionSponsorInput = {
  competition_id: string
  sponsor_id: string
  level_id: string | null
  display_order?: number | null
  blurb?: string | null
}

// Create a sponsor (master)
export async function createSponsor(name: string) {
  const { data, error } = await supabase
    .from('sponsors')
    .insert({ name })
    .select()
    .single()
  if (error) throw error
  return data as Sponsor
}

// Default-group levels (fallback to all active if no default)
export async function fetchDefaultGroupLevels(): Promise<SponsorLevel[]> {
  const { data: group, error: gErr } = await supabase
    .from('sponsor_group')
    .select('id')
    .eq('is_default', true)
    .maybeSingle()
  if (gErr) throw gErr

  const query = supabase.from('sponsor_level')
    .select('id,label,group_id,sort_order')
    .eq('active', true)
    .order('sort_order')

  if (group?.id) query.eq('group_id', group.id)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// Link sponsor to competition
export async function addSponsorToCompetition(input: CompetitionSponsorInput) {
  const { error } = await supabase.from('competition_sponsor').insert({
    competition_id: input.competition_id,
    sponsor_id: input.sponsor_id,
    level_id: input.level_id,
    display_order: input.display_order ?? null,
    blurb: input.blurb ?? null
  })
  if (error) throw error
}

// List configured sponsors for a competition
export async function listCompetitionSponsors(competition_id: string) {
  const { data, error } = await supabase
    .from('vw_competition_sponsors') // or build the join inline if you didn’t add the view
    .select('*')
    .eq('competition_id', competition_id)
    .order('display_order', { ascending: true })
  if (error) throw error
  return data ?? []
}
// ---------------------------------------------------------------------------
// Sponsors
// ---------------------------------------------------------------------------

export async function listSponsors() {
    const { data, error } = await supabase
        .from('sponsors')
        .select('id, name')
        .order('name')

    if (error) throw error
    return data ?? []
}
// ---------------------------------------------------------------------------
// Competition sponsors
// ---------------------------------------------------------------------------

export async function updateCompetitionSponsor(
    id: string,
    updates: {
        level_id: string
        display_order: number | null
        blurb: string | null
    }
) {
    const { error } = await supabase
        .from('competition_sponsor')
        .update({
            level_id: updates.level_id,
            display_order: updates.display_order,
            blurb: updates.blurb,
        })
        .eq('id', id)

    if (error) throw error
}
