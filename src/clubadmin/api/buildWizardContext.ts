import type { Competition } from "@/types";

import type {
    WizardContext,
    CompetitionDiscipline,
    ResultMethod,
    PrizeTargetKind,
    OutcomeFilter,
} from "@/clubadmin/api/WizardContext";

export function buildWizardContext(params: {
    competition: Competition;

    divisions: {
        id: string;
        code: string;
        name: string;
        sort_order: number;
        is_default: boolean;
    }[];
}): WizardContext {
    const { competition, divisions } = params;

    // ---------------------------------------------------------------------
    // Discipline
    // ---------------------------------------------------------------------
    const discipline: CompetitionDiscipline =
        competition.competition_type?.code === "game"
            ? "game"
            : competition.competition_type?.code === "sport"
                ? "sport"
                : "mixed";

    // ---------------------------------------------------------------------
    // Result methods (weight / length)
    // ---------------------------------------------------------------------
    let allowedResultMethods: ResultMethod[] = [];

    const compModeName =
        competition.comp_mode?.name?.toLowerCase?.() ?? "";

    if (compModeName.includes("weight") && compModeName.includes("length")) {
        allowedResultMethods = ["weighed", "measured"];
    } else if (compModeName.includes("length")) {
        allowedResultMethods = ["measured"];
    } else {
        // default to weight
        allowedResultMethods = ["weighed"];
    }

    // ---------------------------------------------------------------------
    // Prize target kinds
    // ---------------------------------------------------------------------
    const allowedTargetKinds: PrizeTargetKind[] = [
        "species",
        "group",
        "spot",
    ];

    // ---------------------------------------------------------------------
    // Award rules
    // ---------------------------------------------------------------------
    const allowedAwardRules = ["ranked", "first"] as const;

    // ---------------------------------------------------------------------
    // Outcomes (game fishing semantics)
    // ---------------------------------------------------------------------
    let allowedOutcomes: OutcomeFilter[];

    if (discipline === "sport") {
        allowedOutcomes = ["landed"];
    } else {
        // game + mixed
        allowedOutcomes = ["any", "landed", "tagged_released"];
    }

    // ---------------------------------------------------------------------
    // Divisions
    // ---------------------------------------------------------------------
    const prizeMode =
        competition.prize_mode?.name === "Multiple Divisions"
            ? "multiple"
            : "single";

    const supportsDivisions = prizeMode === "multiple";

    const defaultDivision =
        divisions.find((d) => d.is_default) ?? null;

    // ---------------------------------------------------------------------
    // Final context
    // ---------------------------------------------------------------------
    return {
        competitionId: competition.id,

        discipline,
        allowedResultMethods,

        allowedTargetKinds,
        allowedAwardRules: [...allowedAwardRules],

        allowedOutcomes,

        prizeMode,
        supportsDivisions,

        availableDivisions: divisions,
        defaultDivisionId: defaultDivision?.id ?? null,
    };
}
