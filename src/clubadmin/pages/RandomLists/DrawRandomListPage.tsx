// ============================================================================
// File: DrawRandomListPage.tsx
// Path: src/clubadmin/pages/RandomLists/DrawRandomListPage.tsx
// Description:
//  - LIVE spot prize draw display
//  - One draw at a time
//  - Rehydrates from DB on refresh
//  - Stage-style reveal with fishing line animation
//  - ✅ Shows angler_number (from competitor) under name
//  - ✅ Name + number SAME SIZE
//  - ✅ Reduced blue padding + text fills the blue better
// ============================================================================

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { client } from "@/services/api";
import { drawNextRandomListEntry } from "@/clubadmin/api/randomLists";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

export type DrawnEntry = {
    entry_id: string;
    entry_name: string;
    random_order: number;

    // random_list_entry.source_id -> competitor.id
    competitor_id: string | null;

    // competitor.angler_number
    angler_number: string | null;
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Winner label that aggressively fills the available blue area.
 * - minimal padding
 * - strong line-height + big responsive font size
 * - uses flex to occupy full height
 */
function WinnerLabel({ entry }: { entry: DrawnEntry }) {
    return (
        <div
            style={{
                height: "100%",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",

                // make the 2 lines eat the space
                lineHeight: 1.0,

                // responsive, big; both lines same size
                fontSize: "clamp(30px, 6vw, 110px)",
                fontWeight: 900,
                textAlign: "center",

                // ✅ less padding so the text fills more of the blue card
                padding: "0px 8px",

                // long names won’t overflow
                wordBreak: "break-word",
            }}
        >
            <div style={{ margin: 0, padding: 0 }}>{entry.entry_name}</div>

            {entry.angler_number && (
                <div
                    style={{
                        margin: 0,
                        padding: 0,

                        // ✅ tighter spacing between the two lines
                        marginTop: "0.2em",
                    }}
                >
                    {entry.angler_number}
                </div>
            )}
        </div>
    );
}

async function fetchAnglerNumberMap(
    supabase: SupabaseClient,
    competitorIds: string[]
) {
    const uniq = Array.from(new Set(competitorIds.filter(Boolean)));
    if (uniq.length === 0) return new Map<string, string>();

    // NOTE: if your table is named "competitors" instead of "competitor",
    // change the .from("competitor") call below.
    const { data, error } = await supabase
        .from("competitor")
        .select("id, angler_number")
        .in("id", uniq);

    if (error) {
        console.error(
            "[LiveDraw] Failed to load competitor angler numbers",
            error
        );
        return new Map<string, string>();
    }

    const map = new Map<string, string>();
    (data ?? []).forEach((row: any) => {
        if (row?.id && row?.angler_number) {
            map.set(row.id, row.angler_number);
        }
    });

    return map;
}

async function enrichEntryWithAnglerNumber(
    supabase: SupabaseClient,
    entry: { entry_id: string; entry_name: string; random_order: number }
): Promise<DrawnEntry> {
    const { data: entryRow, error: entryErr } = await supabase
        .from("random_list_entry")
        .select("id, display_name, source_id, random_order")
        .eq("id", entry.entry_id)
        .single();

    if (entryErr) {
        console.error(
            "[LiveDraw] Failed to load random_list_entry for winner",
            entryErr
        );
        return {
            entry_id: entry.entry_id,
            entry_name: entry.entry_name,
            random_order: entry.random_order,
            competitor_id: null,
            angler_number: null,
        };
    }

    const competitorId = entryRow?.source_id ?? null;

    if (!competitorId) {
        return {
            entry_id: entry.entry_id,
            entry_name: entryRow?.display_name ?? entry.entry_name,
            random_order: entryRow?.random_order ?? entry.random_order,
            competitor_id: null,
            angler_number: null,
        };
    }

    const { data: compRow, error: compErr } = await supabase
        .from("competitor") // change to "competitors" if that’s your table name
        .select("id, angler_number")
        .eq("id", competitorId)
        .single();

    if (compErr) {
        console.error("[LiveDraw] Failed to load competitor for winner", compErr);
    }

    return {
        entry_id: entryRow.id,
        entry_name: entryRow.display_name ?? entry.entry_name,
        random_order: entryRow.random_order ?? entry.random_order,
        competitor_id: competitorId,
        angler_number: compRow?.angler_number ?? null,
    };
}

// ============================================================================
// Component
// ============================================================================

export default function DrawRandomListPage() {
    const { organisationId, randomListId } = useParams<{
        organisationId: string;
        randomListId: string;
    }>();

    const [currentWinner, setCurrentWinner] = useState<DrawnEntry | null>(null);
    const [drawn, setDrawn] = useState<DrawnEntry[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [isRevealing, setIsRevealing] = useState(false);

    // ------------------------------------------------------------------
    // Rehydrate from DB on mount
    // ------------------------------------------------------------------

    useEffect(() => {
        if (!randomListId) return;

        const supabase = client;
        if (!supabase) {
            console.error("[LiveDraw] Supabase client not initialised");
            setIsLoading(false);
            return;
        }

        loadExistingDraws(supabase, randomListId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [randomListId]);

    async function loadExistingDraws(
        supabase: SupabaseClient,
        randomListId: string
    ) {
        const { data, error } = await supabase
            .from("random_list_entry")
            .select(
                `
                id,
                source_id,
                display_name,
                random_order,
                selected_order
            `
            )
            .eq("random_list_id", randomListId)
            .not("selected_at", "is", null)
            .order("selected_order", { ascending: true });

        if (error) {
            console.error("[LiveDraw] Failed to load existing draws", error);
            setIsLoading(false);
            return;
        }

        if (!data || data.length === 0) {
            setIsLoading(false);
            return;
        }

        const competitorIds = data
            .map((row: any) => row.source_id)
            .filter(Boolean) as string[];

        const anglerMap = await fetchAnglerNumberMap(supabase, competitorIds);

        const hydrated: DrawnEntry[] = data.map((row: any) => ({
            entry_id: row.id,
            entry_name: row.display_name,
            random_order: row.random_order,
            competitor_id: row.source_id ?? null,
            angler_number: row.source_id
                ? anglerMap.get(row.source_id) ?? null
                : null,
        }));

        setDrawn(hydrated);
        setCurrentWinner(hydrated[hydrated.length - 1]);
        setIsLoading(false);
    }

    // ------------------------------------------------------------------
    // Draw next winner
    // ------------------------------------------------------------------

    async function drawNext() {
        if (!randomListId || isDrawing || isComplete) return;

        const supabase = client;
        if (!supabase) {
            console.error("[LiveDraw] Supabase client not initialised");
            return;
        }

        try {
            setIsDrawing(true);
            setIsRevealing(true);

            const result = await drawNextRandomListEntry(randomListId);

            if (!result) {
                setIsComplete(true);
                setCurrentWinner(null);
                return;
            }

            const enriched = await enrichEntryWithAnglerNumber(supabase, result);

            setTimeout(() => {
                setCurrentWinner(enriched);
                setDrawn((prev) => [...prev, enriched]);
                setIsRevealing(false);
            }, 900);
        } finally {
            setIsDrawing(false);
        }
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    if (isLoading) {
        return (
            <section className="card live-draw-loading">
                <h2>Loading draw…</h2>
            </section>
        );
    }

    return (
        <section className="live-draw-page">
            {/* ================= STAGE ================= */}
            <div className="card live-draw-stage">
                <header className="stage-header">
                    <h1>🎣 Live Draw</h1>
                    <p>Press the button to reel in the next winner</p>
                </header>

                <div className="winner-stage">
                    {/* Fishing line */}
                    <div className={`fishing-line ${isRevealing ? "drop" : ""}`}>
                        <div className="hook" />
                    </div>

                    {/* Winner reveal */}
                    <div
                        className={`winner-name ${isRevealing ? "hidden" : "show"}`}
                        style={{
                            // ✅ allow the label to fill the blue area
                            minHeight: 260,
                            width: "100%",

                            // remove extra inner spacing
                            padding: 0,
                            margin: 0,

                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {currentWinner ? (
                            <WinnerLabel entry={currentWinner} />
                        ) : isComplete ? (
                            "🎊 Draw Complete"
                        ) : (
                            "Ready…"
                        )}
                    </div>
                </div>

                {!isComplete && (
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={drawNext}
                        disabled={isDrawing}
                    >
                        {isDrawing ? "Drawing…" : "🎯 DRAW NEXT"}
                    </button>
                )}
            </div>

            {/* ================= HISTORY ================= */}
            <div className="card live-draw-history">
                <h3>Drawn so far</h3>

                {drawn.length === 0 && <p className="muted">No winners yet</p>}

                {drawn.length > 0 && (
                    <ol>
                        {drawn.map((d) => (
                            <li key={d.entry_id}>
                                {d.entry_name}
                                {d.angler_number ? ` ${d.angler_number}` : ""}
                            </li>
                        ))}
                    </ol>
                )}

                <Link
                    to={
                        organisationId
                            ? `/clubadmin/${organisationId}/prize-giving`
                            : "/clubadmin"
                    }
                    className="btn btn-secondary back-btn"
                >
                    ← Back to prizes
                </Link>
            </div>
        </section>
    );
}
