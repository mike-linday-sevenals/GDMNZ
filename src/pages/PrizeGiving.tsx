// src/pages/PrizeGiving.ts
import { useEffect, useState, useMemo } from 'react'
import { fetchSettings, listFishJoined, listSpecies } from '@/services/api'
import { fmt } from '@/utils'
import { listPrizes } from '@/services/prizes'

type Category = 'combined' | 'adult' | 'junior'
type PrizeCell = { label: string; sponsor: string | null }
type PrizeMap = Record<
    string,
    { combined: Record<number, PrizeCell>; adult: Record<number, PrizeCell>; junior: Record<number, PrizeCell> }
>

export default function PrizeGiving() {
    const [settings, setSettings] = useState<any>(null)
    const [entries, setEntries] = useState<any[]>([])
    const [species, setSpecies] = useState<{ id: number; name: string }[]>([])
    const [prizeMap, setPrizeMap] = useState<PrizeMap>({})

    useEffect(() => {
        (async () => {
            const [st, fish, spRows, pRows] = await Promise.all([
                fetchSettings(),
                listFishJoined(),
                listSpecies(), // MUST return id + name
                listPrizes(),  // from '@/services/prizes'
            ])
            setSettings(st)
            setEntries(fish)

            const sp = spRows.map((s: any) => ({ id: s.id, name: s.name }))
            setSpecies(sp)

            // Build: speciesName -> category -> { rank -> {label,sponsor} }
            const byId = new Map<number, string>(spRows.map((s: any) => [s.id, s.name]))
            const m: PrizeMap = {}
            for (const s of spRows) m[s.name] = { combined: {}, adult: {}, junior: {} }
            for (const p of pRows) {
                const sName = byId.get(p.species_id)
                if (!sName) continue
                const cat: Category = (p.for_category ?? 'combined') as Category
                m[sName] ??= { combined: {}, adult: {}, junior: {} }
                m[sName][cat][p.rank] = { label: p.label ?? '', sponsor: p.sponsor ?? '' }
            }
            setPrizeMap(m)
        })()
    }, [])

    // Active species set from settings (default: all active)
    const activeSet = useMemo(() => {
        if (!settings) return null
        const ids: number[] = Array.isArray(settings.activeSpeciesIds)
            ? settings.activeSpeciesIds
            : species.map(s => s.id)
        return new Set(ids)
    }, [settings, species])

    function parseWeighIn(ts?: string | null) {
        if (!ts) return Number.POSITIVE_INFINITY
        const n = Date.parse(String(ts))
        return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n
    }

    // Sort by value desc, tie-break on earliest created_at (first weighed/registered wins)
    function rankFor(arr: any[]) {
        const s = settings || { compMode: 'weight' }
        return arr.slice().sort((a, b) => {
            const pa = s.compMode === 'measure' ? (a.length_cm || 0) : (a.weight_kg || 0)
            const pb = s.compMode === 'measure' ? (b.length_cm || 0) : (b.weight_kg || 0)
            if (pb !== pa) return pb - pa
            const ta = parseWeighIn(a.created_at)
            const tb = parseWeighIn(b.created_at)
            return ta - tb
        })
    }

    const mode: 'combined' | 'split' = settings?.prizeMode || 'combined'
    const speciesToShow = (activeSet ? species.filter(s => activeSet.has(s.id)) : species)

    return (
        <section className="card">
            <h2>Prize Giving</h2>
            <p className="sub">
                Mode: <strong>{mode === 'combined' ? 'Combined' : 'Split (Adult & Junior)'}</strong> — shown in reverse order for announcing (3rd → 1st).
                &nbsp;Entry day/time reflect <strong>submission</strong> (date of entry).
            </p>

            {!!activeSet && speciesToShow.length !== species.length && (
                <p className="sub">Showing <strong>active species only</strong>. Toggle species in <em>Settings → Species visibility</em>.</p>
            )}

            {speciesToShow.map(s => {
                const all = entries.filter(e => e.species?.id === s.id)
                const node = prizeMap[s.name] || { combined: {}, adult: {}, junior: {} }

                if (mode === 'combined') {
                    const pz = node.combined
                    const places = Object.keys(pz).map(n => parseInt(n)).sort((a, b) => b - a) // reverse for 3rd→1st
                    if (places.length === 0) {
                        return (
                            <section className="card" key={s.id}>
                                <h3>{s.name}</h3>
                                <p className="muted">No prizes configured.</p>
                            </section>
                        )
                    }
                    const ranked = rankFor([...all]).slice(0, Math.max(...places))
                    return (
                        <SpeciesBlock
                            key={s.id}
                            name={s.name}
                            label="Combined"
                            places={places}
                            ranked={ranked}
                            prizeMap={pz}
                            compMode={settings?.compMode || 'weight'}
                        />
                    )
                } else {
                    const pzA = node.adult
                    const pzJ = node.junior
                    const placesA = Object.keys(pzA).map(n => parseInt(n)).sort((a, b) => b - a)
                    const placesJ = Object.keys(pzJ).map(n => parseInt(n)).sort((a, b) => b - a)
                    const rankedA = rankFor(all.filter(e => e.competitor?.category === 'adult')).slice(0, Math.max(0, ...placesA))
                    const rankedJ = rankFor(all.filter(e => e.competitor?.category === 'junior')).slice(0, Math.max(0, ...placesJ))

                    return (
                        <div key={s.id}>
                            <section className="card">
                                <h3>{s.name} — Adult</h3>
                                {placesA.length
                                    ? <Table places={placesA} ranked={rankedA} pz={pzA} compMode={settings?.compMode || 'weight'} showCat={false} />
                                    : <p className="muted">No Adult prizes.</p>}
                            </section>
                            <section className="card">
                                <h3>{s.name} — Junior</h3>
                                {placesJ.length
                                    ? <Table places={placesJ} ranked={rankedJ} pz={pzJ} compMode={settings?.compMode || 'weight'} showCat={false} />
                                    : <p className="muted">No Junior prizes.</p>}
                            </section>
                        </div>
                    )
                }
            })}
        </section>
    )
}

