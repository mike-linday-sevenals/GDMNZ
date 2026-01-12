// ============================================================================
// File: PrizeWizardModal.tsx
// Path: src/clubadmin/pages/CompetitionPrizes/PrizeWizardModal.tsx
// Description:
// Guided Prize Wizard modal (no defaults, reveal questions progressively)
// ============================================================================

import { useEffect, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { WizardContext } from "@/clubadmin/api/WizardContext";


// Match your page types
type ResultMethod = "weighed" | "measured";
type AwardRule = "ranked" | "first";
type OutcomeFilter = "any" | "landed" | "tagged_released";

type FishType = {
    fish_type_id: string;
    name: string;
};

type WizardTargetMode = "single" | "group";

export type PrizeWizardState = {
    step: 1 | 2 | 3 | 4;

    // Step 1
    prizeType: "species" | "special" | null;
    disciplineFishTypeId: string | null; // only for species prizes

    // Step 2
    targetMode: WizardTargetMode | null;
    selectedKeys: string[]; // s:12 or g:catId
    search: string;

    // Special prize fields
    specialName: string;
    specialDescription: string;

    // Step 3
    award_rule: AwardRule | null;

    // Step 3 - First
    outcomes: Array<Exclude<OutcomeFilter, "any">>;


    // Step 3 - Best
    result_method: ResultMethod | null;

    // Step 4
    count: number;
};

export function defaultPrizeWizardState(opts: {
    singleFishTypeId: string | null; // if only one discipline exists, pre-set it
    defaultCount?: number;
}): PrizeWizardState {
    return {
        step: 1,

        prizeType: null,
        disciplineFishTypeId: opts.singleFishTypeId,

        targetMode: null,
        selectedKeys: [],
        search: "",

        specialName: "",
        specialDescription: "",

        award_rule: null,
        outcomes: [],
        result_method: null,

        count: opts.defaultCount ?? 0,
    };
}

function clampInt(n: number, fallback: number) {
    const v = Math.floor(Number(n));
    return Number.isFinite(v) && v >= 1 ? v : fallback;
}


type SpeciesLike = {
    id: number;
    name: string;
    fish_type_id?: string | null;
    species_category_id?: string | null;
    species_category?: { name?: string | null } | null;
};

type Props = {
    open: boolean;
    wiz: PrizeWizardState;
    setWiz: Dispatch<SetStateAction<PrizeWizardState>>;

    fishTypes?: FishType[];
    allSpecies: SpeciesLike[];
    context: WizardContext;

    existingPrizeKeys?: Set<string>;
    onClose: () => void;
    onApply: (state: PrizeWizardState) => void;
};




export default function PrizeWizardModal({
    open,
    wiz,
    setWiz,
    fishTypes,
    allSpecies,
    context,
    existingPrizeKeys, // ✅ NEW
    onClose,
    onApply,
}: Props) {

    const safeFishTypes = fishTypes ?? [];

    // Auto-select fish type when only one exists (mixed competitions)
    useEffect(() => {
        if (!open) return;
        if (context.discipline !== "mixed") return;
        if (wiz.prizeType !== "species") return;

        if (
            !wiz.disciplineFishTypeId &&
            safeFishTypes.length === 1
        ) {
            setWiz((w) => ({
                ...w,
                disciplineFishTypeId: safeFishTypes[0].fish_type_id,
            }));
        }
    }, [
        open,
        context.discipline,
        wiz.prizeType,
        wiz.disciplineFishTypeId,
        safeFishTypes,
        setWiz,
    ]);




    // -------------------------------------------------------------------------

    const effectiveDiscipline = useMemo<"sport" | "game" | "mixed">(() => {
        // Non-mixed competitions are fixed
        if (context.discipline !== "mixed") {
            return context.discipline;
        }

        // Mixed but no fish type chosen yet
        if (!wiz.disciplineFishTypeId) {
            return "mixed";
        }

        // Resolve selected fish type → semantic discipline
        const selected = safeFishTypes.find(
            (ft) => ft.fish_type_id === wiz.disciplineFishTypeId
        );

        if (!selected) return "mixed";

        return selected.name.toLowerCase().includes("game")
            ? "game"
            : "sport";
    }, [context.discipline, wiz.disciplineFishTypeId, safeFishTypes]);

    const isSport = effectiveDiscipline === "sport";
    const isGame = effectiveDiscipline === "game";
    const isMixed = context.discipline === "mixed";
    const isSingleDiscipline = safeFishTypes.length <= 1;

    // -------------------------------------------------------------------------
    // Examples text (UI only)
    // -------------------------------------------------------------------------
    const speciesExampleText = useMemo(() => {
        if (isSport) return "e.g. Snapper, Kingfish";
        if (isGame) return "e.g. Blue Marlin, Yellowfin Tuna";
        return "e.g. Blue Marlin, Snapper";
    }, [isSport, isGame]);

    // -------------------------------------------------------------------------
    // Discipline requirement (mixed comps only)
    // -------------------------------------------------------------------------
    const disciplineRequired =
        wiz.prizeType === "species" &&
        context.discipline === "mixed" &&
        !isSingleDiscipline &&
        !wiz.disciplineFishTypeId;

    const disciplineOk =
        wiz.prizeType !== "species" ||
        context.discipline !== "mixed" ||
        !!wiz.disciplineFishTypeId;

    // -------------------------------------------------------------------------
    // Species scoped by SELECTED FISH TYPE (THIS WAS THE BUG)
    // -------------------------------------------------------------------------
    const scopedSpecies = useMemo(() => {
        if (wiz.prizeType !== "species") return [];

        // Single-discipline competitions → all species already scoped by API
        if (context.discipline !== "mixed") {
            return allSpecies;
        }

        // Mixed, but no fish type selected yet
        if (!wiz.disciplineFishTypeId) {
            return [];
        }

        // ✅ CORRECT: filter by FISH TYPE ID (UUID)
        return allSpecies.filter(
            (s) => s.fish_type_id === wiz.disciplineFishTypeId
        );
    }, [
        wiz.prizeType,
        allSpecies,
        context.discipline,
        wiz.disciplineFishTypeId,
    ]);

    // -------------------------------------------------------------------------
    // TEMP DEBUG — Prize wizard state snapshots (safe, type-correct)
    // -------------------------------------------------------------------------

    if (wiz.prizeType === "species") {
        console.log("[PrizeWizard] Species prize snapshot", {
            step: wiz.step,
            prizeType: wiz.prizeType,

            // Discipline
            effectiveDiscipline,
            disciplineFishTypeId: wiz.disciplineFishTypeId,
            matchedFishType: safeFishTypes.find(
                (ft) => ft.fish_type_id === wiz.disciplineFishTypeId
            ),

            // Targeting
            targetMode: wiz.targetMode,
            selectedKeys: wiz.selectedKeys,
            selectedCount: wiz.selectedKeys.length,

            // Scope
            scopedSpeciesCount: scopedSpecies.length,
            scopedSpeciesSample: scopedSpecies[0] ?? null,

            // Award config (may be null depending on step)
            award_rule: wiz.award_rule,
            result_method: wiz.result_method,
            outcomes: wiz.outcomes,
            count: wiz.count,
        });
    }

    if (wiz.prizeType === "special") {
        console.log("[PrizeWizard] Special / Spot prize snapshot", {
            step: wiz.step,
            prizeType: wiz.prizeType,

            // Core fields
            specialName: wiz.specialName,
            specialDescription: wiz.specialDescription,

            // Award config (auto-forced later, but log anyway)
            award_rule: wiz.award_rule,
            count: wiz.count,
            outcomes: wiz.outcomes,

            // Targets (should usually be empty for special)
            targetMode: wiz.targetMode,
            selectedKeys: wiz.selectedKeys,
        });
    }

    // -------------------------------------------------------------------------
    // Grouping (GAME ONLY, derived from scopedSpecies)
    // -------------------------------------------------------------------------
    const canUseGroups =
        context.allowedTargetKinds.includes("group") && isGame;

    const groups = useMemo(() => {
        if (!canUseGroups) return [];

        const map = new Map<
            string,
            {
                key: string;
                categoryId: string;
                name: string;
                count: number;
                speciesIds: number[];
            }
        >();

        for (const s of scopedSpecies) {
            if (!s.species_category_id || !s.species_category?.name) continue;

            const catId = s.species_category_id;
            const catName = s.species_category.name;

            if (!map.has(catId)) {
                map.set(catId, {
                    key: `g:${catId}`,
                    categoryId: catId,
                    name: catName,
                    count: 0,
                    speciesIds: [],
                });
            }

            const entry = map.get(catId)!;
            entry.count += 1;
            entry.speciesIds.push(s.id);
        }

        return Array.from(map.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
    }, [scopedSpecies, canUseGroups]);

    // -------------------------------------------------------------------------
    // Map selection keys -> display labels (species + groups)
    // -------------------------------------------------------------------------
    const targetLabelByKey = useMemo(() => {
        const map = new Map<string, string>();

        for (const s of scopedSpecies) {
            map.set(`s:${s.id}`, s.name);
        }

        for (const g of groups) {
            map.set(g.key, g.name);
        }

        return map;
    }, [scopedSpecies, groups]);

    const selectedFishType = wiz.disciplineFishTypeId;




    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    function selectedCountByMode() {
        const mode = canUseGroups ? wiz.targetMode : "single";

        return mode === "group"
            ? wiz.selectedKeys.filter((k) => k.startsWith("g:")).length
            : wiz.selectedKeys.filter((k) => k.startsWith("s:")).length;
    }

    function toggleKey(key: string) {
        setWiz((w) => ({
            ...w,
            selectedKeys: w.selectedKeys.includes(key)
                ? w.selectedKeys.filter((k) => k !== key)
                : [...w.selectedKeys, key],
        }));
    }

    // -------------------------------------------------------------------------
    // Navigation guards
    // -------------------------------------------------------------------------
    function canNext(): boolean {
        if (wiz.prizeType === "special") {
            return wiz.step !== 1 || wiz.specialName.trim().length > 0;
        }

        if (wiz.step === 1) {
            if (!wiz.prizeType) return false;
            if (disciplineRequired && !wiz.disciplineFishTypeId) return false;
            return true;
        }

        if (wiz.step === 2) {
            const mode = canUseGroups ? wiz.targetMode : "single";
            const count =
                mode === "group"
                    ? wiz.selectedKeys.filter((k) => k.startsWith("g:")).length
                    : wiz.selectedKeys.filter((k) => k.startsWith("s:")).length;
            return count > 0;
        }

        if (wiz.step === 3) {
            if (!wiz.award_rule) return false;
            if (wiz.award_rule === "first") return wiz.outcomes.length > 0;
            return (
                context.allowedResultMethods.length === 1 ||
                !!wiz.result_method
            );
        }

        if (wiz.step === 4) {
            if (wiz.award_rule === "ranked") {
                return Number.isFinite(wiz.count) && wiz.count >= 1;
            }
            return wiz.outcomes.length > 0;
        }

        return false;
    }

    function next() {
        if (!canNext()) return;

        setWiz((w) => {
            if (w.step === 1 && w.prizeType === "special") {
                return {
                    ...w,
                    step: 4,
                    award_rule: "first",
                    count: 1,
                    outcomes: [],
                    result_method: null,
                };
            }

            return {
                ...w,
                step: Math.min(4, w.step + 1) as 1 | 2 | 3 | 4,
            };
        });
    }

    function back() {
        setWiz((w) => ({
            ...w,
            step:
                w.step === 4 && w.prizeType === "special"
                    ? 1
                    : (Math.max(1, w.step - 1) as 1 | 2 | 3 | 4),
        }));
    }




    // =========================================================================
    // DUPLICATE-SAFE HELPERS + PREVIEW (replaces previewText + step4GroupedLines)
    // =========================================================================

    type FirstOutcome = Exclude<OutcomeFilter, "any">;

    const safeExistingPrizeKeys = existingPrizeKeys ?? new Set<string>();
    const hasExisting = safeExistingPrizeKeys.size > 0;

    function makePrizeKey(parts: {
        award_rule: AwardRule;
        targetKey: string; // "s:12" | "g:catId" | "sp:Spot prize"
        place: number;     // 1..n
        outcome?: FirstOutcome | null;
        result_method?: ResultMethod | null;
    }) {
        const o = parts.outcome ?? "";
        const m = parts.result_method ?? "";
        return `${parts.award_rule}|${parts.targetKey}|p:${parts.place}|o:${o}|m:${m}`;
    }

    const selectedTargetKeys = useMemo(() => {
        if (wiz.prizeType === "special") {
            const name = wiz.specialName?.trim() || "Spot prize";
            return [`sp:${name}`];
        }

        const mode = canUseGroups ? wiz.targetMode : "single";

        if (mode === "group") {
            return wiz.selectedKeys.filter((k) => k.startsWith("g:"));
        }

        return wiz.selectedKeys.filter((k) => k.startsWith("s:"));
    }, [
        wiz.prizeType,
        wiz.specialName,
        wiz.targetMode,
        wiz.selectedKeys,
        canUseGroups,
    ]);


    const targetLabel = (k: string) => {
        if (k.startsWith("sp:")) return k.slice(3);
        return targetLabelByKey.get(k) ?? k;
    };

    const resolvedResultMethod =
        wiz.award_rule === "ranked"
            ? (context.allowedResultMethods.length === 1 ? context.allowedResultMethods[0] : wiz.result_method)
            : null;

    const resolvedCount =
        wiz.award_rule === "first" ? 1 : clampInt(wiz.count, 1);

    const previewGroups = useMemo(() => {
        if (!wiz.award_rule) return [];

        // FIRST: 1 placing per selected target per selected outcome
        if (wiz.award_rule === "first") {
            return (wiz.outcomes as FirstOutcome[]).map((outcome) => {
                const label = outcome === "tagged_released" ? "First tagged & released" : "First landed";

                const keys = selectedTargetKeys.map((t) =>
                    makePrizeKey({
                        award_rule: "first",
                        targetKey: t,
                        place: 1,
                        outcome,
                        result_method: null,
                    })
                );

                const duplicate = hasExisting ? keys.some((k) => safeExistingPrizeKeys.has(k)) : false;

                return {
                    id: `first:${outcome}`,
                    title: `1 prize per selected target — ${label}`,
                    lines: selectedTargetKeys.map((t) => `${label} — ${targetLabel(t)}`),
                    keys,
                    duplicate,
                };
            });
        }

        // RANKED: places 1..N per selected target
        const method: ResultMethod =
            (resolvedResultMethod ?? context.allowedResultMethods[0]) as ResultMethod;

        const methodLabel = method === "weighed" ? "Heaviest" : "Longest";

        const keys: string[] = [];
        for (const t of selectedTargetKeys) {
            for (let place = 1; place <= resolvedCount; place++) {
                keys.push(
                    makePrizeKey({
                        award_rule: "ranked",
                        targetKey: t,
                        place,
                        outcome: null,
                        result_method: method,
                    })
                );
            }
        }

        const duplicate = hasExisting ? keys.some((k) => safeExistingPrizeKeys.has(k)) : false;

        return [
            {
                id: `ranked:${method}:${resolvedCount}`,
                title: `${resolvedCount} placing${resolvedCount === 1 ? "" : "s"} per selected target — ${methodLabel}`,
                lines: selectedTargetKeys.map((t) => `${methodLabel} — ${targetLabel(t)} (places 1 → ${resolvedCount})`),
                keys,
                duplicate,
            },
        ];
    }, [
        wiz.award_rule,
        wiz.outcomes,
        resolvedCount,
        resolvedResultMethod,
        context.allowedResultMethods,
        selectedTargetKeys,
        hasExisting,
        safeExistingPrizeKeys,
    ]);

    const hasPreviewDuplicates = previewGroups.some((g) => g.duplicate);

    const previewSummary = useMemo(() => {
        const total = previewGroups.reduce((acc, g) => acc + g.keys.length, 0);
        return `You will create ${total} prize entr${total === 1 ? "y" : "ies"} as detailed below.`;
    }, [previewGroups]);

    // Keep these AFTER helpers so canNext() sees updated state
    const canGoBack = wiz.step > 1;
    const canProceed = canNext();

    // Auto-select fish type when mixed competition has only ONE option
    useEffect(() => {
        if (!open) return;
        if (wiz.prizeType !== "species") return;
        if (context.discipline !== "mixed") return;
        if (!isSingleDiscipline) return;
        if (wiz.disciplineFishTypeId) return;

        if (safeFishTypes.length === 1) {
            setWiz((w) => ({
                ...w,
                disciplineFishTypeId: safeFishTypes[0].fish_type_id,
            }));
        }
    }, [
        open,
        wiz.prizeType,
        context.discipline,
        isSingleDiscipline,
        safeFishTypes,
        wiz.disciplineFishTypeId,
        setWiz,
    ]);

    // Auto-force single-target mode when grouping is not allowed by context
    useEffect(() => {
        if (!open) return;
        if (wiz.prizeType !== "species") return;
        if (canUseGroups) return;

        if (wiz.targetMode !== "single") {
            setWiz((w: PrizeWizardState) => ({
                ...w,
                targetMode: "single",
                selectedKeys: w.selectedKeys.filter((k) => k.startsWith("s:")),
                search: "",
            }));
        }
    }, [open, wiz.prizeType, wiz.targetMode, canUseGroups, setWiz]);



    return (
        <>
            {!open ? null : (
                <div className="modal-backdrop" onClick={onClose}>
                    <div
                        className="modal card"
                        style={{ width: "min(980px,92vw)", padding: 16 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <h3 style={{ margin: 0 }}>Prize Wizard</h3>

                            <span className="muted" style={{ fontSize: 12 }}>
                                Step {wiz.step} of 4
                            </span>

                            <div
                                style={{
                                    marginLeft: "auto",
                                    display: "flex",
                                    gap: 8,
                                }}
                            >
                                <button
                                    className="btn btn--ghost"
                                    type="button"
                                    onClick={onClose}
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <hr
                            style={{
                                border: 0,
                                borderTop: "1px solid var(--border)",
                                margin: "12px 0",
                            }}
                        />

                        {/* STEP 1 */}
                        {wiz.step === 1 && (
                            <div style={{ display: "grid", gap: 12 }}>

                                {/* ───────────────────────────────────────────── */}
                                {/* PRIZE TYPE */}
                                {/* ───────────────────────────────────────────── */}
                                <div className="wizard-section">
                                    <div className="wizard-question-title">
                                        What kind of prize are you creating?
                                    </div>

                                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                                        <button
                                            type="button"
                                            className={`btn btn--ghost ${wiz.prizeType === "species" ? "primary" : ""}`}
                                            onClick={() =>
                                                setWiz((w) => ({
                                                    ...w,
                                                    prizeType: "species",
                                                    // reset downstream
                                                    targetMode: null,
                                                    selectedKeys: [],
                                                    search: "",
                                                    award_rule: null,
                                                    outcomes: [],
                                                    result_method: null,
                                                }))
                                            }
                                            style={{ justifyContent: "flex-start", textAlign: "left" }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700 }}>Fish prize</div>
                                                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                                    {context.discipline === "sport"
                                                        ? "Awarded to a specific species (e.g. Snapper, Kingfish)."
                                                        : context.discipline === "game"
                                                            ? "Awarded to a species or a group (e.g. Blue Marlin or Marlin group)."
                                                            : "Awarded to a species or group across sport and game fish."}
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            className={`btn btn--ghost ${wiz.prizeType === "special" ? "primary" : ""}`}
                                            onClick={() =>
                                                setWiz((w) => ({
                                                    ...w,
                                                    prizeType: "special",
                                                    // reset downstream
                                                    targetMode: null,
                                                    selectedKeys: [],
                                                    search: "",
                                                    award_rule: null,
                                                    outcomes: [],
                                                    result_method: null,
                                                }))
                                            }
                                            style={{ justifyContent: "flex-start", textAlign: "left" }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700 }}>Custom / spot prize</div>
                                                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                                    Spot prizes, boat prizes, random draws, best dressed, etc.
                                                </div>
                                            </div>
                                        </button>
                                    </div>

                                    {!wiz.prizeType && (
                                        <div className="wizard-help">Choose one to continue.</div>
                                    )}
                                </div>

                                {/* ───────────────────────────────────────────── */}
                                {/* FISH TYPE (MIXED COMPETITIONS ONLY) */}
                                {/* ───────────────────────────────────────────── */}
                                {wiz.prizeType === "species" && context.discipline === "mixed" && (
                                    <div className="wizard-section">
                                        <div className="wizard-question-title">
                                            What type of fish does this prize apply to?
                                        </div>

                                        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                                            {safeFishTypes.map((ft) => {
                                                const isGameFish = ft.name.toLowerCase().includes("game");

                                                return (
                                                    <button
                                                        key={ft.fish_type_id}
                                                        type="button"
                                                        className={`btn btn--ghost ${wiz.disciplineFishTypeId === ft.fish_type_id
                                                                ? "primary"
                                                                : ""
                                                            }`}
                                                        onClick={() =>
                                                            setWiz((w) => ({
                                                                ...w,
                                                                disciplineFishTypeId: ft.fish_type_id,
                                                                targetMode: null,
                                                                selectedKeys: [],
                                                                search: "",
                                                            }))
                                                        }
                                                        style={{ justifyContent: "flex-start", textAlign: "left" }}
                                                    >
                                                        <div>
                                                            <div style={{ fontWeight: 700 }}>{ft.name}</div>
                                                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                                                {isGameFish
                                                                    ? "Examples: Blue Marlin, Yellowfin Tuna…"
                                                                    : "Examples: Snapper, Kingfish, Kahawai…"}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {!wiz.disciplineFishTypeId && (
                                            <div className="wizard-help">
                                                Choose a fish type to continue.
                                            </div>
                                        )}
                                    </div>
                                )}



                                {/* ───────────────────────────────────────────── */}
                                {/* SPOT PRIZE DETAILS */}
                                {/* ───────────────────────────────────────────── */}
                                {wiz.prizeType === "special" && (
                                    <div className="wizard-section">
                                        <div className="wizard-question-title">
                                            Spot / custom prize details
                                        </div>

                                        <div className="wizard-help">
                                            This prize is awarded manually and is not based on fish
                                            results.
                                        </div>

                                        <div className="field" style={{ marginTop: 10 }}>
                                            <label className="muted" style={{ fontSize: 12 }}>
                                                Prize name
                                            </label>
                                            <input
                                                className="input"
                                                placeholder="e.g. Lucky junior draw"
                                                value={wiz.specialName}
                                                onChange={(e) =>
                                                    setWiz((w) => ({
                                                        ...w,
                                                        specialName: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>

                                        <div className="field" style={{ marginTop: 10 }}>
                                            <label className="muted" style={{ fontSize: 12 }}>
                                                How is this prize awarded? (optional)
                                            </label>
                                            <textarea
                                                className="input"
                                                rows={3}
                                                placeholder="e.g. Random junior selected at prize giving"
                                                value={wiz.specialDescription}
                                                onChange={(e) =>
                                                    setWiz((w) => ({
                                                        ...w,
                                                        specialDescription: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}


                        {/* ===================================================================== */}
                        {/* ===================================================================== */}
                        {/* STEP 2 — TARGET SELECTION */}
                        {/* ===================================================================== */}
                        {wiz.step === 2 && wiz.prizeType !== "special" && (
                            <div style={{ display: "grid", gap: 12 }}>


                                {/* ───────────────────────────────────────────── */}
                                {/* TARGET MODE — GAME ONLY */}
                                {/* ───────────────────────────────────────────── */}
                                {isGame && (
                                    <div className="wizard-section">
                                        <div className="wizard-question-title">
                                            Select your fish
                                        </div>
                                        <div className="wizard-help">
                                            Does this prize apply to an{" "}
                                            <strong>individual species</strong> or a{" "}
                                            <strong>group</strong>?
                                        </div>

                                        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                                            <button
                                                type="button"
                                                className={`btn btn--ghost ${wiz.targetMode === "single" ? "primary" : ""
                                                    }`}
                                                onClick={() =>
                                                    setWiz((w) => ({
                                                        ...w,
                                                        targetMode: "single",
                                                        selectedKeys: [],
                                                        search: "",
                                                    }))
                                                }
                                                style={{ justifyContent: "flex-start", textAlign: "left" }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 700 }}>
                                                        Individual species
                                                    </div>
                                                    <div className="muted" style={{ fontSize: 12 }}>
                                                        Choose a specific fish ({speciesExampleText})
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                className={`btn btn--ghost ${wiz.targetMode === "group" ? "primary" : ""
                                                    }`}
                                                onClick={() =>
                                                    setWiz((w) => ({
                                                        ...w,
                                                        targetMode: "group",
                                                        selectedKeys: [],
                                                        search: "",
                                                    }))
                                                }
                                                style={{ justifyContent: "flex-start", textAlign: "left" }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 700 }}>
                                                        Fish groups
                                                    </div>
                                                    <div className="muted" style={{ fontSize: 12 }}>
                                                        Whole categories like Marlin or Tuna
                                                    </div>
                                                </div>
                                            </button>
                                        </div>

                                        {!wiz.targetMode && (
                                            <div className="wizard-help">
                                                Choose one to continue.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ───────────────────────────────────────────── */}
                                {/* SPORT — HEADER ONLY */}
                                {/* ───────────────────────────────────────────── */}
                                {isSport && (
                                    <div className="wizard-section">
                                        <div className="wizard-question-title">
                                            Select your fish
                                        </div>
                                        <div className="wizard-help">
                                            Choose a specific species ({speciesExampleText})
                                        </div>
                                    </div>
                                )}

                                {/* ───────────────────────────────────────────── */}
                                {/* TARGET LIST */}
                                {/* ───────────────────────────────────────────── */}
                                {(isSport || wiz.targetMode) && (
                                    <div className="wizard-section">
                                        <div className="wizard-question-title">
                                            {wiz.targetMode === "group"
                                                ? "Choose groups"
                                                : "Choose species"}
                                        </div>

                                        <input
                                            className="input"
                                            value={wiz.search}
                                            onChange={(e) =>
                                                setWiz((w) => ({ ...w, search: e.target.value }))
                                            }
                                            placeholder={
                                                wiz.targetMode === "group"
                                                    ? "Search groups…"
                                                    : "Search species…"
                                            }
                                        />

                                        <div
                                            style={{
                                                marginTop: 10,
                                                maxHeight: 340,
                                                overflow: "auto",
                                                border: "1px solid var(--border)",
                                                borderRadius: 10,
                                            }}
                                        >
                                            {/* SPECIES */}
                                            {(isSport || wiz.targetMode === "single") &&
                                                scopedSpecies
                                                    .filter((s) =>
                                                        wiz.search
                                                            ? s.name
                                                                .toLowerCase()
                                                                .includes(wiz.search.toLowerCase())
                                                            : true
                                                    )
                                                    .map((s) => {
                                                        const key = `s:${s.id}`;
                                                        const checked =
                                                            wiz.selectedKeys.includes(key);

                                                        return (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                className="btn btn--ghost"
                                                                onClick={() => toggleKey(key)}
                                                                style={{
                                                                    width: "100%",
                                                                    justifyContent: "space-between",
                                                                    background: checked
                                                                        ? "var(--muted)"
                                                                        : "transparent",
                                                                }}
                                                            >
                                                                <span>{s.name}</span>
                                                                {checked && <span>✓</span>}
                                                            </button>
                                                        );
                                                    })}

                                            {/* GROUPS — GAME ONLY */}
                                            {isGame &&
                                                wiz.targetMode === "group" &&
                                                groups
                                                    .filter((g) =>
                                                        wiz.search
                                                            ? g.name
                                                                .toLowerCase()
                                                                .includes(wiz.search.toLowerCase())
                                                            : true
                                                    )
                                                    .map((g) => {
                                                        const checked =
                                                            wiz.selectedKeys.includes(g.key);

                                                        return (
                                                            <button
                                                                key={g.key}
                                                                type="button"
                                                                className="btn btn--ghost"
                                                                onClick={() => toggleKey(g.key)}
                                                                style={{
                                                                    width: "100%",
                                                                    justifyContent: "space-between",
                                                                    background: checked
                                                                        ? "var(--muted)"
                                                                        : "transparent",
                                                                }}
                                                            >
                                                                <span>
                                                                    {g.name}{" "}
                                                                    <span
                                                                        className="muted"
                                                                        style={{ fontSize: 12 }}
                                                                    >
                                                                        ({g.count})
                                                                    </span>
                                                                </span>
                                                                {checked && <span>✓</span>}
                                                            </button>
                                                        );
                                                    })}
                                        </div>

                                        {!canNext() && (
                                            <div className="wizard-help">
                                                Select at least one target to continue.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}


                        {/* STEP 3 */}
                        {wiz.step === 3 && wiz.prizeType !== "special" && (
                            <div style={{ display: "grid", gap: 12 }}>
                                <div className="wizard-section">
                                    <div className="wizard-question-title">How do we decide the winner?</div>

                                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                                        <button
                                            type="button"
                                            className={`btn btn--ghost ${wiz.award_rule === "first" ? "primary" : ""}`}
                                            onClick={() =>
                                                setWiz((w) => ({
                                                    ...w,
                                                    award_rule: "first",
                                                    result_method: null,
                                                    count: 1,
                                                    outcomes: [],
                                                }))
                                            }
                                            style={{ justifyContent: "flex-start", textAlign: "left" }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700 }}>First submission (per selected target)</div>
                                                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                                    Creates one prize per selected target — whichever comes in first wins for that target.
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            className={`btn btn--ghost ${wiz.award_rule === "ranked" ? "primary" : ""}`}
                                            onClick={() =>
                                                setWiz((w) => ({
                                                    ...w,
                                                    award_rule: "ranked",
                                                    outcomes: [],
                                                    result_method: context.allowedResultMethods.length === 1 ? context.allowedResultMethods[0] : null,
                                                }))
                                            }
                                            style={{ justifyContent: "flex-start", textAlign: "left" }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700 }}>Best result (per selected target)</div>
                                                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                                    Ranks fish for each selected target using the competition method (weight or length).
                                                </div>
                                            </div>
                                        </button>
                                    </div>

                                    {!wiz.award_rule && <div className="wizard-help">Make a selection to continue.</div>}
                                </div>

                                {/* FIRST: Outcomes (context-driven, duplicate-safe) */}
                                {wiz.award_rule === "first" && (
                                    <div className="wizard-section">
                                        <div className="wizard-question-title">
                                            For “First submission”, what counts?
                                        </div>

                                        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                                            {(() => {
                                                // Multi-select allowed only when context allows multiple outcomes
                                                const multi = context.allowedOutcomes.length > 1;

                                                const optionDefs = context.allowedOutcomes
                                                    .filter((o): o is FirstOutcome => o !== "any")
                                                    .map((outcome) => ({
                                                        outcome,
                                                        title:
                                                            outcome === "tagged_released"
                                                                ? "First tagged & released submission"
                                                                : "First landed submission",
                                                        sub:
                                                            outcome === "tagged_released"
                                                                ? "First tagged & released fish recorded for each selected target."
                                                                : "First landed fish recorded for each selected target.",
                                                    }));

                                                return optionDefs.map((opt) => {
                                                    const isSelected = wiz.outcomes.includes(opt.outcome);

                                                    // Predict keys this option would create
                                                    const wouldCreateKeys = selectedTargetKeys.map((t) =>
                                                        makePrizeKey({
                                                            award_rule: "first",
                                                            targetKey: t,
                                                            place: 1,
                                                            outcome: opt.outcome,
                                                            result_method: null,
                                                        })
                                                    );

                                                    const isDuplicate = hasExisting
                                                        ? wouldCreateKeys.some((k) =>
                                                            safeExistingPrizeKeys.has(k)
                                                        )
                                                        : false;

                                                    // Allow deselecting an already-selected duplicate
                                                    const disabled = isDuplicate && !isSelected;

                                                    return (
                                                        <button
                                                            key={opt.outcome}
                                                            type="button"
                                                            disabled={disabled}
                                                            className={`btn btn--ghost ${isSelected ? "primary" : ""
                                                                }`}
                                                            onClick={() => {
                                                                setWiz((w) => {
                                                                    if (!multi) {
                                                                        // Single-select mode
                                                                        return {
                                                                            ...w,
                                                                            outcomes: [opt.outcome],
                                                                        };
                                                                    }

                                                                    // Multi-select toggle
                                                                    const next = w.outcomes.includes(opt.outcome)
                                                                        ? w.outcomes.filter(
                                                                            (x) => x !== opt.outcome
                                                                        )
                                                                        : [...w.outcomes, opt.outcome];

                                                                    return { ...w, outcomes: next };
                                                                });
                                                            }}
                                                            style={{
                                                                justifyContent: "flex-start",
                                                                textAlign: "left",
                                                                opacity: disabled ? 0.55 : 1,
                                                                cursor: disabled
                                                                    ? "not-allowed"
                                                                    : "pointer",
                                                            }}
                                                        >
                                                            <div>
                                                                <div style={{ fontWeight: 700 }}>
                                                                    {opt.title}{" "}
                                                                    {disabled && (
                                                                        <span
                                                                            className="muted"
                                                                            style={{ fontWeight: 600 }}
                                                                        >
                                                                            (already exists)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div
                                                                    className="muted"
                                                                    style={{
                                                                        fontSize: 12,
                                                                        marginTop: 4,
                                                                    }}
                                                                >
                                                                    {opt.sub}
                                                                    {multi
                                                                        ? " (You can select both.)"
                                                                        : ""}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>

                                        {!wiz.outcomes.length && (
                                            <div className="wizard-help" style={{ marginTop: 10 }}>
                                                Choose at least one option to continue.
                                            </div>
                                        )}

                                        <div className="wizard-help" style={{ marginTop: 10 }}>
                                            This creates <strong>1 placing</strong> per selected target per
                                            option selected.
                                        </div>
                                    </div>
                                )}


                                {/* RANKED: Method */}
                                {wiz.award_rule === "ranked" && (
                                    <div className="wizard-section">
                                        <div className="wizard-question-title">For “Best result”, what determines the winner?</div>

                                        {context.allowedResultMethods.length === 1 ? (
                                            <div className="wizard-help" style={{ marginTop: 10 }}>
                                                This competition is locked to {context.allowedResultMethods[0] === "weighed" ? "Weight" : "Length"}.
                                            </div>
                                        ) : (
                                            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                                                <button
                                                    type="button"
                                                    className={`btn btn--ghost ${wiz.result_method === "weighed" ? "primary" : ""}`}
                                                    onClick={() => setWiz((w) => ({ ...w, result_method: "weighed" }))}
                                                    style={{ justifyContent: "flex-start", textAlign: "left" }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>Heaviest fish (per target)</div>
                                                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                                            Ranks each selected target by weight.
                                                        </div>
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    className={`btn btn--ghost ${wiz.result_method === "measured" ? "primary" : ""}`}
                                                    onClick={() => setWiz((w) => ({ ...w, result_method: "measured" }))}
                                                    style={{ justifyContent: "flex-start", textAlign: "left" }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>Longest fish (per target)</div>
                                                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                                            Ranks each selected target by length.
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
                                        )}

                                        <div className="wizard-help" style={{ marginTop: 10 }}>
                                            Best result uses the competition method and applies to the targets you selected in Step 2.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}





                        {/* STEP 4 */}
                        {wiz.step === 4 && (
                            <div style={{ display: "grid", gap: 12 }}>
                                {/* SPOT / SPECIAL PRIZE REVIEW */}
                                {wiz.prizeType === "special" && (
                                    <div className="wizard-section">
                                        <div className="wizard-question-title">Review spot prize</div>

                                        <div className="wizard-help" style={{ marginBottom: 10 }}>
                                            This prize will be awarded manually and is not based on competition results.
                                        </div>

                                        <div style={{ fontSize: 14 }}>
                                            <div>
                                                <strong>Name:</strong> {wiz.specialName}
                                            </div>

                                            {wiz.specialDescription && (
                                                <div style={{ marginTop: 6 }}>
                                                    <strong>How it’s awarded:</strong>
                                                    <br />
                                                    <span className="muted">{wiz.specialDescription}</span>
                                                </div>
                                            )}

                                            <div style={{ marginTop: 6 }}>
                                                <strong>Placings:</strong> 1
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SPECIES PRIZES ONLY */}
                                {wiz.prizeType !== "special" && (
                                    <>
                                        {/* Placings */}
                                        {wiz.award_rule === "ranked" ? (
                                            <div className="wizard-section">
                                                <div className="wizard-question-title">
                                                    How many prize placings per selected target?
                                                </div>
                                                <div className="wizard-help">e.g. 1st, 2nd, 3rd…</div>

                                                <div className="field" style={{ marginTop: 10 }}>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        step={1}
                                                        placeholder="3"
                                                        value={wiz.count === 0 ? "" : wiz.count}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            const nextVal =
                                                                raw === "" ? 0 : clampInt(Number(raw), 1);
                                                            setWiz((w) => ({ ...w, count: nextVal }));
                                                        }}
                                                        style={{ width: 90, maxWidth: "100%" }}
                                                    />
                                                </div>

                                                {wiz.count === 0 && (
                                                    <div className="wizard-help" style={{ marginTop: 8 }}>
                                                        Enter a value to generate the preview.
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="wizard-section">
                                                <div className="wizard-question-title">Placings</div>
                                                <div className="wizard-help">
                                                    “First submission” creates <strong>1 placing</strong> per
                                                    selected target (per option selected).
                                                </div>
                                            </div>
                                        )}

                                        {/* Prize preview */}
                                        <div className="wizard-section">
                                            <div className="wizard-question-title">Prize preview</div>

                                            {!wiz.award_rule ? (
                                                <div className="wizard-help">
                                                    Choose how the winner is decided to see a preview.
                                                </div>
                                            ) : selectedTargetKeys.length === 0 ? (
                                                <div className="wizard-help">
                                                    Select at least one target to generate the preview.
                                                </div>
                                            ) : wiz.award_rule === "ranked" && wiz.count < 1 ? (
                                                <div className="wizard-help">
                                                    Enter a value for prize placings to generate the preview.
                                                </div>
                                            ) : wiz.award_rule === "first" && wiz.outcomes.length === 0 ? (
                                                <div className="wizard-help">
                                                    Choose at least one “First submission” option to generate
                                                    the preview.
                                                </div>
                                            ) : (
                                                <>
                                                    {hasPreviewDuplicates && (
                                                        <div className="wizard-help" style={{ marginTop: 6 }}>
                                                            ⚠️ Some of these prizes already exist — duplicates
                                                            are blocked.
                                                        </div>
                                                    )}

                                                    <div className="wizard-help" style={{ marginTop: 6 }}>
                                                        {previewSummary}
                                                    </div>

                                                    <div
                                                        style={{
                                                            marginTop: 10,
                                                            border: "1px solid var(--border)",
                                                            borderRadius: 10,
                                                            background: "var(--muted)",
                                                            padding: 10,
                                                            maxHeight: 260,
                                                            overflow: "auto",
                                                        }}
                                                    >
                                                        {previewGroups.map((g) => (
                                                            <div key={g.id} style={{ marginBottom: 10 }}>
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: 8,
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            fontWeight: 700,
                                                                            fontSize: 13,
                                                                        }}
                                                                    >
                                                                        {g.title}
                                                                    </div>
                                                                    {g.duplicate && (
                                                                        <span
                                                                            className="muted"
                                                                            style={{
                                                                                fontSize: 12,
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            (contains existing prizes)
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div
                                                                    style={{
                                                                        marginTop: 6,
                                                                        border: "1px solid var(--border)",
                                                                        borderRadius: 8,
                                                                        background: "#fff",
                                                                    }}
                                                                >
                                                                    {g.lines.map((line, idx) => (
                                                                        <div
                                                                            key={`${g.id}:${idx}`}
                                                                            style={{
                                                                                padding: "8px 10px",
                                                                                borderBottom:
                                                                                    idx === g.lines.length - 1
                                                                                        ? "none"
                                                                                        : "1px solid var(--border)",
                                                                                fontSize: 13,
                                                                            }}
                                                                        >
                                                                            {line}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* FOOTER */}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                marginTop: 14,
                            }}
                        >
                            {/* Left side */}
                            <div>
                                {canGoBack ? (
                                    <button
                                        className="btn btn--ghost"
                                        type="button"
                                        onClick={back}
                                    >
                                        Back
                                    </button>
                                ) : (
                                    <span />
                                )}
                            </div>

                            {/* Right side */}
                            <div style={{ display: "flex", gap: 8 }}>
                                {wiz.step < 4 ? (
                                    <button
                                        className={`btn ${canProceed ? "primary" : "btn--ghost"}`}
                                        type="button"
                                        onClick={next}
                                        disabled={!canProceed}
                                    >
                                        Next
                                    </button>
                                ) : (
                                    <button
                                        className={`btn ${canProceed && !hasPreviewDuplicates
                                            ? "primary"
                                            : "btn--ghost"
                                            }`}
                                        type="button"
                                        disabled={!canProceed || hasPreviewDuplicates}
                                        onClick={() =>
                                            onApply(
                                                wiz.prizeType === "special"
                                                    ? {
                                                        ...wiz,
                                                        award_rule: "first",
                                                        count: 1,
                                                        outcomes: [],
                                                        result_method: null,
                                                    }
                                                    : wiz
                                            )
                                        }
                                    >
                                        Create prizes
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
