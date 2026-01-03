import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
    addCompetitor,
    listCompetitions,
    listCompetitorsForCompetition,
    addCompetitorToCompetition,
    fetchCompetitionFees,
    updateCompetitor,
    updateBoatForCompetition,
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
};

type BoatDraft = {
    boat_name: string;
    boat_type: BoatType | "";
    anglers: AnglerDraft[];
};

type Competitor = {
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

const formatDateNZ = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-NZ") : "";

/* =========================================================
   Component
========================================================= */

export default function Register() {
    const { organisationId } = useParams<{ organisationId: string }>();

    /* ----------------------------- State ----------------------------- */

    const emptyBoat: BoatDraft = {
        boat_name: "",
        boat_type: "",
        anglers: [
            {
                full_name: "",
                category: "Adult",
                membership_no: "",
                paid: false,
            },
        ],
    };

    const [competitionId, setCompetitionId] = useState<string | null>(null);
    const [competitions, setCompetitions] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [rows, setRows] = useState<Competitor[]>([]);
    const [boat, setBoat] = useState<BoatDraft>(emptyBoat);

    const [openBoat, setOpenBoat] = useState<string | null>(null);
    const [boatDraft, setBoatDraft] = useState<{ name: string; type: BoatType } | null>(null);

    /* ----------------------------- Load competitions ----------------------------- */

    useEffect(() => {
        if (!organisationId) return;
        listCompetitions(organisationId).then(setCompetitions);
    }, [organisationId]);

    /* ----------------------------- Load fees + competitors ----------------------------- */

    useEffect(() => {
        if (!competitionId || !organisationId) return;

        (async () => {
            const fees = await fetchCompetitionFees(
                organisationId,
                competitionId
            );

            setSettings(
                fees
                    ? {
                        fees: {
                            Adult: {
                                early: Number(fees.earlybird_fee_adult),
                                standard: Number(fees.full_fee_adult),
                            },
                            Junior: {
                                early: Number(fees.earlybird_fee_junior),
                                standard: Number(fees.full_fee_junior),
                            },
                        },
                    }
                    : null
            );

            setRows(await listCompetitorsForCompetition(competitionId));
        })();
    }, [organisationId, competitionId]);

    /* ----------------------------- Registration helpers ----------------------------- */

    const updateAnglerDraft = (i: number, patch: Partial<AnglerDraft>) =>
        setBoat((b) => ({
            ...b,
            anglers: b.anglers.map((a, idx) =>
                idx === i ? { ...a, ...patch } : a
            ),
        }));

    const addAngler = () =>
        setBoat((b) => ({
            ...b,
            anglers: [
                ...b.anglers,
                {
                    full_name: "",
                    category: "Adult",
                    membership_no: "",
                    paid: false,
                },
            ],
        }));

    /* ----------------------------- Register ----------------------------- */

    async function registerBoat() {
        if (!competitionId || !boat.boat_name.trim()) return;

        for (const a of boat.anglers.filter((x) => x.full_name.trim())) {
            const created = await addCompetitor({
                full_name: a.full_name.trim(),
                category: toDomainCategory(a.category),
                paid_on: a.paid ? todayISO() : null,
                boat: boat.boat_name.trim(),
                membership_no: a.membership_no.trim(),
                boat_type: boat.boat_type as BoatType,
            });

            await addCompetitorToCompetition(
                competitionId,
                String(created.id)
            );
        }

        setRows(await listCompetitorsForCompetition(competitionId));
        setBoat(emptyBoat);
    }

    /* ----------------------------- Group by boat ----------------------------- */

    const boats = useMemo(() => {
        const map = new Map<string, Competitor[]>();
        rows.forEach((r) => {
            const key = r.boat || "—";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        });
        return Array.from(map.entries());
    }, [rows]);

    /* ----------------------------- Save boat edits ----------------------------- */

    async function saveBoatEdit(oldName: string) {
        if (!competitionId || !boatDraft) return;

        await updateBoatForCompetition(competitionId, oldName, {
            boat: boatDraft.name,
            boat_type: boatDraft.type,
        });

        setRows(await listCompetitorsForCompetition(competitionId));
        setBoatDraft(null);
    }

    /* ========================================================= Render ========================================================= */

    return (
        <section className="card">
            {/* ================= HEADER ================= */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h2 style={{ margin: 0, flex: 1 }}>
                    Competition Registration
                </h2>

                <select
                    value={competitionId ?? ""}
                    onChange={(e) => setCompetitionId(e.target.value || null)}
                    style={{ maxWidth: 320 }}
                >
                    <option value="">-- Select Competition --</option>
                    {competitions.map((c: any) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* ================= REGISTRATION CARD ================= */}
            {competitionId && (
                <section className="card" style={{ marginTop: 16 }}>
                    <h3>Add / Register Boat</h3>

                    <div style={{ display: "flex", gap: 12 }}>
                        <input
                            style={{ flex: 3 }}
                            placeholder="Boat name"
                            value={boat.boat_name}
                            onChange={(e) =>
                                setBoat({
                                    ...boat,
                                    boat_name: e.target.value,
                                })
                            }
                        />

                        <select
                            style={{ flex: 1 }}
                            value={boat.boat_type}
                            onChange={(e) =>
                                setBoat({
                                    ...boat,
                                    boat_type: e.target.value as BoatType,
                                })
                            }
                        >
                            <option value="">Boat type</option>
                            <option value="Trailer">Trailer</option>
                            <option value="Launch">Launch</option>
                            <option value="Charter">Charter</option>
                        </select>
                    </div>

                    <div style={{ height: 12 }} />

                    {boat.anglers.map((a, i) => (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                gap: 12,
                                alignItems: "center",
                                marginTop: 8,
                            }}
                        >
                            <input
                                placeholder="Full name"
                                value={a.full_name}
                                onChange={(e) =>
                                    updateAnglerDraft(i, {
                                        full_name: e.target.value,
                                    })
                                }
                                style={{ flex: 3 }}
                            />

                            <select
                                value={a.category}
                                onChange={(e) =>
                                    updateAnglerDraft(i, {
                                        category:
                                            e.target.value as DisplayCategory,
                                    })
                                }
                                style={{ flex: 1 }}
                            >
                                <option>Adult</option>
                                <option>Junior</option>
                            </select>

                            <input
                                placeholder="Member #"
                                value={a.membership_no}
                                onChange={(e) =>
                                    updateAnglerDraft(i, {
                                        membership_no: e.target.value,
                                    })
                                }
                                style={{ flex: 2 }}
                            />

                            <label>
                                <input
                                    type="checkbox"
                                    checked={a.paid}
                                    onChange={(e) =>
                                        updateAnglerDraft(i, {
                                            paid: e.target.checked,
                                        })
                                    }
                                />{" "}
                                Paid
                            </label>
                        </div>
                    ))}

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 16,
                        }}
                    >
                        <button
                            className="btn secondary"
                            onClick={addAngler}
                        >
                            + Add angler
                        </button>

                        <button
                            className="btn primary"
                            onClick={registerBoat}
                        >
                            Register Boat & Anglers
                        </button>
                    </div>
                </section>
            )}

            {/* ================= BOAT LIST (EDITABLE WHEN OPEN) ================= */}
            {boats.map(([boatName, anglers]) => {
                const isOpen = openBoat === boatName;

                return (
                    <section
                        key={boatName}
                        className="card"
                        style={{ marginTop: 12 }}
                    >
                        {/* Boat header */}
                        <div
                            style={{
                                cursor: "pointer",
                                padding: 8,
                                fontWeight: 600,
                            }}
                            onClick={() => {
                                setOpenBoat(isOpen ? null : boatName);
                                setBoatDraft({
                                    name: boatName,
                                    type: anglers[0].boat_type,
                                });
                            }}
                        >
                            {isOpen ? "▾" : "▸"} {boatName} ({anglers.length})
                        </div>

                        {isOpen && boatDraft && (
                            <>
                                {/* Boat edit */}
                                <div style={{ display: "flex", gap: 8, padding: 8 }}>
                                    <input
                                        value={boatDraft.name}
                                        onChange={(e) =>
                                            setBoatDraft({
                                                ...boatDraft,
                                                name: e.target.value,
                                            })
                                        }
                                    />
                                    <select
                                        value={boatDraft.type}
                                        onChange={(e) =>
                                            setBoatDraft({
                                                ...boatDraft,
                                                type: e.target.value as BoatType,
                                            })
                                        }
                                    >
                                        <option value="Trailer">Trailer</option>
                                        <option value="Launch">Launch</option>
                                        <option value="Charter">Charter</option>
                                    </select>
                                    <button
                                        className="btn secondary"
                                        onClick={() => saveBoatEdit(boatName)}
                                    >
                                        Save boat
                                    </button>
                                </div>

                                {/* Anglers edit */}
                                <table style={{ marginTop: 8 }}>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Category</th>
                                            <th>Member No</th>
                                            <th>Registered</th>
                                            <th>Amount</th>
                                            <th>Paid</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {anglers.map((r) => {
                                            const amount =
                                                settings?.fees &&
                                                computeFee(
                                                    settings,
                                                    r.category === "adult"
                                                        ? "Adult"
                                                        : "Junior",
                                                    r.paid_on ?? todayISO()
                                                );

                                            return (
                                                <tr key={String(r.id)}>
                                                    <td>
                                                        <input
                                                            value={r.full_name}
                                                            onChange={(e) =>
                                                                updateCompetitor(
                                                                    r.id,
                                                                    {
                                                                        full_name:
                                                                            e.target.value,
                                                                    }
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={r.category}
                                                            onChange={(e) =>
                                                                updateCompetitor(
                                                                    r.id,
                                                                    {
                                                                        category:
                                                                            e.target
                                                                                .value as any,
                                                                    }
                                                                )
                                                            }
                                                        >
                                                            <option value="adult">
                                                                Adult
                                                            </option>
                                                            <option value="junior">
                                                                Junior
                                                            </option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            value={
                                                                r.membership_no ||
                                                                ""
                                                            }
                                                            onChange={(e) =>
                                                                updateCompetitor(
                                                                    r.id,
                                                                    {
                                                                        membership_no:
                                                                            e.target
                                                                                .value,
                                                                    }
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        {formatDateNZ(
                                                            r.created_at
                                                        )}
                                                    </td>
                                                    <td>
                                                        {amount != null
                                                            ? `$${amount}`
                                                            : ""}
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!r.paid_on}
                                                            onChange={(e) =>
                                                                updateCompetitor(
                                                                    r.id,
                                                                    {
                                                                        paid_on:
                                                                            e.target
                                                                                .checked
                                                                                ? todayISO()
                                                                                : null,
                                                                    }
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </section>
                );
            })}
        </section>
    );
}
