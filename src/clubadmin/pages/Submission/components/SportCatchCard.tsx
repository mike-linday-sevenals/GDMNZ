// ============================================================================
// SportCatchCard.tsx
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { useSubmission } from "../SubmissionContext";
import ConfirmModal from "@/components/ConfirmModal";

// ============================================================================
// Component
// ============================================================================

export default function SportCatchCard() {
    const {
        discipline,
        competitionMode,
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

    if (discipline !== "sport") return null;
    if (!draft.competitor_id) return null;
    if (!competitionMode) return null;

    // ------------------------------------------------------------------
    // Resolve Sport Fish type
    // ------------------------------------------------------------------

    const sportFishTypeId = useMemo(() => {
        return fishTypes.find(f => f.name === "Sport Fish")?.id ?? null;
    }, [fishTypes]);

    const sportSpecies = useMemo(() => {
        if (!sportFishTypeId) return [];
        return species.filter(s => s.fish_type_id === sportFishTypeId);
    }, [species, sportFishTypeId]);

    // ------------------------------------------------------------------
    // Measurement options
    // ------------------------------------------------------------------

    const measurementOptions = useMemo<Array<"weighed" | "length">>(() => {
        if (competitionMode === "weight") return ["weighed"];
        if (competitionMode === "length") return ["length"];
        return ["weighed", "length"];
    }, [competitionMode]);

    // ------------------------------------------------------------------
    // Auto-select measurement if locked
    // ------------------------------------------------------------------

    useEffect(() => {
        if (
            measurementOptions.length === 1 &&
            draft.measurement !== measurementOptions[0]
        ) {
            setDraft(d => ({
                ...d,
                measurement: measurementOptions[0],
                weight_kg: null,
                length_cm: null,
            }));
        }
    }, [measurementOptions, draft.measurement, setDraft]);

    // ------------------------------------------------------------------
    // Clear invalid species
    // ------------------------------------------------------------------

    useEffect(() => {
        if (
            draft.species_id &&
            !sportSpecies.some(s => s.id === draft.species_id)
        ) {
            setDraft(d => ({
                ...d,
                species_id: null,
                species_name: null,
                measurement: null,
                weight_kg: null,
                length_cm: null,
            }));
        }
    }, [sportSpecies, draft.species_id, setDraft]);

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

            // 🔑 Reset for next entry (competition stays selected)
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

            measurement: draft.measurement,
            weight_kg: draft.weight_kg,
            length_cm: draft.length_cm,
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
            <h3>Sport Catch</h3>

            {/* ================= INPUT ROW ================= */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1.5fr",
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

                            const selected = sportSpecies.find(
                                s => s.id === id
                            );

                            setDraft(d => ({
                                ...d,
                                species_id: id,
                                species_name: selected?.name ?? null,
                                measurement:
                                    measurementOptions.length === 1
                                        ? measurementOptions[0]
                                        : null,
                                weight_kg: null,
                                length_cm: null,
                            }));
                        }}
                    >
                        <option value="">— Select species —</option>
                        {sportSpecies.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Measurement */}
                <div className="field">
                    <label>Measurement</label>
                    <select
                        value={draft.measurement ?? ""}
                        onChange={e =>
                            setDraft(d => ({
                                ...d,
                                measurement: e.target.value
                                    ? (e.target.value as
                                        | "weighed"
                                        | "length")
                                    : null,
                                weight_kg: null,
                                length_cm: null,
                            }))
                        }
                    >
                        <option value="">— Select —</option>
                        {measurementOptions.map(m => (
                            <option key={m} value={m}>
                                {m === "weighed" ? "Weight" : "Length"}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Measurement value */}
                {draft.measurement && (
                    <div className="field">
                        <label>
                            {draft.measurement === "length"
                                ? "Length (cm)"
                                : "Weight (kg)"}
                        </label>
                        <input
                            type="number"
                            step={draft.measurement === "length" ? 1 : 0.01}
                            value={
                                draft.measurement === "length"
                                    ? draft.length_cm ?? ""
                                    : draft.weight_kg ?? ""
                            }
                            onChange={e =>
                                setDraft(d => ({
                                    ...d,
                                    weight_kg:
                                        draft.measurement === "weighed"
                                            ? e.target.value
                                                ? Number(e.target.value)
                                                : null
                                            : null,
                                    length_cm:
                                        draft.measurement === "length"
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
                    title="Confirm catch submission"
                    message="Are you sure you want to submit this catch? You’ll be taken to the next angler."
                    confirmLabel="Submit catch"
                    cancelLabel="Review"
                    onCancel={() => setShowConfirm(false)}
                    onConfirm={confirmSubmit}
                />
            )}
        </div>
    );
}
    