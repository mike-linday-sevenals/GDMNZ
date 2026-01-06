/* ============================================================================
   Component: SpeciesModal
   Purpose: Add / Edit Species (platform admin)
   Notes:
   - UI only
   - No state, no handlers
   ========================================================================== */

export default function SpeciesModal({
    mode = "add", // "add" | "edit"
}: {
    mode?: "add" | "edit";
}) {
    const isEdit = mode === "edit";

    return (
        <div className="modal-backdrop">
            <div className="modal-shell">
                {/* =====================================================
                   HEADER
                   =================================================== */}
                <h3>{isEdit ? "Edit Species" : "Add Species"}</h3>

                <p className="muted" style={{ marginBottom: 16 }}>
                    Species define what may be landed, weighed, or tagged
                    in fishing competitions.
                </p>

                {/* =====================================================
                   FORM
                   =================================================== */}
                <div className="form-grid">
                    {/* Fish Type */}
                    <div className="field span-6">
                        <label>Fish Type</label>
                        <select disabled={isEdit}>
                            <option>Game Fish</option>
                            <option>Sport Fish</option>
                            <option>Shellfish</option>
                        </select>
                        {isEdit && (
                            <small className="muted">
                                Fish type cannot be changed.
                            </small>
                        )}
                    </div>

                    {/* Species Group */}
                    <div className="field span-6">
                        <label>Species Group</label>
                        <select disabled={isEdit}>
                            <option>Marlin</option>
                            <option>Tuna</option>
                            <option>Snapper</option>
                            <option>Pelagic Inshore</option>
                        </select>
                        {isEdit && (
                            <small className="muted">
                                Group cannot be changed.
                            </small>
                        )}
                    </div>

                    {/* Species Name */}
                    <div className="field span-12">
                        <label>Species Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Blue Marlin"
                        />
                    </div>

                    {/* NZ Minimum Length */}
                    <div className="field span-6">
                        <label>NZ Minimum Length (mm)</label>
                        <input
                            type="number"
                            placeholder="Optional"
                        />
                        <small className="muted">
                            Leave blank if no NZ minimum applies.
                        </small>
                    </div>

                    {/* Status */}
                    <div className="field span-6">
                        <label>Status</label>
                        <select>
                            <option>Inactive</option>
                            <option>Active</option>
                        </select>
                        <small className="muted">
                            Inactive species are hidden from competition
                            setup.
                        </small>
                    </div>
                </div>

                {/* =====================================================
                   ACTIONS
                   =================================================== */}
                <div className="modal-actions">
                    <button className="btn">
                        Cancel
                    </button>
                    <button className="btn btn--lg primary">
                        {isEdit ? "Save Changes" : "Add Species"}
                    </button>
                </div>
            </div>
        </div>
    );
}
