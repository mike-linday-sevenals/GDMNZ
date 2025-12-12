import { useEffect, useMemo, useState } from "react";
import {
    addCompetitor,
    deleteCompetitors,
    updateCompetitor,
    listCompetitions,
    listCompetitorsForCompetition,
    addCompetitorToCompetition,
    fetchCompetitionFees
} from "@/services/api";

import type { Competitor } from "@/types";
import { computeFee, formatNZ, todayISO } from "@/utils";

type DisplayCategory = "Adult" | "Junior";
type DomainCategory = "adult" | "junior";

function toDisplayCat(domain: DomainCategory): DisplayCategory {
    return domain === "adult" ? "Adult" : "Junior";
}

function toDomainCat(display: DisplayCategory): DomainCategory {
    return display === "Adult" ? "adult" : "junior";
}

function normName(s: string) {
    return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function Register() {
    // NEW — Competition state
    const [competitionId, setCompetitionId] = useState<string | null>(null);
    const [competitions, setCompetitions] = useState<any[]>([]);

    const [settings, setSettings] = useState<any>(null);
    const [rows, setRows] = useState<Competitor[]>([]);
    const [selected, setSelected] = useState<Set<string | number>>(new Set());

    // Create form fields
    const [name, setName] = useState("");
    const [category, setCategory] = useState<DisplayCategory>("Adult");
    const [paidOn, setPaidOn] = useState(todayISO());
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [boat, setBoat] = useState("");
    const [notes, setNotes] = useState("");

    // Edit state
    const [editingId, setEditingId] = useState<string | number | null>(null);
    const [draft, setDraft] = useState<{
        full_name: string;
        category: DisplayCategory;
        paid_on: string;
        email: string;
        phone: string;
        boat: string;
    } | null>(null);

    const [confirm, setConfirm] = useState<null | {
        message: string;
        onYes: () => void;
        onNo: () => void;
    }>(null);

    // -----------------------------
    // Load competitions on mount
    // -----------------------------
    useEffect(() => {
        (async () => {
            const comps = await listCompetitions();
            setCompetitions(comps);
        })();
    }, []);

    // ---------------------------------------------------
    // When competition changes → load fees + competitors
    // ---------------------------------------------------
    useEffect(() => {
        if (!competitionId) return;

        (async () => {
            const fees = await fetchCompetitionFees(competitionId);

            if (fees) {
                setSettings({
                    earlyBirdCutoff: fees.earlybird_cutoff_date,
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
                });
            } else {
                setSettings(null);
            }

            const compCompetitors = await listCompetitorsForCompetition(competitionId);
            setRows(compCompetitors);
        })();
    }, [competitionId]);

    // -----------------------------
    // Compute fee safely
    // -----------------------------
    const fee = useMemo(() => {
        if (!settings) return null;
        if (!settings.fees || !settings.fees.Adult) return null;
        return computeFee(settings, category, paidOn);
    }, [settings, category, paidOn]);

    const duplicateOnCreate = useMemo(() => {
        const n = normName(name);
        if (!n) return null;
        return rows.find((r) => normName(r.full_name) === n) || null;
    }, [name, rows]);

    // -----------------------------------
    // REGISTER COMPETITOR
    // -----------------------------------
    async function doAdd(keepBoat: boolean) {
        if (!competitionId) {
            alert("Please select a competition first.");
            return;
        }

        const newCompetitor = await addCompetitor({
            full_name: name.trim(),
            category: toDomainCat(category),
            paid_on: paidOn,
            email: email.trim() || null,
            phone: phone.trim() || null,
            boat: boat.trim() || null
        });

        await addCompetitorToCompetition(
            competitionId,
            String(newCompetitor.id)
        );

        setRows(await listCompetitorsForCompetition(competitionId));

        setName("");
        setEmail("");
        setPhone("");
        setNotes("");
        if (!keepBoat) setBoat("");
    }

    function save(keepBoat: boolean) {
        if (!name.trim()) return alert("Full Name is required");
        if (!paidOn) return alert("Payment Date is required");

        const dup = duplicateOnCreate;
        if (dup) {
            setConfirm({
                message: `A competitor named "${dup.full_name}" already exists. Continue anyway?`,
                onYes: async () => {
                    setConfirm(null);
                    await doAdd(keepBoat);
                },
                onNo: () => setConfirm(null)
            });
            return;
        }

        doAdd(keepBoat);
    }

    // -----------------------------------
    // Delete competitors
    // -----------------------------------
    async function removeSelected() {
        if (selected.size === 0) return alert("Select at least one");
        if (!confirmWindow("Delete selected competitors?")) return;

        await deleteCompetitors(Array.from(selected).map(id => String(id)));

        if (competitionId) {
            setRows(await listCompetitorsForCompetition(competitionId));
        }

        setSelected(new Set());
    }

    // -----------------------------------
    // Edit competitor
    // -----------------------------------
    function startEdit(r: Competitor) {
        if (editingId && editingId !== r.id) {
            if (!confirmWindow("Discard current changes?")) return;
        }

        setEditingId(r.id);
        setDraft({
            full_name: r.full_name,
            category: toDisplayCat(r.category as DomainCategory),
            paid_on: r.paid_on?.slice(0, 10) || "",
            email: r.email || "",
            phone: r.phone || "",
            boat: r.boat || ""
        });
    }

    function cancelEdit() {
        setEditingId(null);
        setDraft(null);
    }

    function findDuplicateForEdit(d: any, id: string | number | null) {
        if (!d?.full_name) return null;
        const n = normName(d.full_name);
        return rows.find(
            (r) => String(r.id) !== String(id) && normName(r.full_name) === n
        );
    }

    async function doSaveEdit() {
        if (!editingId || !draft) return;

        await updateCompetitor(String(editingId), {
            full_name: draft.full_name.trim(),
            category: toDomainCat(draft.category),
            paid_on: draft.paid_on,
            email: draft.email.trim() || null,
            phone: draft.phone.trim() || null,
            boat: draft.boat.trim() || null
        });

        if (competitionId) {
            setRows(await listCompetitorsForCompetition(competitionId));
        }

        setEditingId(null);
        setDraft(null);
    }

    function saveEdit() {
        if (!editingId || !draft) return;

        const dup = findDuplicateForEdit(draft, editingId);
        if (dup) {
            setConfirm({
                message: "Another competitor already has this name. Continue?",
                onYes: async () => {
                    setConfirm(null);
                    await doSaveEdit();
                },
                onNo: () => setConfirm(null)
            });
            return;
        }

        doSaveEdit();
    }

    // -----------------------------------
    // Search + fee rendering
    // -----------------------------------
    const [search, setSearch] = useState("");

    const filtered = rows.filter(
        (r) =>
            !search ||
            [r.full_name, r.email, r.boat]
                .join(" ")
                .toLowerCase()
                .includes(search.toLowerCase())
    );

    function feeForDraft(d: typeof draft | null) {
        if (!d || !settings?.fees?.Adult) return "";
        const f = computeFee(settings, d.category, d.paid_on);
        return isFinite(f as any) ? `$${f.toFixed(0)}` : "";
    }

    // -----------------------------------
    // RENDER
    // -----------------------------------
    return (
        <>
            {/* Confirm Banner */}
            {confirm && (
                <div className="card" style={{ background: "#fff7ed", borderColor: "#fed7aa", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className="badge" style={{ background: "#fdba74" }}>Warning</span>
                        <div style={{ flex: 1 }}>{confirm.message}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn" onClick={confirm.onNo}>Cancel</button>
                            <button className="btn primary" onClick={confirm.onYes}>Continue</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Registration Card */}
            <section className="card">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px"
                    }}
                >
                    <h2>Competition Registration</h2>

                    <select
                        value={competitionId || ""}
                        onChange={(e) => setCompetitionId(e.target.value)}
                        style={{
                            padding: "6px 10px",
                            width: "30%",        // 💡 keeps dropdown compact
                            minWidth: "220px",   // 💡 prevents too small
                            maxWidth: "300px",   // 💡 prevents too large
                            textAlign: "left",         // <-- fixes list alignment
                        }}
                    >
                        <option value="">-- Select Competition --</option>
                        {competitions
                            .sort(
                                (a, b) =>
                                    new Date(b.starts_at).getTime() -
                                    new Date(a.starts_at).getTime()   // ← FIXED TS ERROR
                            )
                            .map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                    </select>
                </div>


                {/* Form */}
                <div className="row">
                    <div className="col-6">
                        <label>Full Name *</label>
                        <input
                            disabled={!competitionId}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="First Last"
                        />
                        {!!duplicateOnCreate && (
                            <div className="muted" style={{ color: "#b45309", marginTop: 4 }}>
                                A competitor named <strong>{duplicateOnCreate.full_name}</strong> already exists.
                            </div>
                        )}
                    </div>

                    <div className="col-3">
                        <label>Category *</label>
                        <select
                            disabled={!competitionId}
                            value={category}
                            onChange={(e) => setCategory(e.target.value as DisplayCategory)}
                        >
                            <option>Adult</option>
                            <option>Junior</option>
                        </select>
                    </div>

                    <div className="col-3">
                        <label>Payment Date *</label>
                        <input
                            type="date"
                            disabled={!competitionId}
                            value={paidOn}
                            onChange={(e) => setPaidOn(e.target.value)}
                        />
                    </div>

                    <div className="col-6">
                        <label>Email</label>
                        <input
                            disabled={!competitionId}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                        />
                    </div>

                    <div className="col-3">
                        <label>Phone</label>
                        <input
                            disabled={!competitionId}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+64 ..."
                        />
                    </div>

                    <div className="col-3">
                        <label>Boat / Team</label>
                        <input
                            disabled={!competitionId}
                            value={boat}
                            onChange={(e) => setBoat(e.target.value)}
                            placeholder="Boat or Team name"
                        />
                    </div>

                    <div className="col-12">
                        <label>Notes (local only)</label>
                        <textarea
                            disabled={!competitionId}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                {/* Buttons */}
                <div className="actions" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", marginTop: 6 }}>
                    <span className="pill">
                        Fee:
                        <strong style={{ marginLeft: 6 }}>
                            {fee != null ? `$${fee.toFixed(0)}` : "$0"}
                        </strong>
                    </span>

                    <div style={{ flex: "1 1 auto" }} />

                    <button disabled={!competitionId} className="btn primary" onClick={() => save(false)}>
                        Register Competitor
                    </button>

                    <button disabled={!competitionId} className="btn accent" onClick={() => save(true)}>
                        Save & Register Another
                    </button>

                    <button className="btn" onClick={() => {
                        setName(""); setEmail(""); setPhone(""); setBoat(""); setNotes("");
                    }}>
                        Clear
                    </button>

                    {settings?.fees?.Adult && (
                        <div style={{ flexBasis: "100%", marginTop: 6, lineHeight: 1.3 }}>
                            Early-bird cutoff:
                            <span className="badge">{formatNZ(settings.earlyBirdCutoff)}</span>
                            — Adult ${settings.fees.Adult.early} → ${settings.fees.Adult.standard} after;
                            Junior ${settings.fees.Junior.early} → ${settings.fees.Junior.standard}.
                        </div>
                    )}
                </div>
            </section>

            {/* Registered Competitors */}
            <section className="card">
                <h3>Registered Competitors</h3>

                <div className="actions">
                    <input
                        placeholder="Search by name / email / boat..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <button
                        type="button"
                        className="btn"
                        onClick={() =>
                            setRows((r) =>
                                [...r].sort((a, b) => a.full_name.localeCompare(b.full_name))
                            )
                        }
                    >
                        Sort A → Z
                    </button>

                    <button
                        type="button"
                        className="btn danger"
                        onClick={removeSelected}
                        disabled={!!editingId}
                    >
                        Delete Selected
                    </button>
                </div>

                <div style={{ overflow: "auto", marginTop: 10 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        disabled={!!editingId}
                                        onChange={(e) => {
                                            if (e.target.checked)
                                                setSelected(new Set(filtered.map((x) => x.id)));
                                            else setSelected(new Set());
                                        }}
                                    />
                                </th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Boat</th>
                                <th>Payment Date</th>
                                <th>Fee</th>
                                <th>Edit</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filtered.map((r) => {
                                const isEditing = editingId === r.id;
                                const dispCat = toDisplayCat(r.category as DomainCategory);
                                const feeRow = settings?.fees?.Adult
                                    ? computeFee(settings, dispCat, r.paid_on)
                                    : null;

                                if (!isEditing) {
                                    return (
                                        <tr key={r.id}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(r.id)}
                                                    onChange={(e) => {
                                                        const set = new Set(selected);
                                                        if (e.target.checked) set.add(r.id);
                                                        else set.delete(r.id);
                                                        setSelected(set);
                                                    }}
                                                />
                                            </td>
                                            <td>{r.full_name}</td>
                                            <td>{dispCat}</td>
                                            <td>{r.email || ""}</td>
                                            <td>{r.phone || ""}</td>
                                            <td>{r.boat || ""}</td>
                                            <td className="nz-date">{formatNZ(r.paid_on)}</td>
                                            <td>{feeRow != null ? `$${feeRow.toFixed(0)}` : ""}</td>
                                            <td>
                                                <button className="btn" onClick={() => startEdit(r)}>
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr key={r.id}>
                                        <td><input type="checkbox" disabled /></td>
                                        <td>
                                            <input
                                                value={draft?.full_name || ""}
                                                onChange={(e) =>
                                                    setDraft((d) => ({ ...(d as any), full_name: e.target.value }))
                                                }
                                            />
                                            {!!findDuplicateForEdit(draft, editingId) && (
                                                <div className="muted" style={{ color: "#b45309", marginTop: 4 }}>
                                                    Duplicate name detected.
                                                </div>
                                            )}
                                        </td>

                                        <td>
                                            <select
                                                value={draft?.category || "Adult"}
                                                onChange={(e) =>
                                                    setDraft((d) => ({ ...(d as any), category: e.target.value as DisplayCategory }))
                                                }
                                            >
                                                <option>Adult</option>
                                                <option>Junior</option>
                                            </select>
                                        </td>

                                        <td>
                                            <input
                                                value={draft?.email || ""}
                                                onChange={(e) =>
                                                    setDraft((d) => ({ ...(d as any), email: e.target.value }))
                                                }
                                            />
                                        </td>

                                        <td>
                                            <input
                                                value={draft?.phone || ""}
                                                onChange={(e) =>
                                                    setDraft((d) => ({ ...(d as any), phone: e.target.value }))
                                                }
                                            />
                                        </td>

                                        <td>
                                            <input
                                                value={draft?.boat || ""}
                                                onChange={(e) =>
                                                    setDraft((d) => ({ ...(d as any), boat: e.target.value }))
                                                }
                                            />
                                        </td>

                                        <td>
                                            <input
                                                type="date"
                                                value={draft?.paid_on || todayISO()}
                                                onChange={(e) =>
                                                    setDraft((d) => ({ ...(d as any), paid_on: e.target.value }))
                                                }
                                            />
                                        </td>

                                        <td>{feeForDraft(draft)}</td>

                                        <td>
                                            <button className="btn primary" onClick={saveEdit}>
                                                Save
                                            </button>
                                            <button className="btn" onClick={cancelEdit} style={{ marginLeft: 8 }}>
                                                Cancel
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="muted">No competitors yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}

function confirmWindow(msg: string) {
    return window.confirm(msg);
}
