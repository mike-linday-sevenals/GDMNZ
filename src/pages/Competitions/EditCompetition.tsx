// -------------------------------------------------------------
// Drag + Drop (typed as ANY because react-beautiful-dnd has no TS types)
// -------------------------------------------------------------
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
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
    createCompetitionBriefing,
    getCompetitionFees,
    upsertCompetitionFees,
    listCompModes,
    listPrizeModes,
    listSpecies,
    listCompetitionSpecies,
    saveCompetitionSpecies
} from "@/services/api";

import type {
    Competition,
    CompetitionDay,
    CompMode,
    PrizeMode,
    Species
} from "@/types";

type FishingStartType = "None" | "Required";
type WeighinType = "None" | "Optional" | "Required";

// -------------------------------------------------------------
// COMPONENT
// -------------------------------------------------------------
export default function EditCompetition() {
    const { id } = useParams();

    const [competition, setCompetition] = useState<Competition | null>(null);
    const [briefing, setBriefing] = useState<any | null>(null);
    const [days, setDays] = useState<CompetitionDay[]>([]);
    const [fees, setFees] = useState<any | null>(null);

    const [allSpecies, setAllSpecies] = useState<Species[]>([]);
    const [selectedSpeciesIds, setSelectedSpeciesIds] = useState<number[]>([]);

    const [modes, setModes] = useState<CompMode[]>([]);
    const [prizeModes, setPrizeModes] = useState<PrizeMode[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // -------------------------------------------------------------
    // LOAD EVERYTHING
    // -------------------------------------------------------------
    useEffect(() => {
        if (!id) return;

        (async () => {
            setLoading(true);

            try {
                const [m, p] = await Promise.all([
                    listCompModes(),
                    listPrizeModes()
                ]);
                setModes(m);
                setPrizeModes(p);

                const raw = await getCompetition({ id });
                const comp: Competition = {
                    id: raw.id,
                    name: raw.name,
                    starts_at: raw.starts_at,
                    ends_at: raw.ends_at,
                    comp_mode_id: raw.comp_mode_id ?? null,
                    prize_mode_id: raw.prize_mode_id ?? null,
                    comp_mode: raw.comp_mode ?? null,
                    prize_mode: raw.prize_mode ?? null
                };
                setCompetition(comp);

                let brief = await getCompetitionBriefing(id);
                if (!brief) brief = await createCompetitionBriefing(id);
                setBriefing(brief);

                const compDays = await listCompetitionDays(id);
                setDays(compDays || []);

                let feeRow = await getCompetitionFees(id);
                if (!feeRow) {
                    feeRow = {
                        earlybird_fee_adult: 0,
                        earlybird_fee_junior: 0,
                        earlybird_cutoff_date: null,
                        full_fee_adult: 0,
                        full_fee_junior: 0,
                        nonmember_fee_adult: 0,
                        nonmember_fee_junior: 0
                    };
                }
                setFees(feeRow);

                const speciesList = await listSpecies();
                setAllSpecies(speciesList);

                const compSpecies = await listCompetitionSpecies(id);
                setSelectedSpeciesIds(compSpecies.map(s => s.species.id));

            } catch (err) {
                console.error("Load error", err);
                alert("Unable to load competition.");
            }

            setLoading(false);
        })();
    }, [id]);

    // -------------------------------------------------------------
    // FIELD HANDLERS
    // -------------------------------------------------------------
    function onFieldChange(field: keyof Competition, value: any) {
        setCompetition(c => (c ? { ...c, [field]: value } : c));
    }

    function onBriefingChange(field: string, value: any) {
        setBriefing((b: any) => ({ ...b, [field]: value }));
    }

    function updateDay(index: number, patch: Partial<CompetitionDay>) {
        setDays(prev => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    }

    // -------------------------------------------------------------
    // SAVE ALL
    // -------------------------------------------------------------
    async function saveChanges() {
        if (!competition || !id) return;

        setSaving(true);

        try {
            await updateCompetition(id, {
                name: competition.name,
                starts_at: competition.starts_at,
                ends_at: competition.ends_at,
                comp_mode_id: competition.comp_mode_id ?? null,
                prize_mode_id: competition.prize_mode_id ?? null
            });

            await upsertCompetitionBriefing(id, {
                briefing_date: briefing.briefing_date || null,
                briefing_time: briefing.briefing_time || null,
                location: briefing.location || null,
                notes: briefing.notes || null
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
                    notes: d.notes || null
                });
            }

            await upsertCompetitionFees(id, fees);

            await saveCompetitionSpecies(id, selectedSpeciesIds);

            alert("Competition updated!");
        } catch (err) {
            console.error("Save failed", err);
            alert("Unable to save competition.");
        }

        setSaving(false);
    }

    // -------------------------------------------------------------
    // ADD DAY
    // -------------------------------------------------------------
    async function addDay() {
        if (!id) return;
        const newDay = await addCompetitionDay(id);
        setDays(prev => [...prev, newDay]);
    }

    // -------------------------------------------------------------
    // DRAG END
    // -------------------------------------------------------------
    function onDragEnd(result: any) {
        if (!result.destination) return;

        const reordered = [...days];
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);

        setDays(reordered);
    }

    // -------------------------------------------------------------
    // LOADING UI
    // -------------------------------------------------------------
    if (loading || !competition || !briefing || !fees) {
        return <p className="muted">Loading…</p>;
    }

    // -------------------------------------------------------------
    // UI RENDER
    // -------------------------------------------------------------
    return (
        <section className="card admin-card">
            <h2>Edit Competition</h2>

            <div style={{ marginBottom: 20 }}>
                <Link to="/admin/competitions" className="btn primary btn--lg">
                    ← Back
                </Link>
            </div>

            <div className="form-grid">

                {/* -------------------- BASIC INFO -------------------- */}
                <h3 className="span-12">Basic Info</h3>

                <div className="field span-6">
                    <label>Name</label>
                    <input
                        value={competition.name}
                        onChange={e => onFieldChange("name", e.target.value)}
                    />
                </div>

                <div className="field span-3">
                    <label>Starts</label>
                    <input
                        type="date"
                        value={competition.starts_at || ""}
                        onChange={e => onFieldChange("starts_at", e.target.value)}
                    />
                </div>

                <div className="field span-3">
                    <label>Ends</label>
                    <input
                        type="date"
                        value={competition.ends_at || ""}
                        onChange={e => onFieldChange("ends_at", e.target.value)}
                    />
                </div>

                {/* -------------------- SPECIES -------------------- */}
                <h3 className="span-12">Species in This Competition</h3>
                <p className="sub span-12">Tick the species included in this competition.</p>

                <div className="species-grid span-12">
                    {allSpecies.map(s => {
                        const checked = selectedSpeciesIds.includes(s.id);

                        return (
                            <label key={s.id} className="species-tile">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                        setSelectedSpeciesIds(prev =>
                                            checked
                                                ? prev.filter(id => id !== s.id)
                                                : [...prev, s.id]
                                        )
                                    }
                                />
                                <span>{s.name}</span>
                            </label>
                        );
                    })}
                </div>

                {/* Custom styles */}
                <style>{`
                    .species-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                        gap: 14px;
                        margin-top: 8px;
                    }
                    .species-tile {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        padding: 10px 14px;
                        border-radius: 10px;
                        cursor: pointer;
                        user-select: none;
                    }
                    .species-tile:hover {
                        background: #eef2f6;
                    }
                    .species-tile input {
                        width: 18px;
                        height: 18px;
                        flex-shrink: 0;
                    }
                    .species-tile span {
                        font-size: 15px;
                        font-weight: 500;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                `}</style>

                {/* -------------------- COMP MODES -------------------- */}
                <div className="field span-6">
                    <label>Competition Mode</label>
                    <select
                        value={competition.comp_mode_id || ""}
                        onChange={e => onFieldChange("comp_mode_id", e.target.value || null)}
                    >
                        <option value="">— Select mode —</option>
                        {modes.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="field span-6">
                    <label>Prize Mode</label>
                    <select
                        value={competition.prize_mode_id || ""}
                        onChange={e => onFieldChange("prize_mode_id", e.target.value || null)}
                    >
                        <option value="">— Select prize mode —</option>
                        {prizeModes.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {/* -------------------- BRIEFING -------------------- */}
                <h3 className="span-12">Briefing</h3>

                <div className="field span-4">
                    <label>Date</label>
                    <input
                        type="date"
                        value={briefing.briefing_date || ""}
                        onChange={e => onBriefingChange("briefing_date", e.target.value)}
                    />
                </div>

                <div className="field span-4">
                    <label>Time</label>
                    <input
                        type="time"
                        value={briefing.briefing_time || ""}
                        onChange={e => onBriefingChange("briefing_time", e.target.value)}
                    />
                </div>

                <div className="field span-12">
                    <label>Location</label>
                    <input
                        value={briefing.location || ""}
                        onChange={e => onBriefingChange("location", e.target.value)}
                    />
                </div>

                <div className="field span-12">
                    <label>Notes</label>
                    <textarea
                        rows={2}
                        value={briefing.notes || ""}
                        onChange={e => onBriefingChange("notes", e.target.value)}
                    />
                </div>

                {/* -------------------- FEES -------------------- */}
                <h3 className="span-12">Entry Fees</h3>

                <div className="field span-6">
                    <label>Early Bird (Adult)</label>
                    <input
                        type="number"
                        value={fees.earlybird_fee_adult ?? ""}
                        onChange={e => setFees({ ...fees, earlybird_fee_adult: Number(e.target.value) })}
                    />
                </div>

                <div className="field span-6">
                    <label>Early Bird (Junior)</label>
                    <input
                        type="number"
                        value={fees.earlybird_fee_junior ?? ""}
                        onChange={e => setFees({ ...fees, earlybird_fee_junior: Number(e.target.value) })}
                    />
                </div>

                <div className="field span-12">
                    <label>Early Bird Cutoff</label>
                    <input
                        type="date"
                        value={fees.earlybird_cutoff_date ?? ""}
                        onChange={e => setFees({ ...fees, earlybird_cutoff_date: e.target.value })}
                    />
                </div>

                <div className="field span-6">
                    <label>Full Fee (Adult)</label>
                    <input
                        type="number"
                        value={fees.full_fee_adult ?? ""}
                        onChange={e => setFees({ ...fees, full_fee_adult: Number(e.target.value) })}
                    />
                </div>

                <div className="field span-6">
                    <label>Full Fee (Junior)</label>
                    <input
                        type="number"
                        value={fees.full_fee_junior ?? ""}
                        onChange={e => setFees({ ...fees, full_fee_junior: Number(e.target.value) })}
                    />
                </div>

                <div className="field span-6">
                    <label>Non-Member (Adult)</label>
                    <input
                        type="number"
                        value={fees.nonmember_fee_adult ?? ""}
                        onChange={e => setFees({ ...fees, nonmember_fee_adult: Number(e.target.value) })}
                    />
                </div>

                <div className="field span-6">
                    <label>Non-Member (Junior)</label>
                    <input
                        type="number"
                        value={fees.nonmember_fee_junior ?? ""}
                        onChange={e => setFees({ ...fees, nonmember_fee_junior: Number(e.target.value) })}
                    />
                </div>

                {/* -------------------- FISHING DAYS -------------------- */}
                <h3 className="span-12">Fishing Days</h3>

                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="days">
                        {(provided: any) => (
                            <div
                                className="span-12"
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "16px"
                                }}
                            >
                                {days.map((d, index) => {
                                    const isOpen = d._open ?? index === 0;

                                    return (
                                        <Draggable key={d.id} draggableId={String(d.id)} index={index}>
                                            {(provided: any) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    style={{
                                                        background: "#f7faff",
                                                        borderRadius: "8px",
                                                        border: "1px solid #dde6f2",
                                                        padding: "12px 0",
                                                        ...provided.draggableProps.style
                                                    }}
                                                >


                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            padding: "0 16px 8px 16px",
                                                            borderBottom: isOpen ? "1px solid #e4e9f1" : "none"
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                cursor: "pointer",
                                                                userSelect: "none",
                                                                marginRight: "12px",
                                                                fontSize: "20px"
                                                            }}
                                                            onClick={() =>
                                                                updateDay(index, { _open: !isOpen })
                                                            }
                                                        >
                                                            {isOpen ? "▼" : "▶"}
                                                        </div>

                                                        <strong style={{ fontSize: "1.05rem" }}>
                                                            Fishing Day {index + 1}
                                                        </strong>

                                                        <div
                                                            {...provided.dragHandleProps}
                                                            style={{
                                                                marginLeft: "auto",
                                                                cursor: "grab",
                                                                fontSize: "22px"
                                                            }}
                                                        >
                                                            ⋮⋮
                                                        </div>
                                                    </div>

                                                    {isOpen && (
                                                        <div style={{ padding: "16px" }}>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    justifyContent: "flex-end",
                                                                    marginBottom: "10px"
                                                                }}
                                                            >
                                                                <button
                                                                    className="btn danger"
                                                                    onClick={async e => {
                                                                        e.stopPropagation();
                                                                        if (!confirm("Remove this fishing day?"))
                                                                            return;
                                                                        await deleteCompetitionDay(d.id);
                                                                        setDays(prev =>
                                                                            prev.filter(x => x.id !== d.id)
                                                                        );
                                                                    }}
                                                                >
                                                                    🗑 Remove Day
                                                                </button>
                                                            </div>

                                                            <div className="form-grid">
                                                                <div className="field span-3">
                                                                    <label>Date</label>
                                                                    <input
                                                                        type="date"
                                                                        value={d.day_date}
                                                                        onChange={e =>
                                                                            updateDay(index, {
                                                                                day_date: e.target.value
                                                                            })
                                                                        }
                                                                    />
                                                                </div>

                                                                <div className="field span-3">
                                                                    <label>Start Type</label>
                                                                    <select
                                                                        value={d.fishing_start_type}
                                                                        onChange={e =>
                                                                            updateDay(index, {
                                                                                fishing_start_type:
                                                                                    e.target.value as FishingStartType
                                                                            })
                                                                        }
                                                                    >
                                                                        <option value="None">None</option>
                                                                        <option value="Required">Required</option>
                                                                    </select>
                                                                </div>

                                                                <div className="field span-3">
                                                                    <label>Start Time</label>
                                                                    <input
                                                                        type="time"
                                                                        value={d.fishing_start_time || ""}
                                                                        onChange={e =>
                                                                            updateDay(index, {
                                                                                fishing_start_time: e.target.value
                                                                            })
                                                                        }
                                                                    />
                                                                </div>

                                                                <div className="field span-3">
                                                                    <label>End Time</label>
                                                                    <input
                                                                        type="time"
                                                                        value={d.fishing_end_time || ""}
                                                                        onChange={e =>
                                                                            updateDay(index, {
                                                                                fishing_end_time: e.target.value
                                                                            })
                                                                        }
                                                                    />
                                                                </div>

                                                                <div className="field span-3">
                                                                    <label>Weigh-in</label>
                                                                    <select
                                                                        value={d.weighin_type}
                                                                        onChange={e =>
                                                                            updateDay(index, {
                                                                                weighin_type:
                                                                                    e.target.value as WeighinType
                                                                            })
                                                                        }
                                                                    >
                                                                        <option value="None">None</option>
                                                                        <option value="Optional">Optional</option>
                                                                        <option value="Required">Required</option>
                                                                    </select>
                                                                </div>

                                                                <div className="field span-3">
                                                                    <label>Weigh-In Start</label>
                                                                    <input
                                                                        type="time"
                                                                        value={d.weighin_start_time || ""}
                                                                        onChange={e =>
                                                                            updateDay(index, {
                                                                                weighin_start_time: e.target.value
                                                                            })
                                                                        }
                                                                    />
                                                                </div>

                                                                <div className="field span-3">
                                                                    <label>Weigh-In End</label>
                                                                    <input
                                                                        type="time"
                                                                        value={d.weighin_end_time || ""}
                                                                        onChange={e =>
                                                                            updateDay(index, {
                                                                                weighin_end_time: e.target.value
                                                                            })
                                                                        }
                                                                    />
                                                                </div>

                                                                <div className="field span-12">
                                                                    <label>Notes</label>
                                                                    <textarea
                                                                        rows={2}
                                                                        value={d.notes || ""}
                                                                        onChange={e =>
                                                                            updateDay(index, {
                                                                                notes: e.target.value
                                                                            })
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    );
                                })}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>

                <button
                    className="btn"
                    style={{
                        marginTop: 10,
                        padding: "14px 22px",
                        borderRadius: "12px",
                        fontSize: "16px",
                        minWidth: "180px",
                    }}
                    onClick={addDay}
                >
                    + Add Fishing Day
                </button>

            </div>

            <div className="actions span-12" style={{ marginTop: 25 }}>
                <button
                    className="btn primary btn--lg"
                    onClick={saveChanges}
                    disabled={saving}
                >
                    {saving ? "Saving…" : "Save Competition"}
                </button>
            </div>
        </section>
    );
}
