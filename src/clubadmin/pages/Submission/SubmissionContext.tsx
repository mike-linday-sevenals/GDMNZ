// ============================================================================
// SubmissionContext.tsx
// Central submission state, validation, and submit pipeline
// ============================================================================

import {
    createContext,
    useContext,
    useState,
    ReactNode,
    useCallback,
} from "react";
import { useParams } from "react-router-dom";
import type { Species } from "@/types";

import {
    createCatchSubmission,
    CatchSubmissionSubmitPayload,
} from "@/clubadmin/api/submission";

// ============================================================================
// TYPES
// ============================================================================

export type FishingDiscipline = "sport" | "game" | "mixed";
export type CompetitionMode = "weight" | "length" | "both";

// Fish type (from fish_type table)
export type FishType = {
    id: string;
    name: string;
};

// ============================================================================
// SUBMISSION DRAFT (DOMAIN-CORRECT)
// ============================================================================

export type SubmissionDraft = {
    competitor_id: string | null;
    competition_day_id: string | null;

    species_id: number | null;
    species_name: string | null;

    /**
     * GAME FISHING ONLY
     */
    outcome: "landed" | "tagged_released" | null;

    /**
     * Tag & release only
     */
    tag_number: string | null;

    /**
     * SPORT + GAME
     */
    measurement: "weighed" | "length" | null;

    /**
     * Measurements
     */
    weight_kg: number | null;
    estimated_weight_kg: number | null;
    length_cm: number | null;

    /**
     * Catch metadata
     */
    date_caught: string;
    hooked_time: string | null;
    landed_time: string | null;
    location: string | null;

    /**
     * Courtesy weigh
     */
    is_courtesy_weigh: boolean;
    courtesy_club_name: string | null;
    host_club_number: string | null;

    /**
     * People / notes
     */
    skipper_name: string | null;
    notes: string | null;
};

// ============================================================================
// DRAFT SUBSETS (used by submit builders)
// ============================================================================

export type SportCatchDraft = Pick<
    SubmissionDraft,
    | "species_id"
    | "species_name"
    | "weight_kg"
    | "estimated_weight_kg"
    | "length_cm"
    | "date_caught"
    | "hooked_time"
    | "landed_time"
    | "notes"
>;


// ============================================================================
// VALIDATION TYPES
// ============================================================================

export type SubmissionValidationError = {
    field?: keyof SubmissionDraft | "competitionId" | "discipline";
    message: string;
};

export type SubmissionValidationResult = {
    valid: boolean;
    errors: SubmissionValidationError[];
};

// ============================================================================
// CONTEXT SHAPE
// ============================================================================

type SubmissionContextValue = {
    organisationId: string | null;

    competitionId: string | null;
    setCompetitionId: (id: string | null) => void;

    competitionMode: CompetitionMode | null;
    setCompetitionMode: (m: CompetitionMode | null) => void;

    discipline: FishingDiscipline | null;
    setDiscipline: (d: FishingDiscipline | null) => void;

    species: Species[];
    setSpecies: (s: Species[]) => void;

    fishTypes: FishType[];
    setFishTypes: (f: FishType[]) => void;

    draft: SubmissionDraft;
    setDraft: React.Dispatch<React.SetStateAction<SubmissionDraft>>;

    validateDraft: () => SubmissionValidationResult;
    submitDraft: () => Promise<void>;

    // ✅ NEW — used after ConfirmModal submit
    resetDraftForNextEntry: () => void;
};

// ============================================================================

