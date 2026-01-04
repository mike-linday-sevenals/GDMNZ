// ============================================================================
// PUBLIC RESULTS PAGE (SELECTION + SLUG MODES)
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { client, getCompetitionByPublicSlug } from "@/services/api";
import {
    getPublicResultsBySlug,
    PublicResultRow
} from "@/services/publicResults";

// ============================================================================
// TYPES
// ============================================================================

type Organisation = {
    organisation_id: string;
    organisation_name: string;
};

type CompetitionRow = {
    id: string;
    name: string;
    public_results_slug: string | null;
};

type PublicCompetition = {
    id: string;
    name: string;
    prize_mode: { name: "combined" | "split" } | null;
};

// ============================================================================
// HELPERS
// ============================================================================

function formatDayLabel(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-NZ", {
        weekday: "short",
        day: "numeric",
        month: "short"
    });
}

// ============================================================================
// PAGE
// ============================================================================

export default function PublicResultsPage() {
    const { slug } = useParams<{ slug?: string }>();
    const navigate = useNavigate();

    // -----------------------------
    // Selection mode state
    // -----------------------------
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [competitions, setCompetitions] = useState<CompetitionRow[]>([]);
    const [orgId, setOrgId] = useState("");
    const [compId, setCompId] = useState("");

    // -----------------------------
    // Results mode state
    // -----------------------------
    const [competition, setCompetition] =
        useState<PublicCompetition | null>(null);

    const [allResults, setAllResults] = useState<PublicResultRow[]>([]);
    const [day, setDay] = useState<number | null>(null);
    const [species, setSpecies] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // =========================================================================
    // LOAD ORGANISATIONS
    // =========================================================================

    useEffect(() => {
        if (!client || slug) return;

        (async () => {
            const { data } = await client
                .from("organisation")
                .select("organisation_id, organisation_name")
                .order("organisation_name");

            setOrganisations(data || []);
        })();
    }, [slug]);

    // =========================================================================
    // LOAD COMPETITIONS FOR CLUB
    // =========================================================================

    useEffect(() => {
        if (!client || !orgId) {
            setCompetitions([]);
            return;
        }

        (async () => {
            const { data } = await client
                .from("competition_organisation")
                .select(`
                    competition:competition_id (
                        id,
                        name,
                        public_results_slug
                    )
                `)
                .eq("organisation_id", orgId);

            const rows =
                data?.map((r: any) =>
                    Array.isArray(r.competition)
                        ? r.competition[0]
                        : r.competition
                ) || [];

            setCompetitions(rows);
        })();
    }, [orgId]);

    // =========================================================================
    // LOAD COMPETITION BY SLUG
    // =========================================================================

    useEffect(() => {
        if (!slug) return;

        setLoading(true);

        (async () => {
            try {
                const comp = await getCompetitionByPublicSlug(slug);
                setCompetition(comp);
            } catch {
                setCompetition(null);
            } finally {
                setLoading(false);
            }
        })();
    }, [slug]);

    // =========================================================================
    // LOAD ALL RESULTS (ONCE)
    // =========================================================================

    useEffect(() => {
        if (!slug) return;

        (async () => {
            const rows = await getPublicResultsBySlug(slug, null);
            setAllResults(rows);
        })();
    }, [slug]);

    // =========================================================================
    // DERIVED DATA
    // =========================================================================

    const dayMap = useMemo(() => {
        const map = new Map<number, string>();
        allResults.forEach(r => {
            if (!map.has(r.day)) map.set(r.day, r.day_date);
        });
        return map;
    }, [allResults]);

    const availableDays = useMemo(
        () => Array.from(dayMap.keys()).sort((a, b) => a - b),
        [dayMap]
    );

    const availableSpecies = useMemo(
        () => Array.from(new Set(allResults.map(r => r.species))).sort(),
        [allResults]
    );

    const filteredResults = useMemo(() => {
        return allResults.filter(r => {
            if (day !== null && r.day !== day) return false;
            if (species && r.species !== species) return false;
            return true;
        });
    }, [allResults, day, species]);

    // =========================================================================
    // HANDLERS
    // =========================================================================

    function handleViewResults() {
        const comp = competitions.find(c => c.id === compId);
        if (!comp?.public_results_slug) return;
        navigate(`/results/${comp.public_results_slug}`);
    }

    // =========================================================================
    // RENDER — RESULTS MODE
    // =========================================================================

    if (slug) {
        if (loading) return <p>Loading results…</p>;
        if (!competition) return <p>Competition not found</p>;

        return (
            <div className="wrap" style={{ paddingTop: 12 }}>
                <h1 style={{ marginBottom: 6 }}>{competition.name}</h1>

                <p style={{ marginBottom: 12 }}>
                    Prize mode:{" "}
                    <strong>{competition.prize_mode?.name ?? "Unknown"}</strong>
                </p>

                {/* FILTER BAR */}
                {(availableDays.length > 1 || availableSpecies.length > 1) && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            marginBottom: 16,
                            flexWrap: "nowrap"
                        }}
                    >
                        {/* SPECIES (LEFT) */}
                        {availableSpecies.length > 1 && (
                            <select
                                className="select"
                                style={{ width: 220 }}
                                value={species ?? ""}
                                onChange={e =>
                                    setSpecies(e.target.value || null)
                                }
                            >
                                <option value="">All species</option>
                                {availableSpecies.map(s => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* DAYS (RIGHT) */}
                        {availableDays.length > 1 && (
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    className={`btn ${day === null ? "primary" : ""
                                        }`}
                                    onClick={() => setDay(null)}
                                >
                                    All Days
                                </button>

                                {availableDays.map(d => (
                                    <button
                                        key={d}
                                        className={`btn ${day === d ? "primary" : ""
                                            }`}
                                        onClick={() => setDay(d)}
                                    >
                                        {formatDayLabel(dayMap.get(d)!)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {filteredResults.length === 0 ? (
                    <p>No results available.</p>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Angler</th>
                                <th>Species</th>
                                <th>Weight (kg)</th>
                                <th>Day</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResults.map((r, i) => (
                                <tr
                                    key={`${r.day}-${r.angler}-${r.species}-${i}`}
                                >
                                    <td>{i + 1}</td>
                                    <td>{r.angler}</td>
                                    <td>{r.species}</td>
                                    <td>
                                        {r.weight_kg !== null
                                            ? r.weight_kg.toFixed(2)
                                            : "—"}
                                    </td>
                                    <td>{formatDayLabel(r.day_date)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    }

    // =========================================================================
    // RENDER — SELECTION MODE
    // =========================================================================

    return (
        <div className="wrap" style={{ maxWidth: 600 }}>
            <h2>View Competition Results</h2>

            <label>Club</label>
            <select
                value={orgId}
                onChange={e => {
                    setOrgId(e.target.value);
                    setCompId("");
                }}
            >
                <option value="">Select club…</option>
                {organisations.map(o => (
                    <option
                        key={o.organisation_id}
                        value={o.organisation_id}
                    >
                        {o.organisation_name}
                    </option>
                ))}
            </select>

            <label style={{ marginTop: 12 }}>Tournament</label>
            <select
                value={compId}
                onChange={e => setCompId(e.target.value)}
                disabled={!orgId}
            >
                <option value="">Select tournament…</option>
                {competitions.map(c => (
                    <option key={c.id} value={c.id}>
                        {c.name}
                    </option>
                ))}
            </select>

            <button
                className="btn primary"
                style={{ marginTop: 16 }}
                disabled={!compId}
                onClick={handleViewResults}
            >
                View Results
            </button>
        </div>
    );
}
