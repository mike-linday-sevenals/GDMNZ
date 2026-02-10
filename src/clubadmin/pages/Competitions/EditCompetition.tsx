// ============================================================================
// File: EditCompetition.tsx
// Path: src/clubadmin/pages/Competitions/EditCompetition.tsx
// Description:
// Edit an existing competition.
// IMPORTANT:
//  - Competition is created as a *shell*
//  - Child records are guaranteed by the API
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
    Link,
    Outlet,
    useMatch,
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    listCompetitionPoints,
    saveCompetitionPoints,
} from "@/clubadmin/api/competitionPoints";

import { QRCodeSVG } from "qrcode.react";

import { listPublicOrganisations } from "@/services/api";

// ============================================================================
// Club-admin scoped APIs — competitions (PERSISTENCE / JOIN TABLES)
// ============================================================================

import {
    addCompetitionDay,
    canDeleteCompetition,
    competitionHasResults,
    deleteCompetition,
    deleteCompetitionDay,
    getCompetition,
    getCompetitionBriefing,
    listCompetitionDays,
    listCompetitionSpecies, // ✅ ID-ONLY (species_id)
    listCompetitionTypes,
    listCompModes,
    listPrizeModes,
    saveCompetitionSpecies, // ✅ ID-ONLY persistence
    updateCompetition,
    updateCompetitionDay,
    upsertCompetitionBriefing,
} from "@/clubadmin/api/competitions";

// ============================================================================
// Club-admin scoped APIs — species (DISPLAY / LOOKUPS ONLY)
// ============================================================================

import {
    listFishTypesForCompetitionType,
    listSpeciesByFishTypes,
} from "@/clubadmin/api/species";

import CompetitionPrizes from "@/clubadmin/pages/CompetitionPrizes/CompetitionPrizes";

import CompetitionFeesCard from   "@/clubadmin/pages/Competitions/components/CompetitionFeesCard";

import type { CompetitionPointsRuleDTO } from "@/clubadmin/api/competitionPoints";

type PointsFormula =
    | { mode: "none" }
    | { mode: "flat"; value: number }
    | {
        mode: "weight";
        multiplier: number;
        divide_by_line_weight: boolean;
    };

type TagReleaseRule = {
    species_group_ids: string[]; // eg: ["marlin"]
    points: number;
};

type LandedGroupRule = {
    species_category_id: string; // eg: "tuna"
    formula: {
        multiplier: number;
        divide_by_line_weight: boolean;
    };
};

type OrganisationSummary = {
    organisation_id: string;
    organisation_name: string;
};

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

type EditSection = "details" | "fees" | "briefing" | "days" | "species" | "prizes";
type Division = {
    id: string;
    code: string;
    name: string;
    sort_order: number;
};

type SpeciesPointsRule = {
    tag_release_points: number;
    landed_multiplier: number;
    landed_divide_by_line_weight: boolean;
};


import {
    listCompetitionDivisions,
    saveCompetitionDivisions,
    listDivisions,
} from "@/clubadmin/api/divisions";

import FeedbackModal from "@/components/FeedbackModal";

function formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function handlePrintLateRegistration() {
    window.print();
}
export default function EditCompetition() {
    const navigate = useNavigate();

    // =============================
    // Species Points Configuration
    // =============================

    const [tagReleaseRules, setTagReleaseRules] = useState<TagReleaseRule[]>([
        {
            species_group_ids: [],
            points: 450,
        },
    ]);

    const [gameFishRules, setGameFishRules] = useState<LandedGroupRule[]>([]);


    const [activeSection, setActiveSection] =
        useState<EditSection>("details");

    const { organisationId, id } = useParams<{
        organisationId: string;
        id: string;
    }>();

    const [clubName, setClubName] = useState<string | null>(null);


    const [competition, setCompetition] = useState<Competition | null>(null);
    const [days, setDays] = useState<CompetitionDay[]>([]);

    const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
    const [compModes, setCompModes] = useState<CompMode[]>([]);
    const [prizeModes, setPrizeModes] = useState<PrizeMode[]>([]);

    const [competitionDivisions, setCompetitionDivisions] =
        useState<Division[]>([]);
    const [savedDivisionIds, setSavedDivisionIds] = useState<string[]>([]);


    const [allSpecies, setAllSpecies] = useState<Species[]>([]);
    const [selectedSpeciesIds, setSelectedSpeciesIds] = useState<number[]>([]);
    const [allowedFishTypeIds, setAllowedFishTypeIds] = useState<string[]>([]);
    const [activeFishTypeId, setActiveFishTypeId] = useState<string | null>(null);
    const [speciesDirty, setSpeciesDirty] = useState(false);
    const [savedSpeciesIds, setSavedSpeciesIds] = useState<number[]>([]);

    const [hasResults, setHasResults] = useState(false);
    const inPrizeGiving = !!useMatch(
        "/clubadmin/:organisationId/admin/competitions/:id/edit/prize-giving"
    );



    const [briefing, setBriefing] = useState<CompetitionBriefing>({
        briefing_date: null,
        briefing_time: null,
        location: null,
        notes: null,
    });


    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);


    // Modal state
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const [showDivisionModal, setShowDivisionModal] = useState(false);
    const [showSpeciesPoints, setShowSpeciesPoints] = useState(false);
    const [isQrOpen, setIsQrOpen] = useState(false);
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");


    // All divisions available in the system (NOT competition-specific)
    const [allDivisions, setAllDivisions] = useState<Division[]>([]);

    // Working selection inside modal
    const [selectedDivisionIds, setSelectedDivisionIds] = useState<string[]>([]);

    // Can this competition be deleted (no registrations)?
    const [canDelete, setCanDelete] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Save Dirty Data 
    const [divisionsDirty, setDivisionsDirty] = useState(false);
    const [speciesPoints, setSpeciesPoints] =
        useState<Record<number, SpeciesPointsRule>>({});
    const [pointsDirty, setPointsDirty] = useState(false);
    const [pointsLoaded, setPointsLoaded] = useState(false);

    // ================================================================
    // DERIVED DIRTY STATE (MUST BE ABOVE EFFECTS THAT USE IT)
    // ================================================================

    const pageDirty = speciesDirty || divisionsDirty || pointsDirty;


    // ================================================================
    // WARN BEFORE UNLOAD IF UNSAVED CHANGES
    // ================================================================

    useEffect(() => {
        if (!pageDirty) return;

        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };

        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [pageDirty]);


    // =========================================================================
    // LOAD
    // =========================================================================

    useEffect(() => {
        if (!organisationId || !id) return;

        let cancelled = false;

        (async () => {
            setLoading(true);
            setPointsLoaded(false);
            setSpeciesPoints({});
            setPointsDirty(false);
            try {
                // -------------------------------------------------------------
                // 1️⃣ Load core competition
                // -------------------------------------------------------------
                const comp = await getCompetition(organisationId, id);
                if (cancelled) return;
                setCompetition(comp);

                // -------------------------------------------------------------
                // 1️⃣c️⃣ Club / Organisation name (for QR modal / print)
                // -------------------------------------------------------------
                try {
                    const orgs = (await listPublicOrganisations()) as OrganisationSummary[];

                    const match =
                        orgs?.find((o) => o.organisation_id === organisationId) ??
                        null;

                    if (!cancelled) {
                        setClubName(match?.organisation_name ?? null);
                    }
                } catch (e) {
                    // Non-fatal: QR still works without a club name
                    if (!cancelled) setClubName(null);
                }


                // -------------------------------------------------------------
                // 1️⃣b️⃣ Has results?
                // -------------------------------------------------------------
                const has = await competitionHasResults(id);
                if (!cancelled) {
                    setHasResults(has);
                }

                // -------------------------------------------------------------
                // 2️⃣ Can delete?
                // -------------------------------------------------------------
                const deletable = await canDeleteCompetition(id);
                if (!cancelled) {
                    setCanDelete(deletable);
                }

                // -------------------------------------------------------------
                // 3️⃣ Load lookups in parallel
                // -------------------------------------------------------------
                const [types, modes, prizes] = await Promise.all([
                    listCompetitionTypes(),
                    listCompModes(),
                    listPrizeModes(),
                ]);

                if (!cancelled) {
                    setCompetitionTypes(types);
                    setCompModes(modes);
                    setPrizeModes(prizes);
                }

                // -------------------------------------------------------------
                // 4️⃣ Divisions
                // -------------------------------------------------------------
                const divisions = await listCompetitionDivisions(id);
                if (!cancelled) {
                    setCompetitionDivisions(divisions);

                    const savedIds = divisions.map(d => d.id);
                    setSelectedDivisionIds(savedIds);
                    setSavedDivisionIds(savedIds);
                    setDivisionsDirty(false);
                }

                // -------------------------------------------------------------
                // 5️⃣ Briefing (ONLY if required)
                // -------------------------------------------------------------
                if (comp.briefing_required) {
                    const b = await getCompetitionBriefing(organisationId, id);
                    if (!cancelled && b) {
                        setBriefing({
                            briefing_date: b.briefing_date ?? null,
                            briefing_time: b.briefing_time ?? null,
                            location: b.location ?? null,
                            notes: b.notes ?? null,
                        });
                    }
                }

                // -------------------------------------------------------------
                // 6️⃣ All divisions (system-wide)
                // -------------------------------------------------------------
                const all = await listDivisions();
                if (!cancelled) {
                    setAllDivisions(all);
                }

                // -------------------------------------------------------------
                // 7️⃣ Competition days
                // -------------------------------------------------------------
                const compDays = await listCompetitionDays(organisationId, id);
                if (!cancelled) {
                    setDays(compDays);
                }

                // -------------------------------------------------------------
                // 8️⃣ SPECIES: discipline + species loading
                // -------------------------------------------------------------
                if (comp.competition_type_id) {
                    // Resolve allowed fish types
                    const fishTypes =
                        await listFishTypesForCompetitionType(
                            comp.competition_type_id
                        );

                    const fishTypeIds = Array.isArray(fishTypes)
                        ? fishTypes.map(ft => ft.fish_type_id)
                        : [];

                    if (!cancelled) {
                        setAllowedFishTypeIds(fishTypeIds);
                        setActiveFishTypeId(fishTypeIds[0] ?? null);
                    }

                    // Load species scoped to fish types
                    const loadedSpecies =
                        fishTypeIds.length > 0
                            ? await listSpeciesByFishTypes(fishTypeIds)
                            : [];

                    if (!cancelled) {
                        const normalised: Species[] = (loadedSpecies as any[]).map((s) => {
                            const catId: string = s.species_category_id ?? "other";
                            const cat = s.species_category ?? { species_category_id: catId, name: "Other" };

                            return {
                                ...s,
                                species_category_id: catId,
                                species_category: {
                                    species_category_id: cat.species_category_id ?? catId,
                                    name: cat.name ?? "Other",
                                },
                            } as Species;
                        });

                        setAllSpecies(normalised);
                    }
                } else {
                    if (!cancelled) {
                        setAllowedFishTypeIds([]);
                        setActiveFishTypeId(null);
                        setAllSpecies([]);
                    }
                }
                // -------------------------------------------------------------
                // 9️⃣b️⃣ Competition points (AFTER species loaded)
                // -------------------------------------------------------------


                // -------------------------------------------------------------
                // 9️⃣ Persisted competition species
                // -------------------------------------------------------------


                const compSpecies = await listCompetitionSpecies(id);
                const speciesIds = Array.isArray(compSpecies)
                    ? compSpecies.map(s => s.species_id)
                    : [];

                // compSpecies is CompetitionSpecies[]

                if (!cancelled) {
                    setSelectedSpeciesIds(speciesIds);
                    setSavedSpeciesIds(speciesIds);
                    setSpeciesDirty(false);
                }

            } catch (err) {
                console.error(err);
                alert("Unable to load competition");
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [organisationId, id]);


    // =========================================================================
    // HELPERS
    // =========================================================================



    type SpeciesGroup = {
        categoryName: string;
        species: Species[];
    };


    const visibleSpecies = activeFishTypeId
        ? allSpecies.filter(s => s.fish_type_id === activeFishTypeId)
        : allSpecies;

    /**
     * Group visible species by species_category
     */
    const speciesByCategory = visibleSpecies.reduce<
        Record<
            string,
            {
                id: string;
                name: string;
                species: Species[];
            }
        >
    >((acc, s) => {
        const catId = s.species_category_id;

        if (!acc[catId]) {
            acc[catId] = {
                id: catId,
                name: s.species_category.name,
                species: [],
            };
        }

        acc[catId].species.push(s);
        return acc;
    }, {});

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
        setSelectedSpeciesIds(prev => {
            const isSelected = prev.includes(speciesId);
            const next = isSelected
                ? prev.filter(id => id !== speciesId)
                : [...prev, speciesId];

            const isDirty =
                next.length !== savedSpeciesIds.length ||
                next.some(id => !savedSpeciesIds.includes(id));

            setSpeciesDirty(isDirty);

            if (isSelected) {
                setSpeciesPoints(current => {
                    if (!current[speciesId]) return current;
                    const { [speciesId]: _, ...rest } = current;
                    return rest;
                });
            }

            setPointsDirty(true);
            return next;
        });
    }


    const groupedSpecies = useMemo<SpeciesGroup[]>(() => {
        const map = new Map<string, SpeciesGroup>();

        for (const s of visibleSpecies) {
            const catId = s.species_category_id;
            const catName = s.species_category?.name ?? "Other";

            if (!map.has(catId)) {
                map.set(catId, {
                    categoryName: catName,
                    species: [],
                });
            }

            map.get(catId)!.species.push(s);
        }

        return Array.from(map.values()).sort((a, b) =>
            a.categoryName.localeCompare(b.categoryName)
        );
    }, [visibleSpecies]);


    // =========================================================================
    // SAVE
    // =========================================================================
    async function saveChanges() {
        if (!organisationId || !id || !competition) return;

        setSaving(true);
        try {
            // --------------------------------------------------
            // 1️⃣ SAFE DETAILS — ALWAYS ALLOWED
            // --------------------------------------------------
            await updateCompetition(organisationId, id, {
                name: competition.name,
                starts_at: competition.starts_at,
                ends_at: competition.ends_at,
                competition_type_id: competition.competition_type_id ?? null,
                briefing_required: competition.briefing_required,

                // REQUIRED by DB (must never be null)
                comp_mode_id: competition.comp_mode_id,
                prize_mode_id: competition.prize_mode_id,
            });


            // --------------------------------------------------
            // 2️⃣ STRUCTURE — ONLY IF NO RESULTS
            // --------------------------------------------------
            if (!hasResults) {
                await saveCompetitionDivisions(id, selectedDivisionIds);
                setSavedDivisionIds(selectedDivisionIds);

                const updatedDivisions = await listCompetitionDivisions(id);
                setCompetitionDivisions(updatedDivisions);
            }


            // --------------------------------------------------
            // 3️⃣ BRIEFING (ONLY IF REQUIRED)
            // --------------------------------------------------
            if (competition.briefing_required) {
                await upsertCompetitionBriefing(organisationId, id, briefing);
            }

            // --------------------------------------------------
            // 4️⃣ FISHING DAYS
            // --------------------------------------------------
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

            // --------------------------------------------------
            // 5️⃣ SPECIES
            // --------------------------------------------------
            await saveCompetitionSpecies(
                organisationId,
                id,
                selectedSpeciesIds
            );
            // --------------------------------------------------
            // 6️⃣ SPECIES POINTS (ONLY IF DIRTY)
            // --------------------------------------------------
            if (pointsDirty) {
                const rules: CompetitionPointsRuleDTO[] = [];

                for (const s of selectedSpecies) {
                    const rule = speciesPoints[s.id] ?? defaultSpeciesPoints;

                    const discipline: "game" | "sport" =
                        s.fish_type_id === allowedFishTypeIds[1] ? "sport" : "game";

                    rules.push({
                        fishing_discipline: discipline,
                        outcome: "tagged_released",

                        // ✅ per-species selector
                        species_id: s.id,
                        // ✅ explicitly clear other selectors
                        species_category_id: null,
                        species_group_code: null,

                        points_mode: "flat",
                        points_value: rule.tag_release_points ?? 0,
                        divide_by_line_weight: false,
                        priority: 10,
                    });

                    rules.push({
                        fishing_discipline: discipline,
                        outcome: "landed",

                        // ✅ per-species selector
                        species_id: s.id,
                        // ✅ explicitly clear other selectors
                        species_category_id: null,
                        species_group_code: null,

                        points_mode: "weight",
                        points_value: rule.landed_multiplier ?? 1,
                        divide_by_line_weight: rule.landed_divide_by_line_weight ?? false,
                        priority: 20,
                    });
                }

                await saveCompetitionPoints(id, { rules });
                setPointsDirty(false);
            }
            // --------------------------------------------------
            // 6️⃣ CLEAR DIRTY STATE (AUTHORITIVE RESET)
            // --------------------------------------------------
            setSavedSpeciesIds(selectedSpeciesIds);
            setSpeciesDirty(false);
            setDivisionsDirty(false);

            setFeedbackMessage("Competition updated successfully.");
        } catch (err) {
            console.error(err);
            alert("Save failed");
        } finally {
            setSaving(false);
        }
    }

    // =========================================================================
    // Delete 
    // =========================================================================

    async function handleDelete() {
        if (!organisationId || !id) return;

        try {
            await deleteCompetition(id);

            // ✅ Navigate back to list AND force refresh
            navigate(
                `/clubadmin/${organisationId}/admin/competitions`,
                { replace: true }
            );

            // 🔄 Force reload so list reflects deletion immediately
            navigate(0);
        } catch (err) {
            console.error(err);
            alert("Unable to delete competition");
        }
    }

    // =========================================================================
    // DAY HELPERS
    // =========================================================================

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
    // DERIVED BRIEFING DATE LIMITS
    // =========================================================================

    const startsAtDate = competition?.starts_at
        ? new Date(`${competition.starts_at}T00:00:00`)
        : null;

    const briefingMaxDate = startsAtDate
        ? formatDateInput(startsAtDate)
        : undefined;

    const briefingMinDate = startsAtDate
        ? formatDateInput(
            new Date(startsAtDate.getTime() - 24 * 60 * 60 * 1000)
        )
        : undefined;

    const clampBriefingDate = (value: string | null) => {
        if (!value) return null;

        if (briefingMinDate && value < briefingMinDate) {
            return briefingMinDate;
        }

        if (briefingMaxDate && value > briefingMaxDate) {
            return briefingMaxDate;
        }

        return value;
    };

    useEffect(() => {
        setBriefing((b) => {
            const clamped = clampBriefingDate(b.briefing_date);
            return clamped === b.briefing_date ? b : { ...b, briefing_date: clamped };
        });
    }, [briefingMinDate, briefingMaxDate]);


    // Sync competition start date to the first fishing day (Day 1)
    useEffect(() => {
        if (!days.length) {
            return;
        }

        const firstDayDate = days[0]?.day_date;
        if (!firstDayDate) {
            return;
        }

        setCompetition((current) => {
            if (!current || current.starts_at === firstDayDate) {
                return current;
            }

            return { ...current, starts_at: firstDayDate };
        });
    }, [days]);


    // =========================================================================
    // RENDER
    // =========================================================================
    // derive registration URL safely (works even while competition is null during load)
    const registrationUrl: string | null = competition?.public_results_slug
        ? `${window.location.origin}/c/${competition.public_results_slug}/register`
        : null;

    function closeQrModal() {
        setIsQrOpen(false);
        setCopyStatus("idle");
    }

    async function handleCopyRegistrationUrl() {
        if (!registrationUrl) return;

        try {
            await navigator.clipboard.writeText(registrationUrl);
            setCopyStatus("copied");
            window.setTimeout(() => setCopyStatus("idle"), 1500);
        } catch {
            setCopyStatus("error");
        }
    }

    // ESC closes QR modal (MUST be above early return so hook order never changes)
    useEffect(() => {
        if (!isQrOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeQrModal();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isQrOpen]);

    const selectedSpecies = useMemo(() => {
        const selected = new Set(selectedSpeciesIds);
        return allSpecies.filter(s => selected.has(s.id));
    }, [allSpecies, selectedSpeciesIds]);

    const selectedSpeciesSorted = useMemo(
        () => selectedSpecies.slice().sort((a, b) => a.name.localeCompare(b.name)),
        [selectedSpecies]
    );

    const defaultSpeciesPoints: SpeciesPointsRule = {
        tag_release_points: 0,
        landed_multiplier: 1,
        landed_divide_by_line_weight: false,
    };

    function updateSpeciesPointsRule(
        speciesId: number,
        patch: Partial<SpeciesPointsRule>
    ) {
        setSpeciesPoints(prev => {
            const current = prev[speciesId] ?? defaultSpeciesPoints;
            return {
                ...prev,
                [speciesId]: { ...current, ...patch },
            };
        });
        setPointsDirty(true);
    }

    // Effects
    useEffect(() => {
        if (!id || pointsLoaded) return;

        if (!selectedSpeciesIds.length) {
            setSpeciesPoints({});
            setPointsDirty(false);
            setPointsLoaded(true);
            return;
        }

        if (!allSpecies.length) return;

        let cancelled = false;

        (async () => {
            const existing = await listCompetitionPoints(id);
            if (cancelled) return;

            const selected = new Set(selectedSpeciesIds);
            const next: Record<number, SpeciesPointsRule> = {};

            for (const s of allSpecies) {
                if (!selected.has(s.id)) continue;
                next[s.id] = { ...defaultSpeciesPoints };
            }

            for (const rule of existing) {
                if (!rule.species_id || !selected.has(rule.species_id)) continue;

                const current = next[rule.species_id] ?? { ...defaultSpeciesPoints };

                if (rule.outcome === "tagged_released" && rule.points_mode === "flat") {
                    current.tag_release_points = rule.points_value;
                }

                if (rule.outcome === "landed" && rule.points_mode === "weight") {
                    current.landed_multiplier = rule.points_value;
                    current.landed_divide_by_line_weight = rule.divide_by_line_weight;
                }

                next[rule.species_id] = current;
            }

            setSpeciesPoints(next);
            setPointsDirty(false);
            setPointsLoaded(true);
        })();

        return () => {
            cancelled = true;
        };
    }, [id, allSpecies, selectedSpeciesIds, pointsLoaded]);

    if (loading || !competition) {
        return <p className="muted">Loading…</p>;
    }

    const displayedClubName =
        clubName ?? (organisationId ? `Club (${organisationId})` : "Club");

    const printTimestamp = new Date().toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });


    const displayedDivisions: Division[] = divisionsDirty
        ? allDivisions
            .filter(d => selectedDivisionIds.includes(d.id))
            .sort((a, b) => a.sort_order - b.sort_order)
        : competitionDivisions;

    

    return (
        <>
            <section className="card admin-card">

                <div className="edit-header">
                    <div className="edit-header-top">
                        <h2>Edit Competition</h2>

                        <span className="edit-context">
                            {competition.name}
                        </span>

                        <button
                            type="button"
                            className="btn btn--ghost"
                            style={{ marginLeft: "auto" }}
                            disabled={!competition.public_results_slug}
                            title={
                                competition.public_results_slug
                                    ? "Show registration QR"
                                    : "Set a public slug to enable registration QR"
                            }
                            onClick={() => {
                                setCopyStatus("idle");
                                setIsQrOpen(true);
                            }}
                        >
                            Registration QR
                        </button>

                        <Link
                            to={`/clubadmin/${organisationId}/admin/competitions`}
                            className="btn btn--ghost"
                        >
                            ← Back to Competitions
                        </Link>
                    </div>

                    <div className="edit-section-tabs">
                        <button
                            className={`btn ${activeSection === "details" ? "primary" : ""}`}
                            onClick={() => setActiveSection("details")}
                        >
                            Details
                        </button>

                        <button
                            className={`btn ${activeSection === "fees" ? "primary" : ""}`}
                            onClick={() => setActiveSection("fees")}
                            type="button"
                        >
                            Fees
                        </button>

                        <button
                            className={`btn ${activeSection === "briefing" ? "primary" : ""}`}
                            onClick={() => setActiveSection("briefing")}
                        >
                            Briefing
                        </button>

                        <button
                            className={`btn ${activeSection === "days" ? "primary" : ""}`}
                            onClick={() => setActiveSection("days")}
                        >
                            Fishing Days
                        </button>

                        <button
                            className={`btn ${activeSection === "species" ? "primary" : ""}`}
                            onClick={() => setActiveSection("species")}
                        >
                            Species
                        </button>

                        <button
                            className={`btn ${activeSection === "prizes" ? "primary" : ""}`}
                            onClick={() => setActiveSection("prizes")}
                            type="button"
                        >
                            Prizes
                        </button>
                    </div>
                </div>


                {feedbackMessage && (
                    <FeedbackModal
                        message={feedbackMessage}
                        onClose={() => setFeedbackMessage(null)}
                    />
                )}

                {showDivisionModal && (
                    <div className="modal-backdrop">
                        <div className="modal card" style={{ maxWidth: 720 }}>
                            <h3>Edit divisions</h3>

                            <p className="muted">
                                Select the divisions that apply to this competition.
                            </p>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                {allDivisions
                                    .slice()
                                    .sort((a, b) => a.sort_order - b.sort_order)
                                    .map((d) => {
                                        const checked = selectedDivisionIds.includes(d.id);

                                        return (
                                            <label key={d.id} className="pill pill--clickable" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        setSelectedDivisionIds((prev) => {
                                                            const next = prev.includes(d.id)
                                                                ? prev.filter((x) => x !== d.id)
                                                                : [...prev, d.id];

                                                            // dirty calc against last-saved selection
                                                            const isDirty =
                                                                next.length !== savedDivisionIds.length ||
                                                                next.some((x) => !savedDivisionIds.includes(x));

                                                            setDivisionsDirty(isDirty);
                                                            return next;
                                                        });
                                                    }}
                                                />
                                                <span>{d.name}</span>
                                            </label>
                                        );
                                    })}
                            </div>

                            <div className="modal-actions" style={{ marginTop: 16 }}>
                                <button
                                    type="button"
                                    className="btn btn--ghost"
                                    onClick={() => {
                                        // revert modal changes
                                        setSelectedDivisionIds(savedDivisionIds);
                                        setDivisionsDirty(false);
                                        setShowDivisionModal(false);
                                    }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className="btn primary"
                                    onClick={() => setShowDivisionModal(false)}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {isQrOpen && registrationUrl && (
                    <div
                        className="modal-backdrop"
                        onMouseDown={(e) => {
                            // close if user clicks the backdrop (not the card)
                            if (e.target === e.currentTarget) closeQrModal();
                        }}
                    >
                        <div className="modal card" style={{ maxWidth: 560 }}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                }}
                            >
                                <div>
                                    <h3 style={{ margin: 0 }}>Late Registration QR</h3>
                                    <div className="muted" style={{ marginTop: 6 }}>
                                        <div>
                                            <strong>Club:</strong> {displayedClubName}
                                        </div>
                                        <div>
                                            <strong>Competition:</strong> {competition.name}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={closeQrModal}
                                    aria-label="Close"
                                    title="Close"
                                >
                                    ×
                                </button>
                            </div>

                            <p className="muted" style={{ marginTop: 8 }}>
                                Scan this with a phone camera to open registration.
                            </p>

                            <div
                                style={{
                                    display: "grid",
                                    placeItems: "center",
                                    padding: "12px 0",
                                }}
                            >
                                <QRCodeSVG value={registrationUrl} size={240} />
                            </div>

                            <div
                                style={{
                                    wordBreak: "break-all",
                                    fontSize: 12,
                                    padding: 10,
                                    borderRadius: 8,
                                    background: "rgba(0,0,0,0.04)",
                                }}
                            >
                                {registrationUrl}
                            </div>

                            <div className="modal-actions" style={{ marginTop: 16 }}>
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={handleCopyRegistrationUrl}
                                >
                                    {copyStatus === "copied"
                                        ? "Copied!"
                                        : copyStatus === "error"
                                            ? "Copy failed"
                                            : "Copy link"}
                                </button>

                                <button
                                    type="button"
                                    className="btn"
                                    onClick={handlePrintLateRegistration}
                                >
                                    Print (A4)
                                </button>

                                <button
                                    type="button"
                                    className="btn btn--ghost"
                                    onClick={closeQrModal}
                                >
                                    Close
                                </button>
                            </div>

                            {copyStatus === "error" && (
                                <p className="muted" style={{ marginTop: 8 }}>
                                    Couldn’t copy automatically — select the URL above and copy it.
                                </p>
                            )}

                            <div id="late-registration-print" className="late-registration-print">
                                <div className="late-registration-print__content">
                                    <div className="late-registration-print__title">
                                        LATE REGISTRATIONS
                                    </div>
                                    <div className="late-registration-print__club">
                                        {displayedClubName}
                                    </div>
                                    <div className="late-registration-print__competition">
                                        {competition.name}
                                    </div>
                                    <div className="late-registration-print__instruction">
                                        Scan to register (or type the link below)
                                    </div>
                                    <QRCodeSVG value={registrationUrl} size={360} />
                                    <div className="late-registration-print__url">
                                        {registrationUrl}
                                    </div>
                                    <div className="late-registration-print__footer">
                                        Generated from Club Admin · {printTimestamp}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}


                {showDeleteModal && (
                    <div className="modal-backdrop">
                        <div className="modal card">
                            <h3>Delete Competition</h3>

                            <p>
                                Are you sure you want to delete
                                <strong> {competition.name}</strong>?
                            </p>

                            <p className="muted">
                                This action cannot be undone.
                            </p>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn btn--ghost"
                                    onClick={() => setShowDeleteModal(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className="btn danger"
                                    onClick={handleDelete}
                                >
                                    Delete Competition
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showSpeciesPoints && (
                    <div className="modal-backdrop">
                        <div
                            className="modal card"
                            style={{
                                maxWidth: 900,
                                maxHeight: "85vh",
                                overflowY: "auto",
                            }}
                        >
                            <h3>Species Points</h3>

                            <p className="muted">
                                Configure how points are awarded for selected species.
                            </p>

                            {selectedSpeciesSorted.length === 0 ? (
                                <p className="muted">No species selected for this competition.</p>
                            ) : (
                                <>
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "minmax(220px, 1fr) 120px 120px 180px",
                                            gap: 10,
                                            alignItems: "center",
                                            fontWeight: 600,
                                            paddingBottom: 6,
                                            borderBottom: "1px solid rgba(0,0,0,0.08)",
                                        }}
                                    >
                                        <div>Species</div>
                                        <div>Tag &amp; Release</div>
                                        <div>Landed ×</div>
                                        <div>Divide by line weight</div>
                                    </div>

                                    {selectedSpeciesSorted.map(s => {
                                        const rule = speciesPoints[s.id] ?? defaultSpeciesPoints;
                                        const categoryName = s.species_category?.name ?? "Other";

                                        return (
                                            <div
                                                key={s.id}
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "minmax(220px, 1fr) 120px 120px 180px",
                                                    gap: 10,
                                                    alignItems: "center",
                                                    padding: "6px 0",
                                                }}
                                            >
                                                <div>
                                                    <div>{s.name}</div>
                                                    <div className="muted" style={{ fontSize: 12 }}>
                                                        {categoryName}
                                                    </div>
                                                </div>

                                                <div>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        className="points-input small"
                                                        value={rule.tag_release_points}
                                                        onChange={(e) => {
                                                            const value = e.target.value === ""
                                                                ? 0
                                                                : Number(e.target.value);

                                                            updateSpeciesPointsRule(s.id, {
                                                                tag_release_points: value,
                                                            });
                                                        }}
                                                    />
                                                </div>

                                                <div>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={0.1}
                                                        className="points-input small"
                                                        value={rule.landed_multiplier}
                                                        onChange={(e) => {
                                                            const value = e.target.value === ""
                                                                ? 1
                                                                : Number(e.target.value);

                                                            updateSpeciesPointsRule(s.id, {
                                                                landed_multiplier: value,
                                                            });
                                                        }}
                                                    />
                                                </div>

                                                <label className="points-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={rule.landed_divide_by_line_weight}
                                                        onChange={(e) =>
                                                            updateSpeciesPointsRule(s.id, {
                                                                landed_divide_by_line_weight: e.target.checked,
                                                            })
                                                        }
                                                    />
                                                    Divide by line weight
                                                </label>
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            <div className="modal-actions">
                                <button
                                    className="btn btn--ghost"
                                    onClick={() => setShowSpeciesPoints(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}



                {/* ================= COMPETITION DETAILS ================= */}
                {activeSection === "details" && (
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
                                    {competitionTypes.map(t => (
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
                                    {compModes.map(m => (
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
                                    {prizeModes.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* ✅ Briefing Required */}
                            <div className="field span-6">
                                <label>Briefing required</label>

                                <div className="segmented">
                                    <button
                                        type="button"
                                        className={`segmented-btn ${competition.briefing_required ? "active" : ""}`}
                                        onClick={() => onFieldChange("briefing_required", true)}
                                    >
                                        Yes
                                    </button>

                                    <button
                                        type="button"
                                        className={`segmented-btn ${!competition.briefing_required ? "active" : ""}`}
                                        onClick={() => onFieldChange("briefing_required", false)}
                                    >
                                        No
                                    </button>
                                </div>
                            </div>


                            {/* ✅ DIVISIONS — RIGHT HAND SIDE */}
                            <div className="field span-6">
                                <label>Divisions</label>

                                <div className="division-control-row">
                                    <div className="division-value">
                                        {displayedDivisions.length === 0 ? (
                                            <span className="muted">
                                                No divisions configured.
                                            </span>
                                        ) : (
                                            <div className="pill-row">
                                                {displayedDivisions.map(d => (
                                                    <span key={d.id} className="pill">
                                                        {d.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="division-actions">
                                        <button
                                            type="button"
                                            className="btn btn--sm"
                                            disabled={hasResults}
                                            title={hasResults ? "Divisions can't be changed after results exist." : "Edit divisions"}
                                            onClick={() => setShowDivisionModal(true)}
                                        >
                                            Edit divisions
                                        </button>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ================= FEES ================= */}
                {activeSection === "fees" && organisationId && id && (
                    <CompetitionFeesCard
                        organisationId={organisationId}
                        competitionId={id}
                    />
                )}


                {/* ================= BRIEFING ================= */}
                {activeSection === "briefing" && (
                    <section className="card">
                        <h3>Competition Briefing</h3>

                        {!competition.briefing_required ? (
                            <>
                                {/* NOT REQUIRED — READ-ONLY STATE */}
                                <div className="empty-state muted">
                                    <p>
                                        A competition briefing is <strong>not required</strong> for this competition.
                                    </p>

                                    <p>
                                        If you decide to hold a briefing, enable <strong>“Briefing required”</strong> in the{" "}
                                        <strong>Competition Details</strong> tab.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* REQUIRED — EDITABLE FORM */}
                                <div className="info-inline">
                                    Briefing is required for this competition. Please enter the briefing details below.
                                </div>

                                <div className="form-grid">
                                    <div className="field span-4">
                                        <label>Date</label>
                                        <input
                                            type="date"
                                            min={briefingMinDate}
                                            max={briefingMaxDate}
                                            value={briefing.briefing_date ?? ""}
                                            onChange={(e) =>
                                                setBriefing((b) => ({
                                                    ...b,
                                                    briefing_date: clampBriefingDate(e.target.value || null),
                                                }))
                                            }
                                        />
                                        <small className="muted">Must be the competition start date or the day before.</small>
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
                            </>
                        )}
                    </section>
                )}

                {/* ================= FISHING DAYS ================= */}
                {activeSection === "days" && (
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
                                            onChange={(e) => updateDay(i, { day_date: e.target.value })}
                                        />
                                    </div>

                                    <div className="field span-4">
                                        <label>Fishing start type</label>
                                        <select
                                            value={d.fishing_start_type}
                                            onChange={(e) =>
                                                updateDay(i, { fishing_start_type: e.target.value as FishingStartType })
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
                                            onChange={(e) => updateDay(i, { fishing_start_time: e.target.value || null })}
                                        />
                                    </div>

                                    <div className="field span-4">
                                        <label>Fishing end type</label>
                                        <select
                                            value={d.fishing_end_type ?? "None"}
                                            onChange={(e) =>
                                                updateDay(i, { fishing_end_type: e.target.value as "None" | "Required" })
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
                                            onChange={(e) => updateDay(i, { fishing_end_time: e.target.value || null })}
                                        />
                                    </div>

                                    <div className="field span-4">
                                        <label>Weigh-in type</label>
                                        <select
                                            value={d.weighin_type}
                                            onChange={(e) => updateDay(i, { weighin_type: e.target.value as WeighinType })}
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
                                                        updateDay(i, { weighin_start_time: e.target.value || null })
                                                    }
                                                />
                                            </div>

                                            <div className="field span-4">
                                                <label>Weigh-in end</label>
                                                <input
                                                    type="time"
                                                    value={d.weighin_end_time ?? ""}
                                                    onChange={(e) => updateDay(i, { weighin_end_time: e.target.value || null })}
                                                />
                                            </div>

                                            <div className="field span-4">
                                                <label>Weigh-in cutoff</label>
                                                <input
                                                    type="time"
                                                    value={d.weighin_cutoff_time ?? ""}
                                                    onChange={(e) =>
                                                        updateDay(i, { weighin_cutoff_time: e.target.value || null })
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
                                                onChange={(e) => updateDay(i, { overnight_allowed: e.target.checked })}
                                            />
                                            Overnight fishing allowed
                                        </label>
                                    </div>

                                    <div className="field span-12">
                                        <label>Notes</label>
                                        <textarea
                                            value={d.notes ?? ""}
                                            onChange={(e) => updateDay(i, { notes: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </section>
                        ))}

                        <div className="actions">
                            <button type="button" className="btn" onClick={addDay}>
                                + Add Fishing Day
                            </button>
                        </div>
                    </section>
                )}

                {/* ================= SPECIES ================= */}
                {activeSection === "species" && (
                    <section className="card">
                        <div className="species-header-row">
                            <div className="species-title">
                                <h3>Eligible Species</h3>
                            </div>

                            <div className="species-actions">
                                {allowedFishTypeIds.length > 1 && (
                                    <div className="species-discipline-toggle">
                                        {allowedFishTypeIds.map((fishTypeId) => {
                                            const count = selectedSpeciesIds.filter((id) =>
                                                allSpecies.some((s) => s.id === id && s.fish_type_id === fishTypeId)
                                            ).length;

                                            return (
                                                <button
                                                    key={fishTypeId}
                                                    type="button"
                                                    className={`btn btn--sm ${activeFishTypeId === fishTypeId ? "primary" : ""}`}
                                                    onClick={() => setActiveFishTypeId(fishTypeId)}
                                                >
                                                    {fishTypeId === allowedFishTypeIds[0] ? "Game Fishing" : "Sport Fishing"}
                                                    {count > 0 && ` (${count})`}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className="btn btn--sm"
                                    onClick={() => setShowSpeciesPoints(true)}
                                    disabled={selectedSpeciesIds.length === 0}
                                >
                                    Species Points
                                </button>
                            </div>
                        </div>

                        <div className="species-category-list">
                            {groupedSpecies.map((group) => (
                                <section key={group.categoryName} className="species-category">
                                    <h4 className="species-category-title">{group.categoryName}</h4>

                                    <div className="species-grid">
                                        {group.species.map((s) => {
                                            const checked = selectedSpeciesIds.includes(s.id);

                                            return (
                                                <label key={s.id} className={`species-tile ${checked ? "active" : ""}`}>
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
                            ))}
                        </div>
                    </section>
                )}

                {/* ================= PRIZES ================= */}
                {activeSection === "prizes" && !inPrizeGiving && (
                    <CompetitionPrizes embedded competition={competition} days={days} divisions={displayedDivisions} />
                )}

                <Outlet />

                <hr className="edit-footer-divider" />




                {/* ================= FOOTER DIVIDER ================= */}
                <hr className="edit-footer-divider" />

                {/* ================= FOOTER ACTIONS ================= */}
                <div className="edit-footer-actions">
                    <div className="edit-footer-left">
                        {canDelete ? (
                            <button
                                type="button"
                                className="btn danger"
                                onClick={() => setShowDeleteModal(true)}
                            >
                                Delete Competition
                            </button>
                        ) : (
                            <div className="delete-disabled">
                                <button
                                    type="button"
                                    className="btn danger"
                                    disabled
                                    aria-describedby="delete-disabled-reason"
                                >
                                    Delete Competition
                                </button>

                                <p
                                    id="delete-disabled-reason"
                                    className="muted"
                                    style={{ marginTop: 4 }}
                                >
                                    This competition can’t be deleted because competitors are registered.
                                </p>
                            </div>

                        )}
                    </div>

                    <div className="edit-footer-right">
                        {pageDirty && (
                            <span className="save-warning">
                                Unsaved changes
                            </span>
                        )}

                        <button
                            className="btn primary btn--lg"
                            onClick={saveChanges}
                            disabled={saving}
                        >
                            {saving ? "Saving…" : "Save Competition"}
                        </button>
                    </div>
                </div>
            </section>
        </>
    );
}