import { useEffect, useMemo, useState } from "react";
import {
    addCompetitor,
    updateCompetitor,
    deleteCompetitors,
    listCompetitions,
    listCompetitorsForCompetition,
    addCompetitorToCompetition,
    fetchCompetitionFees
} from "@/services/api";

import { computeFee, todayISO } from "@/utils";

/* =========================================================
   Types
========================================================= */

type DisplayCategory = "Adult" | "Junior";
type DomainCategory = "adult" | "junior";
type BoatType = "Launch" | "Trailer" | "Charter";

type AnglerDraft = {
    full_name: string;
    category: DisplayCategory;
    membership_no: string;
    paid: boolean;
    paid_on: string | null;
};

type BoatDraft = {
    boat_name: string;
    boat_type: BoatType;
    anglers: {
        full_name: string;
        category: DisplayCategory;
        membership_no: string;
        paid: boolean;
    }[];
};

export type Competitor = {
    id: string | number;
    created_at: string;
    full_name: string;
    category: DomainCategory;
    paid_on: string | null;
    boat: string;
    membership_no: string;
    boat_type: BoatType;
};

/* =========================================================
   Helpers
========================================================= */

const toDomainCategory = (c: DisplayCategory): DomainCategory =>
    c === "Adult" ? "adult" : "junior";

const toDisplayCategory = (c: DomainCategory): DisplayCategory =>
    c === "adult" ? "Adult" : "Junior";

const formatDateNZ = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-NZ") : "";

/* =========================================================
   Component
========================================================= */

