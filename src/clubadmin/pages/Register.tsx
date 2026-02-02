import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import {
    registerCompetitorsForBoat,
    listCompetitorsForCompetition,
    updateCompetitor,
    RegistrationCategory,
    moveCompetitorToBoat,
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

type EditDraft = {
    full_name: string;
    category: DomainCategory;
    membership_no: string;
    registration_date: string;
    paid_on: string | null;
    boat_number: string | null;
    boat: string | null;
    boat_type: BoatType | null;
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

const formatDateISOForInput = (iso: string | null | undefined): string => {
    if (!iso) return "";

    if (iso.length >= 10) return iso.slice(0, 10);

    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const formatDateNZForDisplay = (iso: string | null | undefined): string => {
    if (!iso) return "";

    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return iso.length >= 10 ? iso.slice(0, 10) : iso;
    }

    return d.toLocaleDateString("en-NZ", {
        timeZone: "Pacific/Auckland",
    });
};

/* =========================================================
   Component
========================================================= */

export default function Register() {
    const { organisationId } = useParams<{ organisationId: string }>();

    /* ----------------------------- State ----------------------------- */

    const [boatTypeError, setBoatTypeError] = useState(false);

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

    const [showFinder, setShowFinder] = useState(false);
    const [finderSearch, setFinderSearch] = useState("");
    const [draftBoatNumber, setDraftBoatNumber] = useState<string | null>(null);
    const [draftCompetitorId, setDraftCompetitorId] = useState<string | null>(null);
    const [highlightCompetitorId, setHighlightCompetitorId] = useState<string | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Competitor | null>(null);
    const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
    const [moveBoatEnabled, setMoveBoatEnabled] = useState(false);
    const [moveSearch, setMoveSearch] = useState("");
    const [moveTargetBoatNumber, setMoveTargetBoatNumber] = useState<string | null>(null);
    const [createNewBoatEnabled, setCreateNewBoatEnabled] = useState(false);
    const [newBoatName, setNewBoatName] = useState("");
    const [newBoatType, setNewBoatType] = useState<BoatType | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    const boatRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (!highlightCompetitorId) return;

        const timer = setTimeout(() => setHighlightCompetitorId(null), 2500);
        return () => clearTimeout(timer);
    }, [highlightCompetitorId]);

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
    async function registerBoat() {
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
        setHasUnsavedChanges(false);
    }

    const buildBoatLabel = (boatNumber: string, boatAnglers: Competitor[]) => {
        const boatName =
            boatAnglers[0]?.boat?.trim() || "Unnamed Boat";

        return boatNumber === "NO_BOAT"
            ? boatName
            : `${boatNumber} — ${boatName}`;
    };

    const seedBoatDraftState = (boatNumber: string, boatAnglers: Competitor[]) => {
        setBoatDraft({
            boat_number: boatNumber,
            name: boatAnglers[0]?.boat ?? "",
            type: boatAnglers[0]?.boat_type ?? null,
        });
    };

    const loadCaptainForBoat = async (boatNumber: string) => {
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
    };

    const scrollToBoat = (boatNumber: string) => {
        const el =
            boatRefs.current[boatNumber] ??
            document.getElementById(`boat-${boatNumber}`);

        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    const openBoatForEditing = async (
        boatNumber: string,
        boatAnglers: Competitor[]
    ) => {
        await loadCaptainForBoat(boatNumber);
        setOpenBoat(boatNumber);
        seedBoatDraftState(boatNumber, boatAnglers);
        setHasUnsavedChanges(false);

        setTimeout(() => scrollToBoat(boatNumber), 10);
    };

    const handleBoatToggle = async (
        boatNumber: string,
        boatAnglers: Competitor[],
        isOpen: boolean
    ) => {
        if (isOpen && hasUnsavedChanges) {
            if (!confirm("Discard unsaved changes?")) return;
        }

        if (isOpen) {
            setOpenBoat(null);
            return;
        }

        await openBoatForEditing(boatNumber, boatAnglers);
    };

    const resetFinderState = () => {
        setShowFinder(false);
        setFinderSearch("");
        setDraftBoatNumber(null);
        setDraftCompetitorId(null);
    };

    const matcher = (value: string | null | undefined, q: string) =>
        (value ?? "").toLowerCase().includes(q);

    const normalisedQuery = finderSearch.trim().toLowerCase();

    const boatMatches = useMemo(() => {
        return boats
            .map(([boatNumber, boatAnglers]) => {
                const label = buildBoatLabel(boatNumber, boatAnglers);
                const q = normalisedQuery;

                const boatNumberMatch =
                    boatNumber.toLowerCase().includes(q) ||
                    (boatNumber === "NO_BOAT" && q.includes("no boat"));

                const boatLabelMatch = matcher(label, q);

                const competitorMatch = boatAnglers.some(a =>
                    matcher(a.full_name, q) ||
                    matcher(a.angler_number, q)
                );

                const includeNoBoat =
                    boatNumber !== "NO_BOAT" ||
                    q === "" ||
                    q.includes("no boat");

                const matches =
                    (q === "" && includeNoBoat) ||
                    (includeNoBoat &&
                        (boatNumberMatch ||
                            boatLabelMatch ||
                            competitorMatch));

                return matches
                    ? { boatNumber, boatAnglers, label }
                    : null;
            })
            .filter(Boolean) as {
                boatNumber: string;
                boatAnglers: Competitor[];
                label: string;
            }[];
    }, [boats, normalisedQuery]);

    const anglerMatches = useMemo(() => {
        const q = normalisedQuery;

        const allAnglers = boats.flatMap(([boatNumber, boatAnglers]) => {
            const label = buildBoatLabel(boatNumber, boatAnglers);
            return boatAnglers.map(a => ({
                ...a,
                boatNumber,
                boatLabel: label,
            }));
        });

        const filteredByQuery = allAnglers.filter(a => {
            if (q === "") return true;

            return (
                matcher(a.full_name, q) ||
                matcher(a.angler_number, q) ||
                matcher(a.boatLabel, q) ||
                matcher(a.boatNumber, q)
            );
        });

        if (!draftBoatNumber) return filteredByQuery;

        return filteredByQuery.filter(a => a.boatNumber === draftBoatNumber);
    }, [boats, draftBoatNumber, normalisedQuery]);

    const handleFinderSelect = async () => {
        const targetBoatNumber =
            draftCompetitorId
                ? (() => {
                    for (const [boatNumber, boatAnglers] of boats) {
                        if (boatAnglers.some(a => String(a.id) === draftCompetitorId)) {
                            return boatNumber;
                        }
                    }
                    return null;
                })()
                : draftBoatNumber;

        if (!targetBoatNumber) return;

        const [, boatAnglers = []] =
            boats.find(([bn]) => bn === targetBoatNumber) ?? [];

        if (
            openBoat &&
            openBoat !== targetBoatNumber &&
            hasUnsavedChanges
        ) {
            if (!confirm("Discard unsaved changes?")) return;
        }

        await openBoatForEditing(targetBoatNumber, boatAnglers);

        if (draftCompetitorId) {
            setHighlightCompetitorId(draftCompetitorId);
        }

        resetFinderState();
    };

    const moveBoatMatches = useMemo(() => {
        const q = moveSearch.trim().toLowerCase();

        return boats
            .filter(([boatNumber]) => boatNumber !== "NO_BOAT")
            .map(([boatNumber, boatAnglers]) => {
                const label = buildBoatLabel(boatNumber, boatAnglers);
                const matches =
                    q === "" ||
                    boatNumber.toLowerCase().includes(q) ||
                    matcher(label, q);
                return matches
                    ? {
                        boatNumber,
                        label,
                        boatAnglers,
                    }
                    : null;
            })
            .filter(Boolean) as {
                boatNumber: string;
                label: string;
                boatAnglers: Competitor[];
            }[];
    }, [boats, moveSearch]);

    const startEditModal = (competitor: Competitor) => {
        setEditTarget(competitor);
        setEditDraft({
            full_name: competitor.full_name ?? "",
            category: competitor.category,
            membership_no: competitor.membership_no ?? "",
            registration_date:
                formatDateISOForInput(competitor.registration_date) || todayISO(),
            paid_on: competitor.paid_on,
            boat_number: competitor.boat_number,
            boat: competitor.boat,
            boat_type: competitor.boat_type,
        });
        setMoveBoatEnabled(false);
        setMoveSearch("");
        setMoveTargetBoatNumber(null);
        setCreateNewBoatEnabled(false);
        setNewBoatName("");
        setNewBoatType(null);
        setIsEditModalOpen(true);
    };

    const resetEditModal = () => {
        setIsEditModalOpen(false);
        setEditTarget(null);
        setEditDraft(null);
        setMoveBoatEnabled(false);
        setMoveTargetBoatNumber(null);
        setCreateNewBoatEnabled(false);
        setNewBoatName("");
        setNewBoatType(null);
        setSavingEdit(false);
    };

    const hasModalUnsavedChanges = (): boolean => {
        if (!editTarget || !editDraft) return false;

        const baseChanged =
            editDraft.full_name.trim() !== (editTarget.full_name ?? "").trim() ||
            editDraft.category !== editTarget.category ||
            (editDraft.membership_no ?? "") !== (editTarget.membership_no ?? "") ||
            formatDateISOForInput(editDraft.registration_date) !==
            formatDateISOForInput(editTarget.registration_date) ||
            (!!editDraft.paid_on) !== (!!editTarget.paid_on);

        const moveChanged =
            moveBoatEnabled ||
            createNewBoatEnabled;

        return baseChanged || moveChanged;
    };

    const generateNextBoatNumber = (allCompetitors: Competitor[]): string => {
        const maxSeq = Math.max(
            0,
            ...allCompetitors
                .map(c => c.boat_number)
                .filter((b): b is string => !!b && b !== "NO_BOAT")
                .map(b => {
                    const m = b.match(/^B(\d+)/);
                    return m ? Number(m[1]) : 0;
                })
        );

        return `B${String(maxSeq + 1).padStart(5, "0")}`;
    };

    const handleSaveEdit = async () => {
        if (!competitionId || !editTarget || !editDraft) return;

        if (moveBoatEnabled && createNewBoatEnabled && !newBoatName.trim()) {
            alert("Please provide a boat name for the new boat.");
            return;
        }

        if (moveBoatEnabled && !createNewBoatEnabled && !moveTargetBoatNumber) {
            alert("Select a boat to move the angler to, or choose Create new boat.");
            return;
        }

        setSavingEdit(true);

        try {
            const basePatch = normalizeCompetitorPatch({
                full_name: editDraft.full_name.trim(),
                category: editDraft.category,
                membership_no: editDraft.membership_no,
                registration_date: editDraft.registration_date,
                paid_on: editDraft.paid_on,
            });

            await updateCompetitor(editTarget.id, basePatch);

            let destinationBoatNumber = editDraft.boat_number ?? "NO_BOAT";
            let destinationBoatName = editDraft.boat ?? "";
            let destinationBoatType: BoatType | null | undefined = editDraft.boat_type;

            if (moveBoatEnabled) {
                if (createNewBoatEnabled) {
                    destinationBoatNumber = generateNextBoatNumber(rows);
                    destinationBoatName = newBoatName.trim();
                    destinationBoatType = newBoatType ?? null;
                } else if (moveTargetBoatNumber) {
                    const targetEntry = boats.find(
                        ([boatNumber]) => boatNumber === moveTargetBoatNumber
                    );
                    destinationBoatNumber = moveTargetBoatNumber;
                    destinationBoatName =
                        targetEntry?.[1]?.[0]?.boat ?? destinationBoatName;
                    destinationBoatType =
                        targetEntry?.[1]?.[0]?.boat_type ?? destinationBoatType;
                }

                if (destinationBoatNumber) {
                    await moveCompetitorToBoat(editTarget.id, {
                        boat_number: destinationBoatNumber,
                        boat: destinationBoatName,
                        boat_type: destinationBoatType ?? null,
                    });
                }
            }

            const updatedRows = await listCompetitorsForCompetition(competitionId);
            setRows(updatedRows);

            // keep boat expanded + highlight
            const targetBoatNumber =
                moveBoatEnabled && destinationBoatNumber
                    ? destinationBoatNumber
                    : editTarget.boat_number ?? "NO_BOAT";

            const targetBoatAnglers =
                updatedRows.filter(r => r.boat_number === targetBoatNumber);

            if (targetBoatNumber) {
                await openBoatForEditing(targetBoatNumber, targetBoatAnglers);
            }

            setHighlightCompetitorId(String(editTarget.id));
            resetEditModal();
        } finally {
            setSavingEdit(false);
        }
    };

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
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 16,
                    marginBottom: 8,
                }}
            >
                <h3 style={{ margin: 0 }}>Boat List</h3>
                <button
                    className="btn secondary"
                    onClick={() => {
                        setShowFinder(true);
                        setFinderSearch("");
                        setDraftBoatNumber(null);
                        setDraftCompetitorId(null);
                    }}
                >
                    Find Boat / Angler
                </button>
            </div>

            {boats.map(([boatNumber, boatAnglers]) => {
                const isOpen = openBoat === boatNumber;

                const boatName =
                    boatAnglers[0]?.boat?.trim() || "Unnamed Boat";

                const boatLabel =
                    boatNumber === "NO_BOAT"
                        ? boatName
                        : `${boatNumber} — ${boatName}`;

                const refSetter = (el: HTMLDivElement | null) => {
                    boatRefs.current[boatNumber] = el;
                };

                return (
                    <section
                        key={boatNumber}
                        id={`boat-${boatNumber}`}
                        ref={refSetter}
                        className="card"
                        style={{ marginTop: 12 }}
                    >
                        {/* -------- Boat header -------- */}
                        <div
                            style={{ marginTop: 8, cursor: "pointer" }}
                            onClick={() =>
                                handleBoatToggle(boatNumber, boatAnglers, isOpen)
                            }
                        >
                            {isOpen ? "▾" : "▸"} {boatLabel} ({boatAnglers.length})
                        </div>

                        {isOpen && boatDraft && (
                            <>
                                {/* ================= BOAT EDIT ================= */}
                                <div className="boat-edit-row">
                                    <input
                                        value={boatDraft.name}
                                        style={{ flex: 1 }}
                                        onChange={(e) => {
                                            setBoatDraft({ ...boatDraft, name: e.target.value });
                                            setHasUnsavedChanges(true);
                                        }}
                                    />

                                    <select
                                        className="select--compact"
                                        value={boatDraft.type ?? ""}
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
                                            setHasUnsavedChanges(true);

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
                                            setHasUnsavedChanges(true);

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
                                                style={{ width: "100%" }}
                                                value={teamCaptain?.competitor_id ?? ""}
                                                onChange={async (e) => {
                                                    const id = e.target.value || null;

                                                    if (!id) {
                                                        await clearTeamCaptainForBoat(
                                                            competitionId!,
                                                            boatNumber
                                                        );
                                                        setTeamCaptain(null);
                                                        setHasUnsavedChanges(true);
                                                        return;
                                                    }

                                                    const updated = await setTeamCaptainForBoat({
                                                        competitionId: competitionId!,
                                                        boatNumber,
                                                        competitor_id: id,
                                                    });

                                                    setTeamCaptain(updated);
                                                    setHasUnsavedChanges(true);
                                                }}
                                            >
                                                <option value="">— Select angler —</option>
                                                {boatAnglers.map((a) => (
                                                    <option key={a.id} value={String(a.id)}>
                                                        {a.full_name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}

                                        {editCaptainMode === "external" && (
                                            <input
                                                style={{ width: "100%" }}
                                                placeholder="Skipper name"
                                                value={externalCaptainName}
                                                onChange={(e) => {
                                                    setExternalCaptainName(e.target.value);
                                                    setHasUnsavedChanges(true);
                                                }}
                                                onBlur={async () => {
                                                    if (!externalCaptainName.trim()) return;

                                                    const updated = await setTeamCaptainForBoat({
                                                        competitionId: competitionId!,
                                                        boatNumber,
                                                        display_name: externalCaptainName.trim(),
                                                    });

                                                    setTeamCaptain(updated);
                                                    setHasUnsavedChanges(true);
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
                                            <th style={{ width: 90 }} className="th-center">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {boatAnglers.map((r) => {
                                            const isCaptain =
                                                teamCaptain?.competitor_id === String(r.id);

                                            const reg = formatDateISOForInput(r.registration_date);
                                            const cutoff = formatDateISOForInput(settings?.earlybird_cutoff_date);

                                            const isEarly = !!cutoff && !!reg && reg <= cutoff;

                                            const amount =
                                                settings?.fees &&
                                                computeFee(
                                                    settings,
                                                    r.category === "adult" ? "Adult" : "Junior",
                                                    r.registration_date!
                                                );

                                            const isHighlighted =
                                                String(r.id) === highlightCompetitorId;

                                            const rowStyle: React.CSSProperties = {};

                                            if (isCaptain) {
                                                Object.assign(rowStyle, {
                                                    background: "#f0f9ff",
                                                    borderLeft: "4px solid #0284c7",
                                                });
                                            }

                                            if (isHighlighted) {
                                                Object.assign(rowStyle, {
                                                    background: rowStyle.background ?? "#fffbeb",
                                                    boxShadow: "inset 0 0 0 2px #f59e0b",
                                                });
                                            }

                                            return (
                                                <tr
                                                    key={String(r.id)}
                                                    style={rowStyle}
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
                                                    <td>{r.full_name}</td>

                                                    <td>
                                                        {r.category === "adult" ? "Adult" : "Junior"}
                                                    </td>

                                                    <td className="cell-center">
                                                        <span
                                                            className={`pill ${isEarly ? "pill--green" : "pill--muted"
                                                                }`}
                                                        >
                                                            {isEarly ? "Early" : "Standard"}
                                                        </span>
                                                    </td>

                                                    <td>{r.membership_no || "—"}</td>

                                                    <td>{formatDateNZForDisplay(r.registration_date) || "—"}</td>


                                                    <td>{amount != null ? `$${amount}` : ""}</td>

                                                    <td className="cell-center">
                                                        <span
                                                            className={`pill ${r.paid_on ? "pill--green" : "pill--muted"
                                                                }`}
                                                        >
                                                            {r.paid_on ? "Paid" : "Unpaid"}
                                                        </span>
                                                    </td>

                                                    <td className="cell-center">
                                                        <button
                                                            className="btn btn--sm-primary"
                                                            onClick={() => startEditModal(r)}
                                                        >
                                                            Edit
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
                                        disabled={!hasUnsavedChanges}
                                        onClick={async () => {
                                            await saveBoatEdit();
                                        }}
                                    >
                                        Save changes
                                    </button>

                                    <button
                                        className="btn secondary"
                                        onClick={() => {
                                            setOpenBoat(null);
                                            setHasUnsavedChanges(false);
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

            {/* ================= FINDER MODAL ================= */}
            {showFinder && (
                <div className="modal-backdrop">
                    <div className="modal-shell">
                        <h3>Find Boat / Angler</h3>

                        <input
                            type="text"
                            placeholder="Search angler or boat…"
                            value={finderSearch}
                            onChange={e => setFinderSearch(e.target.value)}
                            autoFocus
                        />

                        <div className="modal-lists">
                            <div className="modal-list">
                                <strong>Boats</strong>
                                {boatMatches.length === 0 && (
                                    <div className="modal-row">No matches</div>
                                )}
                                {boatMatches.map(({ boatNumber, boatAnglers, label }) => (
                                    <div
                                        key={boatNumber}
                                        className={`modal-row ${draftBoatNumber === boatNumber ? "active" : ""}`}
                                        onClick={() => {
                                            if (draftBoatNumber === boatNumber) {
                                                setDraftBoatNumber(null);
                                                setDraftCompetitorId(null);
                                            } else {
                                                setDraftBoatNumber(boatNumber);
                                                setDraftCompetitorId(null);
                                            }
                                        }}
                                    >
                                        🚤 {label}
                                    </div>
                                ))}
                            </div>

                            <div className="modal-list">
                                <strong>Anglers</strong>
                                {anglerMatches.length === 0 && (
                                    <div className="modal-row">No matches</div>
                                )}
                                {anglerMatches.map(a => (
                                    <div
                                        key={a.id}
                                        className={`modal-row ${draftCompetitorId === String(a.id) ? "active" : ""}`}
                                        onClick={() => {
                                            setDraftCompetitorId(String(a.id));
                                            setDraftBoatNumber(a.boatNumber);
                                        }}
                                    >
                                        👤 {(a.angler_number ?? "—")} · {a.full_name} · {a.boatLabel}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn" onClick={resetFinderState}>
                                Cancel
                            </button>
                            <button
                                className="btn primary"
                                disabled={
                                    !draftBoatNumber && !draftCompetitorId
                                }
                                onClick={handleFinderSelect}
                            >
                                Select
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= EDIT COMPETITOR MODAL ================= */}
            {isEditModalOpen && editDraft && editTarget && (
                <div className="modal-backdrop">
                    <div className="modal-shell">
                        <h3>Edit Angler</h3>

                        <div className="form-grid">
                            <div className="field span-6">
                                <label>Full Name</label>
                                <input
                                    value={editDraft.full_name}
                                    onChange={(e) =>
                                        setEditDraft({
                                            ...editDraft,
                                            full_name: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div className="field span-6">
                                <label>Category</label>
                                <select
                                    value={editDraft.category}
                                    onChange={(e) =>
                                        setEditDraft({
                                            ...editDraft,
                                            category: e.target.value as DomainCategory,
                                        })
                                    }
                                >
                                    <option value="adult">Adult</option>
                                    <option value="junior">Junior</option>
                                </select>
                            </div>

                            <div className="field span-6">
                                <label>Member Number</label>
                                <input
                                    value={editDraft.membership_no}
                                    onChange={(e) =>
                                        setEditDraft({
                                            ...editDraft,
                                            membership_no: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div className="field span-6">
                                <label>Registered Date</label>
                                <input
                                    type="date"
                                    value={editDraft.registration_date}
                                    onChange={(e) =>
                                        setEditDraft({
                                            ...editDraft,
                                            registration_date: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginTop: 8,
                            }}
                        >
                            <strong className="muted" style={{ fontSize: 12 }}>
                                Payment
                            </strong>
                            <button
                                type="button"
                                className={`pill pill--clickable ${editDraft.paid_on ? "pill--green" : "pill--muted"}`}
                                onClick={() =>
                                    setEditDraft({
                                        ...editDraft,
                                        paid_on: editDraft.paid_on ? null : todayISO(),
                                    })
                                }
                            >
                                {editDraft.paid_on ? "Paid" : "Mark as Paid"}
                            </button>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginTop: 12,
                            }}
                        >
                            <strong className="muted" style={{ fontSize: 12 }}>
                                Boat
                            </strong>
                            <button
                                type="button"
                                className={`pill pill--clickable ${moveBoatEnabled ? "pill--green" : "pill--muted"}`}
                                onClick={() => {
                                    const next = !moveBoatEnabled;
                                    setMoveBoatEnabled(next);
                                    if (!next) {
                                        setMoveTargetBoatNumber(null);
                                        setCreateNewBoatEnabled(false);
                                        setNewBoatName("");
                                        setNewBoatType(null);
                                    }
                                }}
                            >
                                {moveBoatEnabled ? "Move to another boat" : "Select if moving the angler to another boat"}
                            </button>
                        </div>

                        {moveBoatEnabled && (
                            <>
                                <div className="field" style={{ marginTop: 8 }}>
                                    <label>Find boat</label>
                                    <input
                                        placeholder="Search boat number or name…"
                                        value={moveSearch}
                                        onChange={(e) => setMoveSearch(e.target.value)}
                                    />
                                </div>

                                <div className="modal-lists" style={{ marginTop: 8 }}>
                                    <div className="modal-list">
                                        {moveBoatMatches.length === 0 && (
                                            <div className="modal-row">No matches</div>
                                        )}

                                        {moveBoatMatches.map(({ boatNumber, label }) => (
                                            <div
                                                key={boatNumber}
                                                className={`modal-row ${moveTargetBoatNumber === boatNumber ? "active" : ""}`}
                                                onClick={() => {
                                                    setMoveTargetBoatNumber(
                                                        moveTargetBoatNumber === boatNumber ? null : boatNumber
                                                    );
                                                    setCreateNewBoatEnabled(false);
                                                }}
                                            >
                                                🚤 {label}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginTop: 12,
                                    }}
                                >
                                    <strong className="muted" style={{ fontSize: 12 }}>
                                        Create new boat
                                    </strong>
                                    <button
                                        type="button"
                                        className={`pill pill--clickable ${createNewBoatEnabled ? "pill--green" : "pill--muted"}`}
                                        onClick={() => {
                                            const next = !createNewBoatEnabled;
                                            setCreateNewBoatEnabled(next);
                                            if (next) {
                                                setMoveTargetBoatNumber(null);
                                            } else {
                                                setNewBoatName("");
                                                setNewBoatType(null);
                                            }
                                        }}
                                    >
                                        {createNewBoatEnabled ? "Creating new boat" : "Select if creating a new boat"}
                                    </button>
                                </div>

                                {createNewBoatEnabled && (
                                    <div className="form-grid" style={{ marginTop: 8 }}>
                                        <div className="field span-6">
                                            <label>New boat name</label>
                                            <input
                                                value={newBoatName}
                                                onChange={(e) => setNewBoatName(e.target.value)}
                                            />
                                        </div>
                                        <div className="field span-6">
                                            <label>Boat type (optional)</label>
                                            <select
                                                value={newBoatType ?? ""}
                                                onChange={(e) =>
                                                    setNewBoatType(
                                                        e.target.value
                                                            ? (e.target.value as BoatType)
                                                            : null
                                                    )
                                                }
                                            >
                                                <option value="">— Select type —</option>
                                                <option value="Trailer">Trailer</option>
                                                <option value="Launch">Launch</option>
                                                <option value="Charter">Charter</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="modal-actions">
                            <button
                                className="btn secondary"
                                onClick={() => {
                                    if (hasModalUnsavedChanges()) {
                                        if (!confirm("Discard changes?")) return;
                                    }
                                    resetEditModal();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn primary"
                                disabled={savingEdit}
                                onClick={handleSaveEdit}
                            >
                                {savingEdit ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}