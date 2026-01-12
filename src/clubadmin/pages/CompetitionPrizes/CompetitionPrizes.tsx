// ============================================================================
// File: CompetitionPrizes.tsx
// Description:
// Prizes tab — DB-driven via competition_prize_definition
// - Single top card controls (dropdowns + Add Prize)
// - Wizard creates prize definitions -> API insert -> refetch -> list
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import type { Competition, CompetitionDay } from "@/types";
import type { Division as ApiDivision } from "@/clubadmin/api/divisions";

import {
    listCompetitionSpecies,
    type CompetitionSpecies,
    type FishType,
} from "@/clubadmin/api/species";

import PrizeWizardModal, {
    defaultPrizeWizardState,
    type PrizeWizardState,
} from "./PrizeWizardModal";

import { buildWizardContext } from "@/clubadmin/api/buildWizardContext";
import type { WizardContext } from "@/clubadmin/api/WizardContext";

// ✅ New API module (you said you have this file ready)
import {
    listPrizeDefinitions,
    createPrizeDefinitions,
    setPrizeDefinitionActive,
    type PrizeDefinitionRow,
    type ScopeKind,
} from "@/clubadmin/api/competitionPrizes";

import FeedbackModal from "@/components/FeedbackModal";



// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------
type Props = {
    embedded?: boolean;
    competition: Competition;
    days: CompetitionDay[];
    divisions: ApiDivision[];
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
const uid = () =>
    (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

function nowIso() {
    return new Date().toISOString();
}

function ordinal(n: number) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function safeTrim(s?: string | null) {
    const t = (s ?? "").trim();
    return t ? t : null;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export default function CompetitionPrizes({
    embedded = false,
    competition,
    days,
    divisions,
}: Props) {
    // ------------------------------------------------------------------------
    // Species / Fish types (for wizard + display name generation)
    // ------------------------------------------------------------------------
    const [fishTypes, setFishTypes] = useState<FishType[]>([]);
    const [allSpecies, setAllSpecies] = useState<CompetitionSpecies[]>([]);

    const speciesReady = allSpecies.length > 0;


    useEffect(() => {
        let alive = true;

        async function load() {
            const species = await listCompetitionSpecies(competition.id);
            if (!alive) return;

            setAllSpecies(species);

            const map = new Map<string, FishType>();
            for (const s of species) {
                if (!map.has(s.fish_type_id)) {
                    map.set(s.fish_type_id, {
                        fish_type_id: s.fish_type_id,
                        name: s.fish_type_name,
                    });
                }
            }
            setFishTypes(Array.from(map.values()));
        }

        load();
        return () => {
            alive = false;
        };
    }, [competition.id]);


    // ------------------------------------------------------------------------
    // Wizard context (as per your existing modal)
    // ------------------------------------------------------------------------
    const wizardContext: WizardContext = useMemo(
        () =>
            buildWizardContext({
                competition,
                divisions: divisions.map((d) => ({ ...d, is_default: false })),
            }),
        [competition, divisions]
    );

    // ------------------------------------------------------------------------
    // Scope dropdown state (simple)
    // ------------------------------------------------------------------------
    const initialScope: { scope: ScopeKind; dayId: string | null } =
        days.length === 1
            ? { scope: "day", dayId: days[0].id }
            : { scope: "competition", dayId: null };

    const [scopeKind, setScopeKind] = useState<ScopeKind>(initialScope.scope);
    const [selectedDayId, setSelectedDayId] = useState<string | null>(initialScope.dayId);
    const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);

    useEffect(() => {
        if (scopeKind !== "day") {
            if (selectedDayId !== null) setSelectedDayId(null);
            return;
        }
        if (!selectedDayId) setSelectedDayId(days[0]?.id ?? null);
    }, [scopeKind, selectedDayId, days]);



    // ------------------------------------------------------------------------
    // Prize definitions list
    // ------------------------------------------------------------------------
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<PrizeDefinitionRow[]>([]);

    // Feedback modal (success messages)
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    // Confirm remove modal
    const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
    const [pendingRemove, setPendingRemove] = useState<PrizeDefinitionRow | null>(null);



    // Filters
    const [q, setQ] = useState("");
    const [filterScope, setFilterScope] = useState<"all" | ScopeKind>("all");
    const [filterType, setFilterType] = useState<"all" | "species" | "spot">("all");
    const [filterDivision, setFilterDivision] = useState<"all" | "none" | string>("all");
    const [filterStatus, setFilterStatus] = useState<"active" | "inactive" | "all">("active");

    async function refetch() {
        setLoading(true);
        setError(null);
        try {
            const data = await listPrizeDefinitions(competition.id);
            setRows(data);
        } catch (e: any) {
            setError(e?.message || "Failed to load prize definitions");
        } finally {
            setLoading(false);
        }
    }

    // ✅ initial load / competition change
    useEffect(() => {
        void refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [competition.id]);

   

    // ------------------------------------------------------------------------
    // Wizard modal state
    // ------------------------------------------------------------------------
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wiz, setWiz] = useState<PrizeWizardState>(() =>
        defaultPrizeWizardState({ singleFishTypeId: null, defaultCount: 3 })
    );

    // ------------------------------------------------------------------------
    // Display-name generation (stored into display_name)
    // ------------------------------------------------------------------------
    function getDayLabel(dayId: string | null) {
        if (!dayId) return null;
        const idx = days.findIndex((d) => d.id === dayId);
        return idx >= 0 ? `Day ${idx + 1}` : "Day";
    }

    function getDivisionLabel(divisionId: string | null) {
        if (!divisionId) return null;
        return divisions.find((d) => d.id === divisionId)?.name ?? "Division";
    }

    function buildDisplayName(p: Pick<
        PrizeDefinitionRow,
        | "scope_kind"
        | "competition_day_id"
        | "division_id"
        | "prize_type"
        | "target_kind"
        | "species_id"
        | "species_category_id"
        | "spot_label"
        | "award_rule"
        | "result_method"
        | "place"
        | "outcome_filter"
        | "priority_timestamp_source"
    >) {
        const chunks: string[] = [];

        // Scope
        if (p.scope_kind === "competition") chunks.push("Competition");
        else if (p.scope_kind === "briefing") chunks.push("Briefing");
        else chunks.push(getDayLabel(p.competition_day_id) ?? "Day");

        // Division
        const div = getDivisionLabel(p.division_id);
        if (div) chunks.push(div);

        // Target
        if (p.prize_type === "spot") {
            chunks.push(p.spot_label || "Spot prize");
        } else if (p.target_kind === "species" && p.species_id != null) {
            const s = allSpecies.find((x) => x.id === p.species_id);
            chunks.push(s?.name ?? `Species #${p.species_id}`);
        } else if (p.target_kind === "species_category" && p.species_category_id) {
            const sample = allSpecies.find((x) => x.species_category_id === p.species_category_id);
            chunks.push(sample?.species_category?.name ?? "Species category");
        } else {
            chunks.push("Prize");
        }

        // Rule
        if (p.prize_type === "spot") {
            chunks.push("Spot");
        } else if (p.award_rule === "first") {
            let firstBy = "First";
            if (p.priority_timestamp_source === "weighin_at") firstBy = "First (weigh-in)";
            else if (p.priority_timestamp_source === "time_caught") firstBy = "First (caught)";
            else if (p.priority_timestamp_source === "created_at") firstBy = "First (submitted)";
            chunks.push(firstBy);
        } else {
            const methodLabel = p.result_method === "measured" ? "Longest (cm)" : "Heaviest (kg)";
            chunks.push(methodLabel);
            chunks.push(ordinal(p.place));
        }

        if (p.outcome_filter && p.outcome_filter !== "any") {
            chunks.push(p.outcome_filter === "tagged_released" ? "Tagged & released" : "Landed");
        }

        return chunks.join(" · ");
    }

    // ------------------------------------------------------------------------
    // Wizard apply -> map wizard state to DB rows -> API create -> refetch
    // ------------------------------------------------------------------------
    async function handleWizardApply(state: PrizeWizardState) {
        setSaving(true);
        setError(null);

        try {
            const baseSort =
                rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1 : 0;

            const createdAt = nowIso();
            const next: PrizeDefinitionRow[] = [];

            const scope_kind: ScopeKind = scopeKind;
            const competition_day_id = scope_kind === "day" ? selectedDayId : null;
            const division_id = selectedDivisionId;

            // --------------------------
            // Spot / Special
            // --------------------------
            if (state.prizeType === "special") {
                const spot = safeTrim(state.specialName) ?? "Spot prize";

                const row: PrizeDefinitionRow = {
                    id: uid(),
                    competition_id: competition.id,

                    scope_kind,
                    competition_day_id,
                    division_id,

                    prize_type: "spot",
                    target_kind: "spot",

                    species_id: null,
                    species_category_id: null,
                    spot_label: spot,

                    result_method: null,
                    award_rule: "first",
                    place: 1,

                    outcome_filter: "any",
                    min_weight_kg: null,
                    min_length_cm: null,
                    priority_timestamp_source: "created_at",

                    display_name: "", // set below
                    description: safeTrim(state.specialDescription),

                    sort_order: baseSort,
                    active: true,

                    created_at: createdAt,
                    updated_at: createdAt,
                };

                row.display_name = buildDisplayName(row);
                next.push(row);

                await createPrizeDefinitions(competition.id, next);
                setWizardOpen(false);
                await refetch();
                return;
            }

            


            // --------------------------
            // Species / Category targets
            // --------------------------
            const outcomeSet = (state.outcomes?.length ? state.outcomes : ["any"]) as Array<
                "any" | "landed" | "tagged_released"
            >;


            function resolveTarget(key: string): {
                target_kind: "species" | "species_category";
                species_id: number | null;
                species_category_id: string | null;
            } | null {
                if (key.startsWith("s:")) {
                    const id = Number(key.slice(2));
                    if (!Number.isFinite(id)) return null;
                    const s = allSpecies.find((x) => x.id === id);
                    if (!s) return null;

                    return { target_kind: "species", species_id: id, species_category_id: null };
                }

                if (key.startsWith("g:")) {
                    const catId = key.slice(2);
                    const sample = allSpecies.find((x) => x.species_category_id === catId);
                    if (!sample) return null;

                    return { target_kind: "species_category", species_id: null, species_category_id: catId };
                }

                return null;
            }

            let sortCursor = baseSort;

            for (const key of state.selectedKeys) {
                const target = resolveTarget(key);
                if (!target) continue;

                // FIRST prizes: one per outcome
                if (state.award_rule === "first") {
                    for (const outcome of outcomeSet) {
                        const row: PrizeDefinitionRow = {
                            id: uid(),
                            competition_id: competition.id,

                            scope_kind,
                            competition_day_id,
                            division_id,

                            prize_type: "species",
                            target_kind: target.target_kind,

                            species_id: target.species_id,
                            species_category_id: target.species_category_id,
                            spot_label: null,

                            result_method: null,
                            award_rule: "first",
                            place: 1,

                            outcome_filter: outcome ?? "any",
                            min_weight_kg: null,
                            min_length_cm: null,
                            priority_timestamp_source: "created_at",

                            display_name: "",
                            description: null,

                            sort_order: sortCursor++,
                            active: true,

                            created_at: createdAt,
                            updated_at: createdAt,
                        };

                        row.display_name = buildDisplayName(row);
                        next.push(row);
                    }
                    continue;
                }

                // RANKED prizes: place 1..N
                const count = Math.max(1, state.count ?? 1);

                // If multiple outcomes selected, keep ranked as "any" for now (avoids exploding rows)
                const rankedOutcome =
                    outcomeSet.length === 1 ? (outcomeSet[0] ?? "any") : "any";

                for (let place = 1; place <= count; place++) {
                    const row: PrizeDefinitionRow = {
                        id: uid(),
                        competition_id: competition.id,

                        scope_kind,
                        competition_day_id,
                        division_id,

                        prize_type: "species",
                        target_kind: target.target_kind,

                        species_id: target.species_id,
                        species_category_id: target.species_category_id,
                        spot_label: null,

                        result_method: state.result_method ?? "weighed",
                        award_rule: "ranked",
                        place,

                        outcome_filter: rankedOutcome,
                        min_weight_kg: null,
                        min_length_cm: null,
                        priority_timestamp_source: null,

                        display_name: "",
                        description: null,

                        sort_order: sortCursor++,
                        active: true,

                        created_at: createdAt,
                        updated_at: createdAt,
                    };

                    row.display_name = buildDisplayName(row);
                    next.push(row);
                }
            }

            if (!next.length) {
                setError("No prizes created (nothing selected).");
                return;
            }

            await createPrizeDefinitions(competition.id, next);
            setWizardOpen(false);
            await refetch();
        } catch (e: any) {
            setError(e?.message || "Failed to save prize definitions");
        } finally {
            setSaving(false);
        }
    }

    function handleRemove(row: PrizeDefinitionRow) {
        setPendingRemove(row);
        setConfirmRemoveOpen(true);
    }

    async function confirmRemove() {
        if (!pendingRemove) return;

        setSaving(true);
        setError(null);
        try {
            await setPrizeDefinitionActive(competition.id, pendingRemove.id, false);
            await refetch();

            setFeedbackMessage("Prize removed successfully.");
        } catch (e: any) {
            setError(e?.message || "Failed to remove prize definition");
        } finally {
            setSaving(false);
            setConfirmRemoveOpen(false);
            setPendingRemove(null);
        }
    }



    const filteredRows = useMemo(() => {
        const needle = q.trim().toLowerCase();

        const filtered = rows.filter((r) => {
            // Status
            if (filterStatus === "active" && !r.active) return false;
            if (filterStatus === "inactive" && r.active) return false;

            // Scope
            if (filterScope !== "all" && r.scope_kind !== filterScope) return false;

            // Type
            if (filterType !== "all" && r.prize_type !== filterType) return false;

            // Division
            if (filterDivision === "none") {
                if (r.division_id != null) return false;
            } else if (filterDivision !== "all") {
                if (r.division_id !== filterDivision) return false;
            }

            // Search
            if (needle) {
                const hay = [
                    r.display_name ?? "",
                    r.description ?? "",
                    r.spot_label ?? "",
                    r.prize_type ?? "",
                    r.target_kind ?? "",
                    r.scope_kind ?? "",
                    r.division_id ?? "",
                    r.competition_day_id ?? "",
                    r.species_id != null ? String(r.species_id) : "",
                    r.species_category_id ?? "",
                ]
                    .join(" ")
                    .toLowerCase();

                if (!hay.includes(needle)) return false;
            }

            return true;
        });

        // Sort AFTER filtering (faster) and make it deterministic
        return filtered.sort((a, b) => {
            const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
            const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
            if (ao !== bo) return ao - bo;

            const an = (a.display_name ?? "").localeCompare(b.display_name ?? "");
            if (an !== 0) return an;

            // final stable tie-break
            return (a.id ?? "").localeCompare(b.id ?? "");
        });
    }, [rows, q, filterScope, filterType, filterDivision, filterStatus]);


    // ------------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------------
    const scopeOptions = [
        { value: "competition" as const, label: "Competition" },
        ...(competition.briefing_required ? [{ value: "briefing" as const, label: "Briefing" }] : []),
        { value: "day" as const, label: "Day" },
    ];

    const content = (
        <>
            {feedbackMessage && (
                <FeedbackModal
                    message={feedbackMessage}
                    onClose={() => setFeedbackMessage(null)}
                />
            )}
            {confirmRemoveOpen && pendingRemove && (
                <div className="modal-backdrop">
                    <div className="modal card">
                        <h3>Remove prize</h3>

                        <p>Are you sure you want to remove this prize?</p>

                        <p className="muted" style={{ marginTop: 8 }}>
                            {pendingRemove.display_name}
                        </p>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn btn--ghost"
                                disabled={saving}
                                onClick={() => {
                                    setConfirmRemoveOpen(false);
                                    setPendingRemove(null);
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="btn danger"
                                disabled={saving}
                                onClick={confirmRemove}
                            >
                                {saving ? "Removing…" : "Remove"}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Single top card: dropdowns + add */}
            <section className="card" style={{ marginBottom: 12 }}>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ minWidth: 180 }}>
                        <label className="muted" style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
                            Applies to
                        </label>
                        <select
                            className="input"
                            value={scopeKind}
                            onChange={(e) => setScopeKind(e.target.value as ScopeKind)}
                            disabled={saving}
                        >
                            {scopeOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {scopeKind === "day" && (
                        <div style={{ minWidth: 180 }}>
                            <label className="muted" style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
                                Day
                            </label>
                            <select
                                className="input"
                                value={selectedDayId ?? ""}
                                onChange={(e) => setSelectedDayId(e.target.value || null)}
                                disabled={saving}
                            >
                                {days.map((d, i) => (
                                    <option key={d.id} value={d.id}>
                                        Day {i + 1}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div style={{ minWidth: 220 }}>
                        <label className="muted" style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
                            Division
                        </label>
                        <select
                            className="input"
                            value={selectedDivisionId ?? ""}
                            onChange={(e) => setSelectedDivisionId(e.target.value || null)}
                            disabled={saving}
                        >
                            <option value="">All divisions</option>
                            {divisions.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <button className="btn" onClick={() => refetch()} disabled={loading || saving}>
                            Refresh
                        </button>

                        <button
                            className="btn primary"
                            disabled={
                                saving ||
                                loading ||
                                !speciesReady ||
                                (scopeKind === "day" && !selectedDayId)
                            }
                            onClick={() => {
                                setWiz(
                                    defaultPrizeWizardState({
                                        singleFishTypeId: fishTypes.length === 1 ? fishTypes[0].fish_type_id : null,
                                        defaultCount: 3,
                                    })
                                );
                                setWizardOpen(true);
                            }}
                        >
                            Add prize
                        </button>
                    </div>
                </div>


                <p className="muted" style={{ marginTop: 10 }}>
                    Wizard will create prize definitions for:{" "}
                    <strong>
                        {scopeKind === "competition"
                            ? "Competition"
                            : scopeKind === "briefing"
                                ? "Briefing"
                                : getDayLabel(selectedDayId) ?? "Day"}
                        {selectedDivisionId ? ` · ${getDivisionLabel(selectedDivisionId)}` : ""}
                    </strong>
                </p>
            </section>

            {/* Simple list (no nested cards/containers) */}
            <section className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0 }}>Prize definitions</h3>
                    <span className="muted" style={{ fontSize: 12 }}>
                        {filteredRows.filter((r) => r.active).length} active / {filteredRows.length} shown
                        {" · "}
                        {rows.length} total
                    </span>
                </div>
                {/* Filters */}
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Row 1: Search (3/4) + Status (1/4) */}
                    <div style={{ display: "flex", gap: 10 }}>
                        <input
                            className="input"
                            style={{ flex: 3, minWidth: 240 }}
                            placeholder="Search prize definitions…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            disabled={loading || saving}
                        />

                        <select
                            className="input"
                            style={{ flex: 1, minWidth: 160 }}
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            disabled={loading || saving}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="all">All</option>
                        </select>
                    </div>

                    {/* Row 2: Type (50%) + Division (50%) */}
                    <div style={{ display: "flex", gap: 10 }}>
                        <select
                            className="input"
                            style={{ flex: 1, minWidth: 200 }}
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            disabled={loading || saving}
                        >
                            <option value="all">All types</option>
                            <option value="species">Species</option>
                            <option value="spot">Spot</option>
                        </select>

                        <select
                            className="input"
                            style={{ flex: 1, minWidth: 220 }}
                            value={filterDivision}
                            onChange={(e) => setFilterDivision(e.target.value as any)}
                            disabled={loading || saving}
                        >
                            <option value="all">All divisions</option>
                            <option value="none">No division</option>
                            {divisions.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Row 3: Scope + Reset */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <select
                            className="input"
                            style={{ flex: 1, minWidth: 220 }}
                            value={filterScope}
                            onChange={(e) => setFilterScope(e.target.value as any)}
                            disabled={loading || saving}
                        >
                            <option value="all">All scopes</option>
                            <option value="competition">Competition</option>
                            {competition.briefing_required && <option value="briefing">Briefing</option>}
                            <option value="day">Day</option>
                        </select>

                        <button
                            className="btn"
                            disabled={loading || saving}
                            onClick={() => {
                                setQ("");
                                setFilterScope("all");
                                setFilterType("all");
                                setFilterDivision("all");
                                setFilterStatus("active");
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </div>




                {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}

                {/* Body */}
                {loading ? (
                    <p className="muted" style={{ marginTop: 12 }}>Loading…</p>
                ) : rows.length === 0 ? (
                    <p className="muted" style={{ marginTop: 12 }}>
                        No prize definitions yet. Use <strong>Add prize</strong> to create them.
                    </p>
                ) : filteredRows.length === 0 ? (
                    <p className="muted" style={{ marginTop: 12 }}>
                        No matches for the current filters. Try clearing search/filters.
                    </p>
                ) : (
                    <div style={{ marginTop: 12, overflowX: "auto" }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: 70 }}>Order</th>
                                    <th>Description</th>
                                    <th style={{ width: 130 }}>Scope</th>
                                    <th style={{ width: 120 }}>Type</th>
                                    <th style={{ width: 90 }}>Place</th>
                                    <th style={{ width: 90 }}>Active</th>
                                    <th style={{ width: 130 }}>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredRows.map((r) => (
                                    <tr key={r.id} style={!r.active ? { opacity: 0.55 } : undefined}>
                                        <td>{r.sort_order}</td>

                                        <td>
                                            <div style={{ fontWeight: 600 }}>{r.display_name}</div>
                                            {r.description && (
                                                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                                                    {r.description}
                                                </div>
                                            )}
                                        </td>

                                        <td>
                                            {r.scope_kind === "competition"
                                                ? "Competition"
                                                : r.scope_kind === "briefing"
                                                    ? "Briefing"
                                                    : getDayLabel(r.competition_day_id) ?? "Day"}
                                        </td>

                                        <td>{r.prize_type}</td>

                                        <td>{r.award_rule === "ranked" ? ordinal(r.place) : "—"}</td>

                                        <td>{r.active ? "Active" : "Inactive"}</td>

                                        <td>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                {r.active ? (
                                                    <button
                                                        className="btn btn--sm"
                                                        disabled={saving}
                                                        onClick={() => handleRemove(r)}
                                                        title="Deactivate (soft remove)"
                                                    >
                                                        Remove
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn btn--sm"
                                                        disabled={saving}
                                                        onClick={async () => {
                                                            setSaving(true);
                                                            setError(null);
                                                            try {
                                                                await setPrizeDefinitionActive(competition.id, r.id, true);
                                                                await refetch();
                                                            } catch (e: any) {
                                                                setError(e?.message || "Failed to restore prize definition");
                                                            } finally {
                                                                setSaving(false);
                                                            }
                                                        }}
                                                        title="Restore (make active again)"
                                                    >
                                                        Restore
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>


            <PrizeWizardModal
                open={wizardOpen}
                wiz={wiz}
                setWiz={setWiz}
                context={wizardContext}
                fishTypes={fishTypes}
                allSpecies={allSpecies}
                onClose={() => setWizardOpen(false)}
                onApply={handleWizardApply}
            />
        </>
    );

    if (embedded) return content;

    return (
        <section className="card admin-card">
            <h2>Prizes</h2>
            {content}
        </section>
    );
}
