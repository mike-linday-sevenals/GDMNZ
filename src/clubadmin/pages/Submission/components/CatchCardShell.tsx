// ============================================================================
// CatchCardShell.tsx
// ============================================================================

import { useSubmission } from "../SubmissionContext";
import SportCatchCard from "./SportCatchCard";
import GameCatchCard from "./GameCatchCard";

type Props = {
    competition: any;
};

export default function CatchCardShell({ competition }: Props) {
    const { draft, discipline } = useSubmission();

    if (!competition) {
        return null;
    }

    if (!draft.competitor_id) {
        return (
            <div className="card muted">
                Select an angler to submit a catch.
            </div>
        );
    }

    if (!discipline) {
        return (
            <div className="card muted">
                Select Sport or Game to continue.
            </div>
        );
    }

    return (
        <>
            {discipline === "sport" && <SportCatchCard />}
            {discipline === "game" && <GameCatchCard />}
        </>
    );
}
