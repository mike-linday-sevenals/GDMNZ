// ============================================================================
// File: AddCompetition.tsx
// Path: src/clubadmin/pages/Competitions/AddCompetition.tsx
// ============================================================================

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Club-admin scoped APIs
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
    onClose?: () => void;
};

type Lookup = {
    id: string;
    name: string;
    description?: string | null;
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
    const [competitionTypes, setCompetitionTypes] = useState<Lookup[]>([]);
    const [compModes, setCompModes] = useState<Lookup[]>([]);
    const [prizeModes, setPrizeModes] = useState<Lookup[]>([]);

    // Selected values
    const [competitionTypeId, setCompetitionTypeId] = useState<string | null>(null);
    const [compModeId, setCompModeId] = useState<string | null>(null);
    const [prizeModeId, setPrizeModeId] = useState<string | null>(null);

    // ✅ Briefing required
    const [briefingRequired, setBriefingRequired] = useState<boolean>(false);

    // Info popovers
    const [infoOpen, setInfoOpen] =
        useState<null | "type" | "mode" | "prize" | "briefing">(null);

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
                briefing_required: briefingRequired,
            });

            navigate(`/clubadmin/${organisationId}/admin/competitions`, {
                replace: true,
            });
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
            <h2>Add Competition</h2>

            {/* ================= BASIC DETAILS ================= */}
            <div className="form-grid">
                <div className="field span-6">
                    <label>Name</label>
                    <input
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

            {/* ================= RULES ================= */}
            <div className="form-grid" style={{ marginTop: 16 }}>
                {/* Competition Type */}
                <div className="field span-6">
                    <label>Competition type</label>
                    <select
                        value={competitionTypeId ?? ""}
                        onChange={(e) =>
                            setCompetitionTypeId(e.target.value || null)
                        }
                    >
                        <option value="">Select competition type</option>
                        {competitionTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Competition Mode */}
                <div className="field span-6">
                    <label>Competition mode</label>
                    <select
                        value={compModeId ?? ""}
                        onChange={(e) =>
                            setCompModeId(e.target.value || null)
                        }
                    >
                        <option value="">Select competition mode</option>
                        {compModes.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Prize Grouping */}
                <div className="field span-6">
                    <label>Prize grouping</label>
                    <select
                        value={prizeModeId ?? ""}
                        onChange={(e) =>
                            setPrizeModeId(e.target.value || null)
                        }
                    >
                        <option value="">Select prize grouping</option>
                        {prizeModes.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* ✅ BRIEFING REQUIRED */}
                <div className="field span-6">
                    <label>Briefing required</label>

                    <div className="segmented">
                        <button
                            type="button"
                            className={`segmented-btn ${briefingRequired ? "active" : ""}`}
                            onClick={() => setBriefingRequired(true)}
                        >
                            Yes
                        </button>

                        <button
                            type="button"
                            className={`segmented-btn ${!briefingRequired ? "active" : ""}`}
                            onClick={() => setBriefingRequired(false)}
                        >
                            No
                        </button>
                    </div>
                </div>
            </div>

            {/* ================= ACTIONS ================= */}
            <div className="actions" style={{ marginTop: 24 }}>
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
