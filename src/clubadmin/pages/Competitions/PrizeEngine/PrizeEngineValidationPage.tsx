// ============================================================================
// File: PrizeEngineValidationPage.tsx
// Description:
// Embedded prize engine validation (EditCompetition → Prize Giving)
// - Species prizes: deterministic preview (ordered = authoritative)
// - Spot prizes: prepare list → preview eligible entries → randomise
// UI mirrors PROD layout exactly, including ranked prizes (2nd / 3rd / etc.)
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

import {
    ensureRandomListForPrize,
    randomiseRandomList,
} from "@/clubadmin/api/randomLists";

import { client } from "@/services/api";

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

/**
 * Derive awarded rank from prize display name.
 * Examples:
 *  - "... · 1st" → 0
 *  - "... · 2nd" → 1
 *  - "... · 3rd" → 2
 *  - "... · 4th" → 3
 *  - no suffix  → 0 (default = first)
 */
function getWinningIndex(prize: PrizeDefinitionRow): number {
    const match = prize.display_name.match(
        /\b(\d+)(st|nd|rd|th)\b/i
    );

    if (!match) return 0;

    const n = parseInt(match[1], 10);
    if (Number.isNaN(n) || n < 1) return 0;

    return n - 1;
}

// ============================================================================
// Component
// ============================================================================

type Props = {
    embedded?: boolean;
};

type SpotListState = {
    randomListId: string;
    randomised: boolean;
    entries: { id: string; display_name: string }[];
};


