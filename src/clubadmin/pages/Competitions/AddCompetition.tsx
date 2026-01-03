import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { addCompetition } from "@/services/api";

/* ============================================================================
   TYPES
   ========================================================================== */
type Props = {
    onClose?: () => void; // optional for modal usage
};

/* ============================================================================
   ADD COMPETITION
   - Matches EditCompetition layout & styling
   - Org-scoped
   - Works as modal OR routed page
   ========================================================================== */
export default function AddCompetition({ onClose }: Props) {
    const navigate = useNavigate();
    const { organisationId } = useParams<{ organisationId: string }>();

    const [name, setName] = useState("");
    const [startsAt, setStartsAt] = useState("");
    const [endsAt, setEndsAt] = useState("");
    const [saving, setSaving] = useState(false);

    function close() {
        if (onClose) {
            onClose(); // modal usage
        } else if (organisationId) {
            navigate(`/clubadmin/${organisationId}/admin/competitions`);
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
            });

            close();
        } catch (err) {
            console.error(err);
            alert("Failed to add competition");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="card admin-card">
            {/* ================= HEADER ================= */}
            <h2>Add Competition</h2>

            <div style={{ marginBottom: 16 }}>
                {!onClose && (
                    <Link to=".." className="btn btn--lg">
                        ← Back
                    </Link>
                )}
            </div>

            {/* ================= BASIC DETAILS ================= */}
            <div className="form-grid">
                <div className="field span-12">
                    <label>Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Competition name"
                    />
                </div>

                <div className="field span-6">
                    <label>Start date</label>
                    <input
                        type="date"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                    />
                </div>

                <div className="field span-6">
                    <label>End date</label>
                    <input
                        type="date"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                    />
                </div>
            </div>

            {/* ================= ACTIONS ================= */}
            <div className="actions span-12" style={{ marginTop: 24 }}>
                <button className="btn" onClick={close}>
                    Cancel
                </button>

                <button
                    className="btn primary btn--lg"
                    disabled={saving || !name || !startsAt || !endsAt}
                    onClick={save}
                >
                    {saving ? "Saving…" : "Save Competition"}
                </button>
            </div>
        </section>
    );
}
