// ============================================================================
// File: EditCompetition.tsx
// Path: src/clubadmin/pages/Competitions/EditCompetition.tsx
// Description:
// Edit an existing competition.
// IMPORTANT:
//  - Competition is created as a *shell*
//  - Child records are guaranteed by the API
// ============================================================================

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

// Club-admin scoped APIs
import {
    getCompetition,
    updateCompetition,
    listCompetitionDays,
    updateCompetitionDay,
    addCompetitionDay,
    deleteCompetitionDay,
    listSpecies,
    listCompetitionSpecies,
    saveCompetitionSpecies,
    listCompetitionTypes,
    listCompModes,
    listPrizeModes,
    getCompetitionBriefing,
    upsertCompetitionBriefing,
} from "@/clubadmin/api/competitions";

// Types
import type {
    Competition,
    CompetitionDay,
    Species,
    CompetitionType,
    CompMode,
    PrizeMode,
} from "@/types";

type FishingStartType = "None" | "Required";
type WeighinType = "None" | "Optional" | "Required";

type CompetitionBriefing = {
    briefing_date: string | null;
    briefing_time: string | null;
    location: string | null;
    notes: string | null;
};

export default function EditCompetition() {
    const { organisationId, id } = useParams<{
        organisationId: string;
        id: string;
    }>();

    const [competition, setCompetition] = useState<Competition | null>(null);
    const [days, setDays] = useState<CompetitionDay[]>([]);

    const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
    const [compModes, setCompModes] = useState<CompMode[]>([]);
    const [prizeModes, setPrizeModes] = useState<PrizeMode[]>([]);

    const [allSpecies, setAllSpecies] = useState<Species[]>([]);
    const [selectedSpeciesIds, setSelectedSpeciesIds] = useState<number[]>([]);

    const [briefing, setBriefing] = useState<CompetitionBriefing>({
        briefing_date: null,
        briefing_time: null,
        location: null,
        notes: null,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // =========================================================================
    // LOAD
    // =========================================================================
    useEffect(() => {
        if (!organisationId || !id) return;

        (async () => {
            setLoading(true);
            try {
                const comp = await getCompetition(organisationId, id);
                setCompetition(comp);

                const [types, modes, prizes] = await Promise.all([
                    listCompetitionTypes(),
                    listCompModes(),
                    listPrizeModes(),
                ]);

                setCompetitionTypes(types);
                setCompModes(
                    modes.filter(
                        (m): m is CompMode =>
                            m.name === "weight" ||
                            m.name === "length" ||
                            m.name === "mixed"
                    )
                );
                setPrizeModes(
                    prizes.filter(
                        (p): p is PrizeMode =>
                            p.name === "combined" || p.name === "split"
                    )
                );

                const b = await getCompetitionBriefing(organisationId, id);
                if (b) {
                    setBriefing({
                        briefing_date: b.briefing_date ?? null,
                        briefing_time: b.briefing_time ?? null,
                        location: b.location ?? null,
                        notes: b.notes ?? null,
                    });
                }

                const compDays = await listCompetitionDays(organisationId, id);
                setDays(compDays);

                const species = await listSpecies();
                setAllSpecies(species);

                const compSpecies = await listCompetitionSpecies(organisationId, id);
                setSelectedSpeciesIds(compSpecies.map((s) => s.species.id));
            } catch (err) {
                console.error(err);
                alert("Unable to load competition");
            } finally {
                setLoading(false);
            }
        })();
    }, [organisationId, id]);

    // =========================================================================
    // HELPERS
    // =========================================================================

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

    function toggleSpecies(speciesId: number) {
        setSelectedSpeciesIds((prev) =>
            prev.includes(speciesId)
                ? prev.filter((x) => x !== speciesId)
                : [...prev, speciesId]
        );
    }

    // =========================================================================
    // SAVE
    // =========================================================================
    async function saveChanges() {
        if (!organisationId || !id || !competition) return;

        setSaving(true);
        try {
            await updateCompetition(organisationId, id, {
                name: competition.name,
                starts_at: competition.starts_at,
                ends_at: competition.ends_at,
                competition_type_id: competition.competition_type_id ?? null,
                comp_mode_id: competition.comp_mode_id ?? null,
                prize_mode_id: competition.prize_mode_id ?? null,
            });

            await upsertCompetitionBriefing(organisationId, id, briefing);

            for (const d of days) {
                await updateCompetitionDay(d.id, {
                    day_date: d.day_date,
                    fishing_start_type: d.fishing_start_type as FishingStartType,
                    fishing_start_time: d.fishing_start_time || null,
                    fishing_end_type: d.fishing_end_type || "None",
                    fishing_end_time: d.fishing_end_time || null,
                    weighin_type: d.weighin_type as WeighinType,
                    weighin_start_time: d.weighin_start_time || null,
                    weighin_end_time: d.weighin_end_time || null,
                    weighin_cutoff_time: d.weighin_cutoff_time || null,
                    overnight_allowed: !!d.overnight_allowed,
                    notes: d.notes || null,
                });
            }

            await saveCompetitionSpecies(
                organisationId,
                id,
                selectedSpeciesIds
            );

            alert("Competition updated");
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
        if (!confirm("Remove this fishing day?")) return;
        await deleteCompetitionDay(dayId);
        setDays((prev) => prev.filter((d) => d.id !== dayId));
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    if (loading || !competition) {
        return <p className="muted">Loading…</p>;
    }

    return (
        <section className="card admin-card">
            <div className="actions" style={{ marginBottom: 12 }}>
                <Link to=".." className="btn btn--lg">
                    ← Back to Competitions
                </Link>
            </div>

            <h2>Edit Competition</h2>

            {/* COMPETITION DETAILS */}
            {/* ================= COMPETITION DETAILS ================= */}
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

                    <div className="field span-6">
                        <label>Competition type</label>
                        <select
                            value={competition.competition_type_id ?? ""}
                            onChange={(e) =>
                                onFieldChange(
                                    "competition_type_id",
                                    e.target.value || null
                                )
                            }
                        >
                            <option value="">— Select —</option>
                            {competitionTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="field span-6">
                        <label>Competition mode</label>
                        <select
                            value={competition.comp_mode_id ?? ""}
                            onChange={(e) =>
                                onFieldChange(
                                    "comp_mode_id",
                                    e.target.value || null
                                )
                            }
                        >
                            <option value="">— Select —</option>
                            {compModes.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="field span-6">
                        <label>Prize grouping</label>
                        <select
                            value={competition.prize_mode_id ?? ""}
                            onChange={(e) =>
                                onFieldChange(
                                    "prize_mode_id",
                                    e.target.value || null
                                )
                            }
                        >
                            <option value="">— Select —</option>
                            {prizeModes.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>


            {/* BRIEFING */}
            {/* ================= BRIEFING ================= */}
            <section className="card">
                <h3>Competition Briefing</h3>

                <div className="form-grid">
                    <div className="field span-4">
                        <label>Date</label>
                        <input
                            type="date"
                            value={briefing.briefing_date ?? ""}
                            onChange={(e) =>
                                setBriefing((b) => ({
                                    ...b,
                                    briefing_date: e.target.value || null,
                                }))
                            }
                        />
                    </div>

                    <div className="field span-4">
                        <label>Time</label>
                        <input
                            type="time"
                            value={briefing.briefing_time ?? ""}
                            onChange={(e) =>
                                setBriefing((b) => ({
                                    ...b,
                                    briefing_time: e.target.value || null,
                                }))
                            }
                        />
                    </div>

                    <div className="field span-12">
                        <label>Location</label>
                        <input
                            value={briefing.location ?? ""}
                            onChange={(e) =>
                                setBriefing((b) => ({
                                    ...b,
                                    location: e.target.value || null,
                                }))
                            }
                        />
                    </div>

                    <div className="field span-12">
                        <label>Notes</label>
                        <textarea
                            value={briefing.notes ?? ""}
                            onChange={(e) =>
                                setBriefing((b) => ({
                                    ...b,
                                    notes: e.target.value || null,
                                }))
                            }
                        />
                    </div>
                </div>
            </section>


            {/* FISHING DAYS */}
            {/* ================= FISHING DAYS ================= */}
            <section className="card">
                <h3>Fishing Days</h3>

                {days.map((d, i) => (
                    <section key={d.id} className="card">
                        <h4>Day {i + 1}</h4>

                        <div className="form-grid">
                            <div className="field span-4">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={d.day_date}
                                    onChange={(e) =>
                                        updateDay(i, { day_date: e.target.value })
                                    }
                                />
                            </div>

                            <div className="field span-4">
                                <label>Fishing start type</label>
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
                                <label>Fishing start time</label>
                                <input
                                    type="time"
                                    value={d.fishing_start_time ?? ""}
                                    onChange={(e) =>
                                        updateDay(i, {
                                            fishing_start_time: e.target.value || null,
                                        })
                                    }
                                />
                            </div>

                            <div className="field span-4">
                                <label>Fishing end type</label>
                                <select
                                    value={d.fishing_end_type ?? "None"}
                                    onChange={(e) =>
                                        updateDay(i, {
                                            fishing_end_type:
                                                e.target.value as "None" | "Required",
                                        })
                                    }
                                >
                                    <option value="None">None</option>
                                    <option value="Required">Required</option>
                                </select>
                            </div>

                            <div className="field span-4">
                                <label>Fishing end time</label>
                                <input
                                    type="time"
                                    value={d.fishing_end_time ?? ""}
                                    onChange={(e) =>
                                        updateDay(i, {
                                            fishing_end_time: e.target.value || null,
                                        })
                                    }
                                />
                            </div>

                            <div className="field span-4">
                                <label>Weigh-in type</label>
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

                            {d.weighin_type !== "None" && (
                                <>
                                    <div className="field span-4">
                                        <label>Weigh-in start</label>
                                        <input
                                            type="time"
                                            value={d.weighin_start_time ?? ""}
                                            onChange={(e) =>
                                                updateDay(i, {
                                                    weighin_start_time:
                                                        e.target.value || null,
                                                })
                                            }
                                        />
                                    </div>

                                    <div className="field span-4">
                                        <label>Weigh-in end</label>
                                        <input
                                            type="time"
                                            value={d.weighin_end_time ?? ""}
                                            onChange={(e) =>
                                                updateDay(i, {
                                                    weighin_end_time:
                                                        e.target.value || null,
                                                })
                                            }
                                        />
                                    </div>

                                    <div className="field span-4">
                                        <label>Weigh-in cutoff</label>
                                        <input
                                            type="time"
                                            value={d.weighin_cutoff_time ?? ""}
                                            onChange={(e) =>
                                                updateDay(i, {
                                                    weighin_cutoff_time:
                                                        e.target.value || null,
                                                })
                                            }
                                        />
                                    </div>
                                </>
                            )}

                            <div className="field span-12">
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={!!d.overnight_allowed}
                                        onChange={(e) =>
                                            updateDay(i, {
                                                overnight_allowed: e.target.checked,
                                            })
                                        }
                                    />
                                    Overnight fishing allowed
                                </label>
                            </div>

                            <div className="field span-12">
                                <label>Notes</label>
                                <textarea
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


            {/* SPECIES */}
            {/* ================= SPECIES ================= */}
            <section className="card">
                <h3>Eligible Species</h3>

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


            {/* SAVE */}
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
