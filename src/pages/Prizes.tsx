// File: src/pages/Prizes.tsx
import { useEffect, useMemo, useState } from 'react'
import { fetchSettings, listSpecies } from '../services/api'
import {
  listPrizes,
  createPrizeRow,
  updatePrizeRow,
  deletePrizeRow,
  getNextRank,
  type PrizeRow,
  type Category,
} from '../services/prizes'
import { listCompetitionSponsors } from '@/services/sponsors'
import { supabase } from '@/services/db'
import type { Settings } from '@/types'

const cssId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

type Species = { id: number; name: string }
type PrizeMap = Record<number, Record<Category, PrizeRow[]>>
type CompSponsor = { id: string; sponsor_id: string; sponsor_name: string; level_label?: string | null; display_order?: number | null }

export default function Prizes() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [species, setSpecies] = useState<Species[]>([])
  const [prizes, setPrizes] = useState<PrizeMap>({})
  const [competitionId, setCompetitionId] = useState<string>('')
  const [compSponsors, setCompSponsors] = useState<CompSponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const [st, sp, rows] = await Promise.all([
        fetchSettings(),
        listSpecies(),
        listPrizes(),
      ])
      setSettings(st)
      setSpecies(sp.map((s: any) => ({ id: s.id, name: s.name })))
      setPrizes(groupRows(rows))

      const cid = await getCurrentCompetitionId()
      setCompetitionId(cid)
      const sponsorRows = await listCompetitionSponsors(cid)
      setCompSponsors(sponsorRows)
      setLoading(false)
    })().catch(err => {
      console.error(err)
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    })
  }, [])

  const mode: 'combined' | 'split' = settings?.prizeMode || 'combined'

  function groupRows(rows: PrizeRow[]): PrizeMap {
    const out: PrizeMap = {}
    for (const r of rows) {
      out[r.species_id] ??= { combined: [], adult: [], junior: [] }
      out[r.species_id][r.for_category].push(r)
    }
    for (const sid of Object.keys(out)) {
      ;(['combined', 'adult', 'junior'] as Category[]).forEach((c: Category) => {
        out[+sid][c] = out[+sid][c].slice().sort((a: PrizeRow, b: PrizeRow) => a.rank - b.rank)
      })
    }
    return out
  }

  function immSetRows(sid: number, cat: Category, rows: PrizeRow[]): PrizeMap {
    return {
      ...prizes,
      [sid]: {
        ...(prizes[sid] ?? { combined: [], adult: [], junior: [] }),
        [cat]: rows.slice().sort((a: PrizeRow, b: PrizeRow) => a.rank - b.rank),
      },
    }
  }

  async function addPrize(species_id: number, cat: Category) {
    const next = await getNextRank(species_id, cat)

    // optimistic temp row
    const temp: PrizeRow = {
      id: `tmp-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      rank: next,
      label: '',
      species_id,
      sponsor: '',
      sponsor_id: null,
      for_category: cat,
      active: true,
      created_at: new Date().toISOString(),
    }
    setPrizes((prev) => {
      const cur = (prev[species_id]?.[cat] ?? []).slice()
      cur.push(temp)
      return {
        ...prev,
        [species_id]: {
          ...(prev[species_id] ?? { combined: [], adult: [], junior: [] }),
          [cat]: cur.sort((a: PrizeRow, b: PrizeRow) => a.rank - b.rank),
        },
      }
    })

    try {
      const created = await createPrizeRow({
        rank: next,
        label: '',
        species_id,
        sponsor: '',
        sponsor_id: null,
        for_category: cat,
        active: true,
      } as Omit<PrizeRow, 'id' | 'created_at'>)

      // swap temp -> real
      setPrizes((prev) => {
        const cur = (prev[species_id]?.[cat] ?? []).filter((r) => !String(r.id).startsWith('tmp-'))
        return immSetRows(species_id, cat, [...cur, created])
      })
    } catch (e: any) {
      // revert optimistic add
      setPrizes((prev) => {
        const cur = (prev[species_id]?.[cat] ?? []).filter((r) => !String(r.id).startsWith('tmp-'))
        return immSetRows(species_id, cat, cur)
      })
      alert(`Failed to add prize: ${e?.message ?? e}`)
    }
  }

  function editPrize(id: string, species_id: number, cat: Category, patch: Partial<PrizeRow>) {
    // optimistic UI
    setPrizes((prev) => {
      const cur = (prev[species_id]?.[cat] ?? []).map((r: PrizeRow) => (r.id === id ? { ...r, ...patch } : r))
      return immSetRows(species_id, cat, cur)
    })
    // persist
    updatePrizeRow(id, patch).catch((e: any) => {
      console.error('Failed to save prize patch', e)
    })
  }

  async function removePrize(id: string, species_id: number, cat: Category) {
    const before = prizes[species_id]?.[cat] ?? []
    setPrizes((prev) => immSetRows(species_id, cat, before.filter((r: PrizeRow) => r.id !== id)))
    try {
      await deletePrizeRow(id)
    } catch (e: any) {
      // rollback
      setPrizes((prev) => immSetRows(species_id, cat, before))
      alert(`Failed to remove prize: ${e?.message ?? e}`)
    }
  }

  function saveMode() {
    // If you persist settings.prizeMode in DB, do it here.
    alert('Prize mode saved.')
  }

  const sponsorOptions = useMemo(
    () => [
      { id: '', name: '— No sponsor —' },
      ...compSponsors
        .slice()
        .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.sponsor_name.localeCompare(b.sponsor_name))
        .map((r) => ({ id: r.sponsor_id, name: r.sponsor_name })),
    ],
    [compSponsors]
  )

  if (loading) {
    return (
      <section className="card">
        <h2>Prize Setup</h2>
        <p className="muted">Loading…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="card">
        <h2>Prize Setup</h2>
        <p className="muted">{error}</p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>
        Prize Setup <span className="badge">DB-backed</span>
      </h2>
      <p className="sub">
        Prizes are stored in Supabase <code>prize</code> table. Sponsors shown below are configured for this competition.
      </p>

      <div className="actions">
        <span>Mode:</span>
        <label className="switch">
          <input type="radio" name="pmode" defaultChecked={mode === 'combined'} value="combined" /> <span>Combined</span>
        </label>
        <label className="switch">
          <input type="radio" name="pmode" defaultChecked={mode === 'split'} value="split" />{' '}
          <span>Split: Adult &amp; Junior</span>
        </label>
        <div style={{ flex: '1 1 auto' }} />
        <button className="btn" onClick={saveMode}>
          Save Mode
        </button>
      </div>

      <div className="grid">
        {species.map((sp) => {
          const byCat = prizes[sp.id] ?? { combined: [], adult: [], junior: [] }
          return (
            <details key={sp.id} open>
              <summary>
                <strong>{sp.name}</strong>
              </summary>

              <div style={{ margin: '10px 0' }}>
                {mode === 'combined' ? (
                  <PrizeTable
                    title=""
                    name={sp.name}
                    speciesId={sp.id}
                    rows={byCat.combined}
                    sponsorOptions={sponsorOptions}
                    onAdd={() => addPrize(sp.id, 'combined')}
                    onEdit={(id, patch) => editPrize(id, sp.id, 'combined', patch)}
                    onRemove={(id) => removePrize(id, sp.id, 'combined')}
                  />
                ) : (
                  <>
                    <h4>Adult</h4>
                    <PrizeTable
                      title="Adult"
                      name={sp.name}
                      speciesId={sp.id}
                      rows={byCat.adult}
                      sponsorOptions={sponsorOptions}
                      onAdd={() => addPrize(sp.id, 'adult')}
                      onEdit={(id, patch) => editPrize(id, sp.id, 'adult', patch)}
                      onRemove={(id) => removePrize(id, sp.id, 'adult')}
                    />

                    <h4>Junior</h4>
                    <PrizeTable
                      title="Junior"
                      name={sp.name}
                      speciesId={sp.id}
                      rows={byCat.junior}
                      sponsorOptions={sponsorOptions}
                      onAdd={() => addPrize(sp.id, 'junior')}
                      onEdit={(id, patch) => editPrize(id, sp.id, 'junior', patch)}
                      onRemove={(id) => removePrize(id, sp.id, 'junior')}
                    />
                  </>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}

// ---- helper: choose the running competition or latest by start date ----
async function getCurrentCompetitionId(): Promise<string> {
  if (!supabase) throw new Error('Supabase client not configured')
  const today = new Date().toISOString().slice(0, 10)
  let { data, error } = await supabase
    .from('competition')
    .select('id, starts_at, ends_at')
    .lte('starts_at', today)
    .gte('ends_at', today)
    .order('starts_at', { ascending: false })
    .limit(1)
  if (error) throw error
  if (data?.length) return data[0].id

  const { data: latest, error: err2 } = await supabase
    .from('competition')
    .select('id')
    .order('starts_at', { ascending: false })
    .limit(1)
  if (err2) throw err2
  if (!latest?.length) throw new Error('No competitions found')
  return latest[0].id
}

function PrizeTable({
  title,
  name,
  speciesId: _speciesId,
  rows,
  sponsorOptions,
  onAdd,
  onEdit,
  onRemove,
}: {
  title: string
  name: string
  speciesId: number
  rows: PrizeRow[]
  sponsorOptions: { id: string; name: string }[]
  onAdd: () => void
  onEdit: (id: string, patch: Partial<PrizeRow>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div id={`area-${cssId(name)}${title ? `-${cssId(title)}` : ''}`}>
      <table>
        <thead>
          <tr>
            <th>Place</th>
            <th>Prize (label/description)</th>
            <th style={{width: '34%'}}>Sponsor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: PrizeRow) => (
            <tr key={r.id}>
              <td>
                <input
                  className="pz-place"
                  type="number"
                  min={1}
                  step={1}
                  value={r.rank}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEdit(r.id, { rank: Number(e.target.value) || 1 })}
                  onBlur={(e: React.ChangeEvent<HTMLInputElement>) => onEdit(r.id, { rank: Number(e.target.value) || 1 })}
                />
              </td>
              <td>
                <input
                  className="pz-desc"
                  placeholder="e.g., $200 voucher"
                  value={r.label ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEdit(r.id, { label: e.target.value })}
                  onBlur={(e: React.ChangeEvent<HTMLInputElement>) => onEdit(r.id, { label: e.target.value })}
                />
              </td>
              <td>
                {/* linked sponsor (competition sponsors) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select
                    value={r.sponsor_id ?? ''}
                    onChange={(e) => onEdit(r.id, { sponsor_id: e.target.value || null })}
                    onBlur={(e) => onEdit(r.id, { sponsor_id: e.target.value || null })}
                  >
                    {sponsorOptions.map((opt) => (
                      <option key={opt.id || 'none'} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>

                  {/* optional override text shown on results if you want custom wording */}
                  <input
                    className="pz-sponsor"
                    placeholder="Display name (optional)"
                    value={r.sponsor ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEdit(r.id, { sponsor: e.target.value })}
                    onBlur={(e: React.ChangeEvent<HTMLInputElement>) => onEdit(r.id, { sponsor: e.target.value })}
                  />
                </div>
              </td>
              <td>
                <button className="btn danger" onClick={() => onRemove(r.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4} className="muted">
                No prizes yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="actions" style={{ marginTop: 10 }}>
        <button className="btn accent" onClick={onAdd}>
          Add Prize
        </button>
      </div>
    </div>
  )
}
