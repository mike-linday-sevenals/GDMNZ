// ============================================================================
// File: DrawRandomListPage.tsx
// Description:
//  - LIVE spot prize draw display
//  - One draw at a time
//  - Rehydrates from DB on refresh
//  - Stage-style reveal with fishing line animation
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
};

// ============================================================================
// Component
// ============================================================================

export default function DrawRandomListPage() {
    // ✅ IMPORTANT: include organisationId so we can link back to Prize Giving
    const { organisationId, randomListId } = useParams<{
        organisationId: string;
        randomListId: string;
    }>();

    const [currentWinner, setCurrentWinner] =
        useState<DrawnEntry | null>(null);
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

        const hydrated: DrawnEntry[] = data.map((row) => ({
            entry_id: row.id,
            entry_name: row.display_name,
            random_order: row.random_order,
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

        try {
            setIsDrawing(true);
            setIsRevealing(true);

            const result = await drawNextRandomListEntry(randomListId);

            if (!result) {
                setIsComplete(true);
                setCurrentWinner(null);
                return;
            }

            setTimeout(() => {
                setCurrentWinner(result);
                setDrawn((prev) => [...prev, result]);
                setIsRevealing(false);
            }, 900); // animation timing
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
                    <div
                        className={`fishing-line ${isRevealing ? "drop" : ""
                            }`}
                    >
                        <div className="hook" />
                    </div>

                    {/* Winner reveal */}
                    <div
                        className={`winner-name ${isRevealing ? "hidden" : "show"
                            }`}
                    >
                        {currentWinner
                            ? currentWinner.entry_name
                            : isComplete
                                ? "🎊 Draw Complete"
                                : "Ready…"}
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

                {drawn.length === 0 && (
                    <p className="muted">No winners yet</p>
                )}

                {drawn.length > 0 && (
                    <ol>
                        {drawn.map((d) => (
                            <li key={d.entry_id}>{d.entry_name}</li>
                        ))}
                    </ol>
                )}

                {/* ✅ FIX: always go back to Prize Giving page */}
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
