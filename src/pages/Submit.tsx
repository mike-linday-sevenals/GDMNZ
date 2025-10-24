import { useEffect, useMemo, useState } from 'react'
import { addFish, fetchSettings, listCompetitors, listSpecies, listFishJoined } from '@/services/api'
import type { Competitor, Species } from '@/types'
import { todayISO } from '@/utils'

type Settings = {
    compMode: 'weight' | 'measure'
    showTime: boolean
    requireTime: boolean
    activeSpeciesIds?: number[]
}

export default function Submit() {
    const [settings, setSettings] = useState<Settings | null>(null)
    const [species, setSpecies] = useState<Species[]>([])
    const [competitors, setCompetitors] = useState<Competitor[]>([])

    useEffect(() => {
        (async () => {
            const [st, sp, comps] = await Promise.all([
                fetchSettings(),
                listSpecies(),
                listCompetitors()
            ])
            setSettings(st)
            setSpecies(sp)
            setCompetitors(comps)
        })()
    }, [])

    // ===== Competitor quick-filter =====
    const [search, setSearch] = useState('')
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim()
        if (!q) return competitors.slice(0, 50)
        return competitors
            .filter(c => [c.full_name, c.boat || ''].join(' ').toLowerCase().includes(q))
            .slice(0, 50)
    }, [search, competitors])

    // ===== Form state =====
    const [competitorId, setCompetitorId] = useState<string>('')
    const [lengthCm, setLengthCm] = useState<string>('')   // text so we can preserve user input
    const [weightKg, setWeightKg] = useState<string>('')   // text so we can preserve user input
    const [specId, setSpecId] = useState<number | ''>('')    // number or '' for "none"
    const [timeCaught, setTimeCaught] = useState<string>('') // "HH:mm"
    const [dateCaught, setDateCaught] = useState<string>(todayISO())
    const [keepAfter, setKeepAfter] = useState<boolean>(false)

    // ===== Active species from settings =====
    const activeSet = useMemo(() => {
        if (!settings) return null
        const ids = Array.isArray(settings.activeSpeciesIds)
            ? settings.activeSpeciesIds!
            : species.map(s => s.id) // default: all species active if not configured
        return new Set(ids)
    }, [settings, species])

    const activeSpecies = useMemo(() => {
        return activeSet ? species.filter(s => activeSet.has(s.id)) : species
    }, [species, activeSet])

    // If current specId becomes inactive due to a settings change, clear it
    useEffect(() => {
        if (specId === '') return
        if (activeSet && !activeSet.has(Number(specId))) setSpecId('')
    }, [activeSet, specId])

    // ===== Save handler =====
    async function save(stay: boolean) {
        if (!competitorId) { alert('Please select a registered competitor'); return }
        if (!specId) { alert('Please select a species'); return }
        if (!settings) { alert('Settings not loaded yet'); return }

        if (settings.compMode === 'measure') {
            if (!lengthCm || Number(lengthCm) <= 0) { alert('Length is required'); return }
        } else {
            if (!weightKg || Number(weightKg) <= 0) { alert('Weight is required'); return }
        }
        if (settings.showTime && settings.requireTime && !timeCaught) {
            alert('Time is required'); return
        }

        const hhmm = timeCaught || '00:00'
        const dateIso = dateCaught || todayISO()
        const timeISO = `${dateIso}T${hhmm}`

        await addFish({
            competitor_id: competitorId,
            species_id: Number(specId),
            length_cm: settings.compMode === 'measure' ? Number(lengthCm || 0) : null,
            weight_kg: settings.compMode === 'weight' ? Number(weightKg || 0) : null,
            time_caught: settings.showTime ? timeISO : null
        })

        // light refresh / cache-bust for any local state depending on fish
        await listFishJoined()
        alert('Catch saved')

        if (stay) {
            const keep = keepAfter ? competitorId : ''
            setLengthCm('')
            setWeightKg('')
            if (!settings.requireTime) setTimeCaught('')
            setSpecId('')
            if (!keep) setCompetitorId('')
            setSearch('')
        } else {
            location.href = '/results'
        }
    }

    return (
        <section className="card">
            <h2>Submit a Catch</h2>

            {/* Show note if visibility is restricting options */}
            {!!activeSet && activeSpecies.length !== species.length && (
                <p className="sub">Only <strong>active species</strong> are listed. Update in <em>Settings → Species visibility</em>.</p>
            )}

            <div className="row">
                <div className="col-6">
                    <label>Search competitor (name or boat)</label>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type to filter by name or boat" />
                    <div className="sub">Or pick from dropdown below.</div>
                </div>
                <div className="col-6">
                    <label>Competitor</label>
                    <select value={competitorId} onChange={e => setCompetitorId(e.target.value)}>
                        <option value="">— Select registered competitor —</option>
                        {filtered.map(c => (
                            <option key={String(c.id)} value={String(c.id)}>
                                {c.full_name} ({c.category === 'adult' ? 'Adult' : 'Junior'}) — {c.boat || ''}
                            </option>
                        ))}
                    </select>
                </div>

                {settings?.compMode === 'measure' ? (
                    <>
                        <div className="col-3">
                            <label>Length (cm) <span className="muted">*</span></label>
                            <input
                                value={lengthCm}
                                onChange={e => setLengthCm(e.target.value)}
                                type="number" step="0.1" placeholder="e.g., 55.2" />
                        </div>
                        <div className="col-3">
                            <label>Weight (kg) <span className="muted">(optional)</span></label>
                            <input
                                value={weightKg}
                                onChange={e => setWeightKg(e.target.value)}
                                type="number" step="0.001" placeholder="e.g., 3.45" />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="col-3">
                            <label>Weight (kg) <span className="muted">*</span></label>
                            <input
                                value={weightKg}
                                onChange={e => setWeightKg(e.target.value)}
                                type="number" step="0.001" placeholder="e.g., 3.45" />
                        </div>
                        <div className="col-3">
                            <label>Length (cm) <span className="muted">(optional)</span></label>
                            <input
                                value={lengthCm}
                                onChange={e => setLengthCm(e.target.value)}
                                type="number" step="0.1" placeholder="e.g., 55.2" />
                        </div>
                    </>
                )}

                <div className="col-3">
                    <label>Species</label>
                    <select
                        value={specId === '' ? '' : String(specId)}
                        onChange={e => {
                            const v = e.target.value
                            setSpecId(v ? Number(v) : '')
                        }}
                    >
                        <option value="">Select species…</option>
                        {activeSpecies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div className={`col-3 ${settings?.showTime ? '' : 'muted'}`}>
                    <label>
                        Time Caught {settings?.requireTime ? <span className="muted">*</span> : null}
                    </label>
                    <input
                        type="time"
                        disabled={!settings?.showTime}
                        value={timeCaught}
                        onChange={e => setTimeCaught(e.target.value)}
                    />
                </div>

                <div className="col-3">
                    <label>Date Caught</label>
                    <input type="date" value={dateCaught} onChange={e => setDateCaught(e.target.value)} />
                </div>

                <div className="col-3">
                    <label>Location (local only)</label>
                    <input placeholder="e.g., Gulf Harbour" />
                </div>

                <div className="col-12">
                    <label>Notes (local only)</label>
                    <textarea placeholder="Anything worth noting..." />
                </div>
            </div>

            <div className="actions">
                <label className="switch">
                    <input type="checkbox" checked={keepAfter} onChange={e => setKeepAfter(e.target.checked)} />
                    Keep competitor after save
                </label>
                <button className="btn primary" onClick={() => save(false)}>Save Catch</button>
                <button className="btn accent" onClick={() => save(true)}>Save &amp; Add another</button>
                <button className="btn" onClick={() => location.reload()}>Clear Form</button>
            </div>
        </section>
    )
}
