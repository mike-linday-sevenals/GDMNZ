// src/pages/AdminSponsors.tsx
import { useEffect, useRef, useState } from 'react'
import {
  createSponsor,
  fetchDefaultGroupLevels,
  addSponsorToCompetition,
  listCompetitionSponsors,
} from '@/services/sponsors'
import { supabase } from '@/services/db'

const BLURB_MAX = 240

// Helper: get current competition (running today, else latest)
async function getCurrentCompetitionId(): Promise<string> {
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

export default function AdminSponsors() {
  const [competitionId, setCompetitionId] = useState<string>('')

  // form fields
  const [name, setName] = useState('')
  const [levels, setLevels] = useState<{ id: string; label: string }[]>([])
  const [levelId, setLevelId] = useState<string>('')
  const [displayOrder, setDisplayOrder] = useState<string>('')
  const [blurb, setBlurb] = useState('')

  // sponsors already linked
  const [linked, setLinked] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const blurbRef = useRef<HTMLTextAreaElement | null>(null)
  const blurbCount = blurb.length

  // auto-resize the textarea
  function autosize(el: HTMLTextAreaElement) {
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 'px'
  }
  useEffect(() => {
    if (blurbRef.current) autosize(blurbRef.current)
  }, [blurb])

  useEffect(() => {
    ;(async () => {
      try {
        const [cid, lvls] = await Promise.all([
          getCurrentCompetitionId(),
          fetchDefaultGroupLevels(),
        ])
        setCompetitionId(cid)
        setLevels(lvls)
        if (lvls.length) setLevelId(lvls[0].id)
        const rows = await listCompetitionSponsors(cid)
        setLinked(rows)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const sponsor = await createSponsor(name.trim())
      await addSponsorToCompetition({
        competition_id: competitionId,
        sponsor_id: sponsor.id,
        level_id: levelId || null,
        display_order: displayOrder === '' ? null : Number(displayOrder),
        blurb: blurb || null,
      })
      const rows = await listCompetitionSponsors(competitionId)
      setLinked(rows)
      setName('')
      setDisplayOrder('')
      setBlurb('')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="card">
        <h3>Sponsors (DB)</h3>
        <p className="muted">Loading…</p>
      </section>
    )
  }

  return (
    <section className="card">
      <h3>Sponsors (DB)</h3>
      <p className="sub">Competition: {competitionId.slice(0, 8)}…</p>

      {/* Row 1: Name / Level / Order / Add */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'minmax(280px, 1fr) 180px 110px auto',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <input
          placeholder="Sponsor name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
          {!levels.length && <option value="">(no levels)</option>}
        </select>
        <input
          type="number"
          placeholder="Order"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
        />
        <button className="btn" onClick={handleAdd} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>

      {/* Row 2: Blurb textarea with counter */}
      <div style={{ marginTop: 8 }}>
        <label className="muted" htmlFor="s-blurb">Blurb (optional)</label>
        <textarea
          id="s-blurb"
          ref={blurbRef}
          value={blurb}
          maxLength={BLURB_MAX}
          onInput={(e) => {
            const el = e.currentTarget
            setBlurb(el.value)
            autosize(el)
          }}
          placeholder="Short sponsor description shown on prizegiving pages…"
          style={{
            width: '100%',
            minHeight: 44,
            resize: 'none',
            overflow: 'hidden',
          }}
        />
        <div className="muted" style={{ textAlign: 'right', fontSize: 12 }}>
          {blurbCount}/{BLURB_MAX}
        </div>
      </div>

      <ul className="list" style={{ marginTop: 12 }}>
        {linked.length === 0 && (
          <li className="muted">No sponsors linked for this competition.</li>
        )}
        {linked.map((row) => (
          <li key={row.id}>
            <strong>{row.display_order ?? '—'}</strong>&nbsp;{row.sponsor_name}
            {row.level_label && (
              <span className="muted"> ({row.level_label})</span>
            )}
            {row.blurb && <span className="muted"> — {row.blurb}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
