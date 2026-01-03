import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/services/supabase";
import {
    listOrganisations,
    Organisation,
} from "@/admin/services/organisations";

/* ============================================================================
   TYPES
   ========================================================================== */

type KPI = {
    organisations: number;
    competitions: number;
    people: number;
};

/* ============================================================================
   DASHBOARD
   ========================================================================== */

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [kpi, setKpi] = useState<KPI>({
        organisations: 0,
        competitions: 0,
        people: 0,
    });
    const [organisations, setOrganisations] = useState<Organisation[]>([]);

    useEffect(() => {
        async function loadDashboard() {
            setLoading(true);

            /* ------------------------------------------------------------
               KPI COUNTS
               ------------------------------------------------------------ */
            const [
                { count: orgCount },
                { count: compCount },
                { count: personCount },
            ] = await Promise.all([
                supabase
                    .from("organisation")
                    .select("*", { count: "exact", head: true }),
                supabase
                    .from("competition")
                    .select("*", { count: "exact", head: true }),
                supabase
                    .from("person")
                    .select("*", { count: "exact", head: true }),
            ]);

            setKpi({
                organisations: orgCount ?? 0,
                competitions: compCount ?? 0,
                people: personCount ?? 0,
            });

            /* ------------------------------------------------------------
               ORGANISATIONS
               ------------------------------------------------------------ */
            const orgs = await listOrganisations();
            setOrganisations(orgs);

            setLoading(false);
        }

        loadDashboard();
    }, []);

    if (loading) {
        return <p className="muted">Loading platform dashboard…</p>;
    }

    return (
        <>
            <h1>Platform Dashboard</h1>

            {/* KPI STRIP */}
            <div className="grid three" style={{ marginBottom: 24 }}>
                <KpiCard label="Organisations" value={kpi.organisations} />
                <KpiCard label="Competitions" value={kpi.competitions} />
                <KpiCard label="People" value={kpi.people} />
            </div>

            {/* ORGANISATIONS */}
            <section className="card">
                <h2>Organisations</h2>

                {organisations.length === 0 ? (
                    <p className="muted">No organisations found.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Organisation</th>
                                <th>Status</th>
                                <th style={{ width: 140 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {organisations.map((o) => (
                                <tr key={o.organisation_id}>
                                    <td>{o.organisation_name}</td>
                                    <td>
                                        <span
                                            className={
                                                o.status_id === 20
                                                    ? "badge success"
                                                    : "badge"
                                            }
                                        >
                                            {o.status_id === 20
                                                ? "Active"
                                                : "Inactive"}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        <Link
                                            to={`/clubadmin/${o.organisation_id}`}
                                            className="btn btn--sm-primary"
                                        >
                                            Edit Club
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </>
    );
}

/* ============================================================================
   KPI CARD
   ========================================================================== */

function KpiCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="card">
            <div className="muted">{label}</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
        </div>
    );
}
