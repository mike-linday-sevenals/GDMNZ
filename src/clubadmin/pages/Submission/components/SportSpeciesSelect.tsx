// ============================================================================
// src/clubadmin/pages/Submission/components/SportSpeciesSelect.tsx
// ============================================================================

import { useSubmission } from "../SubmissionContext";

// ============================================================================
// TYPES
// ============================================================================

export type SpeciesOption = {
    id: number;
    name: string;
};

// ============================================================================
// COMPONENT
// ============================================================================

type Props = {
    species: SpeciesOption[];
};

export default function SportSpeciesSelect({ species }: Props) {
    const { draft, setDraft } = useSubmission();

    return (
        <div className="field">
            <label>Species</label>

            <select
                value={draft.species_id ?? ""}
                onChange={(e) => {
                    const value = e.target.value;

                    if (!value) {
                        // Clear selection
                        setDraft((d) => ({
                            ...d,
                            species_id: null,
                            species_name: null,
                        }));
                        return;
                    }

                    const id = Number(value);
                    const selected = species.find((s) => s.id === id);

                    setDraft((d) => ({
                        ...d,
                        species_id: id,
                        species_name: selected?.name ?? null,
                    }));
                }}
            >
                <option value="">-- Select species --</option>

                {species.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.name}
                    </option>
                ))}
            </select>
        </div>
    );
}
