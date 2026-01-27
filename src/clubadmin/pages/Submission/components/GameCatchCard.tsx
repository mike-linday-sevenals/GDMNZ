// ============================================================================
// GameCatchCard.tsx
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { useSubmission } from "../SubmissionContext";
import ConfirmModal from "@/components/ConfirmModal";

// ============================================================================
// Component
// ============================================================================

export default function GameCatchCard() {
    const {
        discipline,
        competitionId,
        draft,
        setDraft,
        species,
        fishTypes,
        validateDraft,
        submitDraft,
        resetDraftForNextEntry,
    } = useSubmission();

    const [errors, setErrors] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // ------------------------------------------------------------------
    // Guards
    // ------------------------------------------------------------------

    if (discipline !== "game") return null;
    if (!draft.competitor_id) return null;

    // ------------------------------------------------------------------
    // Resolve Game Fish type
    // ------------------------------------------------------------------

    const gameFishTypeId = useMemo(() => {
        return fishTypes.find(f => f.name === "Game Fish")?.id ?? null;
    }, [fishTypes]);

    const gameSpecies = useMemo(() => {
        if (!gameFishTypeId) return [];
        return species.filter(s => s.fish_type_id === gameFishTypeId);
    }, [species, gameFishTypeId]);

    // ------------------------------------------------------------------
    // Clear invalid species
    // ------------------------------------------------------------------

    useEffect(() => {
        if (
            draft.species_id &&
            !gameSpecies.some(s => s.id === draft.species_id)
        ) {
            setDraft(d => ({
                ...d,
                species_id: null,
                species_name: null,
                outcome: null,
                tag_number: null,
                weight_kg: null,
                estimated_weight_kg: null,
            }));
        }
    }, [gameSpecies, draft.species_id, setDraft]);

    // ------------------------------------------------------------------
    // Validate on change
    // ------------------------------------------------------------------

    useEffect(() => {
        const result = validateDraft();
        setErrors(result.errors.map(e => e.message));
    }, [draft, validateDraft]);

    const canSubmit = errors.length === 0 && !submitting;

    // ------------------------------------------------------------------
    // Confirmed submit
    // ------------------------------------------------------------------

    async function confirmSubmit() {
        try {
            setSubmitting(true);
            setErrors([]);

            await submitDraft();

            // 🔑 Reset for next entry
            resetDraftForNextEntry();

            setShowConfirm(false);
        } catch (err: any) {
            setErrors([err?.message ?? "Failed to submit catch"]);
            setShowConfirm(false);
        } finally {
            setSubmitting(false);
        }
    }

    // ------------------------------------------------------------------
    // Debug preview
    // ------------------------------------------------------------------

    const submissionPreview = useMemo(() => {
        return {
            competition_id: competitionId,
            competition_day_id: draft.competition_day_id,

            discipline,
            competitor_id: draft.competitor_id,

            species_id: draft.species_id,
            species_name: draft.species_name,

            outcome: draft.outcome,
            tag_number: draft.tag_number,

            weight_kg: draft.weight_kg,
            estimated_weight_kg: draft.estimated_weight_kg,

            date_caught: draft.date_caught,
            hooked_time: draft.hooked_time,
            landed_time: draft.landed_time,

            skipper_name: draft.skipper_name,
            location: draft.location,

            notes: draft.notes,
        };
    }, [competitionId, discipline, draft]);

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    return (
        <div className="card">
            <h3>Game Catch</h3>

            {/* ================= INPUT ROW ================= */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
                    gap: 12,
                    alignItems: "end",
                }}
            >
                {/* Species */}
                <div className="field">
                    <label>Species</label>
                    <select
                        value={draft.species_id ?? ""}
                        onChange={e => {
                            const id = e.target.value
                                ? Number(e.target.value)
                                : null;

                            const selected = gameSpecies.find(
                                s => s.id === id
                            );

                            setDraft(d => ({
                                ...d,
                                species_id: id,
                                species_name: selected?.name ?? null,
                                outcome: null,
                                tag_number: null,
                                weight_kg: null,
                                estimated_weight_kg: null,
                            }));
                        }}
                    >
                        <option value="">— Select species —</option>
                        {gameSpecies.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Outcome */}
                <div className="field">
                    <label>Outcome</label>
                    <select
                        value={draft.outcome ?? ""}
                        onChange={e =>
                            setDraft(d => ({
                                ...d,
                                outcome: e.target.value
                                    ? (e.target.value as
                                        | "landed"
                                        | "tagged_released")
                                    : null,
                                tag_number: null,
                                weight_kg: null,
                                estimated_weight_kg: null,
                            }))
                        }
                    >
                        <option value="">— Select —</option>
                        <option value="landed">Landed</option>
                        <option value="tagged_released">
                            Tagged / Released
                        </option>
                    </select>
                </div>

                {/* Tag number */}
                {draft.outcome === "tagged_released" && (
                    <div className="field">
                        <label>Tag number</label>
                        <input
                            type="text"
                            placeholder="e.g. NZ-12345"
                            value={draft.tag_number ?? ""}
                            onChange={e =>
                                setDraft(d => ({
                                    ...d,
                                    tag_number: e.target.value || null,
                                }))
                            }
                        />
                    </div>
                )}

                {/* Weight / Estimated weight */}
                {draft.outcome && (
                    <div className="field">
                        <label>
                            {draft.outcome === "landed"
                                ? "Weight (kg)"
                                : "Estimated weight (kg)"}
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={
                                draft.outcome === "landed"
                                    ? draft.weight_kg ?? ""
                                    : draft.estimated_weight_kg ?? ""
                            }
                            onChange={e =>
                                setDraft(d => ({
                                    ...d,
                                    weight_kg:
                                        draft.outcome === "landed"
                                            ? e.target.value
                                                ? Number(e.target.value)
                                                : null
                                            : null,
                                    estimated_weight_kg:
                                        draft.outcome === "tagged_released"
                                            ? e.target.value
                                                ? Number(e.target.value)
                                                : null
                                            : null,
                                }))
                            }
                        />
                    </div>
                )}
            </div>

            {/* ================= ERRORS ================= */}
            {errors.length > 0 && (
                <div style={{ marginTop: 10, color: "#b42318" }}>
                    {errors.map((e, i) => (
                        <div key={i}>• {e}</div>
                    ))}
                </div>
            )}

            {/* ================= DEBUG PREVIEW ================= */}
            <div
                style={{
                    marginTop: 16,
                    padding: 12,
                    border: "1px dashed var(--border)",
                    borderRadius: 8,
                    background: "#fafafa",
                    fontSize: 12,
                }}
            >
                <strong>Submission preview</strong>
                <pre>{JSON.stringify(submissionPreview, null, 2)}</pre>
            </div>

            {/* ================= ACTIONS ================= */}
            <div style={{ marginTop: 12 }}>
                <button
                    className={`btn ${canSubmit ? "primary" : "btn--ghost"}`}
                    disabled={!canSubmit}
                    onClick={() => setShowConfirm(true)}
                >
                    Submit Catch
                </button>
            </div>

            {/* ================= CONFIRM MODAL ================= */}
            {showConfirm && (
                <ConfirmModal
                    title="Confirm game catch submission"
                    message="Are you sure you want to submit this game catch? You’ll be taken to the next angler."
                    confirmLabel="Submit catch"
                    cancelLabel="Review"
                    onCancel={() => setShowConfirm(false)}
                    onConfirm={confirmSubmit}
                />
            )}
        </div>
    );
}
