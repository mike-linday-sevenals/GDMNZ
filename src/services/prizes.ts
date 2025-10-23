import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

export type Category = 'combined' | 'adult' | 'junior'

export type PrizeRow = {
  id: string
  rank: number
  label: string
  species_id: number
  sponsor: string | null
  sponsor_id: string | null
  for_category: Category
  active: boolean | null
  created_at: string
}

export async function listPrizes(): Promise<PrizeRow[]> {
  const { data, error } = await sb
    .from('prize')
    .select('*')
    .order('species_id', { ascending: true })
    .order('for_category', { ascending: true })
    .order('rank', { ascending: true })
  if (error) throw error
  return data as PrizeRow[]
}

export async function createPrizeRow(
  p: Omit<PrizeRow, 'id' | 'created_at'>
): Promise<PrizeRow> {
  const { data, error } = await sb.from('prize').insert(p).select().single()
  if (error) throw error
  return data as PrizeRow
}

export async function updatePrizeRow(
  id: string,
  patch: Partial<PrizeRow>
): Promise<PrizeRow> {
  const { data, error } = await sb.from('prize').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as PrizeRow
}

export async function deletePrizeRow(id: string): Promise<void> {
  const { error } = await sb.from('prize').delete().eq('id', id)
  if (error) throw error
}

/** helpers */
export async function getNextRank(
  species_id: number,
  for_category: Category
): Promise<number> {
  const { data, error } = await sb
    .from('prize')
    .select('rank')
    .eq('species_id', species_id)
    .eq('for_category', for_category)
    .order('rank', { ascending: false })
    .limit(1)
    .single()
  // PGRST116 = no rows
  if (error && (error as any).code !== 'PGRST116') throw error
  return data?.rank ? (data.rank as number) + 1 : 1
}
