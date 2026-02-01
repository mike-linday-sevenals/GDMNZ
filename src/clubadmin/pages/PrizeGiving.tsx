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
import { useParams, Link } from "react-router-dom";

import { listCompetitions } from "@/clubadmin/api/competitions";
import {
    listPrizeDefinitions,
    type PrizeDefinitionRow,
} from "@/clubadmin/api/competitionPrizes";

import { getRandomListForPrize } from "@/clubadmin/api/randomLists";

import {
    previewPrizeEngine,
    type PrizeEnginePreviewRow,
} from "@/clubadmin/api/prizeEngine";

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

function ordinalSuffix(n: number) {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    const mod10 = n % 10;
    if (mod10 === 1) return "st";
    if (mod10 === 2) return "nd";
    if (mod10 === 3) return "rd";
    return "th";
}

function groupDeterministicPrizes(
    prizes: PrizeDefinitionRow[]
): {
    key: string;
    prize: PrizeDefinitionRow;
    awardedCount: number;
}[] {
    const groups: Record<string, PrizeDefinitionRow[]> = {};

    for (const prize of prizes) {
        const key = stripOrdinal(prize.display_name);
        groups[key] ??= [];
        groups[key].push(prize);
    }

    return Object.entries(groups).map(([key, group]) => {
        const sorted = [...group].sort(
            (a, b) => getAwardedCount(b) - getAwardedCount(a)
        );

        const authoritative = sorted[0];

        return {
            key,
            prize: authoritative,
            awardedCount: getAwardedCount(authoritative),
        };
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

    // If your engine row includes angler_number, show it. If not, it will just omit it.
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
    const { organisationId } = useParams<{ organisationId: string }>();

    const [competitionId, setCompetitionId] = useState("");
    const [competitions, setCompetitions] = useState<any[]>([]);

    const [prizeDefs, setPrizeDefs] = useState<PrizeDefinitionRow[]>([]);
    const [spotPrizes, setSpotPrizes] = useState<SpotPrizeDisplay[]>([]);

    const [resultContainers, setResultContainers] =
        useState<PrizeResultContainer[]>([]);
    const [activeContainer, setActiveContainer] =
        useState<PrizeResultContainer | null>(null);

    const [engineRowsByPrize, setEngineRowsByPrize] = useState<
        Record<string, PrizeEnginePreviewRow[]>
    >({});

    // Reveal progress per grouped key (number of revealed RESULTS, not slots)
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

    // ✅ Pick the “best” Spot Prize to link for the current container
    // We prefer an applicable, active spot prize that already has a randomised list.
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
                const active = data.find((c) => c.status === "active");
                setCompetitionId(active?.id ?? data[0].id);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organisationId]);

    // =====================================================================
    // Load prize definitions + spot random lists
    // =====================================================================

    useEffect(() => {
        if (!competitionId) return;

        async function loadPrizes() {
            const defs = await listPrizeDefinitions(competitionId);
            setPrizeDefs(defs);

            const resolved: SpotPrizeDisplay[] = [];

            for (const prize of defs.filter(
                (p) => p.prize_type === "spot" && p.active
            )) {
                const raw = await getRandomListForPrize({
                    competitionId,
                    prizeId: prize.id,
                });

                // raw is whatever getRandomListForPrize returns. We safely pick known fields.
                resolved.push({
                    prize,
                    randomList: raw
                        ? {
                            id: raw.id ?? null,
                            randomised_at: raw.randomised_at ?? null,
                            // ✅ name from random_list.name
                            // @ts-expect-error - depends on getRandomListForPrize return shape
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

    // Reset reveal state when changing comp/tab
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
            new Set(dayDefs.map((p) => p.competition_day_id).filter(Boolean))
        ) as string[];

        const containers: PrizeResultContainer[] = [];

        if (briefingExists) {
            containers.push({
                id: "briefing",
                label: "Briefing",
                scope_type: "briefing",
                scope_day_id: null,
                isFinal: false,
            });
        }

        uniqueDayIds.forEach((dayId, idx) => {
            containers.push({
                id: `day-${dayId}`,
                label: `Day ${idx + 1}`,
                scope_type: "day",
                scope_day_id: dayId,
                isFinal: false,
            });
        });

        if (containers.length === 0 && competitionDefs.length > 0) {
            containers.push({
                id: "final",
                label: "Prize Giving",
                scope_type: "day",
                scope_day_id: null,
                isFinal: true,
            });
        }

        if (competitionDefs.length > 0 && containers.length > 0) {
            containers[containers.length - 1].isFinal = true;
        }

        setResultContainers(containers);

        setActiveContainer((prev) => {
            if (!containers.length) return null;

            if (prev) {
                const stillThere = containers.find((c) => c.id === prev.id);
                if (stillThere) return stillThere;
            }

            const final = containers.find((c) => c.isFinal);
            return final ?? containers[0];
        });
    }, [prizeDefs]);

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

                rows[prize.id] = await previewPrizeEngine(competitionId, prize.id);
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
            <h2>Prize Giving</h2>

            <select
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
            >
                <option value="">-- Select Competition --</option>
                {competitions.map((c) => (
                    <option key={c.id} value={c.id}>
                        {c.name}
                    </option>
                ))}
            </select>

            {resultContainers.length > 0 && (
                <div className="result-container-tabs">
                    {resultContainers.map((c) => (
                        <button
                            key={c.id}
                            className={
                                activeContainer?.id === c.id
                                    ? "btn"
                                    : "btn btn-secondary"
                            }
                            onClick={() => setActiveContainer(c)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            )}

            {activeContainer && (
                <section style={{ marginTop: 24 }}>
                    <h3>{activeContainer.label}</h3>

                    <div className="prize-stack-card">
                        {/* ===============================
                           🎰 SPOT PRIZES
                           =============================== */}
                        {spotPrizes
                            .filter(({ prize }) => {
                                if (activeContainer.scope_type === "briefing") {
                                    return prize.scope_kind === "briefing";
                                }

                                if (activeContainer.scope_type === "day") {
                                    if (prize.scope_kind === "day") {
                                        return (
                                            prize.competition_day_id ===
                                            activeContainer.scope_day_id
                                        );
                                    }
                                    return (
                                        prize.scope_kind === "competition" &&
                                        activeContainer.isFinal
                                    );
                                }

                                return false;
                            })
                            .map(({ prize, randomList }) => (
                                <div
                                    key={prize.id}
                                    className="prize-card prize-card--spot"
                                >
                                    <div className="prize-card-header">
                                        <strong>{prize.display_name}</strong>
                                        <span className="muted">
                                            Rule: {prize.award_rule}
                                        </span>
                                    </div>

                                    {randomList.randomised_at ? (
                                        <Link
                                            className="btn btn-primary"
                                            to={`/clubadmin/${organisationId}/admin/random-lists/${randomList.id}/draw`}
                                        >
                                            🎉 Start live draw
                                        </Link>
                                    ) : (
                                        <div className="muted">⏳ Not randomised</div>
                                    )}
                                </div>
                            ))}

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
