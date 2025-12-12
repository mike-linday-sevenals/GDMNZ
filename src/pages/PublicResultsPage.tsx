// src/pages/PublicResultsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
    fetchSettings,
    listFishJoinedForCompetition,
    listSpecies,
    listCompetitions,
} from '@/services/api';

import { fmt } from '@/utils';

/* ===================== TYPES ===================== */

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

/* ===================== COMPONENT ===================== */

export default function PublicResultsPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const params = new URLSearchParams(location.search);
    const competitionId = params.get('competition');

    const [competitions, setCompetitions] = useState<any[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [species, setSpecies] = useState<SpeciesRow[]>([]);
    const [loading, setLoading] = useState(false);

    const [selectedDay, setSelectedDay] = useState<string>('all');
    const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | 'all'>('all');
    const [showAdult, setShowAdult] = useState(true);
    const [showJunior, setShowJunior] = useState(true);

    /* ===================== LOAD COMPETITIONS ===================== */

    useEffect(() => {
        (async () => {
            const comps = await listCompetitions();
            setCompetitions(comps || []);
        })();
    }, []);

    /* ===================== LOAD RESULTS WHEN COMP CHANGES ===================== */

    useEffect(() => {
        if (!competitionId) {
            setEntries([]);
            return;
        }

        setLoading(true);

        (async () => {
            const [st, fish, spRows] = await Promise.all([
                fetchSettings(),
                listFishJoinedForCompetition(competitionId),
                listSpecies(),
            ]);

            setSettings(st);
            setEntries(fish);
            setSpecies(spRows.map((s: any) => ({ id: s.id, name: s.name })));
            setLoading(false);
        })();
    }, [competitionId]);

    /* ===================== HELPERS ===================== */

    function dateKeyLocal(ts?: string | null): string {
        if (!ts) return '';
        const d = new Date(ts);
        if (Number.isNaN(+d)) return '';
        return d.toISOString().slice(0, 10);
    }

    function prettyNZDate(ymd: string) {
        const [y, m, d] = ymd.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-NZ', {
            day: '2-digit',
            month: 'short',
        });
    }

    function parseWeighIn(ts?: string | null) {
        if (!ts) return Number.POSITIVE_INFINITY;
        const n = Date.parse(ts);
        return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    }

    function rank(items: Entry[], mode: 'weight' | 'measure') {
        return items.slice().sort((a, b) => {
            const va = mode === 'measure' ? a.length_cm ?? 0 : a.weight_kg ?? 0;
            const vb = mode === 'measure' ? b.length_cm ?? 0 : b.weight_kg ?? 0;
            if (vb !== va) return vb - va;
            return parseWeighIn(a.created_at) - parseWeighIn(b.created_at);
        });
    }

    /* ===================== FILTERS ===================== */

    const uniqueDays = useMemo(() => {
        const s = new Set<string>();
        entries.forEach((e) => {
            const k = dateKeyLocal(e.created_at);
            if (k) s.add(k);
        });
        return Array.from(s).sort();
    }, [entries]);

    const activeSet = useMemo(() => {
        if (!settings) return null;
        return new Set(
            Array.isArray(settings.activeSpeciesIds)
                ? settings.activeSpeciesIds
                : species.map((s) => s.id)
        );
    }, [settings, species]);

    const filtered = useMemo(() => {
        return entries.filter((e) => {
            if (activeSet && e.species?.id && !activeSet.has(e.species.id)) return false;
            if (selectedSpeciesId !== 'all' && e.species?.id !== selectedSpeciesId) return false;
            if (selectedDay !== 'all' && dateKeyLocal(e.created_at) !== selectedDay) return false;
            return true;
        });
    }, [entries, selectedSpeciesId, selectedDay, activeSet]);

    const speciesToRender = useMemo(() => {
        const base = activeSet
            ? species.filter((s) => activeSet.has(s.id))
            : species;

        if (selectedSpeciesId === 'all') return base;
        return base.filter((s) => s.id === selectedSpeciesId);
    }, [species, activeSet, selectedSpeciesId]);

    const compMode = settings?.compMode || 'weight';
    const isCombined = settings?.prizeMode === 'combined';

    /* ===================== RENDER ===================== */

    return (
        <>
            {/* COMPETITION SELECTOR */}
            <section className="card" style={{ marginTop: 14 }}>
                <label className="sub">Select competition results</label>
                <select
                    value={competitionId || ''}
                    onChange={(e) => {
                        const id = e.target.value;
                        if (id) navigate(`/results?competition=${id}`);
                        else navigate('/results');
                    }}
                    style={{ maxWidth: 360 }}
                >
                    <option value="">— Select competition —</option>
                    {competitions.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </section>

            {/* TITLE */}
            <section className="card" style={{ textAlign: 'center' }}>
                <h1>Live Competition Results</h1>
            </section>

            {!competitionId && (
                <section className="card">
                    <p className="muted">Please select a competition above.</p>
                </section>
            )}

            {competitionId && (
                <section className="card">
                    {loading && <p className="muted">Loading results…</p>}

                    {!loading &&
                        speciesToRender.map((sp) => {
                            const bySpecies = filtered.filter(
                                (e) => e.species?.id === sp.id
                            );

                            const ranked = rank(bySpecies, compMode);

                            return (
                                <section className="card" key={sp.id}>
                                    <h3>{sp.name}</h3>
                                    {ranked.length === 0 ? (
                                        <p className="muted">No entries yet.</p>
                                    ) : (
                                        <ResultsTable rows={ranked} compMode={compMode} />
                                    )}
                                </section>
                            );
                        })}
                </section>
            )}
        </>
    );
}

/* ===================== TABLE ===================== */

function ResultsTable({
    rows,
    compMode,
}: {
    rows: Entry[];
    compMode: 'weight' | 'measure';
}) {
    return (
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Competitor</th>
                    <th>{compMode === 'measure' ? 'Length (cm)' : 'Weight (kg)'}</th>
                    <th>Entry date</th>
                    <th>Entry time</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((e, i) => {
                    const metric =
                        compMode === 'measure'
                            ? e.length_cm ?? ''
                            : e.weight_kg ?? '';

                    const dt = e.created_at ? new Date(e.created_at) : null;
                    const date =
                        dt && !Number.isNaN(+dt)
                            ? dt.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })
                            : '';
                    const time =
                        dt && !Number.isNaN(+dt)
                            ? dt.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })
                            : '';

                    return (
                        <tr key={e.id}>
                            <td>{i + 1}</td>
                            <td>{e.competitor?.full_name}</td>
                            <td>{metric}</td>
                            <td>{date}</td>
                            <td>{time}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
