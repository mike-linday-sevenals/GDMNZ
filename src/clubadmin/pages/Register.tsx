import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ConfirmModal from "@/components/ConfirmModal";


import {
    registerCompetitorsForBoat,
    listCompetitorsForCompetition,
    updateCompetitor,
    competitorHasResults,
    deleteCompetitorFromCompetition,
    RegistrationCategory,
} from "@/clubadmin/api/registration";

import {
    listCompetitions,
    fetchCompetitionFees,
    updateBoatForCompetition,
} from "@/services/api";

import { listCompetitionDivisions } from "@/clubadmin/api/divisions";

import {
    getTeamCaptainForBoat,
    setTeamCaptainForBoat,
    clearTeamCaptainForBoat,
    type TeamCaptain,
} from "@/clubadmin/api/teamCaptain";


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
    boat_type: BoatType | null;
    anglers: AnglerDraft[];
};

type Competitor = {
    id: string | number;
    registration_date: string;   // 👈 NEW (PRIMARY)
    created_at: string;          // 👈 keep for audit/debug
    full_name: string;
    category: DomainCategory;
    paid_on: string | null;
    boat: string | null;
    membership_no: string | null;
    boat_type: BoatType | null;

    // Competition identifiers
    angler_number: string | null;
    boat_number: string | null;
   // is_early_bird: boolean;
};

function normalizeCompetitorPatch(
    patch: Partial<Competitor>
): Partial<{
    full_name: string;
    category: RegistrationCategory;
    paid_on: string | null;
    membership_no: string;
    registration_date: string;
}> {
    const out: any = {};

    if (patch.full_name !== undefined)
        out.full_name = patch.full_name;

    if (patch.category !== undefined)
        out.category = patch.category;

    if (patch.paid_on !== undefined)
        out.paid_on = patch.paid_on;

    if (patch.membership_no !== undefined)
        out.membership_no = patch.membership_no ?? ""; // ✅ null → ""

    if (patch.registration_date !== undefined)
        out.registration_date = patch.registration_date;

    return out;
}



function resolveDivisionId(
    divisions: { id: string; name: string }[],
    category: DomainCategory
): string {
    if (divisions.length === 1) {
        return divisions[0].id;
    }

    const hasAdult = divisions.find(d => d.name === "Adult");
    const hasJunior = divisions.find(d => d.name === "Junior");

    if (hasAdult && hasJunior) {
        return category === "adult" ? hasAdult.id : hasJunior.id;
    }

    throw new Error(
        "Division selection required but not implemented yet"
    );
}



/* =========================================================
   Helpers
========================================================= */

const toDomainCategory = (c: DisplayCategory): DomainCategory =>
    c === "Adult" ? "adult" : "junior";





/* =========================================================
   Component
========================================================= */

