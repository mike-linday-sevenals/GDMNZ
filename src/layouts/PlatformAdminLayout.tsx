import { NavLink, Outlet } from "react-router-dom";

/* ============================================================================
   PLATFORM ADMIN LAYOUT
   - Software / system-level admin
   - Left-hand navigation with active state
   - Visually distinct from Club Admin
   ========================================================================== */

export default function PlatformAdminLayout() {
    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* ========================= SIDEBAR ========================= */}
            <aside
                style={{
                    width: 240,
                    padding: "24px 16px",
                    background: "#f8fafc",
                    borderRight: "1px solid #e2e8f0",
                }}
            >
                <div style={{ marginBottom: 24 }}>
                    <div
                        style={{
                            fontWeight: 700,
                            fontSize: 16,
                            marginBottom: 4,
                        }}
                    >
                        GDMNZ ⚙ Platform Admin
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                        System management & governance
                    </div>
                </div>

                <nav
                    className="platform-nav"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                    }}
                >
                    <NavLink to="/admin" end>
                        Dashboard
                    </NavLink>

                    <NavLink to="/admin/organisations">
                        Organisations
                    </NavLink>

                    <NavLink to="/admin/people">
                        People
                    </NavLink>

                    <NavLink to="/admin/settings">
                        Settings
                    </NavLink>
                </nav>
            </aside>

            {/* ========================= CONTENT ========================= */}
            <main
                style={{
                    flex: 1,
                    background: "#f1f5f9",
                    padding: 32,
                }}
            >
                <Outlet />
            </main>

            {/* ========================= STYLES ========================= */}
            <style>{`
                .platform-nav a {
                    padding: 10px 14px;
                    border-radius: 10px;
                    text-decoration: none;
                    color: #334155;
                    font-weight: 500;
                    transition: background 0.15s ease, color 0.15s ease;
                }

                .platform-nav a:hover {
                    background: #e2e8f0;
                }

                .platform-nav a.active {
                    background: #e6f0ff;
                    color: #0b5fff;
                    font-weight: 600;
                }
            `}</style>
        </div>
    );
}
