import { useEffect, useState } from 'react'
import {
    listSponsors,
    fetchDefaultGroupLevels,
    listCompetitionSponsors,
    addSponsorToCompetition,
} from '@/services/sponsors'
import { listCompetitions } from '@/services/api'

type Competition = { id: string; name: string }
type Sponsor = { id: string; name: string }
type Level = { id: string; label: string }

type CompetitionSponsor = {
    id: string
    sponsor_id: string
    sponsor_name: string
    level_id: string
}

export default function AdminSponsors() {
    const [competitions, setCompetitions] = useState<Competition[]>([])
    const [competitionId, setCompetitionId] = useState('')
    const [rows, setRows] = useState<CompetitionSponsor[]>([])
    const [levels, setLevels] = useState<Level[]>([])
    const [allSponsors, setAllSponsors] = useState<Sponsor[]>([])
    const [adding, setAdding] = useState(false)
    const [sponsorId, setSponsorId] = useState('')
    const [levelId, setLevelId] = useState('')

    /* ---------------- Load initial data ---------------- */

    useEffect(() => {
        ; (async () => {
            const comps = await listCompetitions()
            setCompetitions(comps)

            // DO NOT auto-select a competition
            setLevels(await fetchDefaultGroupLevels())
            setAllSponsors(await listSponsors())
        })()
    }, [])

    /* ---------------- Load sponsors when competition changes ---------------- */

    useEffect(() => {
        if (!competitionId) {
            setRows([])
            return
        }

        ; (async () => {
            setRows(await listCompetitionSponsors(competitionId))
        })()
    }, [competitionId])

    /* ---------------- Helpers ---------------- */

    function sponsorAlreadyAdded(id: string) {
        return rows.some(r => r.sponsor_id === id)
    }

    /* ---------------- Add sponsor ---------------- */

    async function addSponsor() {
        if (!competitionId || !sponsorId || !levelId) return

        if (sponsorAlreadyAdded(sponsorId)) {
            alert('This sponsor is already added to this competition.')
            return
        }

        await addSponsorToCompetition({
            competition_id: competitionId,
            sponsor_id: sponsorId,
            level_id: levelId,
            display_order: null,
            blurb: null,
        })

        setRows(await listCompetitionSponsors(competitionId))
        setAdding(false)
        setSponsorId('')
        setLevelId('')
    }

    return (
        <>
            {/* Competition selector */}
            <section className="card">
                <select
                    value={competitionId}
                    onChange={e => setCompetitionId(e.target.value)}
                >
                    <option value="">Select a tournament…</option>
                    {competitions.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                {!competitionId && (
                    <p className="muted small">
                        Please select a tournament to manage sponsors.
                    </p>
                )}

                {competitionId && (
                    <p className="muted small">
                        Showing sponsors for{' '}
                        <strong>
                            {competitions.find(c => c.id === competitionId)?.name}
                        </strong>
                    </p>
                )}
            </section>

            {/* Sponsor list */}
            {competitionId && (
                <section className="card">
                    {/* Empty state */}
                    {rows.length === 0 && (
                        <p className="muted small">No sponsors added yet.</p>
                    )}

                    {/* Existing sponsors */}
                    {rows.map(row => (
                        <div key={row.id} className="row-card sponsor-row">
                            <div className="sponsor-meta">
                                <strong>{row.sponsor_name}</strong>
                                <span className="muted">
                                    {
                                        levels.find(
                                            l => l.id === row.level_id
                                        )?.label
                                    }
                                </span>
                            </div>

                            <button
                                className="btn"
                                onClick={() => alert('Edit coming next')}
                            >
                                Edit
                            </button>
                        </div>
                    ))}

                    {/* Add sponsor */}
                    {!adding ? (
                        <button className="btn" onClick={() => setAdding(true)}>
                            + Add sponsor
                        </button>
                    ) : (
                        <div className="row-card">
                            <select
                                value={sponsorId}
                                onChange={e => setSponsorId(e.target.value)}
                            >
                                <option value="">Select sponsor…</option>
                                {allSponsors.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={levelId}
                                onChange={e => setLevelId(e.target.value)}
                            >
                                <option value="">Select level…</option>
                                {levels.map(l => (
                                    <option key={l.id} value={l.id}>
                                        {l.label}
                                    </option>
                                ))}
                            </select>

                            <div className="actions">
                                <button
                                    className="btn primary"
                                    disabled={!sponsorId || !levelId}
                                    onClick={addSponsor}
                                >
                                    Add
                                </button>
                                <button
                                    className="btn"
                                    onClick={() => setAdding(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            )}
        </>
    )
}