export default function Register() {
    const { organisationId } = useParams<{ organisationId: string }>();

    /* ----------------------------- State ----------------------------- */

    const [boatTypeError, setBoatTypeError] = useState(false);

    const [anglerDrafts, setAnglerDrafts] = useState<Record<string, Partial<Competitor>>>({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);




    const [divisions, setDivisions] = useState<
        { id: string; name: string }[]
    >([]);

    const emptyBoat: BoatDraft = {
        boat_name: "",
        boat_type: null, 
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
    const [boatDraft, setBoatDraft] = useState<{
        boat_number: string;
        name: string;
        type: BoatType | null;
    } | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<Competitor | null>(null);
    const [deleteBlocked, setDeleteBlocked] = useState(false);

    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);


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
                        earlybird_cutoff_date: fees.earlybird_cutoff_date, // 👈 ADD THIS
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

            // ✅ NEW — load divisions
            setDivisions(await listCompetitionDivisions(competitionId));
        })();
    }, [organisationId, competitionId]);

    /* ----------------------------- Registration helpers ----------------------------- */

    const [pendingCaptainIndex, setPendingCaptainIndex] =
        useState<number | null>(null);

    // Team Captain (persisted)
    const [teamCaptain, setTeamCaptain] = useState<TeamCaptain | null>(null);

    // Team Captain (edit mode)
    const [editCaptainMode, setEditCaptainMode] =
        useState<"angler" | "external" | null>(null);
    const [externalCaptainName, setExternalCaptainName] =
        useState<string>("");

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

    const selectedCompetition = useMemo(
        () => competitions.find(c => c.id === competitionId),
        [competitions, competitionId]
    );


    /* ----------------------------- Register ----------------------------- */
    async function registerBoat(){
        if (!boat.boat_type) {
            setBoatTypeError(true);
            return;
        }

        setBoatTypeError(false);

        if (
            !competitionId ||
            !selectedCompetition?.starts_at ||
            !boat.boat_name.trim()
        ) {
            return;
        }

        await registerCompetitorsForBoat({
            competitionId,
            competitionStartDate: selectedCompetition.starts_at,
            boatName: boat.boat_name.trim(),
            boatType: boat.boat_type,
            anglers: boat.anglers
                .filter(a => a.full_name.trim())
                .map(a => ({
                    full_name: a.full_name.trim(),
                    category: toDomainCategory(a.category),
                    membership_no: a.membership_no.trim(),
                    paid_on: a.paid ? todayISO() : null,
                    division_id: resolveDivisionId(
                        divisions,
                        toDomainCategory(a.category)
                    ),
                })),
        });

        // 🔹 Persist Team Captain (if selected)
        if (pendingCaptainIndex !== null) {
            const competitors = await listCompetitorsForCompetition(competitionId);

            const boatCompetitors = competitors.filter(
                c =>
                    c.boat?.trim().toLowerCase() ===
                    boat.boat_name.trim().toLowerCase()
            );

            const captain = boatCompetitors[pendingCaptainIndex];

            if (captain?.boat_number) {
                await setTeamCaptainForBoat({
                    competitionId,
                    boatNumber: captain.boat_number,
                    competitor_id: String(captain.id),
                });
            }
        }


        setRows(await listCompetitorsForCompetition(competitionId));
        setBoat(emptyBoat);
    }







    /* ----------------------------- Group by boat_number ----------------------------- */

    const boats = useMemo(() => {
        const map = new Map<string, Competitor[]>();

        rows.forEach((r) => {
            const key = r.boat_number ?? "NO_BOAT";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        });

        return Array.from(map.entries());
    }, [rows]);

    /* ----------------------------- Save boat edits (name/type only) ----------------------------- */

    async function saveBoatEdit() {
        if (!competitionId || !boatDraft) return;

        await updateBoatForCompetition(
            competitionId,
            boatDraft.boat_number,
            {
                boat: boatDraft.name,
                ...(boatDraft.type ? { boat_type: boatDraft.type } : {}),
            }

        );

        setRows(await listCompetitorsForCompetition(competitionId));
        setBoat(emptyBoat);
        setPendingCaptainIndex(null);
    }
    async function handleConfirmDelete() {
        if (!deleteTarget || !competitionId) return;

        await deleteCompetitorFromCompetition(
            competitionId,
            String(deleteTarget.id)
        );

        setRows(await listCompetitorsForCompetition(competitionId));

        // ✅ REQUIRED cleanup
        setOpenBoat(null);
        setBoatDraft(null);
        setDeleteTarget(null);
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
                            style={{ flex: 4 }}
                            placeholder="Boat name"
                            value={boat.boat_name}
                            onChange={(e) =>
                                setBoat({
                                    ...boat,
                                    boat_name: e.target.value,
                                })
                            }
                        />

                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <select
                                style={{
                                    width: 160,
                                    borderColor: boatTypeError ? "#dc2626" : undefined,
                                    backgroundColor: boatTypeError ? "#fef2f2" : undefined,
                                }}
                                value={boat.boat_type ?? ""}
                                onChange={(e) => {
                                    setBoat({
                                        ...boat,
                                        boat_type: e.target.value
                                            ? (e.target.value as BoatType)
                                            : null,
                                    });
                                    setBoatTypeError(false);
                                }}
                            >
                                <option value="">Boat type</option>
                                <option value="Trailer">Trailer</option>
                                <option value="Launch">Launch</option>
                                <option value="Charter">Charter</option>
                            </select>

                            {boatTypeError && (
                                <span
                                    style={{
                                        color: "#dc2626",
                                        fontSize: 12,
                                        marginTop: 4,
                                    }}
                                >
                                    Please select a boat type
                                </span>
                            )}
                        </div>

                       

                    </div>

                    <div style={{ height: 12 }} />

                    {boat.anglers.map((a, i) => (
                        <div
                            key={i}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "3fr 1fr 1.5fr auto",
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
                            />

                            <select
                                value={a.category}
                                onChange={(e) =>
                                    updateAnglerDraft(i, {
                                        category:
                                            e.target.value as DisplayCategory,
                                    })
                                }
                            >
                                <option value="Adult">Adult</option>
                                <option value="Junior">Junior</option>
                            </select>

                            <input
                                placeholder="Member #"
                                value={a.membership_no}
                                onChange={(e) =>
                                    updateAnglerDraft(i, {
                                        membership_no: e.target.value,
                                    })
                                }
                            />

                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {/* Captain star */}
                                <button
                                    type="button"
                                    title="Select as Team Captain"
                                    onClick={() =>
                                        setPendingCaptainIndex(
                                            pendingCaptainIndex === i ? null : i
                                        )
                                    }
                                    style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: 18,
                                        color: pendingCaptainIndex === i ? "#facc15" : "#9ca3af",
                                    }}
                                >
                                    {pendingCaptainIndex === i ? "★" : "☆"}
                                </button>

                                {/* Paid toggle */}
                                <button
                                    type="button"
                                    title="Select if paid at time of registration"
                                    className={`paid-toggle ${a.paid ? "is-paid" : ""}`}
                                    onClick={() =>
                                        updateAnglerDraft(i, { paid: !a.paid })
                                    }
                                >
                                    Paid
                                </button>
                            </div>


                        </div>
                    ))}

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 16,
                        }}
                    >
                        <button className="btn secondary" onClick={addAngler}>
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

            {/* ================= BOAT LIST ================= */}
            {boats.map(([boatNumber, anglers]) => {
                const isOpen = openBoat === boatNumber;

                const boatName =
                    anglers[0]?.boat?.trim() || "Unnamed Boat";

                const boatLabel =
                    boatNumber === "NO_BOAT"
                        ? boatName
                        : `${boatNumber} — ${boatName}`;

                return (
                    <section
                        key={boatNumber}
                        className="card"
                        style={{ marginTop: 12 }}
                    >
                        {/* -------- Boat header -------- */}
                        <div
                            style={{ marginTop: 8, cursor: "pointer" }}
                            onClick={() => {
                                if (isOpen && hasUnsavedChanges) {
                                    if (!confirm("Discard unsaved changes?")) return;
                                }

                                if (isOpen) {
                                    setOpenBoat(null);
                                    setAnglerDrafts({});
                                    return;
                                }

                                // Open boat → seed drafts
                                setOpenBoat(boatNumber);
                                // 🔹 Load Team Captain for this boat
                                (async () => {
                                    if (!competitionId) return;

                                    const captain = await getTeamCaptainForBoat(
                                        competitionId,
                                        boatNumber
                                    );

                                    setTeamCaptain(captain);

                                    if (captain?.competitor_id) {
                                        setEditCaptainMode("angler");
                                        setExternalCaptainName("");
                                    } else if (captain?.display_name) {
                                        setEditCaptainMode("external");
                                        setExternalCaptainName(captain.display_name);
                                    } else {
                                        setEditCaptainMode(null);
                                        setExternalCaptainName("");
                                    }
                                })();



                                setBoatDraft({
                                    boat_number: boatNumber,
                                    name: anglers[0]?.boat ?? "",
                                    type: anglers[0]?.boat_type ?? null,
                                });

                                const seeded: Record<string, Partial<Competitor>> = {};
                                anglers.forEach(a => {
                                    seeded[String(a.id)] = { ...a };
                                });

                                setAnglerDrafts(seeded);
                            }}
                        >
                            {isOpen ? "▾" : "▸"} {boatLabel} ({anglers.length})
                        </div>

                        {isOpen && boatDraft && (
                            <>
                                {/* ================= BOAT EDIT ================= */}
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 8,
                                        padding: 8,
                                        alignItems: "center",
                                    }}
                                >
                                    <input
                                        value={boatDraft.name}
                                        style={{ height: 36, lineHeight: "36px" }}
                                        onChange={(e) => {
                                            setBoatDraft({ ...boatDraft, name: e.target.value });
                                            setHasUnsavedChanges(true);
                                        }}
                                    />

                                    <select
                                        value={boatDraft.type ?? ""}
                                        style={{ height: 36 }}
                                        onChange={(e) => {
                                            setBoatDraft({
                                                ...boatDraft,
                                                type: e.target.value
                                                    ? (e.target.value as BoatType)
                                                    : null,
                                            });
                                            setHasUnsavedChanges(true);
                                        }}
                                    >
                                        <option value="">Boat type</option>
                                        <option value="Trailer">Trailer</option>
                                        <option value="Launch">Launch</option>
                                        <option value="Charter">Charter</option>
                                    </select>
                                </div>

                                {/* ================= TEAM CAPTAIN ================= */}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: 8,
                                    }}
                                >
                                    <strong style={{ minWidth: 110 }}>Team Captain</strong>

                                    <button
                                        type="button"
                                        className={`pill pill--clickable ${editCaptainMode === "angler" ? "pill--green" : "pill--muted"
                                            }`}
                                        onClick={async () => {
                                            setEditCaptainMode("angler");
                                            setExternalCaptainName("");

                                            if (teamCaptain?.display_name) {
                                                await clearTeamCaptainForBoat(competitionId!, boatNumber);
                                                setTeamCaptain(null);
                                            }
                                        }}
                                    >
                                        Angler
                                    </button>

                                    <button
                                        type="button"
                                        className={`pill pill--clickable ${editCaptainMode === "external" ? "pill--green" : "pill--muted"
                                            }`}
                                        onClick={async () => {
                                            setEditCaptainMode("external");

                                            if (teamCaptain?.competitor_id) {
                                                await clearTeamCaptainForBoat(competitionId!, boatNumber);
                                                setTeamCaptain(null);
                                            }
                                        }}
                                    >
                                        Skipper
                                    </button>

                                    <div style={{ width: 240 }}>
                                        {editCaptainMode === "angler" && (
                                            <select
                                                style={{ width: "100%", height: 36 }}
                                                value={teamCaptain?.competitor_id ?? ""}
                                                onChange={async (e) => {
                                                    const id = e.target.value || null;

                                                    if (!id) {
                                                        await clearTeamCaptainForBoat(
                                                            competitionId!,
                                                            boatNumber
                                                        );
                                                        setTeamCaptain(null);
                                                        return;
                                                    }

                                                    const updated = await setTeamCaptainForBoat({
                                                        competitionId: competitionId!,
                                                        boatNumber,
                                                        competitor_id: id,
                                                    });

                                                    setTeamCaptain(updated);
                                                }}
                                            >
                                                <option value="">— Select angler —</option>
                                                {anglers.map((a) => (
                                                    <option key={a.id} value={String(a.id)}>
                                                        {a.full_name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}

                                        {editCaptainMode === "external" && (
                                            <input
                                                style={{ width: "100%", height: 36 }}
                                                placeholder="Skipper name"
                                                value={externalCaptainName}
                                                onChange={(e) => setExternalCaptainName(e.target.value)}
                                                onBlur={async () => {
                                                    if (!externalCaptainName.trim()) return;

                                                    const updated = await setTeamCaptainForBoat({
                                                        competitionId: competitionId!,
                                                        boatNumber,
                                                        display_name: externalCaptainName.trim(),
                                                    });

                                                    setTeamCaptain(updated);
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* ================= ANGLERS ================= */}
                                <table style={{ marginTop: 8 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 80 }}>Angler #</th>
                                            <th style={{ width: 160 }}>Name</th>
                                            <th style={{ width: 120 }}>Category</th>
                                            <th style={{ width: 100 }} className="th-center">
                                                Early Bird
                                            </th>
                                            <th style={{ width: 100 }}>Member No</th>
                                            <th style={{ width: 130 }}>Registered</th>
                                            <th style={{ width: 70 }}>Amount</th>
                                            <th style={{ width: 70 }} className="th-center">
                                                Paid
                                            </th>
                                            <th style={{ width: 70 }} className="th-center">
                                                Delete
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {anglers.map((r) => {
                                            const d = anglerDrafts[r.id] ?? r;
                                            const isCaptain =
                                                teamCaptain?.competitor_id === String(r.id);

                                            const isEarly =
                                                !!settings?.earlybird_cutoff_date &&
                                                new Date(d.registration_date!) <=
                                                new Date(settings.earlybird_cutoff_date);

                                            const amount =
                                                settings?.fees &&
                                                computeFee(
                                                    settings,
                                                    d.category === "adult" ? "Adult" : "Junior",
                                                    d.registration_date!
                                                );

                                            return (
                                                <tr
                                                    key={String(r.id)}
                                                    style={
                                                        isCaptain
                                                            ? {
                                                                background: "#f0f9ff",
                                                                borderLeft: "4px solid #0284c7",
                                                            }
                                                            : undefined
                                                    }
                                                >
                                                    {/* Angler # + star */}
                                                    <td>
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 6,
                                                                height: 36,
                                                                lineHeight: "36px",
                                                            }}
                                                        >
                                                            <span>{r.angler_number ?? "—"}</span>
                                                            {isCaptain && (
                                                                <span
                                                                    title="Team Captain"
                                                                    style={{
                                                                        color: "#facc15",
                                                                        fontSize: 14,
                                                                        lineHeight: 1,
                                                                    }}
                                                                >
                                                                    ★
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Name */}
                                                    <td>
                                                        <input
                                                            value={d.full_name ?? ""}
                                                            style={{ width: 160, height: 36 }}
                                                            onChange={(e) => {
                                                                setAnglerDrafts((x) => ({
                                                                    ...x,
                                                                    [r.id]: {
                                                                        ...x[r.id],
                                                                        full_name: e.target.value,
                                                                    },
                                                                }));
                                                                setHasUnsavedChanges(true);
                                                            }}
                                                        />
                                                    </td>

                                                    <td>
                                                        <select
                                                            value={d.category}
                                                            style={{ width: 110, height: 36 }}
                                                            onChange={(e) => {
                                                                setAnglerDrafts((x) => ({
                                                                    ...x,
                                                                    [r.id]: {
                                                                        ...x[r.id],
                                                                        category: e.target.value as any,
                                                                    },
                                                                }));
                                                                setHasUnsavedChanges(true);
                                                            }}
                                                        >
                                                            <option value="adult">Adult</option>
                                                            <option value="junior">Junior</option>
                                                        </select>
                                                    </td>

                                                    <td className="cell-center">
                                                        <span
                                                            className={`pill ${isEarly ? "pill--green" : "pill--muted"
                                                                }`}
                                                        >
                                                            {isEarly ? "Early" : "Standard"}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <input
                                                            value={d.membership_no ?? ""}
                                                            style={{ width: 100, height: 36 }}
                                                            onChange={(e) => {
                                                                setAnglerDrafts((x) => ({
                                                                    ...x,
                                                                    [r.id]: {
                                                                        ...x[r.id],
                                                                        membership_no: e.target.value,
                                                                    },
                                                                }));
                                                                setHasUnsavedChanges(true);
                                                            }}
                                                        />
                                                    </td>

                                                    <td>
                                                        <input
                                                            type="date"
                                                            value={d.registration_date ?? ""}
                                                            style={{ height: 36 }}
                                                            onChange={(e) => {
                                                                setAnglerDrafts((x) => ({
                                                                    ...x,
                                                                    [r.id]: {
                                                                        ...x[r.id],
                                                                        registration_date: e.target.value,
                                                                    },
                                                                }));
                                                                setHasUnsavedChanges(true);
                                                            }}
                                                        />
                                                    </td>

                                                    <td>{amount != null ? `$${amount}` : ""}</td>

                                                    <td className="cell-center">
                                                        <button
                                                            type="button"
                                                            className={`pill pill--clickable ${d.paid_on ? "pill--green" : "pill--muted"
                                                                }`}
                                                            onClick={() => {
                                                                setAnglerDrafts((x) => ({
                                                                    ...x,
                                                                    [r.id]: {
                                                                        ...x[r.id],
                                                                        paid_on: d.paid_on
                                                                            ? null
                                                                            : todayISO(),
                                                                    },
                                                                }));
                                                                setHasUnsavedChanges(true);
                                                            }}
                                                        >
                                                            {d.paid_on ? "Paid" : "Unpaid"}
                                                        </button>
                                                    </td>

                                                    <td className="cell-center">
                                                        <button
                                                            className="icon-btn"
                                                            title="Remove angler"
                                                            onClick={async () => {
                                                                const blocked =
                                                                    await competitorHasResults(
                                                                        String(r.id)
                                                                    );
                                                                if (blocked) {
                                                                    setDeleteBlocked(true);
                                                                    setDeleteTarget(r);
                                                                    return;
                                                                }
                                                                setDeleteBlocked(false);
                                                                setDeleteTarget(r);
                                                                setConfirmDeleteOpen(true);
                                                            }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>




                                {/* ================= ACTIONS ================= */}
                                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                    <button
                                        className="btn primary"
                                        onClick={async () => {
                                            if (!competitionId) return;

                                            // Save boat (if changed)
                                            await saveBoatEdit();

                                            // Save anglers
                                            for (const [id, patch] of Object.entries(anglerDrafts)) {
                                                await updateCompetitor(id, normalizeCompetitorPatch(patch));
                                            }


                                            setRows(await listCompetitorsForCompetition(competitionId));
                                        }}
                                    >
                                        Save changes
                                    </button>

                                    <button
                                        className="btn secondary"
                                        onClick={() => {
                                            setOpenBoat(null);
                                            setAnglerDrafts({});
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                );
            })}

            {/* ================= DELETE CONFIRMATION MODAL ================= */}
            {
                confirmDeleteOpen && !deleteBlocked && deleteTarget && (
                    <ConfirmModal
                        title="Remove angler?"
                        message={`This will remove ${deleteTarget.full_name} from the competition. This action cannot be undone.`}
                        confirmLabel="Remove"
                        onCancel={() => {
                            setConfirmDeleteOpen(false);
                            setDeleteTarget(null);
                        }}
                        onConfirm={async () => {
                            await handleConfirmDelete();
                            setConfirmDeleteOpen(false);
                        }}
                    />
                )
            }
        </section>
     );


}
