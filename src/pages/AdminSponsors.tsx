// src/pages/AdminSponsors.tsx
import { useEffect, useRef, useState } from 'react'
import {
    createSponsor,
    fetchDefaultGroupLevels,
    addSponsorToCompetition,
    listCompetitionSponsors,
} from '@/services/sponsors'
import { listCompetitions } from '@/services/api'

const BLURB_MAX = 240

export default function AdminSponsors() {
    const [competitionId, setCompetitionId] = useState<string>('')

    const [name, setName] = useState('')
    const [levels, setLevels] = useState<{ id: string; label: string }[]>([])
    const [levelId, setLevelId] = useState<string>('')
    const [displayOrder, setDisplayOrder] = useState<string>('')
    const [blurb, setBlurb] = useState('')

    const [linked, setLinked] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const blurbRef = useRef<HTMLTextAreaElement | null>(null)

    function autosize(el: HTMLTextAreaElement) {
        el.style.height = '0px'
        el.style.height = el.scrollHeight + 'px'
    }

    useEffect(() => {
        if (blurbRef.current) autosize(blurbRef.current)
    }, [blurb])

    useEffect(() => {
        ; (async () => {
            try {
                const comps = await listCompetitions()
                if (!comps.length) return

                const current = comps.sort(
                    (a: any, b: any) =>
                        new Date(b.starts_at).getTime() -
                        new Date(a.starts_at).getTime()
                )[0]

                setCompetitionId(current.id)

                const lvls = await fetchDefaultGroupLevels()
                setLevels(lvls)
                if (lvls.length) setLevelId(lvls[0].id)

                const rows = await listCompetitionSponsors(current.id)
                setLinked(rows)
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    async function handleAdd() {
        if (!name.trim() || !competitionId) return

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
                <h3>Sponsors</h3>
                <p className="muted">Loading…</p>
            </section>
        )
    }

    return (
        <section className="card">
            <h3>Sponsors</h3>
            <p className="sub">
                Competition: {competitionId.slice(0, 8)}…
            </p>

            <div
                className="grid"
                style={{
                    gridTemplateColumns: 'minmax(280px, 1fr) 180px 110px auto',
                    gap: 8,
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
                </select>

                <input
                    type="number"
                    placeholder="Order"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                />

                <button
                    className="btn"
                    onClick={handleAdd}
                    disabled={saving || !name.trim()}
                >
                    {saving ? 'Saving…' : 'Add'}
                </button>
            </div>

            <div style={{ marginTop: 8 }}>
                <label className="muted">Blurb (optional)</label>
                <textarea
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
                    {blurb.length}/{BLURB_MAX}
                </div>
            </div>

            <ul className="list" style={{ marginTop: 12 }}>
                {linked.length === 0 && (
                    <li className="muted">No sponsors linked for this competition.</li>
                )}
                {linked.map((row: any) => (
                    <li key={row.id}>
                        <strong>{row.display_order ?? '—'}</strong>{' '}
                        {row.sponsor_name}
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
