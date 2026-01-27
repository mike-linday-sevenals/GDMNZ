// ============================================================================
// SubmissionHeader.tsx
// ============================================================================

import { useEffect, useState } from "react";
import {
    listCompetitorsForCompetition,
    listFishTypes,
    getCompetition,
} from "@/services/api";
import { listSubmissionSpecies } from "@/clubadmin/api/submissionSpecies";
import { useSubmission } from "../SubmissionContext";
import AnglerBoatPicker from "./AnglerBoatPicker";
import type { Competitor, Competition } from "@/types";
import SportCatchCard from "./SportCatchCard";
import { listCompetitionDays } from "@/services/api";


// ============================================================================
// Types
// ============================================================================

type CompetitionSummary = {
    id: string;
    name: string;
    competition_type_code: "sport" | "game" | "mixed";
};

type Props = {
    competitions?: CompetitionSummary[];
    competition: CompetitionSummary | null;
    setCompetition: (c: CompetitionSummary | null) => void;
};

// ============================================================================
// Component
// ============================================================================

export default function SubmissionHeader({
    competitions,
    competition,
    setCompetition,
}: Props) {
    const {
        organisationId,
        draft,
        setDraft,
        discipline,
        setDiscipline,
        species,
        setSpecies,
        competitionMode,
        setCompetitionMode,
        setFishTypes,
        setCompetitionId, 
    } = useSubmission();

    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [loadingCompetitors, setLoadingCompetitors] = useState(false);
    const [showPicker, setShowPicker] = useState(false);

    const [competitionDays, setCompetitionDays] = useState<
        { id: string; day_date: string }[]
    >([]);


    // FULL competition record (includes comp_mode)
    const [fullCompetition, setFullCompetition] =
        useState<Competition | null>(null);

    const compType: "sport" | "game" | "mixed" =
        competition?.competition_type_code ?? "mixed";


    // ------------------------------------------------------------------
    // Load competition days
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!competition?.id || !organisationId) {
            setCompetitionDays([]);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const days = await listCompetitionDays(
                    organisationId,
                    competition.id
                );

                if (!cancelled) {
                    setCompetitionDays(
                        days.map(d => ({
                            id: d.id,
                            day_date: d.day_date,
                        }))
                    );
                }
            } catch {
                if (!cancelled) setCompetitionDays([]);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [competition?.id, organisationId]);



    // ------------------------------------------------------------------
    // Load fish types (reference data)
    // ------------------------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const rows = await listFishTypes();
                if (!cancelled) setFishTypes(rows);
            } catch {
                /* non-fatal */
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [setFishTypes]);

    // ------------------------------------------------------------------
    // Discipline defaults (non-mixed)
    // ------------------------------------------------------------------

    useEffect(() => {
        if (compType === "sport") setDiscipline("sport");
        else if (compType === "game") setDiscipline("game");
        // mixed: do nothing, let user choice persist
    }, [compType, setDiscipline]);



    // ------------------------------------------------------------------
    // Load FULL competition (for comp_mode)
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!competition?.id || !organisationId) {
            setFullCompetition(null);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const full = await getCompetition(
                    organisationId,
                    competition.id
                );

                if (!cancelled) {
                    setFullCompetition(full);
                }
            } catch {
                if (!cancelled) {
                    setFullCompetition(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [competition?.id, organisationId]);

    // ------------------------------------------------------------------
    // Default catch date when competition + competitor selected
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!fullCompetition || !draft.competitor_id) return;

        const { starts_at, ends_at } = fullCompetition;

        // HARD guard — satisfies TS and runtime
        if (!starts_at || !ends_at) return;

        if (draft.date_caught) return; // don't override user choice

        const today = new Date().toISOString().slice(0, 10);

        let defaultDate = today;

        if (today < starts_at) defaultDate = starts_at;
        else if (today > ends_at) defaultDate = ends_at;

        setDraft(d => ({
            ...d,
            date_caught: defaultDate,
            competition_day_id:
                competitionDays.find(cd => cd.day_date === defaultDate)?.id ??
                null,
        }));
    }, [
        fullCompetition,
        competitionDays,
        draft.competitor_id,
        draft.date_caught,
        setDraft,
    ]);



    // ------------------------------------------------------------------
    // Resolve competition mode from comp_mode.name
    // ------------------------------------------------------------------
    useEffect(() => {
        const rawName = fullCompetition?.comp_mode?.name;

        if (!rawName) {
            setCompetitionMode(null);
            return;
        }

        // Normalise once
        const name = rawName.trim().toLowerCase();

        if (name === "weight") {
            setCompetitionMode("weight");
            return;
        }

        if (name === "length") {
            setCompetitionMode("length");
            return;
        }

        // Catch ALL combined cases safely
        if (
            name.includes("weight") &&
            name.includes("length")
        ) {
            setCompetitionMode("both");
            return;
        }

        // Fallback (explicit)
        setCompetitionMode(null);
    }, [fullCompetition?.comp_mode?.name, setCompetitionMode]);


    // ------------------------------------------------------------------
    // Reset catch-specific fields when discipline changes
    // ------------------------------------------------------------------

    useEffect(() => {
        if (!discipline) return;

        setDraft(d => {
            // prevent pointless resets
            if (
                d.species_id === null &&
                d.weight_kg === null &&
                d.length_cm === null &&
                d.outcome === null
            ) {
                return d;
            }

            return {
                ...d,
                species_id: null,
                species_name: null,
                outcome: null,
                weight_kg: null,
                length_cm: null,
            };
        });
    }, [discipline, setDraft]);


    // ------------------------------------------------------------------
    // Load competitors
    // ------------------------------------------------------------------

    useEffect(() => {
        if (!competition?.id) {
            setCompetitors([]);
            return;
        }

        let cancelled = false;

        (async () => {
            setLoadingCompetitors(true);
            try {
                const rows = await listCompetitorsForCompetition(
                    competition.id
                );
                if (!cancelled) setCompetitors(rows);
            } finally {
                if (!cancelled) setLoadingCompetitors(false);
            }
        })();

        // Reset selected competitor
        setDraft(d => ({ ...d, competitor_id: null }));

        return () => {
            cancelled = true;
        };
    }, [competition?.id, setDraft]);

    // ------------------------------------------------------------------
    // Load competition species
    // ------------------------------------------------------------------

    useEffect(() => {
        if (!competition?.id || !discipline) {
            setSpecies([]);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const rows = await listSubmissionSpecies(competition.id);
                if (!cancelled) setSpecies(rows);
            } catch {
                if (!cancelled) setSpecies([]);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [competition?.id, discipline, setSpecies]);

    const selectedCompetitor = competitors.find(
        c => String(c.id) === String(draft.competitor_id)
    );

    const switchDiscipline = (next: "sport" | "game") => {
        if (discipline === next) return;
        setDiscipline(next);
    };

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    return (
        <section className="card">
            {/* ================= HEADER ================= */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h2 style={{ margin: 0, flex: 1 }}>Catch Submission</h2>

                <select
                    value={competition?.id ?? ""}
                    onChange={e => {
                        const next =
                            competitions?.find(
                                c => c.id === e.target.value
                            ) || null;

                        setCompetition(next);

                       setCompetitionId(next?.id ?? null);
                    }}
                    style={{ maxWidth: 320 }}
                >
                    <option value="">-- Select Competition --</option>
                    {(competitions ?? []).map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </div>



            {/* ================= IDENTITY ================= */}
            {competition && (
                <div
                    style={{
                        marginTop: 16,
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "#f8fafc",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr auto 1fr",
                        gap: 12,
                    }}
                >
                    {selectedCompetitor ? (
                        <>
                            <div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                    Angler
                                </div>
                                <div style={{ fontWeight: 600 }}>
                                    {selectedCompetitor.full_name}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                    Boat
                                </div>
                                <div style={{ fontWeight: 600 }}>
                                    {selectedCompetitor.boat}
                                </div>
                            </div>

                            <div style={{ alignSelf: "end" }}>
                                <button
                                    className="btn secondary"
                                    onClick={() => setShowPicker(true)}
                                >
                                    Change
                                </button>
                            </div>

                            <div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                    Skipper
                                </div>
                                <input
                                    type="text"
                                    placeholder="Skipper full name"
                                    value={draft.skipper_name ?? ""}
                                    onChange={e =>
                                        setDraft(d => ({
                                            ...d,
                                            skipper_name: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </>
                    ) : (
                        <button
                            className="btn primary"
                            disabled={loadingCompetitors}
                            onClick={() => setShowPicker(true)}
                        >
                            Select Angler / Boat
                        </button>
                    )}
                </div>
            )}

            {/* ================= META (DATE / TIME / LOCATION) ================= */}
            {competition && draft.competitor_id && (
                <>
                    <div
                        style={{
                            marginTop: 12,
                            padding: "12px 14px",
                            borderRadius: 8,
                            background: "#f8fafc",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 1.5fr",
                            gap: 12,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                                Catch date
                            </div>

                            <input
                                type="date"
                                value={draft.date_caught ?? ""}
                                min={fullCompetition?.starts_at ?? undefined}
                                max={fullCompetition?.ends_at ?? undefined}
                                onChange={e => {
                                    const selectedDate = e.target.value;

                                    const matchedDay = competitionDays.find(
                                        d => d.day_date === selectedDate
                                    );

                                    setDraft(d => ({
                                        ...d,
                                        date_caught: selectedDate,
                                        competition_day_id: matchedDay?.id ?? null,
                                    }));
                                }}
                            />

                            {/* 🔎 Helper / warning text */}
                            {draft.date_caught &&
                                competitionDays.length > 0 &&
                                !competitionDays.some(
                                    d => d.day_date === draft.date_caught
                                ) && (
                                    <div
                                        style={{
                                            marginTop: 4,
                                            fontSize: 11,
                                            color: "#64748b",
                                        }}
                                    >
                                        This catch is not linked to a specific competition day
                                    </div>
                                )}
                        </div>

                        <div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                                Hooked time
                            </div>
                            <input
                                type="time"
                                value={draft.hooked_time ?? ""}
                                onChange={e =>
                                    setDraft(d => ({
                                        ...d,
                                        hooked_time: e.target.value || null,
                                    }))
                                }
                            />
                        </div>

                        <div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                                Landed time
                            </div>
                            <input
                                type="time"
                                value={draft.landed_time ?? ""}
                                onChange={e =>
                                    setDraft(d => ({
                                        ...d,
                                        landed_time: e.target.value || null,
                                    }))
                                }
                            />
                        </div>

                        <div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                                Location
                            </div>
                            <input
                                type="text"
                                placeholder="General area or landmark"
                                value={draft.location ?? ""}
                                onChange={e =>
                                    setDraft(d => ({
                                        ...d,
                                        location: e.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>

                    {/* ================= COURTESY WEIGH ================= */}
                    <div
                        style={{
                            marginTop: 8,
                            padding: "12px 14px",
                            borderRadius: 8,
                            background: "#f8fafc",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 1.5fr",
                            gap: 12,
                            alignItems: "end",
                        }}
                    >
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 13,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={draft.is_courtesy_weigh}
                                onChange={e =>
                                    setDraft(d => ({
                                        ...d,
                                        is_courtesy_weigh: e.target.checked,
                                        courtesy_club_name: null,
                                        host_club_number: null,
                                    }))
                                }
                                style={{ width: 14, height: 14, margin: 0 }}
                            />
                            Courtesy weigh
                        </label>

                        {!draft.is_courtesy_weigh && (
                            <div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#64748b",
                                    }}
                                >
                                    Club number
                                </div>
                                <input
                                    type="text"
                                    placeholder="Club #"
                                    value={draft.host_club_number ?? ""}
                                    onChange={e =>
                                        setDraft(d => ({
                                            ...d,
                                            host_club_number: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        )}

                        {draft.is_courtesy_weigh && (
                            <div style={{ gridColumn: "2 / span 2" }}>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#64748b",
                                    }}
                                >
                                    Visiting club
                                </div>
                                <input
                                    type="text"
                                    placeholder="Visiting club"
                                    value={draft.courtesy_club_name ?? ""}
                                    onChange={e =>
                                        setDraft(d => ({
                                            ...d,
                                            courtesy_club_name: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        )}

                        <div />
                    </div>
                </>
            )}

            {/* ================= MIXED DISCIPLINE TOGGLE ================= */}
            {competition &&
                draft.competitor_id &&
                compType === "mixed" && (
                    <div style={{ marginTop: 20, textAlign: "center" }}>
                        <div
                            style={{
                                fontSize: 13,
                                color: "#64748b",
                                marginBottom: 10,
                            }}
                        >
                            Submission mode
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: 10,
                                justifyContent: "center",
                            }}
                        >
                            <button
                                className={
                                    discipline === "sport"
                                        ? "btn primary"
                                        : "btn secondary"
                                }
                                onClick={() => switchDiscipline("sport")}
                            >
                                Sport Fish
                            </button>

                            <button
                                className={
                                    discipline === "game"
                                        ? "btn primary"
                                        : "btn secondary"
                                }
                                onClick={() => switchDiscipline("game")}
                            >
                                Game Fish
                            </button>
                        </div>
                    </div>
                )}

            {/* ================= PICKER ================= */}
            {showPicker && (
                <AnglerBoatPicker
                    competitors={competitors}
                    onClose={() => setShowPicker(false)}
                    onSelect={competitor => {
                        setDraft(d => ({
                            ...d,
                            competitor_id: String(competitor.id),
                        }));
                        setShowPicker(false);
                    }}
                />
            )}
        </section>

    );
    {/* ================= SPORT FISH CARD (SEPARATE CARD) ================= */ }
    {
        competition &&
            draft.competitor_id &&
            discipline === "sport" && (
                <SportCatchCard />
            )
    }

}
