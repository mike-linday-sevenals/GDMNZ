/* ============================================================================
   File: src/admin/pages/Settings/Landing.tsx
   Purpose: Platform Admin Settings landing page
   ========================================================================== */

import { Link } from "react-router-dom";

export default function SettingsLanding() {
    return (
        <>
            <h1>Settings</h1>
            <p className="muted">
                Configure platform-wide settings and manage sport modules.
            </p>

            {/* =============================================================
               SPORTS
               =========================================================== */}
            <section style={{ marginTop: 32 }}>
                <h2>Sports</h2>
                <p className="muted">
                    Manage rules, categories, and defaults for each sport.
                </p>

                <div className="grid three" style={{ marginTop: 16 }}>
                    {/* =======================
                       FISHING (ACTIVE)
                       ======================= */}
                    <Link
                        to="sports/fishing"
                        style={{ textDecoration: "none" }}
                    >
                        <section className="card">
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "start",
                                }}
                            >
                                <h3>Fishing</h3>
                                <span className="badge success">Active</span>
                            </div>

                            <p className="muted" style={{ marginTop: 8 }}>
                                Species, categories, and competition rules.
                            </p>

                            <div style={{ marginTop: 16 }}>
                                <span className="btn btn--sm-primary">
                                    Manage
                                </span>
                            </div>
                        </section>
                    </Link>

                    {/* =======================
                       EQUESTRIAN (PLANNED)
                       ======================= */}
                    <section className="card muted">
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "start",
                            }}
                        >
                            <h3>Equestrian</h3>
                            <span className="badge">Planned</span>
                        </div>

                        <p className="muted" style={{ marginTop: 8 }}>
                            Horse classes, disciplines, and scoring.
                        </p>
                    </section>

                    {/* =======================
                       SAILING (PLANNED)
                       ======================= */}
                    <section className="card muted">
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "start",
                            }}
                        >
                            <h3>Sailing</h3>
                            <span className="badge">Planned</span>
                        </div>

                        <p className="muted" style={{ marginTop: 8 }}>
                            Divisions, handicaps, and race rules.
                        </p>
                    </section>
                </div>
            </section>

            {/* =============================================================
               PLATFORM
               =========================================================== */}
            <section style={{ marginTop: 48 }}>
                <h2>Platform</h2>
                <p className="muted">
                    Global configuration that applies across all sports.
                </p>

                <div className="grid two" style={{ marginTop: 16 }}>
                    <section className="card muted">
                        <h3>General</h3>
                        <p className="muted">
                            Platform defaults, status codes, and system-wide
                            behaviour.
                        </p>
                        <span className="badge">Planned</span>
                    </section>

                    <section className="card muted">
                        <h3>Access & Roles</h3>
                        <p className="muted">
                            Permissions, admin roles, and access control.
                        </p>
                        <span className="badge">Planned</span>
                    </section>
                </div>
            </section>
        </>
    );
}
