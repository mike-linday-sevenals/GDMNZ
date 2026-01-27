// ============================================================================
// SubmissionPage.tsx
// ============================================================================

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { SubmissionProvider } from "./SubmissionContext";
import SubmissionHeader from "./components/SubmissionHeader";
import CatchCardShell from "./components/CatchCardShell";

import { listCompetitions } from "@/services/api";

export default function SubmissionPage() {
    const { organisationId } = useParams<{ organisationId: string }>();

    const [competitions, setCompetitions] = useState<any[]>([]);
    const [competition, setCompetition] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!organisationId) return;

        let mounted = true;

        (async () => {
            try {
                const list = await listCompetitions(organisationId);
                if (mounted) setCompetitions(list);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [organisationId]);

    if (loading) {
        return <div style={{ padding: 16 }}>Loading submission…</div>;
    }

    return (
        <SubmissionProvider>
            <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
                <SubmissionHeader
                    competitions={competitions}
                    competition={competition}
                    setCompetition={setCompetition}
                />

                <CatchCardShell competition={competition} />
            </div>
        </SubmissionProvider>
    );
}
