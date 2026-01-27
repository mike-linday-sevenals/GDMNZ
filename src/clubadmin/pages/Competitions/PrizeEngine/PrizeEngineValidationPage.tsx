// ============================================================================
// File: PrizeEngineValidationPage.tsx
// Description:
// Embedded prize engine validation (EditCompetition → Prize Giving)
// - Inline engine output per prize
// - Winning row highlighted
// - "Why" explanation rendered full-width under each row
// ============================================================================

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
    listPrizeDefinitions,
    type PrizeDefinitionRow,
} from "@/clubadmin/api/competitionPrizes";

import {
    previewPrizeEngine,
    type PrizeEnginePreviewRow,
} from "@/clubadmin/api/prizeEngine";

// ============================================================================
// Helpers
// ============================================================================

function formatDateTimeNZ(value: string) {
    const d = new Date(value);

    return {
        date: d.toLocaleDateString("en-NZ", {
            timeZone: "Pacific/Auckland",
            year: "numeric",
            month: "short",
            day: "2-digit",
        }),
        time: d.toLocaleTimeString("en-NZ", {
            timeZone: "Pacific/Auckland",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        }),
    };
}

function explainInclusion(
    prize: PrizeDefinitionRow,
    row: PrizeEnginePreviewRow
): string {
    let outcomePart = "Outcome ignored (any)";

    if (prize.outcome_filter === "tagged_released") {
        outcomePart = "Outcome matched: tagged & released";
    } else if (prize.outcome_filter === "landed") {
        outcomePart =
            row.outcome === "landed"
                ? "Outcome matched: landed"
                : "Sport fish treated as landed";
    }

    let rankingPart = "Ordered by priority time";

    if (prize.award_rule === "ranked") {
        rankingPart =
            prize.result_method === "measured"
                ? "Ordered by length (cm)"
                : "Ordered by weight (kg)";
    }

    return `${outcomePart} · ${rankingPart}`;
}

// ============================================================================
// Component
// ============================================================================

type Props = {
    embedded?: boolean;
};

export default function PrizeEngineValidationPage({ embedded = false }: Props) {
    const { id: competitionId } = useParams<{ id: string }>();

    const [prizes, setPrizes] = useState<PrizeDefinitionRow[]>([]);
    const [openPrizeId, setOpenPrizeId] = useState<string | null>(null);

    const [rowsByPrize, setRowsByPrize] = useState<
        Record<string, PrizeEnginePreviewRow[]>
    >({});

    const [loadingPrizeId, setLoadingPrizeId] = useState<string | null>(null);
    const [errorPrizeId, setErrorPrizeId] = useState<string | null>(null);

    // ------------------------------------------------------------------------
    // Load prize definitions
    // ------------------------------------------------------------------------
    useEffect(() => {
        if (!competitionId) return;

        (async () => {
            const defs = await listPrizeDefinitions(competitionId);
            setPrizes(defs.filter((p) => p.active));
        })();
    }, [competitionId]);

    // ------------------------------------------------------------------------
    // Run engine preview (per prize)
    // ------------------------------------------------------------------------
    async function togglePrize(prize: PrizeDefinitionRow) {
        if (openPrizeId === prize.id) {
            setOpenPrizeId(null);
            return;
        }

        setOpenPrizeId(prize.id);
        setLoadingPrizeId(prize.id);
        setErrorPrizeId(null);

        try {
            const data = await previewPrizeEngine(competitionId!, prize.id);
            setRowsByPrize((prev) => ({ ...prev, [prize.id]: data }));
        } catch (err) {
            console.error(err);
            setErrorPrizeId(prize.id);
        } finally {
            setLoadingPrizeId(null);
        }
    }

    // ------------------------------------------------------------------------
    // Content
    // ------------------------------------------------------------------------
    const content = (
        <>
            {/* ================= HEADER ================= */}
            <div className="card-header">
                <h3>Prize Giving — Validation</h3>

                <Link to=".." className="btn btn--ghost">
                    ← Back to Prizes
                </Link>
            </div>

            <h4 style={{ marginBottom: 12 }}>Configured Prizes</h4>

            {prizes.map((prize) => {
                const isOpen = openPrizeId === prize.id;
                const rows = rowsByPrize[prize.id] ?? [];

                const winningRank =
                    prize.award_rule === "ranked" ? prize.place : 1;

                return (
                    <div
                        key={prize.id}
                        style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            marginBottom: 16,
                            overflow: "hidden",
                        }}
                    >
                        {/* Prize header */}
                        <div
                            onClick={() => togglePrize(prize)}
                            style={{
                                padding: 12,
                                cursor: "pointer",
                                background: isOpen ? "#f8fafc" : "#fff",
                            }}
                        >
                            <div style={{ fontWeight: 600, lineHeight: 1.4 }}>
                                {prize.display_name}
                            </div>
                            <div className="muted" style={{ fontSize: 13 }}>
                                Rule: {prize.award_rule}
                            </div>
                        </div>

                        {/* Engine output */}
                        {isOpen && (
                            <div
                                style={{
                                    borderTop: "1px solid #e5e7eb",
                                    background: "#fafafa",
                                }}
                            >
                                {loadingPrizeId === prize.id && (
                                    <p className="muted" style={{ padding: 12 }}>
                                        Running prize engine…
                                    </p>
                                )}

                                {rows.map((r) => {
                                    const isWinner =
                                        r.rank === winningRank;
                                    const { date, time } =
                                        formatDateTimeNZ(
                                            r.priority_timestamp
                                        );

                                    return (
                                        <div
                                            key={r.catch_submission_id}
                                            style={{
                                                padding: 12,
                                                borderBottom:
                                                    "1px solid #e5e7eb",
                                                background: isWinner
                                                    ? "rgba(34,197,94,0.12)"
                                                    : "transparent",
                                                borderLeft: isWinner
                                                    ? "4px solid #22c55e"
                                                    : "4px solid transparent",
                                            }}
                                        >
                                            {/* Main row */}
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "48px 1.4fr 1.2fr 1fr 1fr 1.3fr 80px 80px",
                                                    gap: 8,
                                                    alignItems: "center",
                                                }}
                                            >
                                                <strong>{r.rank}</strong>
                                                <div>{r.competitor_name}</div>
                                                <div>{r.species_name}</div>
                                                <div>
                                                    {r.species_category_name ??
                                                        "—"}
                                                </div>
                                                <div>{r.outcome ?? "—"}</div>
                                                <div>
                                                    {date}
                                                    <br />
                                                    <span className="muted">
                                                        {time}
                                                    </span>
                                                </div>
                                                <div>
                                                    {r.weight_kg ?? "—"}
                                                </div>
                                                <div>
                                                    {r.length_cm ?? "—"}
                                                </div>
                                            </div>

                                            {/* WHY (full width) */}
                                            <div
                                                className="muted"
                                                style={{
                                                    marginTop: 8,
                                                    fontSize: 13,
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                {explainInclusion(prize, r)}
                                            </div>
                                        </div>
                                    );
                                })}

                                {!loadingPrizeId && rows.length === 0 && (
                                    <p
                                        className="muted"
                                        style={{ padding: 12 }}
                                    >
                                        No submissions matched this prize.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );

    // ------------------------------------------------------------------------
    // Embedded vs standalone rendering
    // ------------------------------------------------------------------------
    if (embedded) {
        return <section className="card">{content}</section>;
    }

    return <section className="card admin-card">{content}</section>;
}
