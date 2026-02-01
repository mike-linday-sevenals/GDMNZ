// ============================================================================
// File: SpotPrizeDrawPage.tsx
// Description:
// Live / presentation-friendly spot prize draw screen
// - Shows remaining entries
// - Draws winners one-by-one
// - Deterministic + auditable (RPC-backed)
// - ✅ Shows Spot Prize name from random_list.name prominently on the stage card
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { client } from "@/services/api";

// ============================================================================
// Types
// ============================================================================

type RandomList = {
    id: string;
    name: string;
    description: string | null;
    randomised_at: string | null;
};

type Entry = {
    id: string;
    display_name: string;
};

type Drawn = {
    id: string; // ✅ DB primary key (do NOT rename)
    display_name: string;
    draw_sequence: number;
};

// ============================================================================
// Component
// ============================================================================

export default function SpotPrizeDrawPage() {
    const { randomListId } = useParams<{ randomListId: string }>();

    const [list, setList] = useState<RandomList | null>(null);
    const [remaining, setRemaining] = useState<Entry[]>([]);
    const [drawn, setDrawn] = useState<Drawn[]>([]);
    const [loading, setLoading] = useState(true);
    const [drawing, setDrawing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stage text: show the most recent draw, else Ready…
    const stageText = useMemo(() => {
        if (drawn.length > 0) return drawn[drawn.length - 1].display_name;
        return "Ready…";
    }, [drawn]);

    // ------------------------------------------------------------------------
    // Load state
    // ------------------------------------------------------------------------

    async function load() {
        try {
            if (!client || !randomListId) return;

            setLoading(true);

            // Load list meta (includes random_list.name ✅)
            const { data: listData, error: listError } = await client
                .from("random_list")
                .select("id, name, description, randomised_at")
                .eq("id", randomListId)
                .single();

            if (listError) throw listError;
            if (!listData) throw new Error("Random list not found");

            setList(listData);

            // Remaining entries
            const { data: remainingData, error: remainingError } = await client
                .from("random_list_entry")
                .select("id, display_name")
                .eq("random_list_id", randomListId)
                .is("selected_at", null)
                .order("random_order");

            if (remainingError) throw remainingError;

            setRemaining(remainingData ?? []);

            // Drawn entries (AUDIT SOURCE OF TRUTH)
            const { data: drawnData, error: drawnError } = await client
                .from("random_list_draw")
                .select("id, display_name, draw_sequence")
                .eq("random_list_id", randomListId)
                .order("draw_sequence");

            if (drawnError) throw drawnError;

            setDrawn(drawnData ?? []);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load draw");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [randomListId]);

    // ------------------------------------------------------------------------
    // Draw next (RPC-backed, deterministic)
    // ------------------------------------------------------------------------

    async function drawNext() {
        if (!client || !randomListId) return;

        setDrawing(true);

        try {
            const { error } = await client.rpc("draw_next_random_list_entry", {
                p_random_list_id: randomListId,
            });

            if (error) throw error;

            await load();
        } finally {
            setDrawing(false);
        }
    }

    // ------------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------------

    if (loading) {
        return <div className="page">Loading draw…</div>;
    }

    if (error) {
        return <div className="page error">{error}</div>;
    }

    if (!list) {
        return <div className="page">Draw not found</div>;
    }

    return (
        <div
            className="page spot-draw-page"
            style={{
                maxWidth: 1100,
                margin: "0 auto",
                padding: "32px 24px",
            }}
        >
            {/* Header */}
            <header style={{ marginBottom: 18 }}>
                <h1 style={{ fontSize: 34, margin: 0 }}>🎰 Spot Prize Draw</h1>

                {/* ✅ Prize Name from random_list.name */}
                <div
                    style={{
                        marginTop: 8,
                        fontSize: 28,
                        fontWeight: 900,
                    }}
                >
                    {list.name}
                </div>

                {list.description && (
                    <p className="muted" style={{ marginTop: 8 }}>
                        {list.description}
                    </p>
                )}
            </header>

            {/* Big stage card */}
            <section
                style={{
                    borderRadius: 18,
                    padding: 22,
                    background: "white",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    marginBottom: 22,
                }}
            >
                {/* ✅ Name repeated on stage for big screens */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 16,
                        marginBottom: 12,
                    }}
                >
                    <div style={{ fontSize: 24, fontWeight: 800 }}>
                        {list.name}
                    </div>
                    <div className="muted" style={{ fontSize: 14 }}>
                        Press the button to reel in the next winner
                    </div>
                </div>

                <div
                    style={{
                        height: 320,
                        borderRadius: 18,
                        background:
                            "linear-gradient(180deg, rgba(14,165,233,1) 0%, rgba(37,99,235,1) 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                        boxShadow: "0 30px 40px rgba(0,0,0,0.18)",
                        marginBottom: 18,
                    }}
                >
                    <div
                        style={{
                            fontSize: 54,
                            fontWeight: 900,
                            color: "white",
                            textAlign: "center",
                            lineHeight: 1.05,
                            textShadow: "0 3px 0 rgba(0,0,0,0.15)",
                            maxWidth: 980,
                            wordBreak: "break-word",
                        }}
                    >
                        {stageText}
                    </div>
                </div>

                {/* Draw button */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                        onClick={drawNext}
                        disabled={
                            drawing || !list.randomised_at || remaining.length === 0
                        }
                        style={{
                            fontSize: 20,
                            fontWeight: 800,
                            padding: "12px 26px",
                            borderRadius: 12,
                        }}
                    >
                        {remaining.length === 0
                            ? "No entries remaining"
                            : drawing
                                ? "Drawing…"
                                : "Draw next winner"}
                    </button>
                </div>
            </section>

            {/* Bottom panels */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    alignItems: "start",
                }}
            >
                {/* Remaining */}
                <section
                    style={{
                        background: "white",
                        borderRadius: 16,
                        padding: 18,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                    }}
                >
                    <h3 style={{ margin: 0 }}>
                        Remaining entries ({remaining.length})
                    </h3>

                    <ul style={{ columns: 2, marginTop: 12 }}>
                        {remaining.map((e) => (
                            <li key={e.id}>{e.display_name}</li>
                        ))}
                    </ul>
                </section>

                {/* Winners */}
                <section
                    style={{
                        background: "white",
                        borderRadius: 16,
                        padding: 18,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                    }}
                >
                    <h3 style={{ margin: 0 }}>Winners</h3>

                    {drawn.length === 0 && (
                        <p className="muted" style={{ marginTop: 10 }}>
                            No winners yet
                        </p>
                    )}

                    <ol style={{ marginTop: 12 }}>
                        {drawn.map((d) => (
                            <li
                                key={d.id}
                                style={{
                                    fontSize: 20,
                                    fontWeight: 800,
                                    marginBottom: 10,
                                }}
                            >
                                {d.display_name}
                            </li>
                        ))}
                    </ol>
                </section>
            </div>
        </div>
    );
}
