import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import {
    listSponsors,
    fetchDefaultGroupLevels,
    listCompetitionSponsors,
    addSponsorToCompetition,
    createSponsor,
} from '@/services/sponsors'

import { listCompetitions } from '@/services/api'

/* =====================================================================
   TYPES
   ===================================================================== */

type Competition = {
    id: string
    name: string
}

type Sponsor = {
    id: string
    name: string
}

type Level = {
    id: string
    label: string
}

type CompetitionSponsor = {
    id: string
    sponsor_id: string
    sponsor_name: string
    level_id: string
}

type ActivePanel = 'none' | 'add-existing' | 'create-new'

/* =====================================================================
   COMPONENT
   ===================================================================== */

export default function AdminSponsors() {
    const { organisationId } = useParams<{ organisationId: string }>()

    const [competitions, setCompetitions] = useState<Competition[]>([])
    const [competitionId, setCompetitionId] = useState('')

    const [rows, setRows] = useState<CompetitionSponsor[]>([])
    const [levels, setLevels] = useState<Level[]>([])
    const [allSponsors, setAllSponsors] = useState<Sponsor[]>([])

    const [activePanel, setActivePanel] = useState<ActivePanel>('none')

    const [sponsorId, setSponsorId] = useState('')
    const [levelId, setLevelId] = useState('')
    const [newName, setNewName] = useState('')

    /* -------------------------------------------------------------
       LOAD INITIAL DATA
       ------------------------------------------------------------- */

    useEffect(() => {
        if (!organisationId) return

            ; (async () => {
                const comps = await listCompetitions(organisationId)

                setCompetitions(
                    (comps ?? [])
                        .filter(
                            (c): c is NonNullable<typeof c> => c !== null
                        )
                        .map(c => ({
                            id: c.id,
                            name: c.name,
                        }))
                )

                setLevels(await fetchDefaultGroupLevels())
                setAllSponsors(await listSponsors())
            })()
    }, [organisationId])


    /* -------------------------------------------------------------
       LOAD SPONSORS WHEN COMPETITION CHANGES
       ------------------------------------------------------------- */

    useEffect(() => {
        if (!competitionId) {
            setRows([])
            return
        }

        ; (async () => {
            setRows(await listCompetitionSponsors(competitionId))
        })()
    }, [competitionId])

    /* -------------------------------------------------------------
       PANEL SWITCHING WITH UNSAVED GUARD
       ------------------------------------------------------------- */

    function hasUnsavedChanges() {
        if (activePanel === 'add-existing') {
            return Boolean(sponsorId || levelId)
        }
        if (activePanel === 'create-new') {
            return newName.trim().length > 0
        }
        return false
    }

    function switchPanel(next: ActivePanel) {
        if (activePanel !== 'none' && hasUnsavedChanges()) {
            const ok = window.confirm(
                'You have unsaved changes. Discard them?'
            )
            if (!ok) return
        }

        setSponsorId('')
        setLevelId('')
        setNewName('')
        setActivePanel(next)
    }

    /* -------------------------------------------------------------
       HELPERS
       ------------------------------------------------------------- */

    function sponsorAlreadyAdded(id: string) {
        return rows.some(r => r.sponsor_id === id)
    }

    async function refreshSponsors() {
        if (!competitionId) return
        setRows(await listCompetitionSponsors(competitionId))
    }

    /* -------------------------------------------------------------
       ACTIONS
       ------------------------------------------------------------- */

    async function addExistingSponsor() {
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

        await refreshSponsors()
        setActivePanel('none')
    }

    async function saveNewSponsor() {
        if (!newName.trim()) return

        await createSponsor(newName.trim())
        setAllSponsors(await listSponsors())
        setActivePanel('none')
        setNewName('')
    }

    /* -------------------------------------------------------------
       RENDER
       ------------------------------------------------------------- */

    return (
        <>
            {/* ================= HEADER CARD ================= */}
            <section className="card">
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 24,
                    }}
                >
                    {/* LEFT */}
                    <div>
                        <h2 style={{ margin: 0 }}>Sponsors</h2>

                        {competitionId && (
                            <p className="muted small" style={{ marginTop: 6 }}>
                                Showing sponsors for{' '}
                                <strong>
                                    {
                                        competitions.find(
                                            c => c.id === competitionId
                                        )?.name
                                    }
                                </strong>
                            </p>
                        )}
                    </div>

                    {/* RIGHT */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 8,
                        }}
                    >
                        <select
                            value={competitionId}
                            onChange={e => setCompetitionId(e.target.value)}
                            style={{ maxWidth: 320 }}
                        >
                            <option value="">Select a tournament…</option>
                            {competitions.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                className="btn"
                                disabled={!competitionId}
                                onClick={() =>
                                    switchPanel('add-existing')
                                }
                            >
                                + Add existing sponsor
                            </button>

                            <button
                                className="btn"
                                disabled={!competitionId}
                                onClick={() =>
                                    switchPanel('create-new')
                                }
                            >
                                + Create new sponsor
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= ADD EXISTING ================= */}
            {activePanel === 'add-existing' && (
                <section className="card">
                    <h3>Add existing sponsor</h3>

                    <div
                        style={{
                            display: 'flex',
                            gap: 12,
                            flexWrap: 'wrap',
                            marginBottom: 12,
                        }}
                    >
                        <select
                            value={sponsorId}
                            onChange={e => setSponsorId(e.target.value)}
                            style={{ flex: 1, minWidth: 240 }}
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
                            style={{ width: 180 }}
                        >
                            <option value="">Select level…</option>
                            {levels.map(l => (
                                <option key={l.id} value={l.id}>
                                    {l.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="actions">
                        <button
                            className="btn primary"
                            disabled={!sponsorId || !levelId}
                            onClick={addExistingSponsor}
                        >
                            Add
                        </button>
                        <button
                            className="btn"
                            onClick={() => switchPanel('none')}
                        >
                            Cancel
                        </button>
                    </div>
                </section>
            )}

            {/* ================= CREATE NEW ================= */}
            {activePanel === 'create-new' && (
                <section className="card">
                    <h3>Create new sponsor</h3>

                    <input
                        placeholder="Sponsor name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                    />

                    <div className="actions">
                        <button
                            className="btn primary"
                            disabled={!newName.trim()}
                            onClick={saveNewSponsor}
                        >
                            Create sponsor
                        </button>
                        <button
                            className="btn"
                            onClick={() => switchPanel('none')}
                        >
                            Cancel
                        </button>
                    </div>
                </section>
            )}

            {/* ================= SPONSOR LIST ================= */}
            {competitionId && (
                <section className="card">
                    {rows.length === 0 && (
                        <p className="muted small">No sponsors added yet.</p>
                    )}

                    {rows.map(row => {
                        const levelLabel =
                            levels.find(l => l.id === row.level_id)?.label

                        return (
                            <div
                                key={row.id}
                                className="row-card sponsor-row"
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 12,
                                        alignItems: 'center',
                                    }}
                                >
                                    <strong>{row.sponsor_name}</strong>
                                    <span className="muted">
                                        {levelLabel}
                                    </span>
                                </div>

                                <button className="btn">Edit</button>
                            </div>
                        )
                    })}
                </section>
            )}
        </>
    )
}
