// ============================================================================
// SubmissionPage.tsx
// ============================================================================

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { SubmissionProvider } from "./SubmissionContext";
import SubmissionHeader from "./components/SubmissionHeader";
import CatchCardShell from "./components/CatchCardShell";
import SubmittedFishReviewCard from "./components/SubmittedFishReviewCard";

import { listCompetitions } from "@/services/api";

// Keep this in sync with SubmissionHeader.tsx
type CompetitionSummary = {
    id: string;
    name: string;
    competition_type_code: "sport" | "game" | "mixed";
};

export default function SubmissionPage() {
    const { organisationId } = useParams<{ organisationId: string }>();

    const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
    const [competition, setCompetition] = useState<CompetitionSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const [showReview, setShowReview] = useState(false);

    // ------------------------------------------------------------------
    // Load competitions for org
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!organisationId) return;

        let mounted = true;

        (async () => {
            try {
                setLoading(true);
                const list = await listCompetitions(organisationId);
                if (!mounted) return;

                setCompetitions(list as CompetitionSummary[]);

                // Optional: auto-select first competition if nothing selected
                if (!competition && list && list.length > 0) {
                    setCompetition(list[0] as CompetitionSummary);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organisationId]);

    // If competition changes, close the review card (feels clean)
    useEffect(() => {
        setShowReview(false);
    }, [competition?.id]);

    if (loading) {
        return <div style={{ padding: 16 }}>Loading submission…</div>;
    }

    return (
        <SubmissionProvider>
            <SubmissionHeader
                competitions={competitions}
                competition={competition}
                setCompetition={setCompetition}
                showReview={showReview}
                onToggleReview={() => setShowReview((v) => !v)}
            />

            <SubmittedFishReviewCard
                visible={showReview}
                competitionId={competition?.id ?? null}
            />

            <CatchCardShell competition={competition} />
        </SubmissionProvider>
    );

}