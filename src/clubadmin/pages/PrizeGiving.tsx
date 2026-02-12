// ============================================================================
// File: PrizeGiving.tsx
// Path: src/clubadmin/pages/PrizeGiving.tsx
// Description:
//  - Prize Giving DISPLAY MODE (MC / Live Use)
//  - Containers derived ONLY from prize configuration
//  - Competition-scoped prizes flow into final day
//  - Ordinal prize definitions (1st / 2nd / 3rd) are grouped into ONE card
//  - ✅ Live reveal: ALWAYS renders 3/2/1 slots for grouped prizes (placeholders until revealed)
//  - ✅ Correct place filling: if only 2 results exist for a 3-place prize, they fill 2nd + 1st (NOT 3rd + 2nd)
//  - ✅ Blank places (no result exists for that place) show:
//      "No Result — Draw a Spot Prize: <random_list.name>" and link to that draw
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";

import { buildPrizeGivingPdfModel } from "@/clubadmin/export/prizeGivingExport";
import { downloadPrizeGivingPdf } from "@/clubadmin/export/prizeGivingPdf";


import {
    getCompetitionBriefing,
    listCompetitionDays,
    listCompetitions,
} from "@/clubadmin/api/competitions";
import {
    listPrizeDefinitions,
    type PrizeDefinitionRow,
} from "@/clubadmin/api/competitionPrizes";

import { getRandomListForPrize } from "@/clubadmin/api/randomLists";

import {
    previewPrizeEngine,
    type PrizeEnginePreviewRow,
} from "@/clubadmin/api/prizeEngine";
import type { CompetitionBriefing, CompetitionDay } from "@/types";

import "./PrizeGivingPrint.css";

// ============================================================================
// Types
// ============================================================================

type NormalisedRandomList = {
    id: string | null;
    randomised_at: string | null;
    name: string | null; // ✅ random_list.name
};

type SpotPrizeDisplay = {
    prize: PrizeDefinitionRow;
    randomList: NormalisedRandomList;
};

type PrizeResultContainer = {
    id: string;
    label: string;
    scope_type: "briefing" | "day";
    scope_day_id: string | null;
    isFinal: boolean;
    day_start_at: Date | null;
    day_end_at: Date | null;
};

// ============================================================================
// Helpers
// ============================================================================

function getAwardedCount(prize: PrizeDefinitionRow): number {
    const match = prize.display_name.match(/\b(\d+)(st|nd|rd|th)\b/i);
    if (!match) return 1;
    const n = parseInt(match[1], 10);
    return Number.isNaN(n) || n < 1 ? 1 : n;
}

function stripOrdinal(displayName: string): string {
    return displayName.replace(/\s·\s\d+(st|nd|rd|th)\b/i, "");
}

function formatDateTimeNZ(value: string) {
    return new Date(value).toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland",
    });
}

function nowNZ(): Date {
    return new Date(
        new Date().toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })
    );
}

function dateKeyNZ(value: Date): string {
    return value.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}

function sameDayNZ(a: Date, b: Date): boolean {
    return dateKeyNZ(a) === dateKeyNZ(b);
}

