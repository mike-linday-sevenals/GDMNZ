import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import {
    getCompetition,
    updateCompetition,
    listCompetitionDays,
    updateCompetitionDay,
    addCompetitionDay,
    deleteCompetitionDay,
    getCompetitionBriefing,
    upsertCompetitionBriefing,
    getCompetitionFees,
    upsertCompetitionFees,
    listSpecies,
    listCompetitionSpecies,
    saveCompetitionSpecies,
} from "@/services/api";

import type { Competition, CompetitionDay, Species } from "@/types";

type FishingStartType = "None" | "Required";
type WeighinType = "None" | "Optional" | "Required";

export default function EditCompetition() {
    const { organisationId, id } = useParams<{
        organisationId: string;
        id: string;
    }>();

    const [competition, setCompetition] = useState<Competition | null>(null);
    const [briefing, setBriefing] = useState<any | null>(null);
    const [days, setDays] = useState<CompetitionDay[]>([]);
    const [fees, setFees] = useState<any | null>(null);

    const [allSpecies, setAllSpecies] = useState<Species[]>([]);
    const [selectedSpeciesIds, setSelectedSpeciesIds] = useState<number[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    /* ============================================================
       LOAD
       ============================================================ */
    useEffect(() => {
        if (!organisationId || !id) return;

        (async () => {
            setLoading(true);
            try {
                setCompetition(await getCompetition(organisationId, id));
                setBriefing(await getCompetitionBriefing(organisationId, id));
                setDays(await listCompetitionDays(organisationId, id));
                setFees(await getCompetitionFees(organisationId, id));

                setAllSpecies(await listSpecies());

                const compSpecies = await listCompetitionSpecies(
                    organisationId,
                    id
                );
                setSelectedSpeciesIds(
                    compSpecies.map((s) => s.species.id)
                );
            } catch (err) {
                console.error(err);
                alert("Unable to load competition");
            } finally {
                setLoading(false);
            }
        })();
    }, [organisationId, id]);

    /* ============================================================
       HELPERS
       ============================================================ */
    function onFieldChange<K extends keyof Competition>(
        field: K,
        value: Competition[K]
    ) {
        setCompetition((c) => (c ? { ...c, [field]: value } : c));
    }

    function updateDay(index: number, patch: Partial<CompetitionDay>) {
        setDays((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    }

    function toggleSpecies(id: number) {
        setSelectedSpeciesIds((prev) =>
            prev.includes(id)
                ? prev.filter((x) => x !== id)
                : [...prev, id]
        );
    }

    /* ============================================================
       SAVE
       ============================================================ */
    async function saveChanges() {
        if (!organisationId || !id || !competition) return;

        setSaving(true);
        try {
            await updateCompetition(organisationId, id, {
                name: competition.name,
                starts_at: competition.starts_at,
                ends_at: competition.ends_at,
                comp_mode_id: competition.comp_mode_id ?? null,
                prize_mode_id: competition.prize_mode_id ?? null,
            });

            await upsertCompetitionBriefing(organisationId, id, {
                briefing_date: briefing?.briefing_date || null,
                briefing_time: briefing?.briefing_time || null,
                location: briefing?.location || null,
                notes: briefing?.notes || null,
            });

            for (const d of days) {
                await updateCompetitionDay(d.id, {
                    day_date: d.day_date,
                    fishing_start_type: d.fishing_start_type as FishingStartType,
                    fishing_start_time: d.fishing_start_time || null,
                    fishing_end_time: d.fishing_end_time || null,
                    weighin_type: d.weighin_type as WeighinType,
                    weighin_start_time: d.weighin_start_time || null,
                    weighin_end_time: d.weighin_end_time || null,
                    overnight_allowed: d.overnight_allowed ?? false,
                    notes: d.notes || null,
                });
            }

            await upsertCompetitionFees(organisationId, id, fees);
            await saveCompetitionSpecies(
                organisationId,
                id,
                selectedSpeciesIds
            );

            alert("Competition updated!");
        } catch (err) {
            console.error(err);
            alert("Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function addDay() {
        if (!id) return;
        const d = await addCompetitionDay(id);
        setDays((prev) => [...prev, d]);
    }

    async function removeDay(dayId: string) {
        if (!confirm("Remove this day?")) return;
        await deleteCompetitionDay(dayId);
        setDays((prev) => prev.filter((d) => d.id !== dayId));
    }

    /* ============================================================
       RENDER
       ============================================================ */
    if (loading || !competition || !briefing || !fees) {
        return <p className="muted">Loading…</p>;
    }
    return (
        <section className="card admin-card">
            {/* ================= PAGE HEADER ================= */}
            <div className="actions" style={{ marginBottom: 12 }}>
                <Link to=".." className="btn btn--lg">
                    ← Back to Competitions
                </Link>
            </div>

            <h2>Edit Competition</h2>

            {/* ================= BASIC DETAILS ================= */}
            <section className="card">
                <h3>Competition Details</h3>

                <div className="form-grid">
                    <div className="field span-12">
                        <label>Name</label>
                        <input
                            value={competition.name}
                            onChange={(e) =>
                                onFieldChange("name", e.target.value)
                            }
                        />
                    </div>

                    <div className="field span-6">
                        <label>Start date</label>
                        <input
                            type="date"
                            value={competition.starts_at ?? ""}
                            onChange={(e) =>
                                onFieldChange("starts_at", e.target.value)
                            }
                        />
                    </div>

                    <div className="field span-6">
                        <label>End date</label>
                        <input
                            type="date"
                            value={competition.ends_at ?? ""}
                            onChange={(e) =>
                                onFieldChange("ends_at", e.target.value)
                            }
                        />
                    </div>
                </div>
            </section>

            {/* ================= BRIEFING ================= */}
            <section className="card">
                <h3>Safety Briefing</h3>

                <div className="form-grid">
                    <div className="field span-12">
                        <label>Location</label>
                        <input
                            value={briefing.location ?? ""}
                            onChange={(e) =>
                                setBriefing({
                                    ...briefing,
                                    location: e.target.value,
                                })
                            }
                        />
                    </div>

                    <div className="field span-12">
                        <label>Notes</label>
                        <textarea
                            placeholder="Any mandatory information competitors must know"
                            value={briefing.notes ?? ""}
                            onChange={(e) =>
                                setBriefing({
                                    ...briefing,
                                    notes: e.target.value,
                                })
                            }
                        />
                    </div>
                </div>
            </section>

            {/* ================= FISHING DAYS ================= */}
            <section className="card">
                <h3>Fishing Days</h3>

                {days.map((d, i) => (
                    <section key={d.id} className="card">
                        <h4 style={{ marginBottom: 8 }}>
                            Day {i + 1}
                        </h4>

                        <div className="form-grid">
                            <div className="field span-4">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={d.day_date}
                                    onChange={(e) =>
                                        updateDay(i, {
                                            day_date: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div className="field span-4">
                                <label>Fishing start</label>
                                <select
                                    value={d.fishing_start_type}
                                    onChange={(e) =>
                                        updateDay(i, {
                                            fishing_start_type:
                                                e.target.value as FishingStartType,
                                        })
                                    }
                                >
                                    <option value="None">None</option>
                                    <option value="Required">Required</option>
                                </select>
                            </div>

                            <div className="field span-4">
                                <label>Weigh-in</label>
                                <select
                                    value={d.weighin_type}
                                    onChange={(e) =>
                                        updateDay(i, {
                                            weighin_type:
                                                e.target.value as WeighinType,
                                        })
                                    }
                                >
                                    <option value="None">None</option>
                                    <option value="Optional">Optional</option>
                                    <option value="Required">Required</option>
                                </select>
                            </div>

                            <div className="field span-6">
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={!!d.overnight_allowed}
                                        onChange={(e) =>
                                            updateDay(i, {
                                                overnight_allowed:
                                                    e.target.checked,
                                            })
                                        }
                                    />
                                    Overnight fishing allowed
                                </label>
                            </div>

                            <div className="field span-12">
                                <label>Notes</label>
                                <textarea
                                    placeholder="Optional notes for this day"
                                    value={d.notes ?? ""}
                                    onChange={(e) =>
                                        updateDay(i, { notes: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        <div className="actions">
                            <button
                                className="btn danger"
                                onClick={() => removeDay(d.id)}
                            >
                                Remove day
                            </button>
                        </div>
                    </section>
                ))}

                <div className="actions">
                    <button className="btn" onClick={addDay}>
                        + Add Fishing Day
                    </button>
                </div>
            </section>

            {/* ================= SPECIES ================= */}
            <section className="card">
                <h3>Eligible Species</h3>

                <p className="muted" style={{ marginBottom: 8 }}>
                    Select which species can be entered for this competition
                </p>

                <div className="species-grid">
                    {allSpecies.map((s) => {
                        const checked = selectedSpeciesIds.includes(s.id);

                        return (
                            <label
                                key={s.id}
                                className={`species-tile ${checked ? "active" : ""}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSpecies(s.id)}
                                />
                                <span>{s.name}</span>
                            </label>
                        );
                    })}
                </div>

            </section>

            {/* ================= SAVE ================= */}
            <section className="card">
                <div className="actions">
                    <button
                        className="btn primary btn--lg"
                        onClick={saveChanges}
                        disabled={saving}
                    >
                        {saving ? "Saving…" : "Save Competition"}
                    </button>
                </div>
            </section>
        </section>
    );
}
