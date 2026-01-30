// ============================================================================
// File: PrizeGiving.tsx
// Path: src/clubadmin/pages/PrizeGiving.tsx
// Description:
//  - Prize Giving DISPLAY MODE (MC / Live Use)
//  - Containers derived ONLY from prize configuration
//  - Competition-scoped prizes flow into final day
//  - Ordinal prize definitions (1st / 2nd / 3rd) are grouped into ONE card
// ============================================================================

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { listCompetitions } from "@/clubadmin/api/competitions";
import {
    listPrizeDefinitions,
    type PrizeDefinitionRow,
} from "@/clubadmin/api/competitionPrizes";

import {
    getRandomListForPrize,
} from "@/clubadmin/api/randomLists";

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

                resolved.push({
                    prize,
                    randomList: raw
                        ? {
                            id: raw.id,
                            randomised_at: raw.randomised_at ?? null,
                        }
                        : {
                            id: null,
                            randomised_at: null,
                        },
                });
            }

            setSpotPrizes(resolved);
        }

        loadPrizes();
    }, [competitionId]);

    // =====================================================================
    // Build result containers (PRIZE CONFIG DRIVEN)
    // =====================================================================

    useEffect(() => {
        if (!prizeDefs.length) {
            setResultContainers([]);
            setActiveContainer(null);
            return;
        }

        const briefingExists = prizeDefs.some(
            (p) => p.scope_kind === "briefing"
        );

        const dayDefs = prizeDefs.filter(
            (p) => p.scope_kind === "day"
        );

        const competitionDefs = prizeDefs.filter(
            (p) => p.scope_kind === "competition"
        );

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

        // ✅ NEW BEHAVIOUR:
        // - keep current active container if it still exists
        // - else default to final container
        // - else default to first
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

                    if (
                        prize.scope_kind === "competition" &&
                        !container.isFinal
                    ) {
                        continue;
                    }
                }

                rows[prize.id] = await previewPrizeEngine(
                    competitionId,
                    prize.id
                );
            }

            setEngineRowsByPrize(rows);
        }

        loadEngine();
    }, [competitionId, activeContainer, prizeDefs]);

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
                                        <div className="muted">
                                            ⏳ Not randomised
                                        </div>
                                    )}
                                </div>
                            ))}

                        {/* ===============================
                           🏆 DETERMINISTIC PRIZES (GROUPED)
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

                            const awardedRows = rows.slice(0, awardedCount);
                            const displayRows = [...awardedRows].reverse();

                            return (
                                <details
                                    key={key}
                                    className="prize-card"
                                    style={{ marginTop: 12 }}
                                >
                                    <summary
                                        style={{
                                            padding: "12px 16px",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            background: "#f8fafc",
                                            borderRadius: 8,
                                        }}
                                    >
                                        {key}
                                        <div className="muted">
                                            Rule: {prize.award_rule}
                                        </div>
                                    </summary>

                                    {displayRows.map((r, idx) => {
                                        const place = awardedCount - idx;

                                        return (
                                            <div
                                                key={r.catch_submission_id}
                                                style={{
                                                    padding: "12px 16px",
                                                    borderTop:
                                                        "1px solid #e5e7eb",
                                                }}
                                            >
                                                <strong>
                                                    #{place} —{" "}
                                                    {r.competitor_name}
                                                </strong>

                                                <div className="muted">
                                                    {r.species_name} ·{" "}
                                                    {r.outcome}
                                                </div>

                                                <div>
                                                    {r.weight_kg != null &&
                                                        `${r.weight_kg.toFixed(
                                                            2
                                                        )} kg`}
                                                    {r.length_cm != null &&
                                                        ` · ${r.length_cm} cm`}
                                                </div>

                                                <div className="muted">
                                                    {formatDateTimeNZ(
                                                        r.priority_timestamp
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </details>
                            );
                        })}
                    </div>
                </section>
            )}
        </section>
    );
}
