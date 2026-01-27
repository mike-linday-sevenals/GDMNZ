// ============================================================================
// DrawRandomListPage.tsx
// Description:
//  - Run & manage a deterministic random draw (MT19937)
//  - Schema-aligned with random_list + random_list_entry
// ============================================================================

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { client } from "@/services/api";

// ============================================================================
// Types (schema-aligned)
// ============================================================================

type RandomList = {
    id: string;
    name: string;
    description: string | null;
    status: "draft" | "randomised" | "completed";
    randomised_at: string | null;
};

type RandomListEntry = {
    id: string;
    display_name: string;
    random_order: number | null;
    selected_at: string | null;
    selected_order: number | null;
};

// ============================================================================
// Component
// ============================================================================

export default function DrawRandomListPage() {
    const { randomListId } = useParams<{ randomListId: string }>();

    const [list, setList] = useState<RandomList | null>(null);
    const [remaining, setRemaining] = useState<RandomListEntry[]>([]);
    const [drawn, setDrawn] = useState<RandomListEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ------------------------------------------------------------------
    // Load list + entries
    // ------------------------------------------------------------------

    async function loadData() {
        try {
            if (!client) throw new Error("Supabase not initialised");
            if (!randomListId) throw new Error("Missing random list id");

            setLoading(true);
            setError(null);

            // Load list
            const { data: listData, error: listError } = await client
                .from("random_list")
                .select("id, name, description, status, randomised_at")
                .eq("id", randomListId)
                .single();

            if (listError) throw listError;
            setList(listData);

            // Load remaining (not yet drawn)
            const { data: remainingData, error: remainingError } =
                await client
                    .from("random_list_entry")
                    .select(
                        "id, display_name, random_order, selected_at, selected_order"
                    )
                    .eq("random_list_id", randomListId)
                    .is("selected_at", null)
                    .order("random_order");

            if (remainingError) throw remainingError;
            setRemaining(remainingData ?? []);

            // Load drawn
            const { data: drawnData, error: drawnError } = await client
                .from("random_list_entry")
                .select(
                    "id, display_name, random_order, selected_at, selected_order"
                )
                .eq("random_list_id", randomListId)
                .not("selected_at", "is", null)
                .order("selected_order");

            if (drawnError) throw drawnError;
            setDrawn(drawnData ?? []);
        } catch (err: any) {
            setError(err.message ?? "Failed to load draw");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, [randomListId]);

    // ------------------------------------------------------------------
    // Run randomisation (RPC)
    // ------------------------------------------------------------------

    async function handleRandomise() {
        try {
            if (!client) throw new Error("Supabase not initialised");

            const { error } = await client.rpc(
                "persist_random_list_order",
                {
                    p_random_list_id: randomListId,
                }
            );

            if (error) throw error;

            await loadData();
        } catch (err: any) {
            alert(err.message ?? "Failed to randomise");
        }
    }

    // ------------------------------------------------------------------
    // Draw next entry (RPC)
    // ------------------------------------------------------------------

    async function handleDrawNext() {
        try {
            if (!client) throw new Error("Supabase not initialised");

            const { error } = await client.rpc("draw_next_random_list_entry", {
                p_random_list_id: randomListId,
            });

            if (error) throw error;

            await loadData();
        } catch (err: any) {
            alert(err.message ?? "Failed to draw next");
        }
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    if (loading) {
        return <div className="page">Loading draw…</div>;
    }

    if (error) {
        return <div className="page error">{error}</div>;
    }

    if (!list) {
        return <div className="page">Random list not found</div>;
    }

    const isRandomised = !!list.randomised_at;

    return (
        <div className="page random-draw-page">
            <h1>🎰 Random Draw</h1>

            <h3>{list.name}</h3>
            {list.description && (
                <p className="muted">{list.description}</p>
            )}

            {/* Actions */}
            <div className="actions">
                {!isRandomised && (
                    <button onClick={handleRandomise}>
                        Run Randomisation
                    </button>
                )}

                {isRandomised && remaining.length > 0 && (
                    <button onClick={handleDrawNext}>
                        Draw Next
                    </button>
                )}
            </div>

            {/* Remaining */}
            <section>
                <h4>Remaining ({remaining.length})</h4>
                <ul>
                    {remaining.map((e) => (
                        <li key={e.id}>{e.display_name}</li>
                    ))}
                </ul>
            </section>

            {/* Drawn */}
            <section>
                <h4>Drawn</h4>
                <ol>
                    {drawn.map((e) => (
                        <li key={e.id}>{e.display_name}</li>
                    ))}
                </ol>
            </section>
        </div>
    );
}