function normalizeTime(value: string | null | undefined, fallback: string): string {
    const trimmed = value?.trim();
    if (!trimmed) return fallback;
    return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

function buildDayRange(day: CompetitionDay): { startAt: Date; endAt: Date } | null {
    if (!day.day_date) return null;

    const startTime = normalizeTime(day.fishing_start_time, "00:00:00");
    const endTime = normalizeTime(
        day.weighin_cutoff_time ??
        day.weighin_end_time ??
        day.fishing_end_time ??
        null,
        "23:59:59"
    );

    return {
        startAt: new Date(`${day.day_date}T${startTime}`),
        endAt: new Date(`${day.day_date}T${endTime}`),
    };
}


function findActiveContainer(
    containers: PrizeResultContainer[]
): PrizeResultContainer | null {
    const dayContainers = containers.filter(
        (c) => c.scope_type === "day" && c.scope_day_id
    );

    const dayContainersWithRange = dayContainers.filter(
        (c) => !!c.day_start_at && !!c.day_end_at
    );

    if (!dayContainersWithRange.length) return null;

    const now = nowNZ();
    const first = dayContainersWithRange[0];
    const last = dayContainersWithRange[dayContainersWithRange.length - 1];

    if (first.day_start_at && now < first.day_start_at) {
        return (
            containers.find((c) => c.scope_type === "briefing") ?? first ?? null
        );
    }

    const activeDay = dayContainersWithRange.find((c) => {
        if (!c.day_start_at || !c.day_end_at) return false;
        return (
            (now >= c.day_start_at && now <= c.day_end_at) ||
            sameDayNZ(now, c.day_start_at)
        );
    });

    if (activeDay) return activeDay;

    if (last.day_end_at && now > last.day_end_at) {
        return containers.find((c) => c.isFinal) ?? last ?? null;
    }

    return last ?? null;
}

function ordinalSuffix(n: number) {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    const mod10 = n % 10;
    if (mod10 === 1) return "st";
    if (mod10 === 2) return "nd";
    if (mod10 === 3) return "rd";
    return "th";
}

function isTaggedReleasedPrize(p: PrizeDefinitionRow): boolean {
    return /tagged\s*&\s*released/i.test(p.display_name);
}
function isHeaviestKgPrize(p: PrizeDefinitionRow): boolean {
    return /heaviest\s*\(kg\)/i.test(p.display_name);
}

function filterEngineRowsForPrize(
    prize: PrizeDefinitionRow,
    rows: PrizeEnginePreviewRow[]
): PrizeEnginePreviewRow[] {
    return rows.filter((r) => {
        const outcome = (r as any).outcome as string | null | undefined;
        const weightKg = (r as any).weight_kg as number | string | null | undefined;

        if (isTaggedReleasedPrize(prize)) {
            return outcome === "tagged_released";
        }

        if (isHeaviestKgPrize(prize)) {
            return outcome !== "tagged_released" && weightKg != null;
        }

        return true;
    });
}

function groupDeterministicPrizes(
    prizes: PrizeDefinitionRow[]
): {
    key: string;
    prize: PrizeDefinitionRow;
    awardedCount: number;
    sortOrder: number;
    isTagged: boolean;
}[] {
    const groups: Record<string, PrizeDefinitionRow[]> = {};

    for (const prize of prizes) {
        const key = stripOrdinal(prize.display_name);
        groups[key] ??= [];
        groups[key].push(prize);
    }

    const result = Object.entries(groups).map(([key, group]) => {
        const authoritative = [...group].sort(
            (a, b) => getAwardedCount(b) - getAwardedCount(a)
        )[0];

        const minSort = group.reduce(
            (min, p) => Math.min(min, p.sort_order ?? 0),
            Number.POSITIVE_INFINITY
        );

        const isTagged = group.some(isTaggedReleasedPrize);

        return {
            key,
            prize: authoritative,
            awardedCount: getAwardedCount(authoritative),
            sortOrder: Number.isFinite(minSort)
                ? minSort
                : (authoritative.sort_order ?? 0),
            isTagged,
        };
    });

    return result.sort((a, b) => {
        if (a.isTagged !== b.isTagged) return a.isTagged ? 1 : -1;
        return a.sortOrder - b.sortOrder;
    });
}

function buildStageLine(r: PrizeEnginePreviewRow): string {
    const species = r.species_name ?? "";
    const who = r.competitor_name ?? "";

    const metric =
        r.weight_kg != null
            ? `${Number(r.weight_kg).toFixed(2)} kg`
            : r.length_cm != null
                ? `${r.length_cm} cm`
                : "";

    const anglerNo =
        // @ts-expect-error - optional if present in your row type
        r.angler_number != null ? `#${String(r.angler_number)} ` : "";

    const parts = [species, metric, `${anglerNo}${who}`].filter(Boolean);
    return parts.join(" — ");
}

// ============================================================================
// Component
// ============================================================================



export default function PrizeGiving() {
    const [searchParams] = useSearchParams();
    const qpCompetitionId = searchParams.get("competitionId");

    const { organisationId } = useParams<{ organisationId: string }>();

    const [competitionId, setCompetitionId] = useState("");
    const [competitions, setCompetitions] = useState<any[]>([]);
    const [competitionDays, setCompetitionDays] = useState<CompetitionDay[]>([]);
    const [briefingAt, setBriefingAt] = useState<string | null>(null);

    const [prizeDefs, setPrizeDefs] = useState<PrizeDefinitionRow[]>([]);
    const [spotPrizes, setSpotPrizes] = useState<SpotPrizeDisplay[]>([]);

    const [printing, setPrinting] = useState(false);

    async function handlePrintPdf() {
        if (!competitionId) return;

        setPrinting(true);
        try {
            const competitionName =
                competitions.find((c: any) => c.id === competitionId)?.name ??
                "Competition";

            const fallbackSpotPrizeNameBySection: Record<string, string | null> = {};

            const model = await buildPrizeGivingPdfModel({
                competitionId,
                competitionName,
                prizeDefs,
                competitionDays,
                fallbackSpotPrizeNameBySection,
            });

            const safe = competitionName
                .replace(/[^\w\- ]+/g, "")
                .trim()
                .replace(/\s+/g, "_");

            await downloadPrizeGivingPdf(model, `${safe}_Prize_Giving.pdf`);
        } finally {
            setPrinting(false);
        }
    }


    const [resultContainers, setResultContainers] =
        useState<PrizeResultContainer[]>([]);
    const [activeContainer, setActiveContainer] =
        useState<PrizeResultContainer | null>(null);
    const [userPickedContainerId, setUserPickedContainerId] =
        useState<string | null>(null);

    const [engineRowsByPrize, setEngineRowsByPrize] = useState<
        Record<string, PrizeEnginePreviewRow[]>
    >({});

    const [revealedByGroupKey, setRevealedByGroupKey] = useState<
        Record<string, number>
    >({});

    function revealNext(key: string, maxReveal: number) {
        setRevealedByGroupKey((prev) => {
            const current = prev[key] ?? 0;
            return { ...prev, [key]: Math.min(maxReveal, current + 1) };
        });
    }

    function resetReveal(key: string) {
        setRevealedByGroupKey((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }

    function revealAll(key: string, maxReveal: number) {
        setRevealedByGroupKey((prev) => ({ ...prev, [key]: maxReveal }));
    }

    function prizeAppliesToContainer(
        prize: PrizeDefinitionRow,
        container: PrizeResultContainer
    ): boolean {
        if (container.scope_type === "briefing") {
            return prize.scope_kind === "briefing";
        }

        if (container.scope_type === "day") {
            if (prize.scope_kind === "day") {
                return prize.competition_day_id === container.scope_day_id;
            }

            if (prize.scope_kind === "competition") {
                return container.isFinal;
            }
        }

        return false;
    }

    const fallbackSpotDraw = useMemo(() => {
        if (!organisationId || !activeContainer) return null;

        const eligible = spotPrizes
            .filter(({ prize }) => prize.active && prize.prize_type === "spot")
            .filter(({ prize }) => prizeAppliesToContainer(prize, activeContainer))
            .filter(({ randomList }) => !!randomList.id && !!randomList.randomised_at);

        const first = eligible[0];
        if (!first?.randomList?.id) return null;

        return {
            url: `/clubadmin/${organisationId}/admin/random-lists/${first.randomList.id}/draw`,
            name: first.randomList.name ?? "Spot Prize",
        };
    }, [organisationId, activeContainer, spotPrizes]);

    // =====================================================================
    // Load competitions
    // =====================================================================

    useEffect(() => {
        if (!organisationId) return;

        listCompetitions(organisationId).then((data) => {
            setCompetitions(data);
            if (!competitionId && data.length > 0) {
                const fromQuery =
                    qpCompetitionId && data.some((c: any) => c.id === qpCompetitionId)
                        ? qpCompetitionId
                        : null;

                const active = data.find((c: any) => c.status === "active");
                setCompetitionId(fromQuery ?? active?.id ?? data[0].id);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organisationId, qpCompetitionId]);

    // =====================================================================
    // Load prize definitions + spot random lists
    // =====================================================================

    useEffect(() => {
        if (!competitionId) return;

        async function loadPrizes() {
            const defsRaw = await listPrizeDefinitions(competitionId);

            const defs = [...defsRaw].sort(
                (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
            );

            setPrizeDefs(defs);

            const resolved: SpotPrizeDisplay[] = [];

            for (const prize of defs.filter(
                (p) => p.prize_type === "spot" && p.active
            )) {
                const raw = await getRandomListForPrize({
                    competitionId,
                    prizeId: prize.id,
                });

                resolved.push({
                    prize,
                    randomList: raw
                        ? {
                            id: raw.id ?? null,
                            randomised_at: raw.randomised_at ?? null,
                            // @ts-expect-error - depends on return shape
                            name: raw.name ?? null,
                        }
                        : {
                            id: null,
                            randomised_at: null,
                            name: null,
                        },
                });
            }

            setSpotPrizes(resolved);
        }

        loadPrizes();
    }, [competitionId]);

    // =====================================================================
    // Load competition schedule (days + briefing)
    // =====================================================================

    useEffect(() => {
        if (!organisationId || !competitionId) return;

        const orgId = organisationId;
        const compId = competitionId;

        async function loadSchedule() {
            const [days, briefing] = await Promise.all([
                listCompetitionDays(orgId, compId),
                getCompetitionBriefing(orgId, compId),
            ]);

            setCompetitionDays(days ?? []);

            const briefingDate = (briefing as CompetitionBriefing | null)?.briefing_date;
            const briefingTime = (briefing as CompetitionBriefing | null)?.briefing_time;

            if (briefingDate) {
                const time = normalizeTime(briefingTime, "00:00:00");
                setBriefingAt(`${briefingDate}T${time}`);
                return;
            }

            setBriefingAt(null);
        }

        loadSchedule();
    }, [organisationId, competitionId]);

    useEffect(() => {
        setRevealedByGroupKey({});
    }, [competitionId, activeContainer?.id]);

    // =====================================================================
    // Build result containers (PRIZE CONFIG DRIVEN)
    // =====================================================================

    useEffect(() => {
        if (!prizeDefs.length) {
            setResultContainers([]);
            setActiveContainer(null);
            return;
        }

        const briefingExists = prizeDefs.some((p) => p.scope_kind === "briefing");
        const dayDefs = prizeDefs.filter((p) => p.scope_kind === "day");
        const competitionDefs = prizeDefs.filter((p) => p.scope_kind === "competition");

        const uniqueDayIds = Array.from(
            new Set(
                dayDefs
                    .map((p) => p.competition_day_id)
                    .filter((id): id is string => typeof id === "string" && id.length > 0)
            )
        );

        const dayRangeById = new Map<string, { startAt: Date; endAt: Date }>();

        for (const day of competitionDays) {
            if (typeof day?.id !== "string") continue;

            const range = buildDayRange(day);
            if (range) {
                dayRangeById.set(day.id, range);
            }
        }

        const orderedDays = competitionDays
            .filter((day): day is CompetitionDay & { id: string } => typeof day?.id === "string")
            .filter((day) => uniqueDayIds.includes(day.id));

        const containers: PrizeResultContainer[] = [];

        if (briefingExists) {
            containers.push({
                id: "briefing",
                label: "Briefing",
                scope_type: "briefing",
                scope_day_id: null,
                isFinal: false,
                day_start_at: null,
                day_end_at: null,
            });
        }

        if (orderedDays.length > 0) {
            orderedDays.forEach((day, idx) => {
                const dayId = day.id;
                if (!dayId) return;

                const range = dayRangeById.get(dayId) ?? null;

                containers.push({
                    id: `day-${dayId}`,
                    label: `Day ${idx + 1}`,
                    scope_type: "day",
                    scope_day_id: dayId,
                    isFinal: false,
                    day_start_at: range?.startAt ?? null,
                    day_end_at: range?.endAt ?? null,
                });
            });
        } else {
            uniqueDayIds.forEach((dayId, idx) => {
                const range = dayRangeById.get(dayId) ?? null;

                containers.push({
                    id: `day-${dayId}`,
                    label: `Day ${idx + 1}`,
                    scope_type: "day",
                    scope_day_id: dayId,
                    isFinal: false,
                    day_start_at: range?.startAt ?? null,
                    day_end_at: range?.endAt ?? null,
                });
            });
        }

        if (containers.length === 0 && competitionDefs.length > 0) {
            containers.push({
                id: "final",
                label: "Prize Giving",
                scope_type: "day",
                scope_day_id: null,
                isFinal: true,
                day_start_at: null,
                day_end_at: null,
            });
        }

        if (competitionDefs.length > 0 && containers.length > 0) {
            containers[containers.length - 1].isFinal = true;
        }

        setResultContainers(containers);

        setActiveContainer((prev) => {
            if (!containers.length) return null;

            if (userPickedContainerId) {
                return (
                    containers.find((c) => c.id === userPickedContainerId) ?? prev ?? null
                );
            }

            const timeAware = findActiveContainer(containers);
            if (timeAware) return timeAware;

            const final = containers.find((c) => c.isFinal);
            return final ?? containers[0];
        });
    }, [prizeDefs, competitionDays, briefingAt, userPickedContainerId]);

    // =====================================================================
    // Load deterministic (engine) results for ACTIVE container
    // =====================================================================

    useEffect(() => {
        if (!competitionId || !activeContainer) return;

        const container = activeContainer;

        async function loadEngine() {
            const rows: Record<string, PrizeEnginePreviewRow[]> = {};

            for (const prize of prizeDefs.filter(
                (p) => p.prize_type !== "spot" && p.active
            )) {
                if (container.scope_type === "briefing") {
                    if (prize.scope_kind !== "briefing") continue;
                }

                if (container.scope_type === "day") {
                    if (
                        prize.scope_kind === "day" &&
                        prize.competition_day_id !== container.scope_day_id
                    ) {
                        continue;
                    }

                    if (prize.scope_kind === "competition" && !container.isFinal) {
                        continue;
                    }
                }

                const raw = await previewPrizeEngine(competitionId, prize.id);
                rows[prize.id] = filterEngineRowsForPrize(prize, raw);
            }

            setEngineRowsByPrize(rows);
        }

        loadEngine();
    }, [competitionId, activeContainer, prizeDefs]);

    // =====================================================================
    // Render
    // =====================================================================

    return (
        <section className="card prize-giving">
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 8,
                }}
            >
                <h2 style={{ margin: 0 }}>Prize Giving</h2>

                <select
                    value={competitionId}
                    onChange={(e) => setCompetitionId(e.target.value)}
                    style={{
                        width: 360,
                        maxWidth: "100%",
                        marginLeft: "auto",
                    }}
                >
                    <option value="">-- Select Competition --</option>
                    {competitions.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </div>


            {resultContainers.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 8,
                    }}
                >
                    {/* Tabs (left) */}
                    <div
                        className="result-container-tabs"
                        style={{
                            marginTop: 0,
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                        }}
                    >
                        {/* Briefing (with gap before days) */}
                        {resultContainers
                            .filter((c) => c.scope_type === "briefing")
                            .map((c) => (
                                <button
                                    key={c.id}
                                    className={activeContainer?.id === c.id ? "btn primary" : "btn"}
                                    onClick={() => {
                                        setUserPickedContainerId(c.id);
                                        setActiveContainer(c);
                                    }}
                                    style={{ marginRight: 14 }} // ✅ spacer between Briefing and Days
                                >
                                    {c.label}
                                </button>
                            ))}

                        {/* Days */}
                        {resultContainers
                            .filter((c) => c.scope_type !== "briefing")
                            .map((c) => (
                                <button
                                    key={c.id}
                                    className={activeContainer?.id === c.id ? "btn primary" : "btn"}
                                    onClick={() => {
                                        setUserPickedContainerId(c.id);
                                        setActiveContainer(c);
                                    }}
                                >
                                    {c.label}
                                </button>
                            ))}
                    </div>



                    {/* Boat Points (right, inline with tabs) */}
                    {organisationId && competitionId && (
                        <Link
                            className="btn"
                            to={`/clubadmin/${organisationId}/boat-points?from=prize-giving&competitionId=${competitionId}${activeContainer?.scope_type === "day" && activeContainer.scope_day_id
                                    ? `&dayId=${activeContainer.scope_day_id}`
                                    : ""
                                }`}
                            title="View Boat Points"
                            style={{ whiteSpace: "nowrap" }}
                        >
                            Boat Points
                        </Link>
                    )}

                    <button
                        type="button"
                        className="btn"
                        onClick={handlePrintPdf}
                        disabled={printing || !competitionId}
                    >
                        {printing ? "Generating…" : "Print (PDF)"}
                    </button>



                </div>
            )}

            {activeContainer && (
                <section style={{ marginTop: 24 }}>
                    <h3>{activeContainer.label}</h3>

                    <div className="prize-stack-card">


                        {/* ===============================
    🎰 SPOT PRIZES
   =============================== */}
                        {(() => {
                            const spotForContainer = spotPrizes
                                .filter(({ prize }) => {
                                    if (activeContainer.scope_type === "briefing") {
                                        return prize.scope_kind === "briefing";
                                    }

                                    if (activeContainer.scope_type === "day") {
                                        if (prize.scope_kind === "day") {
                                            return prize.competition_day_id === activeContainer.scope_day_id;
                                        }

                                        return prize.scope_kind === "competition" && activeContainer.isFinal;
                                    }

                                    return false;
                                })
                                // ✅ enforce DB sort order for spot prizes
                                .sort((a, b) => (a.prize.sort_order ?? 0) - (b.prize.sort_order ?? 0));

                            if (spotForContainer.length === 0) return null;

                            return (
                                <div style={{ marginTop: 12 }}>
                                    {spotForContainer.map(({ prize, randomList }) => {
                                        const canDraw = !!randomList?.id && !!randomList?.randomised_at;

                                        return (
                                            <div key={prize.id} className="prize-card prize-card--spot">
                                                <div
                                                    className="prize-card-header"
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        gap: 12,
                                                    }}
                                                >
                                                    <div style={{ minWidth: 0 }}>
                                                        <strong>{prize.display_name}</strong>

                                                        <div className="muted" style={{ marginTop: 4 }}>
                                                            Rule: {prize.award_rule}
                                                        </div>

                                                        {randomList?.name ? (
                                                            <div className="muted" style={{ marginTop: 4 }}>
                                                                List: {randomList.name}
                                                            </div>
                                                        ) : (
                                                            <div className="muted" style={{ marginTop: 4 }}>
                                                                List: (not linked)
                                                            </div>
                                                        )}
                                                    </div>

                                                    {canDraw ? (
                                                        <Link
                                                            className="btn btn-primary"
                                                            to={`/clubadmin/${organisationId}/admin/random-lists/${randomList.id}/draw`}
                                                            style={{ whiteSpace: "nowrap" }}
                                                        >
                                                            🎉 Start live draw
                                                        </Link>
                                                    ) : (
                                                        <span className="muted" style={{ whiteSpace: "nowrap" }}>
                                                            ⏳ Not randomised
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}



                        {/* ===============================
   🏆 DETERMINISTIC PRIZES (GROUPED + STAGE REVEAL)
   =============================== */}
                        {groupDeterministicPrizes(
                            prizeDefs.filter(
                                (p) =>
                                    p.prize_type !== "spot" &&
                                    p.active &&
                                    activeContainer &&
                                    prizeAppliesToContainer(p, activeContainer)
                            )
                        ).map(({ key, prize, awardedCount }) => {
                            const rows = engineRowsByPrize[prize.id] ?? [];

                            // How many results actually exist right now for this prize
                            const availableCount = Math.min(awardedCount, rows.length);

                            // Best-first winners (index 0 => 1st, 1 => 2nd, 2 => 3rd)
                            const bestFirst = rows.slice(0, availableCount);

                            // Reveal progress is based on availableCount (not awardedCount)
                            const revealed = revealedByGroupKey[key] ?? 0;
                            const maxReveal = availableCount;

                            const nextPlace = maxReveal - revealed;
                            const nextLabel = revealed >= maxReveal ? "All revealed" : `Reveal #${nextPlace}`;

                            const activePlace = revealed > 0 ? maxReveal - (revealed - 1) : null;

                            return (
                                <div key={key} className="prize-card" style={{ marginTop: 12 }}>
                                    <div
                                        style={{
                                            padding: "12px 16px",
                                            fontWeight: 700,
                                            background: "#f8fafc",
                                            borderRadius: 8,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 12,
                                        }}
                                    >
                                        <div>
                                            {key}
                                            <div className="muted">Rule: {prize.award_rule}</div>
                                        </div>

                                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <button
                                                className="btn btn-primary"
                                                disabled={revealed >= maxReveal || maxReveal === 0}
                                                onClick={() => revealNext(key, maxReveal)}
                                            >
                                                {maxReveal === 0 ? "No results" : nextLabel}
                                            </button>

                                            <button
                                                className="btn btn-secondary"
                                                disabled={revealed === 0}
                                                onClick={() => resetReveal(key)}
                                            >
                                                Reset
                                            </button>

                                            <button
                                                className="btn btn-secondary"
                                                disabled={revealed >= maxReveal || maxReveal === 0}
                                                onClick={() => revealAll(key, maxReveal)}
                                            >
                                                Reveal all
                                            </button>
                                        </div>
                                    </div>

                                    {/* ALWAYS render slots: 3/2/1 if awardedCount=3 (or 1 slot if awardedCount=1) */}
                                    <div className="prize-reveal-stack">
                                        {Array.from({ length: awardedCount }).map((_, idx) => {
                                            const place = awardedCount - idx;

                                            // Only places <= availableCount have an actual result
                                            const hasResultForPlace = place <= availableCount;

                                            const rowForPlace = hasResultForPlace ? bestFirst[place - 1] : undefined;

                                            // Reveal progresses from "lowest available place" up to 1st.
                                            const revealStepForPlace = hasResultForPlace ? availableCount - place + 1 : null;

                                            const isRevealed =
                                                hasResultForPlace && revealStepForPlace != null && revealed >= revealStepForPlace;

                                            const isActive = isRevealed && activePlace != null && place === activePlace;

                                            // ✅ BLANK PLACE (no result): show ONE clean link label (no duplicate name)
                                            if (!hasResultForPlace) {
                                                const spotNameRaw = fallbackSpotDraw?.name ?? null;
                                                const spotName =
                                                    spotNameRaw &&
                                                        spotNameRaw.trim() &&
                                                        spotNameRaw.trim().toLowerCase() !== "spot prize"
                                                        ? spotNameRaw.trim()
                                                        : null;

                                                const linkLabel = spotName ? `Draw Spot Prize: ${spotName}` : "Draw a Spot Prize";

                                                return (
                                                    <div key={`${key}-place-${place}`} className="prize-reveal-row">
                                                        <div className="prize-reveal-line1">
                                                            {place}
                                                            {ordinalSuffix(place)} — No Result
                                                        </div>

                                                        <div className="prize-reveal-winner">
                                                            {fallbackSpotDraw?.url ? (
                                                                <Link to={fallbackSpotDraw.url} className="prize-reveal-link">
                                                                    {linkLabel}
                                                                </Link>
                                                            ) : (
                                                                <span className="prize-reveal-link prize-reveal-link--disabled">
                                                                    {linkLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }



                                            // Normal reveal behaviour for places that DO have a result
                                            // We want the winner name ALWAYS on line 2.
                                            // So we render line1 + winner separately.

                                            const stage = rowForPlace ? buildStageLine(rowForPlace) : "…";

                                            // If your buildStageLine returns something like:
                                            // "Black Marlin — 34.00 kg — Kelly Lindsay"
                                            // split on the LAST "—" so the winner is always the final segment.
                                            const splitStageLine = (s: string) => {
                                                const i = s.lastIndexOf("—");
                                                if (i === -1) return { left: s.trim(), winner: "" };
                                                return {
                                                    left: s.slice(0, i).trim(),
                                                    winner: s.slice(i + 1).trim(),
                                                };
                                            };

                                            const { left, winner } = splitStageLine(stage);

                                            const line1 = isRevealed
                                                ? `${place}${ordinalSuffix(place)} — ${left}`
                                                : `${place}${ordinalSuffix(place)} — …`;

                                            const winnerLine = isRevealed ? winner : "";

                                            return (
                                                <div
                                                    key={`${key}-place-${place}`}
                                                    className={
                                                        isActive ? "prize-reveal-row prize-reveal-row--active" : "prize-reveal-row"
                                                    }
                                                >
                                                    <div className="prize-reveal-line1">{line1}</div>
                                                    <div className="prize-reveal-winner">{winnerLine}</div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Optional hint if nothing qualifies yet */}
                                    {availableCount === 0 && (
                                        <div style={{ padding: "0 16px 16px 16px" }} className="muted">
                                            No qualifying results yet.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </section>
    );
}