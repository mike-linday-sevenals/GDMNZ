// ============================================================================
// File: CompetitionsList.tsx
// Path: src/clubadmin/pages/Competitions/CompetitionsList.tsx
// Description:
// Lists competitions for an organisation (club admin scope)
// ============================================================================

import { useEffect, useState } from "react";
import { Link, Outlet, useParams, useOutlet } from "react-router-dom";

// 🔄 Migrated API import (clubadmin-scoped)
import { listCompetitions } from "@/clubadmin/api/competitions";

// Types
type CompetitionListItem = {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
};

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(value: string) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("en-NZ", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default function CompetitionsList() {
    const { organisationId } = useParams<{ organisationId: string }>();
    const outlet = useOutlet(); // 👈 detect child route

    const [competitions, setCompetitions] = useState<CompetitionListItem[]>([]);
    const [loading, setLoading] = useState(true);

    /* ============================================================
       LOAD
       ============================================================ */
    useEffect(() => {
        if (!organisationId) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organisationId]);

    async function load() {
        if (!organisationId) return;

        setLoading(true);
        try {
            const data = await listCompetitions(organisationId);
            setCompetitions(data ?? []);
        } catch (err) {
            console.error(err);
            alert("Failed to load competitions");
        } finally {
            setLoading(false);
        }
    }

    /* ============================================================
       RENDER
       ============================================================ */
    return (
        <>
            {/* ================= LIST ================= */}
            {!outlet && (
                <section className="card admin-card" style={{ padding: 24 }}>
                    <h2>Competitions</h2>

                    <div className="actions" style={{ marginBottom: 16 }}>
                        <Link to="add" className="btn primary">
                            + Add Competition
                        </Link>
                    </div>

                    {loading ? (
                        <p className="muted">Loading…</p>
                    ) : competitions.length === 0 ? (
                        <p className="muted">No competitions found.</p>
                    ) : (
                        <table
                            className="data-table"
                            style={{ width: "100%", marginTop: 12 }}
                        >
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Starts</th>
                                    <th>Ends</th>
                                    <th style={{ width: 120 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {competitions.map((comp) => (
                                    <tr key={comp.id}>
                                        <td>{comp.name}</td>
                                        <td>{formatDate(comp.starts_at)}</td>
                                        <td>{formatDate(comp.ends_at)}</td>
                                        <td>
                                            <Link
                                                to={comp.id}
                                                className="btn btn--sm-primary"
                                            >
                                                Edit
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
            )}

            {/* ================= CHILD ROUTES ================= */}
            <Outlet />
        </>
    );
}