export default function Register() {
    /* ----------------------------- State ----------------------------- */

    const emptyBoat: BoatDraft = {
        boat_name: "",
        boat_type: "Trailer",
        anglers: [{ full_name: "", category: "Adult", membership_no: "", paid: false }]
    };

    const [competitionId, setCompetitionId] = useState<string | null>(null);
    const [competitions, setCompetitions] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [rows, setRows] = useState<Competitor[]>([]);
    const [boat, setBoat] = useState<BoatDraft>(emptyBoat);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [addingToBoat, setAddingToBoat] = useState<string | null>(null);

    const [draft, setDraft] = useState<AnglerDraft | null>(null);
    const [openBoats, setOpenBoats] = useState<Set<string>>(new Set());

    /* ----------------------------- Load competitions ----------------------------- */

    useEffect(() => {
        (async () => setCompetitions(await listCompetitions()))();
    }, []);

    /* ----------------------------- Load fees + competitors ----------------------------- */

    useEffect(() => {
        if (!competitionId) return;

        (async () => {
            const fees = await fetchCompetitionFees(competitionId);
            setSettings(
                fees
                    ? {
                        fees: {
                            Adult: {
                                early: Number(fees.earlybird_fee_adult),
                                standard: Number(fees.full_fee_adult)
                            },
                            Junior: {
                                early: Number(fees.earlybird_fee_junior),
                                standard: Number(fees.full_fee_junior)
                            }
                        }
                    }
                    : null
            );

            setRows(await listCompetitorsForCompetition(competitionId));
        })();
    }, [competitionId]);

    /* ----------------------------- New boat helpers ----------------------------- */

    const updateAngler = (i: number, patch: Partial<BoatDraft["anglers"][0]>) =>
        setBoat(b => ({
            ...b,
            anglers: b.anglers.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
        }));

    const addAngler = () =>
        setBoat(b => ({
            ...b,
            anglers: [
                ...b.anglers,
                { full_name: "", category: "Adult", membership_no: "", paid: false }
            ]
        }));

    const removeAngler = (i: number) =>
        setBoat(b => ({ ...b, anglers: b.anglers.filter((_, idx) => idx !== i) }));

    /* ----------------------------- Register new boat ----------------------------- */

    const validAnglers = boat.anglers.filter(a => a.full_name.trim());
    const canRegister =
        !!competitionId && !!boat.boat_name.trim() && validAnglers.length > 0;

    async function registerBoat() {
        if (!competitionId || !canRegister) return;

        for (const a of validAnglers) {
            const created = await addCompetitor({
                full_name: a.full_name.trim(),
                category: toDomainCategory(a.category),
                paid_on: a.paid ? todayISO() : null,
                boat: boat.boat_name.trim(),
                membership_no: a.membership_no.trim(),
                boat_type: boat.boat_type
            });

            await addCompetitorToCompetition(competitionId, String(created.id));
        }

        setRows(await listCompetitorsForCompetition(competitionId));
        setBoat(emptyBoat);
    }

    /* ----------------------------- Edit / Add existing ----------------------------- */

    const startEdit = (r: Competitor) => {
        setEditingId(String(r.id));
        setAddingToBoat(null);
        setDraft({
            full_name: r.full_name,
            category: toDisplayCategory(r.category),
            membership_no: r.membership_no || "",
            paid: !!r.paid_on,
            paid_on: r.paid_on
        });
    };

    const startAddToBoat = (boatName: string) => {
        setEditingId(null);
        setAddingToBoat(boatName);
        setDraft({
            full_name: "",
            category: "Adult",
            membership_no: "",
            paid: false,
            paid_on: null
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setAddingToBoat(null);
        setDraft(null);
    };

    const saveExisting = async (id: string | number) => {
        if (!draft) return;

        await updateCompetitor(id, {
            full_name: draft.full_name.trim(),
            category: toDomainCategory(draft.category),
            membership_no: draft.membership_no.trim(),
            paid_on: draft.paid ? draft.paid_on ?? todayISO() : null
        });

        if (competitionId) {
            setRows(await listCompetitorsForCompetition(competitionId));
        }

        cancelEdit();
    };

    const saveNewToBoat = async (boatName: string, boatType: BoatType) => {
        if (!draft || !competitionId) return;

        const created = await addCompetitor({
            full_name: draft.full_name.trim(),
            category: toDomainCategory(draft.category),
            membership_no: draft.membership_no.trim(),
            paid_on: draft.paid ? todayISO() : null,
            boat: boatName,
            boat_type: boatType
        });

        await addCompetitorToCompetition(competitionId, String(created.id));
        setRows(await listCompetitorsForCompetition(competitionId));
        cancelEdit();
    };

    const removeCompetitor = async (id: string | number) => {
        if (!confirm("Remove this angler?")) return;
        await deleteCompetitors([id]);
        if (competitionId) setRows(await listCompetitorsForCompetition(competitionId));
    };

    /* ----------------------------- Group by boat ----------------------------- */

    const boats = useMemo(() => {
        const map = new Map<string, Competitor[]>();
        rows.forEach(r => {
            const key = r.boat || "—";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        });
        return Array.from(map.entries());
    }, [rows]);

    /* ========================================================= Render ========================================================= */

    return (
        <>
            {/* ================= REGISTRATION ================= */}
            <section className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <h2 style={{ margin: 0, flex: 1 }}>Competition Registration</h2>

                    <select
                        value={competitionId ?? ""}
                        onChange={e => setCompetitionId(e.target.value || null)}
                        style={{ maxWidth: 320 }}
                    >
                        <option value="">-- Select Competition --</option>
                        {competitions.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <h3 style={{ marginTop: 16 }}>Boat Details</h3>

                <div className="row">
                    <div className="col-6">
                        <input
                            placeholder="Boat / Team"
                            value={boat.boat_name}
                            onChange={e =>
                                setBoat(b => ({ ...b, boat_name: e.target.value }))
                            }
                        />
                    </div>

                    <div className="col-4">
                        <select
                            value={boat.boat_type}
                            onChange={e =>
                                setBoat(b => ({
                                    ...b,
                                    boat_type: e.target.value as BoatType
                                }))
                            }
                        >
                            <option>Launch</option>
                            <option>Trailer</option>
                            <option>Charter</option>
                        </select>
                    </div>
                </div>

                <h3 style={{ marginTop: 16 }}>Anglers</h3>

                {boat.anglers.map((a, i) => (
                    <div key={i} className="row" style={{ marginBottom: 8 }}>
                        <div className="col-6">
                            <input
                                placeholder="Full name"
                                value={a.full_name}
                                onChange={e =>
                                    updateAngler(i, { full_name: e.target.value })
                                }
                            />
                        </div>

                        <div className="col-2">
                            <select
                                value={a.category}
                                onChange={e =>
                                    updateAngler(i, {
                                        category: e.target.value as DisplayCategory
                                    })
                                }
                            >
                                <option>Adult</option>
                                <option>Junior</option>
                            </select>
                        </div>

                        <div className="col-3">
                            <input
                                placeholder="Membership No"
                                value={a.membership_no}
                                onChange={e =>
                                    updateAngler(i, { membership_no: e.target.value })
                                }
                            />
                        </div>

                        <div className="col-2">
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    height: "100%"
                                }}
                            >
                                <label
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        fontSize: "0.95rem",      // matches inputs/selects
                                        fontWeight: 500,
                                        lineHeight: 1,
                                        cursor: "pointer",
                                        margin: 0
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={a.paid}
                                        onChange={e =>
                                            updateAngler(i, { paid: e.target.checked })
                                        }
                                        style={{
                                            width: 16,
                                            height: 16,
                                            margin: 0
                                        }}
                                    />
                                    Paid
                                </label>
                            </div>
                        </div>


                        <div className="col-1">
                            {boat.anglers.length > 1 && (
                                <button
                                    className="btn danger small"
                                    onClick={() => removeAngler(i)}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                <button className="btn small" onClick={addAngler}>
                    + Add angler to boat
                </button>

                {canRegister && (
                    <div className="actions" style={{ marginTop: 16 }}>
                        <div style={{ flex: 1 }} />
                        <button className="btn primary" onClick={registerBoat}>
                            Register Boat & Anglers
                        </button>
                    </div>
                )}
            </section>

            {/* ================= REGISTERED BOATS ================= */}
            <section className="card">
                <h3>Registered Boats</h3>

                {boats.map(([boatName, anglers]) => {
                    const open = openBoats.has(boatName);
                    const boatType = anglers[0].boat_type;

                    return (
                        <div key={boatName} className="card" style={{ marginTop: 12 }}>
                            <div
                                style={{ display: "flex", gap: 12, cursor: "pointer" }}
                                onClick={() =>
                                    setOpenBoats(p => {
                                        const n = new Set(p);
                                        n.has(boatName) ? n.delete(boatName) : n.add(boatName);
                                        return n;
                                    })
                                }
                            >
                                <strong>{open ? "▼" : "▶"} {boatName}</strong>
                                <span className="badge">{anglers.length} anglers</span>
                            </div>

                            {open && (
                                <>
                                    <table style={{ marginTop: 8 }}>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Category</th>
                                                <th>Member No</th>
                                                <th>Registered</th>
                                                <th>Amount</th>
                                                <th>Paid</th>
                                                <th>Edit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {anglers.map(r => {
                                                const rowId = String(r.id);
                                                const isEditing = editingId === rowId;

                                                const amount = settings?.fees
                                                    ? computeFee(
                                                        settings,
                                                        toDisplayCategory(r.category),
                                                        r.paid_on ?? todayISO()
                                                    )
                                                    : null;

                                                if (!isEditing) {
                                                    return (
                                                        <tr key={rowId}>
                                                            <td>{r.full_name}</td>
                                                            <td>{toDisplayCategory(r.category)}</td>
                                                            <td>{r.membership_no || "—"}</td>
                                                            <td>{formatDateNZ(r.created_at)}</td>
                                                            <td>{amount != null ? `$${amount.toFixed(0)}` : ""}</td>
                                                            <td>{r.paid_on ? "✔" : "✖"}</td>
                                                            <td>
                                                                <button className="btn" onClick={() => startEdit(r)}>
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    className="btn danger"
                                                                    style={{ marginLeft: 6 }}
                                                                    onClick={() => removeCompetitor(r.id)}
                                                                >
                                                                    Remove
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return (
                                                    <tr key={rowId}>
                                                        <td>
                                                            <input
                                                                value={draft?.full_name || ""}
                                                                onChange={e =>
                                                                    setDraft(d => ({ ...(d as AnglerDraft), full_name: e.target.value }))
                                                                }
                                                            />
                                                        </td>
                                                        <td>
                                                            <select
                                                                value={draft?.category}
                                                                onChange={e =>
                                                                    setDraft(d => ({ ...(d as AnglerDraft), category: e.target.value as DisplayCategory }))
                                                                }
                                                            >
                                                                <option>Adult</option>
                                                                <option>Junior</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input
                                                                value={draft?.membership_no || ""}
                                                                onChange={e =>
                                                                    setDraft(d => ({ ...(d as AnglerDraft), membership_no: e.target.value }))
                                                                }
                                                            />
                                                        </td>
                                                        <td>{formatDateNZ(r.created_at)}</td>
                                                        <td>{amount != null ? `$${amount.toFixed(0)}` : ""}</td>
                                                        <td>
                                                            <label style={{ display: "flex", gap: 6 }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!draft?.paid}
                                                                    onChange={e =>
                                                                        setDraft(d => ({
                                                                            ...(d as AnglerDraft),
                                                                            paid: e.target.checked,
                                                                            paid_on: e.target.checked ? todayISO() : null
                                                                        }))
                                                                    }
                                                                />
                                                                Paid
                                                            </label>
                                                        </td>
                                                        <td>
                                                            <button className="btn primary" onClick={() => saveExisting(r.id)}>
                                                                Save
                                                            </button>
                                                            <button className="btn" onClick={cancelEdit} style={{ marginLeft: 6 }}>
                                                                Cancel
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {addingToBoat === boatName && draft && (
                                                <tr>
                                                    <td colSpan={7}>
                                                        <button
                                                            className="btn primary"
                                                            onClick={() => saveNewToBoat(boatName, boatType)}
                                                        >
                                                            Save new angler
                                                        </button>
                                                        <button className="btn" style={{ marginLeft: 6 }} onClick={cancelEdit}>
                                                            Cancel
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>

                                    {addingToBoat !== boatName && (
                                        <button
                                            className="btn small"
                                            style={{ marginTop: 8 }}
                                            onClick={() => startAddToBoat(boatName)}
                                        >
                                            + Add angler to {boatName}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </section>
        </>
    );
}
