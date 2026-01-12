// src/clubadmin/pages/CompetitionPrizes/WizardContext.ts

export type CompetitionDiscipline = "game" | "sport" | "mixed";
export type ResultMethod = "weighed" | "measured";
export type AwardRule = "ranked" | "first";
export type OutcomeFilter = "any" | "landed" | "tagged_released";

export type PrizeTargetKind = "species" | "group" | "spot";

export type WizardContext = {
    // ---------------------------------------------------------------------
    // Source identifiers (informational, not logic)
    // ---------------------------------------------------------------------
    competitionId: string;

    // ---------------------------------------------------------------------
    // Discipline & measurement constraints
    // ---------------------------------------------------------------------
    discipline: CompetitionDiscipline;

    allowedResultMethods: ResultMethod[];

    // ---------------------------------------------------------------------
    // Prize targeting
    // ---------------------------------------------------------------------
    allowedTargetKinds: PrizeTargetKind[];

    // ---------------------------------------------------------------------
    // Award logic
    // ---------------------------------------------------------------------
    allowedAwardRules: AwardRule[];

    // ---------------------------------------------------------------------
    // Outcomes (game fishing semantics)
    // ---------------------------------------------------------------------
    allowedOutcomes: OutcomeFilter[];

    // ---------------------------------------------------------------------
    // Division support (NOT part of wizard flow yet)
    // ---------------------------------------------------------------------
    prizeMode: "single" | "multiple";
    supportsDivisions: boolean;

    availableDivisions: {
        id: string;
        code: string;
        name: string;
        sort_order: number;
        is_default: boolean;
    }[];

    defaultDivisionId: string | null;
};
