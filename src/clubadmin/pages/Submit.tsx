import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
    fetchSettings,
    listCompetitions,
    listCompetitorsForCompetition,
    listCompetitionSpecies,
    addCompetitionResult
} from "@/services/api";

import type { Competitor, Species } from "@/types";
import { todayISO } from "@/utils";

/* =========================================================
   TYPES
   ========================================================= */

type Settings = {
    compMode: "weight" | "measure";
    showTime: boolean;
    requireTime: boolean;
    activeSpeciesIds?: number[];
};

type BoatGroup = {
    boat: string;
    competitors: Competitor[];
};

/* =========================================================
   COMPONENT
   ========================================================= */

export default function Submit() {
    const { organisationId } = useParams<{ organisationId: string }>();

    /* ================= CORE STATE ================= */

    const [competitions, setCompetitions] = useState<any[]>([]);
    const [competitionId, setCompetitionId] = useState("");

    const [settings, setSettings] = useState<Settings | null>(null);
    const [competitionSpecies, setCompetitionSpecies] = useState<Species[]>([]);
    const [competitors, setCompetitors] = useState<Competitor[]>([]);

    /* ================= COMMITTED SELECTION ================= */

    const [selectedCompetitor, setSelectedCompetitor] =
        useState<Competitor | null>(null);

    /* ================= MODAL (DRAFT STATE) ================= */

    const [showPicker, setShowPicker] = useState(false);
    const [search, setSearch] = useState("");
    const [draftBoat, setDraftBoat] = useState<string | null>(null);
    const [draftCompetitor, setDraftCompetitor] =
        useState<Competitor | null>(null);

    /* ================= FORM ================= */

    const [speciesId, setSpeciesId] = useState<number | "">("");
    const [lengthCm, setLengthCm] = useState("");
    const [weightKg, setWeightKg] = useState("");
    const [dateCaught, setDateCaught] = useState(todayISO());
    const [timeCaught, setTimeCaught] = useState("");
    const [keepAfter, setKeepAfter] = useState(false);

    /* ================= LOAD SETTINGS ================= */

    useEffect(() => {
        fetchSettings().then(setSettings);
    }, []);

    /* ================= LOAD COMPETITIONS ================= */

    useEffect(() => {
        if (!organisationId) return;
        listCompetitions(organisationId).then(setCompetitions);
    }, [organisationId]);

    /* ================= LOAD COMPETITORS ================= */

    useEffect(() => {
        if (!competitionId) {
            setCompetitors([]);
            setSelectedCompetitor(null);
            return;
        }
        listCompetitorsForCompetition(competitionId).then(setCompetitors);
    }, [competitionId]);

    /* ================= LOAD SPECIES ================= */

    useEffect(() => {
        if (!organisationId || !competitionId) {
            setCompetitionSpecies([]);
            return;
        }
        listCompetitionSpecies(organisationId, competitionId).then(rows =>
            setCompetitionSpecies(rows.map(r => r.species))
        );
    }, [organisationId, competitionId]);

    /* ================= DERIVED ================= */

    const activeSpecies = useMemo(() => {
        if (!settings?.activeSpeciesIds?.length) return competitionSpecies;
        const allowed = new Set(settings.activeSpeciesIds);
        return competitionSpecies.filter(s => allowed.has(s.id));
    }, [settings, competitionSpecies]);

    const boats: BoatGroup[] = useMemo(() => {
        const map = new Map<string, Competitor[]>();

        competitors.forEach(c => {
            const boat = c.boat || "No boat";
            if (!map.has(boat)) map.set(boat, []);
            map.get(boat)!.push(c);
        });

        return [...map.entries()].map(([boat, competitors]) => ({
            boat,
            competitors
        }));
    }, [competitors]);

    const q = search.toLowerCase().trim();

    const filteredBoats = boats.filter(
        b =>
            b.boat.toLowerCase().includes(q) ||
            b.competitors.some(c =>
                c.full_name.toLowerCase().includes(q)
            )
    );

    const filteredCompetitors = competitors.filter(
        c =>
            c.full_name.toLowerCase().includes(q) ||
            (c.boat || "").toLowerCase().includes(q)
    );

    /* ================= SAVE ================= */

    async function save(stay: boolean) {
        if (!competitionId) return alert("Select a competition");
        if (!selectedCompetitor) return alert("Select an angler");
        if (!speciesId) return alert("Select a species");
        if (!settings) return;

        if (
            settings.compMode === "measure" &&
            (!lengthCm || Number(lengthCm) <= 0)
        ) {
            return alert("Length is required");
        }

        if (
            settings.compMode === "weight" &&
            (!weightKg || Number(weightKg) <= 0)
        ) {
            return alert("Weight is required");
        }

        if (settings.showTime && settings.requireTime && !timeCaught) {
            return alert("Time is required");
        }

        const timeISO =
            settings.showTime && timeCaught
                ? `${dateCaught}T${timeCaught}`
                : null;

        await addCompetitionResult({
            competition_id: competitionId,
            competitor_id: selectedCompetitor.id,
            species_id: Number(speciesId),
            length_cm:
                settings.compMode === "measure" ? Number(lengthCm) : null,
            weight_kg:
                settings.compMode === "weight" ? Number(weightKg) : null,
            time_caught: timeISO
        });

        alert("Catch saved");

        // ALWAYS stay on this page
        if (!keepAfter) setSelectedCompetitor(null);
        setSpeciesId("");
        setLengthCm("");
        setWeightKg("");
        setTimeCaught("");
    }

    /* ================= RENDER ================= */

    return (
        <section className="card">
            {/* HEADER */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <h2 style={{ flex: 1, margin: 0 }}>Submit a Catch</h2>

                <select
                    value={competitionId}
                    onChange={e => setCompetitionId(e.target.value)}
                    style={{ maxWidth: 320 }}
                >
                    <option value="">-- Select Competition --</option>
                    {competitions
                        .slice()
                        .sort(
                            (a, b) =>
                                new Date(b.starts_at).getTime() -
                                new Date(a.starts_at).getTime()
                        )
                        .map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                </select>
            </div>

            {!competitionId && (
                <p className="muted" style={{ marginTop: 12 }}>
                    Select a competition to submit catches.
                </p>
            )}

            {competitionId &&
                competitors.length > 0 &&
                activeSpecies.length > 0 &&
                settings && (
                    <>
                        <hr />

                        {/* SELECTED CONTEXT */}
                        {selectedCompetitor ? (
                            <div className="pill">
                                👤 {selectedCompetitor.full_name}
                                {selectedCompetitor.boat && (
                                    <> · 🚤 {selectedCompetitor.boat}</>
                                )}
                                <button
                                    className="btn btn--sm-primary"
                                    onClick={() => setShowPicker(true)}
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn primary"
                                onClick={() => setShowPicker(true)}
                            >
                                Select Angler / Boat
                            </button>
                        )}

                        {selectedCompetitor && (
                            <>
                                <div className="form-grid">
                                    <div className="field span-4">
                                        <label>Species</label>
                                        <select
                                            value={speciesId}
                                            onChange={e =>
                                                setSpeciesId(
                                                    e.target.value
                                                        ? Number(e.target.value)
                                                        : ""
                                                )
                                            }
                                        >
                                            <option value="">
                                                -- Select --
                                            </option>
                                            {activeSpecies.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {settings.compMode === "measure" && (
                                        <div className="field span-3">
                                            <label>Length (cm)</label>
                                            <input
                                                type="number"
                                                value={lengthCm}
                                                onChange={e =>
                                                    setLengthCm(e.target.value)
                                                }
                                            />
                                        </div>
                                    )}

                                    {settings.compMode === "weight" && (
                                        <div className="field span-3">
                                            <label>Weight (kg)</label>
                                            <input
                                                type="number"
                                                value={weightKg}
                                                onChange={e =>
                                                    setWeightKg(e.target.value)
                                                }
                                            />
                                        </div>
                                    )}

                                    <div className="field span-3">
                                        <label>Date</label>
                                        <input
                                            type="date"
                                            value={dateCaught}
                                            onChange={e =>
                                                setDateCaught(e.target.value)
                                            }
                                        />
                                    </div>

                                    {settings.showTime && (
                                        <div className="field span-3">
                                            <label>Time</label>
                                            <input
                                                type="time"
                                                value={timeCaught}
                                                onChange={e =>
                                                    setTimeCaught(e.target.value)
                                                }
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="actions">
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={keepAfter}
                                            onChange={e =>
                                                setKeepAfter(e.target.checked)
                                            }
                                        />
                                        Keep angler after save
                                    </label>

                                    <button
                                        className="btn primary"
                                        onClick={() => save(true)}
                                    >
                                        Save Catch
                                    </button>

                                    <button
                                        className="btn accent"
                                        onClick={() => save(true)}
                                    >
                                        Save & Add Another
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}

            {/* ================= MODAL ================= */}
            {showPicker && (
                <div className="modal-backdrop">
                    <div className="modal-shell">
                        <h3>Select Angler / Boat</h3>

                        <input
                            type="text"
                            placeholder="Search angler or boat…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />

                        <div className="modal-lists">
                            <div className="modal-list">
                                <strong>Boats</strong>
                                {filteredBoats.map(b => {
                                    const active = draftBoat === b.boat;

                                    return (
                                        <div
                                            key={b.boat}
                                            className={`modal-row ${active ? "active" : ""
                                                }`}
                                            onClick={() => {
                                                if (active) {
                                                    setDraftBoat(null);
                                                    setDraftCompetitor(null);
                                                } else {
                                                    setDraftBoat(b.boat);
                                                    setDraftCompetitor(null);
                                                }
                                            }}
                                        >
                                            🚤 {b.boat}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="modal-list">
                                <strong>Anglers</strong>
                                {filteredCompetitors
                                    .filter(
                                        c =>
                                            !draftBoat ||
                                            c.boat === draftBoat
                                    )
                                    .map(c => (
                                        <div
                                            key={c.id}
                                            className={`modal-row ${draftCompetitor?.id === c.id
                                                    ? "active"
                                                    : ""
                                                }`}
                                            onClick={() => {
                                                setDraftCompetitor(c);
                                                setDraftBoat(c.boat || null);
                                            }}
                                        >
                                            👤 {c.full_name}
                                        </div>
                                    ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn"
                                onClick={() => {
                                    setDraftBoat(null);
                                    setDraftCompetitor(null);
                                    setSearch("");
                                    setShowPicker(false);
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                className="btn primary"
                                disabled={!draftCompetitor}
                                onClick={() => {
                                    setSelectedCompetitor(draftCompetitor);
                                    setDraftBoat(null);
                                    setDraftCompetitor(null);
                                    setSearch("");
                                    setShowPicker(false);
                                }}
                            >
                                Select
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
