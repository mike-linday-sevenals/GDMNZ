/* ============================================================================
   File: src/admin/pages/Settings/Fishing/Landing.tsx
   Purpose: Fishing settings landing page
   ========================================================================== */

import { Link } from "react-router-dom";

export default function FishingLanding() {
    return (
        <>
            {/* Breadcrumb */}
            <nav className="muted" style={{ marginBottom: 16, fontSize: 13 }}>
                <Link to="/admin/settings">Settings</Link>
                {" / "}
                <span>Fishing</span>
            </nav>

            <h1>Fishing</h1>
            <p className="muted">
                Configure fishing-specific data and competition rules.
            </p>

            <section style={{ marginTop: 32 }}>
                <h2>Configuration</h2>
                <p className="muted">
                    Core data used when creating fishing competitions.
                </p>

                <div className="grid three" style={{ marginTop: 16 }}>
                    <Link to="species" style={{ textDecoration: "none" }}>
                        <section className="card">
                            <h3>Species</h3>
                            <p className="muted">
                                Fish species available for competitions and results.
                            </p>
                            <span className="btn btn--sm-primary">
                                Manage
                            </span>
                        </section>
                    </Link>

                    <section className="card muted">
                        <h3>Categories</h3>
                        <span className="badge">Planned</span>
                    </section>

                    <section className="card muted">
                        <h3>Rules</h3>
                        <span className="badge">Planned</span>
                    </section>
                </div>
            </section>
        </>
    );
}
