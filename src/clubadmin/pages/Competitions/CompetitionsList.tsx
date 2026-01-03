import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { listCompetitions } from "@/services/api";

export default function CompetitionsList() {
    const { organisationId } = useParams<{ organisationId: string }>();

    const [competitions, setCompetitions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
            setCompetitions(data || []);
        } catch (err) {
            console.error(err);
            alert("Failed to load competitions");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            {/* ================= LIST ================= */}
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
                                    <td>{comp.starts_at}</td>
                                    <td>{comp.ends_at}</td>
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

            {/* ================= CHILD ROUTES ================= */}
            <Outlet />
        </>
    );
}
