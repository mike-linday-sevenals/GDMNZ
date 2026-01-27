// ============================================================================
// AnglerBoatPicker.tsx
// ============================================================================

import { useMemo, useState } from "react";
import type { Competitor } from "@/types";

// ============================================================================
// Props
// ============================================================================

type Props = {
    competitors: Competitor[];
    onSelect: (competitor: Competitor) => void;
    onClose: () => void;
};

// ============================================================================
// Component
// ============================================================================

export default function AnglerBoatPicker({
    competitors,
    onSelect,
    onClose,
}: Props) {
    const [search, setSearch] = useState("");
    const [draftBoat, setDraftBoat] = useState<string | null>(null);
    const [draftCompetitor, setDraftCompetitor] =
        useState<Competitor | null>(null);

    // ------------------------------------------------------------------
    // Derived
    // ------------------------------------------------------------------

    const boats = useMemo(() => {
        const map = new Map<string, Competitor[]>();

        competitors.forEach(c => {
            const boat = c.boat || "No boat";
            if (!map.has(boat)) map.set(boat, []);
            map.get(boat)!.push(c);
        });

        return [...map.entries()].map(([boat, competitors]) => ({
            boat,
            competitors,
        }));
    }, [competitors]);

    const q = search.toLowerCase().trim();

    const filteredBoats = boats.filter(
        b =>
            b.boat.toLowerCase().includes(q) ||
            b.competitors.some(c =>
                c.full_name.toLowerCase().includes(q)
            )
    );

    const filteredCompetitors = competitors.filter(
        c =>
            c.full_name.toLowerCase().includes(q) ||
            (c.boat || "").toLowerCase().includes(q)
    );

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    return (
        <div className="modal-backdrop">
            <div className="modal-shell">
                <h3>Select Angler / Boat</h3>

                <input
                    type="text"
                    placeholder="Search angler or boat…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                />

                <div className="modal-lists">
                    <div className="modal-list">
                        <strong>Boats</strong>
                        {filteredBoats.map(b => {
                            const active = draftBoat === b.boat;

                            return (
                                <div
                                    key={b.boat}
                                    className={`modal-row ${active ? "active" : ""}`}
                                    onClick={() => {
                                        if (active) {
                                            setDraftBoat(null);
                                            setDraftCompetitor(null);
                                        } else {
                                            setDraftBoat(b.boat);
                                            setDraftCompetitor(null);
                                        }
                                    }}
                                >
                                    🚤 {b.boat}
                                </div>
                            );
                        })}
                    </div>

                    <div className="modal-list">
                        <strong>Anglers</strong>
                        {filteredCompetitors
                            .filter(
                                c =>
                                    !draftBoat ||
                                    (c.boat || "No boat") === draftBoat
                            )
                            .map(c => (
                                <div
                                    key={c.id}
                                    className={`modal-row ${draftCompetitor?.id === c.id
                                            ? "active"
                                            : ""
                                        }`}
                                    onClick={() => {
                                        setDraftCompetitor(c);
                                        setDraftBoat(c.boat || "No boat");
                                    }}
                                >
                                    👤 {c.full_name}
                                </div>
                            ))}
                    </div>
                </div>

                <div className="modal-actions">
                    <button
                        className="btn"
                        onClick={onClose}
                    >
                        Cancel
                    </button>

                    <button
                        className="btn primary"
                        disabled={!draftCompetitor}
                        onClick={() => {
                            if (draftCompetitor) {
                                onSelect(draftCompetitor);
                            }
                        }}
                    >
                        Select
                    </button>
                </div>
            </div>
        </div>
    );
}
