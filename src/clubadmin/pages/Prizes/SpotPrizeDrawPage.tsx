// ============================================================================
// File: SpotPrizeDrawPage.tsx
// Description:
// Live / presentation-friendly spot prize draw screen
// - Shows remaining entries
// - Draws winners one-by-one
// - Deterministic + auditable (RPC-backed)
// ============================================================================

import { useEffect, useState } from "react";
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
    id: string;              // ✅ DB primary key (do NOT rename)
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

    // ------------------------------------------------------------------------
    // Load state
    // ------------------------------------------------------------------------

    async function load() {
        try {
            if (!client || !randomListId) return;

            setLoading(true);

            // Load list meta
            const { data: listData, error: listError } = await client
                .from("random_list")
                .select("id, name, description, randomised_at")
                .eq("id", randomListId)
                .single();

            if (listError) throw listError;
            if (!listData) throw new Error("Random list not found");

            setList(listData);

            // Remaining entries
            const { data: remainingData, error: remainingError } =
                await client
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
            const { error } = await client.rpc(
                "draw_next_random_list_entry",
                {
                    p_random_list_id: randomListId,
                }
            );

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
                maxWidth: 960,
                margin: "0 auto",
                padding: "32px 24px",
            }}
        >
            {/* Header */}
            <header style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 32 }}>🎰 Spot Prize Draw</h1>
                <h2 style={{ marginTop: 8 }}>{list.name}</h2>
                {list.description && (
                    <p className="muted">{list.description}</p>
                )}
            </header>

            {/* Draw button */}
            <div style={{ marginBottom: 32 }}>
                <button
                    onClick={drawNext}
                    disabled={
                        drawing ||
                        !list.randomised_at ||
                        remaining.length === 0
                    }
                    style={{
                        fontSize: 18,
                        padding: "12px 24px",
                    }}
                >
                    {remaining.length === 0
                        ? "No entries remaining"
                        : drawing
                            ? "Drawing…"
                            : "Draw next winner"}
                </button>
            </div>

            {/* Remaining */}
            <section style={{ marginBottom: 32 }}>
                <h3>Remaining entries ({remaining.length})</h3>
                <ul style={{ columns: 2, marginTop: 12 }}>
                    {remaining.map((e) => (
                        <li key={e.id}>{e.display_name}</li>
                    ))}
                </ul>
            </section>

            {/* Winners */}
            <section>
                <h3>Winners</h3>
                {drawn.length === 0 && (
                    <p className="muted">No winners yet</p>
                )}
                <ol style={{ marginTop: 12 }}>
                    {drawn.map((d) => (
                        <li
                            key={d.id}
                            style={{
                                fontSize: 18,
                                fontWeight: 600,
                                marginBottom: 8,
                            }}
                        >
                            {d.display_name}
                        </li>
                    ))}
                </ol>
            </section>
        </div>
    );
}