function SpeciesBlock({
    name, label, places, ranked, prizeMap, compMode
}: {
    name: string; label: string; places: number[]; ranked: any[]; prizeMap: any; compMode: 'weight' | 'measure'
}) {
    return (
        <section className="card">
            <h3>{name} — {label}</h3>
            <Table places={places} ranked={ranked} pz={prizeMap} compMode={compMode} showCat />
        </section>
    )
}

function Table({
    places, ranked, pz, compMode, showCat
}: {
    places: number[]; ranked: any[]; pz: Record<number, PrizeCell>; compMode: 'weight' | 'measure'; showCat: boolean
}) {
    return (
        <table>
            <thead>
                <tr>
                    <th>Place</th>
                    <th>Competitor</th>
                    {showCat && <th>Category</th>}
                    <th>{compMode === 'measure' ? 'Length (cm)' : 'Weight (kg)'}</th>
                    <th>Entry date</th>
                    <th>Entry time</th>
                    <th>Prize</th>
                    <th>Sponsor</th>
                </tr>
            </thead>
            <tbody>
                {places.map(place => {
                    const c = ranked[place - 1]

                    // No qualified entry for this place
                    if (!c) {
                        const totalAfterPlace =
                            1 /* Competitor */ +
                            (showCat ? 1 : 0) +
                            1 /* Metric */ +
                            1 /* Entry date */ +
                            1 /* Entry time */ +
                            1 /* Prize */ +
                            1 /* Sponsor */
                        return (
                            <tr key={place}>
                                <td>{place}</td>
                                <td colSpan={totalAfterPlace} className="muted">— no qualified entry —</td>
                            </tr>
                        )
                    }

                    const prize = pz[place] || { label: '', sponsor: '' }
                    const catLabel = c.competitor?.category === 'adult' ? 'Adult' : 'Junior'
                    const catBadge = <span className={`cat-badge cat-${catLabel}`}>{catLabel}</span>

                    const metric =
                        compMode === 'measure'
                            ? (c.length_cm != null ? fmt(c.length_cm, 1) : '')
                            : (c.weight_kg != null ? fmt(c.weight_kg, 2) : '')

                    // ENTRY (submission) date/time
                    const dt = c.created_at ? new Date(c.created_at) : null
                    const valid = dt && !Number.isNaN(+dt)
                    const entryDate = valid ? dt!.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' }) : ''
                    const entryTime = valid ? dt!.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }) : ''

                    return (
                        <tr key={place}>
                            {/* Place: number only (no Junior badge here) */}
                            <td>{place}</td>
                            <td>{c.competitor?.full_name || ''}</td>
                            {showCat && <td>{catBadge}</td>}
                            <td>{metric}</td>
                            <td>{entryDate}</td>
                            <td>{entryTime}</td>
                            <td>{prize.label}</td>
                            <td className="sponsor">{prize.sponsor || ''}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

