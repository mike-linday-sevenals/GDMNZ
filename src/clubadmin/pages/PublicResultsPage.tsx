import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
    fetchSettings,
    listFishJoinedForCompetition,
    listCompetitionSpecies,
    listCompetitions,
    listPublicOrganisations,
    getCompetitionByPublicSlug,
} from "@/services/api";

/* ===================== TYPES ===================== */

type Settings = {
    compMode: "weight" | "measure";
    prizeMode: "combined" | "split";
    activeSpeciesIds?: number[];
};

type Entry = {
    id: string | number;
    created_at?: string | null;
    weight_kg?: number | null;
    length_cm?: number | null;
    species?: { id: number; name: string } | null;
    competitor?: { full_name?: string } | null;
};

type SpeciesRow = { id: number; name: string };

type Organisation = {
    organisation_id: string;
    organisation_name: string;
    club_code: string;
};

type Competition = {
    id: string;
    name: string;
    organisation_id: string;
    public_results_slug: string;
};

/* ===================== COMPONENT ===================== */

export default function PublicResultsPage() {
    const navigate = useNavigate();
    const { slug } = useParams<{ slug?: string }>();

    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);

    const [selectedOrgId, setSelectedOrgId] = useState<string>("");
    const [selectedComp, setSelectedComp] = useState<Competition | null>(null);

    const [settings, setSettings] = useState<Settings | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [species, setSpecies] = useState<SpeciesRow[]>([]);
    const [loading, setLoading] = useState(false);

    /* ===================== LOAD PUBLIC CLUBS ===================== */

    useEffect(() => {
        (async () => {
            const orgs = await listPublicOrganisations();
            setOrganisations(orgs || []);
        })();
    }, []);

    /* ===================== LOAD BY SLUG (DIRECT LINK) ===================== */

    useEffect(() => {
        if (!slug) return;

        setLoading(true);

        (async () => {
            const comp = await getCompetitionByPublicSlug(slug);
            if (!comp) {
                setLoading(false);
                return;
            }

            setSelectedOrgId(comp.organisation_id);
            setSelectedComp(comp);

            const [st, fish, sp] = await Promise.all([
                fetchSettings(),
                listFishJoinedForCompetition(comp.id),
                listCompetitionSpecies(comp.organisation_id, comp.id),
            ]);

            setSettings(st);
            setEntries(fish);
            setSpecies(
                sp.map((r: any) => ({
                    id: r.species.id,
                    name: r.species.name,
                }))
            );

            setLoading(false);
        })();
    }, [slug]);

    /* ===================== LOAD COMPETITIONS FOR CLUB ===================== */

    useEffect(() => {
        if (!selectedOrgId) {
            setCompetitions([]);
            return;
        }

        (async () => {
            const comps = await listCompetitions(selectedOrgId);
            setCompetitions(comps || []);
        })();
    }, [selectedOrgId]);

    /* ===================== NAVIGATE WHEN COMP SELECTED ===================== */

    useEffect(() => {
        if (!selectedComp) return;
        navigate(`/results/${selectedComp.public_results_slug}`, { replace: true });
    }, [selectedComp, navigate]);

    /* ===================== HELPERS ===================== */

    function parseWeighIn(ts?: string | null) {
        if (!ts) return Number.POSITIVE_INFINITY;
        const n = Date.parse(ts);
        return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    }

    function rank(items: Entry[], mode: "weight" | "measure") {
        return items.slice().sort((a, b) => {
            const va = mode === "measure" ? a.length_cm ?? 0 : a.weight_kg ?? 0;
            const vb = mode === "measure" ? b.length_cm ?? 0 : b.weight_kg ?? 0;
            if (vb !== va) return vb - va;
            return parseWeighIn(a.created_at) - parseWeighIn(b.created_at);
        });
    }

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
            if (activeSet && e.species?.id && !activeSet.has(e.species.id))
                return false;
            return true;
        });
    }, [entries, activeSet]);

    const speciesToRender = useMemo(() => {
        return activeSet
            ? species.filter((s) => activeSet.has(s.id))
            : species;
    }, [species, activeSet]);

    const compMode = settings?.compMode || "weight";

    /* ===================== RENDER ===================== */

    return (
        <>
            {/* SELECTORS */}
            <section className="card" style={{ marginTop: 14 }}>
                <label className="sub">Select club</label>
                <select
                    value={selectedOrgId}
                    onChange={(e) => {
                        setSelectedOrgId(e.target.value);
                        setSelectedComp(null);
                        navigate("/results");
                    }}
                    style={{ maxWidth: 360 }}
                >
                    <option value="">— Select club —</option>
                    {organisations.map((o) => (
                        <option key={o.organisation_id} value={o.organisation_id}>
                            {o.organisation_name}
                        </option>
                    ))}
                </select>

                <label className="sub" style={{ marginTop: 12 }}>
                    Select competition
                </label>
                <select
                    disabled={!competitions.length}
                    value={selectedComp?.id || ""}
                    onChange={(e) => {
                        const c = competitions.find(
                            (x) => x.id === e.target.value
                        );
                        setSelectedComp(c || null);
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

            {selectedComp && (
                <section className="card" style={{ textAlign: "center" }}>
                    <h1>{selectedComp.name}</h1>
                </section>
            )}

            {loading && (
                <section className="card">
                    <p className="muted">Loading results…</p>
                </section>
            )}

            {!loading &&
                selectedComp &&
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
                                <ResultsTable
                                    rows={ranked}
                                    compMode={compMode}
                                />
                            )}
                        </section>
                    );
                })}
        </>
    );
}

/* ===================== TABLE ===================== */

function ResultsTable({
    rows,
    compMode,
}: {
    rows: Entry[];
    compMode: "weight" | "measure";
}) {
    return (
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Competitor</th>
                    <th>
                        {compMode === "measure"
                            ? "Length (cm)"
                            : "Weight (kg)"}
                    </th>
                    <th>Date</th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((e, i) => {
                    const metric =
                        compMode === "measure"
                            ? e.length_cm ?? ""
                            : e.weight_kg ?? "";

                    const dt = e.created_at ? new Date(e.created_at) : null;

                    return (
                        <tr key={e.id}>
                            <td>{i + 1}</td>
                            <td>{e.competitor?.full_name}</td>
                            <td>{metric}</td>
                            <td>
                                {dt?.toLocaleDateString("en-NZ", {
                                    day: "2-digit",
                                    month: "short",
                                })}
                            </td>
                            <td>
                                {dt?.toLocaleTimeString("en-NZ", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