export default function PrizeEngineValidationPage({ embedded = false }: Props) {
    const { id: competitionId } = useParams<{ id: string }>();

    const [prizes, setPrizes] = useState<PrizeDefinitionRow[]>([]);
    const [openPrizeId, setOpenPrizeId] = useState<string | null>(null);

    const [rowsByPrize, setRowsByPrize] = useState<
        Record<string, PrizeEnginePreviewRow[]>
    >({});

    const [spotState, setSpotState] = useState<
        Record<string, SpotListState>
    >({});

    const [loadingPrizeId, setLoadingPrizeId] = useState<string | null>(null);

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
    // Toggle prize
    // ------------------------------------------------------------------------

    async function togglePrize(prize: PrizeDefinitionRow) {
        if (openPrizeId === prize.id) {
            setOpenPrizeId(null);
            return;
        }

        setOpenPrizeId(prize.id);

        if (prize.prize_type !== "spot") {
            setLoadingPrizeId(prize.id);
            try {
                const data = await previewPrizeEngine(
                    competitionId!,
                    prize.id
                );
                setRowsByPrize((prev) => ({
                    ...prev,
                    [prize.id]: data,
                }));
            } finally {
                setLoadingPrizeId(null);
            }
        }
    }

    // ------------------------------------------------------------------------
    // Spot prize actions
    // ------------------------------------------------------------------------

    async function handlePrepareSpotPrize(prize: PrizeDefinitionRow) {
        if (!competitionId) return;

        setLoadingPrizeId(prize.id);

        try {
            const { random_list_id } =
                await ensureRandomListForPrize({
                    competitionId,
                    prizeId: prize.id,
                });

            const { data: list } = await client!
                .from("random_list")
                .select("randomised_at")
                .eq("id", random_list_id)
                .single();

            const { data: entries } = await client!
                .from("random_list_entry")
                .select("id, display_name")
                .eq("random_list_id", random_list_id)
                .order("display_name");

            setSpotState((prev) => ({
                ...prev,
                [prize.id]: {
                    randomListId: random_list_id,
                    randomised: !!list?.randomised_at,
                    entries: entries ?? [],
                },
            }));
        } finally {
            setLoadingPrizeId(null);
        }
    }

    async function handleRandomise(prize: PrizeDefinitionRow) {
        const state = spotState[prize.id];
        if (!state) return;

        setLoadingPrizeId(prize.id);

        try {
            await randomiseRandomList(state.randomListId);
            setSpotState((prev) => ({
                ...prev,
                [prize.id]: { ...state, randomised: true },
            }));
        } finally {
            setLoadingPrizeId(null);
        }
    }

    // ------------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------------

    const content = (
        <>
            <div className="card-header">
                <h3>Prize Giving — Validation</h3>
                <Link to=".." className="btn btn--ghost">
                    ← Back to Prizes
                </Link>
            </div>

            <h4 style={{ marginBottom: 12 }}>Configured Prizes</h4>

            {prizes.map((prize) => {
                const isOpen = openPrizeId === prize.id;
                const rows = rowsByPrize[prize.id];
                const spot = spotState[prize.id];

                const winningIndex = getWinningIndex(prize);

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
                        {/* Header */}
                        <div
                            onClick={() => togglePrize(prize)}
                            style={{
                                padding: 12,
                                cursor: "pointer",
                                background: isOpen ? "#f8fafc" : "#fff",
                            }}
                        >
                            <div style={{ fontWeight: 600 }}>
                                {prize.display_name}
                            </div>
                            <div className="muted" style={{ fontSize: 13 }}>
                                Rule: {prize.award_rule}
                            </div>
                        </div>

                        {/* Content */}
                        {isOpen && (
                            <div style={{ background: "#fafafa" }}>
                                {/* SPOT PRIZE */}
                                {prize.prize_type === "spot" && (
                                    <div style={{ padding: 12 }}>
                                        {!spot && (
                                            <button
                                                onClick={() =>
                                                    handlePrepareSpotPrize(
                                                        prize
                                                    )
                                                }
                                                disabled={
                                                    loadingPrizeId === prize.id
                                                }
                                            >
                                                Prepare draw list
                                            </button>
                                        )}

                                        {spot && (
                                            <>
                                                <p className="muted">
                                                    Eligible entries (
                                                    {spot.entries.length})
                                                </p>
                                                <ul>
                                                    {spot.entries.map((e) => (
                                                        <li key={e.id}>
                                                            {e.display_name}
                                                        </li>
                                                    ))}
                                                </ul>

                                                {!spot.randomised && (
                                                    <button
                                                        onClick={() =>
                                                            handleRandomise(
                                                                prize
                                                            )
                                                        }
                                                    >
                                                        Run randomisation
                                                    </button>
                                                )}

                                                {spot.randomised && (
                                                    <p className="muted">
                                                        ✅ Randomised — ready to
                                                        draw
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* SPECIES PRIZE — PROD MIRROR */}
                                {prize.prize_type !== "spot" &&
                                    rows?.map((r, index) => {
                                        const isWinner =
                                            index === winningIndex;

                                        const { date, time } =
                                            formatDateTimeNZ(
                                                r.priority_timestamp
                                            );

                                        return (
                                            <div
                                                key={r.catch_submission_id}
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "40px 1.4fr 1.2fr 1.2fr 1.2fr 140px 80px 80px",
                                                    gap: 12,
                                                    padding: "12px 16px",
                                                    borderBottom:
                                                        "1px solid #e5e7eb",
                                                    background: isWinner
                                                        ? "#e8f7ee"
                                                        : "#fff",
                                                    borderLeft: isWinner
                                                        ? "4px solid #22c55e"
                                                        : "4px solid transparent",
                                                }}
                                            >
                                                <div style={{ fontWeight: 600 }}>
                                                    {index + 1}
                                                </div>

                                                <div>{r.competitor_name}</div>
                                                <div>{r.species_name}</div>
                                                <div className="muted">—</div>
                                                <div>{r.outcome}</div>

                                                <div>
                                                    <div>{date}</div>
                                                    <div className="muted">
                                                        {time}
                                                    </div>
                                                </div>

                                                <div>
                                                    {r.weight_kg != null
                                                        ? `${r.weight_kg.toFixed(
                                                            2
                                                        )} kg`
                                                        : "—"}
                                                </div>

                                                <div>
                                                    {r.length_cm != null
                                                        ? `${r.length_cm} cm`
                                                        : "—"}
                                                </div>

                                                <div
                                                    style={{
                                                        gridColumn: "1 / -1",
                                                        fontSize: 12,
                                                        color: "#6b7280",
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    Outcome matched:{" "}
                                                    {r.outcome} · Ordered by{" "}
                                                    {prize.award_rule}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );

    return embedded ? (
        <section className="card">{content}</section>
    ) : (
        <section className="card admin-card">{content}</section>
    );
}