const SubmissionContext =
    createContext<SubmissionContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function SubmissionProvider({ children }: { children: ReactNode }) {
    const { organisationId } = useParams<{ organisationId: string }>();

    const [competitionId, setCompetitionId] = useState<string | null>(null);
    const [competitionMode, setCompetitionMode] =
        useState<CompetitionMode | null>(null);
    const [discipline, setDiscipline] =
        useState<FishingDiscipline | null>(null);

    const [species, setSpecies] = useState<Species[]>([]);
    const [fishTypes, setFishTypes] = useState<FishType[]>([]);

    const [draft, setDraft] = useState<SubmissionDraft>({
        competitor_id: null,
        competition_day_id: null,

        species_id: null,
        species_name: null,

        outcome: null,
        tag_number: null,

        measurement: null,

        weight_kg: null,
        estimated_weight_kg: null,
        length_cm: null,

        date_caught: new Date().toISOString().slice(0, 10),
        hooked_time: null,
        landed_time: null,
        location: null,

        is_courtesy_weigh: false,
        courtesy_club_name: null,
        host_club_number: null,

        skipper_name: null,
        notes: null,
    });

    // ---------------------------------------------------------------------
    // RESET (used after successful submit)
    // ---------------------------------------------------------------------

    const resetDraftForNextEntry = useCallback(() => {
        setDraft({
            competitor_id: null,
            competition_day_id: null,

            species_id: null,
            species_name: null,

            outcome: null,
            tag_number: null,

            measurement: null,

            weight_kg: null,
            estimated_weight_kg: null,
            length_cm: null,

            date_caught: new Date().toISOString().slice(0, 10),
            hooked_time: null,
            landed_time: null,
            location: null,

            is_courtesy_weigh: false,
            courtesy_club_name: null,
            host_club_number: null,

            skipper_name: null,
            notes: null,
        });
    }, []);

    // ---------------------------------------------------------------------
    // VALIDATION
    // ---------------------------------------------------------------------

    const validateDraft = useCallback((): SubmissionValidationResult => {
        const errors: SubmissionValidationError[] = [];

        if (!competitionId) {
            errors.push({
                field: "competitionId",
                message: "Select a competition.",
            });
        }

        if (!discipline) {
            errors.push({
                field: "discipline",
                message: "Select Sport Fish or Game Fish.",
            });
        }

        if (!draft.competitor_id) {
            errors.push({
                field: "competitor_id",
                message: "Select a competitor.",
            });
        }

        if (!draft.species_id || !draft.species_name) {
            errors.push({
                field: "species_id",
                message: "Select a species.",
            });
        }

        const measurements = [
            draft.weight_kg,
            draft.length_cm,
            draft.estimated_weight_kg,
        ].filter(v => v != null);

        if (measurements.length === 0) {
            errors.push({
                message: "Enter a weight, length, or estimated weight.",
            });
        }

        if (measurements.length > 1) {
            errors.push({
                message:
                    "Only one measurement is allowed (weight, length, or estimate).",
            });
        }

        if (discipline === "game") {
            if (!draft.outcome) {
                errors.push({
                    field: "outcome",
                    message:
                        "Game fishing requires landed or tagged & released.",
                });
            }

            if (draft.outcome === "tagged_released" && !draft.tag_number) {
                errors.push({
                    field: "tag_number",
                    message:
                        "Tag number is required for tagged & released fish.",
                });
            }
        }

        if (!draft.date_caught) {
            errors.push({
                field: "date_caught",
                message: "Catch date is required.",
            });
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }, [draft, discipline, competitionId]);

    // ---------------------------------------------------------------------
    // SUBMIT
    // ---------------------------------------------------------------------

    const submitDraft = useCallback(async () => {
        const result = validateDraft();
        if (!result.valid) {
            throw new Error("Submission is invalid.");
        }

        const timeCaught =
            draft.landed_time ??
            draft.hooked_time ??
            "00:00";

        const priority_timestamp = new Date(
            `${draft.date_caught}T${timeCaught}`
        ).toISOString();

        const payload: CatchSubmissionSubmitPayload = {
            competition_id: competitionId!,
            division_id: null,

            competitor_id: draft.competitor_id!,

            boat_name: "",
            boat_type: null,

            fishing_discipline: discipline!,

            species_id: draft.species_id!,
            species_name: draft.species_name!,

            gender: null,

            outcome: draft.outcome,

            weight_kg: draft.weight_kg,
            length_cm: draft.length_cm,
            estimated_weight_kg: draft.estimated_weight_kg,

            tag_number: draft.tag_number,
            tag_authority: null,

            date_caught: draft.date_caught,
            time_caught: timeCaught,
            priority_timestamp,

            hooked_time: draft.hooked_time ?? null,
            landed_time: draft.landed_time ?? null,
            skipper_name: draft.skipper_name ?? null,
            location: draft.location ?? null,

            notes: draft.notes ?? null,
            source: "ui",
        };

        await createCatchSubmission(payload);
    }, [draft, discipline, competitionId, validateDraft]);

    // ---------------------------------------------------------------------

    return (
        <SubmissionContext.Provider
            value={{
                organisationId: organisationId ?? null,

                competitionId,
                setCompetitionId,

                competitionMode,
                setCompetitionMode,

                discipline,
                setDiscipline,

                species,
                setSpecies,

                fishTypes,
                setFishTypes,

                draft,
                setDraft,

                validateDraft,
                submitDraft,
                resetDraftForNextEntry,
            }}
        >
            {children}
        </SubmissionContext.Provider>
    );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSubmission() {
    const ctx = useContext(SubmissionContext);
    if (!ctx) {
        throw new Error(
            "useSubmission must be used within SubmissionProvider"
        );
    }
    return ctx;
}
