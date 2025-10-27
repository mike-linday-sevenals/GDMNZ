// src/pages/PublicResultsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { fetchSettings, listFishJoined, listSpecies } from '@/services/api';
import { fmt } from '@/utils';

type Settings = {
    compMode: 'weight' | 'measure';
    prizeMode: 'combined' | 'split';
    activeSpeciesIds?: number[];
};

type Entry = {
    id: string | number;
    created_at?: string | null;
    weight_kg?: number | null;
    length_cm?: number | null;
    species?: { id: number; name: string } | null;
    competitor?: { full_name?: string; category?: 'adult' | 'junior' } | null;
};

type SpeciesRow = { id: number; name: string };

export default function PublicResultsPage() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [species, setSpecies] = useState<SpeciesRow[]>([]);
    const [selectedDay, setSelectedDay] = useState<string>('all');
    const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | 'all'>('all');
    const [showAdult, setShowAdult] = useState(true);
    const [showJunior, setShowJunior] = useState(true);

    useEffect(() => {
        (async () => {
            const [st, fish, spRows] = await Promise.all([
                fetchSettings(),
                listFishJoined(),
                listSpecies(),
            ]);
            setSettings(st);
            setEntries(fish);
            setSpecies(spRows.map((s: any) => ({ id: s.id, name: s.name })));
        })();
    }, []);

    function dateKeyLocal(ts?: string | null): string {
        if (!ts) return '';
        const d = new Date(ts);
        if (Number.isNaN(+d)) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    }

    function parseWeighIn(ts?: string | null) {
        if (!ts) return Number.POSITIVE_INFINITY;
        const n = Date.parse(String(ts));
        return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    }

    /** Rank descending by metric, tie-break earliest weigh-in */
    function rank(items: Entry[], mode: 'weight' | 'measure') {
        return items.slice().sort((a, b) => {
            const va = mode === 'measure' ? (a.length_cm ?? 0) : (a.weight_kg ?? 0);
            const vb = mode === 'measure' ? (b.length_cm ?? 0) : (b.weight_kg ?? 0);
            if (vb !== va) return vb - va;
            const ta = parseWeighIn(a.created_at);
            const tb = parseWeighIn(b.created_at);
            return ta - tb;
        });
    }

    const uniqueDays = useMemo(() => {
        const keys = new Set<string>();
        for (const e of entries) {
            const k = dateKeyLocal(e.created_at);
            if (k) keys.add(k);
        }
        return Array.from(keys).sort();
    }, [entries]);

    const compMode: 'weight' | 'measure' = settings?.compMode || 'weight';

    // Respect active species from settings
    const activeSet = useMemo(() => {
        if (!settings) return null;
        const ids = Array.isArray(settings.activeSpeciesIds)
            ? settings.activeSpeciesIds
            : species.map((s) => s.id);
        return new Set(ids);
    }, [settings, species]);

    // Apply filters
    const filtered = useMemo(() => {
        return entries.filter((e) => {
            if (activeSet && e.species?.id != null && !activeSet.has(e.species.id)) return false;
            if (selectedSpeciesId !== 'all') {
                if (!e.species || e.species.id !== selectedSpeciesId) return false;
            }
            if (selectedDay !== 'all') {
                if (dateKeyLocal(e.created_at) !== selectedDay) return false;
            }
            return true;
        });
    }, [entries, selectedSpeciesId, selectedDay, activeSet]);

    // Species dropdown respects active set
    const allActiveSpecies = useMemo(
        () => (activeSet ? species.filter((s) => activeSet.has(s.id)) : species),
        [species, activeSet]
    );

    // Which species sections to render
    const speciesToRender: SpeciesRow[] = useMemo(() => {
        if (selectedSpeciesId === 'all') return allActiveSpecies;
        const s = allActiveSpecies.find((x) => x.id === selectedSpeciesId);
        return s ? [s] : [];
    }, [allActiveSpecies, selectedSpeciesId]);

    return (
        <>
            {/* Top brand banner */}
            <section
                className="card"
                style={{
                    textAlign: 'center',
                    padding: '18px 16px',
                    borderRadius: 16,
                    marginTop: 14,
                }}
            >
                <h1 style={{ margin: 0, fontSize: 24, letterSpacing: 0.3 }}>
                    WOSC &amp; 100% HOME WHANGAMATA
                </h1>
                <div className="sub">Live Competition Results</div>
            </section>

            <section className="card">
                <h2>Results</h2>
                <p className="sub">Full leaderboard (top to bottom), tie-break on earliest weigh-in.</p>

                {/* Filters */}
                <div className="grid two" style={{ alignItems: 'end', marginBottom: 8 }}>
                    <div className="grid" style={{ gap: 8 }}>
                        {/* Day filter */}
                        <div className="flex">
                            <span className="pill">Day</span>
                            <button
                                className={`pill ${selectedDay === 'all' ? 'active' : ''}`}
                                onClick={() => setSelectedDay('all')}
                            >
                                All
                            </button>
                            {uniqueDays.map((d, i) => (
                                <button
                                    key={d}
                                    className={`pill ${selectedDay === d ? 'active' : ''}`}
                                    onClick={() => setSelectedDay(d)}
                                >
                                    {`Day ${i + 1}`}{' '}
                                    <span className="muted" style={{ marginLeft: 6 }}>
                                        {prettyNZDate(d)}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Species filter */}
                        <div className="flex">
                            <span className="pill">Species</span>
                            <select
                                value={String(selectedSpeciesId)}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setSelectedSpeciesId(v === 'all' ? 'all' : Number(v));
                                }}
                                style={{ width: 240 }}
                            >
                                <option value="all">All species</option>
                                {allActiveSpecies.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Category toggles */}
                    <div className="flex" style={{ justifyContent: 'flex-end' }}>
                        <span className="pill">Category</span>
                        <button
                            className={`pill ${showAdult ? 'active' : ''}`}
                            onClick={() => setShowAdult((v) => !v)}
                            title="Toggle Adult"
                        >
                            Adult
                        </button>
                        <button
                            className={`pill ${showJunior ? 'active' : ''}`}
                            onClick={() => setShowJunior((v) => !v)}
                            title="Toggle Junior"
                        >
                            Junior
                        </button>
                    </div>
                </div>

                {/* Species blocks (ALL results shown) */}
                {speciesToRender.map((sp) => {
                    const bySpecies = filtered.filter((e) => e.species?.id === sp.id);
                    const adultRanked = rank(bySpecies.filter((e) => e.competitor?.category === 'adult'), compMode);
                    const juniorRanked = rank(bySpecies.filter((e) => e.competitor?.category === 'junior'), compMode);
                    const hasAny = (showAdult && adultRanked.length) || (showJunior && juniorRanked.length);

                    return (
                        <section className="card" key={sp.id}>
                            <h3>{sp.name}</h3>
                            {!hasAny ? (
                                <p className="muted">No qualifying entries yet.</p>
                            ) : (
                                <div className="grid two">
                                    {showAdult && (
                                        <div>
                                            <h4 style={{ marginTop: 0 }}>
                                                Adult <span className="badge">Total {adultRanked.length}</span>
                                            </h4>
                                            <ResultsTable rows={adultRanked} compMode={compMode} />
                                        </div>
                                    )}
                                    {showJunior && (
                                        <div>
                                            <h4 style={{ marginTop: 0 }}>
                                                Junior <span className="badge">Total {juniorRanked.length}</span>
                                            </h4>
                                            <ResultsTable rows={juniorRanked} compMode={compMode} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    );
                })}
            </section>
        </>
    );
}

function ResultsTable({ rows, compMode }: { rows: any[]; compMode: 'weight' | 'measure' }) {
    return (
        <table>
            <thead>
                <tr>
                    <th style={{ width: 56 }}>Rank</th>
                    <th>Competitor</th>
                    <th style={{ width: 140 }}>{compMode === 'measure' ? 'Length (cm)' : 'Weight (kg)'}</th>
                    <th style={{ width: 140 }}>Weigh-in</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((e, idx) => {
                    const metric =
                        compMode === 'measure'
                            ? e.length_cm != null
                                ? fmt(e.length_cm, 1)
                                : ''
                            : e.weight_kg != null
                                ? fmt(e.weight_kg, 2)
                                : '';
                    return (
                        <tr key={e.id ?? idx}>
                            <td>{idx + 1}</td>
                            <td>{e.competitor?.full_name || ''}</td>
                            <td>{metric}</td>
                            <td>{prettyNZTime(e.created_at)}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function prettyNZDate(ymd: string) {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' });
}

function prettyNZTime(ts?: string | null) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(+d)) return '';
    return d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
}
