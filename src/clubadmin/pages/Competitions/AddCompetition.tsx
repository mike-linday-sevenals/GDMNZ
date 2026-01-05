// ============================================================================
// File: AddCompetition.tsx
// Path: src/clubadmin/pages/Competitions/AddCompetition.tsx
// ============================================================================

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

// 🔄 Migrated API import (clubadmin-scoped)
import {
    addCompetition,
    listCompetitionTypes,
    listCompModes,
    listPrizeModes,
} from "@/clubadmin/api/competitions";

/* ============================================================================
   TYPES
   ========================================================================== */
type Props = {
    onClose?: () => void; // optional for modal usage
};

/* ============================================================================
   ADD COMPETITION
   ========================================================================== */
export default function AddCompetition({ onClose }: Props) {
    const navigate = useNavigate();
    const { organisationId } = useParams<{ organisationId: string }>();

    // Core fields
    const [name, setName] = useState("");
    const [startsAt, setStartsAt] = useState("");
    const [endsAt, setEndsAt] = useState("");
    const [saving, setSaving] = useState(false);

    // Lookups
    const [competitionTypes, setCompetitionTypes] = useState<any[]>([]);
    const [compModes, setCompModes] = useState<any[]>([]);
    const [prizeModes, setPrizeModes] = useState<any[]>([]);

    // Selected values
    const [competitionTypeId, setCompetitionTypeId] = useState<string | null>(null);
    const [compModeId, setCompModeId] = useState<string | null>(null);
    const [prizeModeId, setPrizeModeId] = useState<string | null>(null);

    /* ============================================================
       LOAD LOOKUPS
       ============================================================ */
    useEffect(() => {
        (async () => {
            try {
                const [types, modes, prizes] = await Promise.all([
                    listCompetitionTypes(),
                    listCompModes(),
                    listPrizeModes(),
                ]);

                setCompetitionTypes(types);
                setCompModes(modes);
                setPrizeModes(prizes);

                // Sensible defaults
                if (types.length) setCompetitionTypeId(types[0].id);
                if (modes.length) setCompModeId(modes[0].id);
                if (prizes.length) setPrizeModeId(prizes[0].id);
            } catch (err) {
                console.error(err);
                alert("Failed to load competition configuration options");
            }
        })();
    }, []);

    /* ============================================================
       ACTIONS
       ============================================================ */
    function close() {
        if (onClose) {
            onClose();
        } else if (organisationId) {
            navigate(`/clubadmin/${organisationId}/admin/competitions`, {
                replace: true,
            });
        }
    }

    async function save() {
        if (!organisationId) {
            alert("Organisation context missing");
            return;
        }

        try {
            setSaving(true);

            await addCompetition(organisationId, {
                name,
                starts_at: startsAt,
                ends_at: endsAt,
                competition_type_id: competitionTypeId,
                comp_mode_id: compModeId,
                prize_mode_id: prizeModeId,
            });

            // ✅ Navigate back to list
            navigate(`/clubadmin/${organisationId}/admin/competitions`, {
                replace: true,
            });

            // ✅ FORCE reload so parent list refreshes
            navigate(0);
        } catch (err) {
            console.error(err);
            alert("Failed to add competition");
        } finally {
            setSaving(false);
        }
    }

    /* ============================================================
       RENDER
       ============================================================ */
    return (
        <section className="card admin-card">
            {/* ================= HEADER ================= */}
            <h2>Add Competition</h2>

            <div style={{ marginBottom: 16 }}>
                {!onClose && (
                    <button className="btn btn--lg" onClick={close}>
                        ← Back
                    </button>
                )}
            </div>

            {/* ================= BASIC DETAILS ================= */}
            <div className="form-grid">
                <div className="field span-6">
                    <label>Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Competition name"
                    />
                </div>

                <div className="field span-3">
                    <label>Start date</label>
                    <input
                        type="date"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                    />
                </div>

                <div className="field span-3">
                    <label>End date</label>
                    <input
                        type="date"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                    />
                </div>
            </div>

            {/* ================= COMPETITION RULES ================= */}
            <div className="form-grid" style={{ marginTop: 16 }}>
                {/* Competition Type */}
                <div className="field span-6">
                    <label>Competition type</label>
                    <select
                        value={competitionTypeId ?? ""}
                        onChange={(e) => setCompetitionTypeId(e.target.value)}
                    >
                        {competitionTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                    <p className="muted" style={{ marginTop: 4 }}>
                        {
                            competitionTypes.find(
                                (t) => t.id === competitionTypeId
                            )?.description
                        }
                    </p>
                </div>

                {/* Competition Mode */}
                <div className="field span-6">
                    <label>Competition mode</label>
                    <select
                        value={compModeId ?? ""}
                        onChange={(e) => setCompModeId(e.target.value)}
                    >
                        {compModes.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.name === "weight" && "Weight (weigh-in)"}
                                {m.name === "length" && "Length (measure / photo)"}
                                {m.name === "mixed" && "Both (weight & length)"}
                            </option>
                        ))}
                    </select>
                    <p className="muted" style={{ marginTop: 4 }}>
                        How fish are recorded and ranked for results.
                    </p>
                </div>

                {/* Prize Mode */}
                <div className="field span-6">
                    <label>Prize grouping</label>
                    <select
                        value={prizeModeId ?? ""}
                        onChange={(e) => setPrizeModeId(e.target.value)}
                    >
                        {prizeModes.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                    <p className="muted" style={{ marginTop: 4 }}>
                        Whether prizes are combined or split (e.g. Adults / Juniors).
                    </p>
                </div>
            </div>

            {/* ================= ACTIONS ================= */}
            <div className="actions span-12" style={{ marginTop: 24 }}>
                <button className="btn" onClick={close}>
                    Cancel
                </button>

                <button
                    className="btn primary btn--lg"
                    disabled={
                        saving ||
                        !name ||
                        !startsAt ||
                        !endsAt ||
                        !competitionTypeId ||
                        !compModeId ||
                        !prizeModeId
                    }
                    onClick={save}
                >
                    {saving ? "Saving…" : "Save Competition"}
                </button>
            </div>
        </section>
    );
}
