import { NavLink, Outlet } from "react-router-dom";

const TABS = [
    { to: "register", label: "Register" },
    { to: "submit", label: "Submit Fish" },
    { to: "results", label: "Results" },
    { to: "prizes", label: "Prizes" },
    { to: "prizegiving", label: "Prize Giving" },
    { to: "admin", label: "Admin" },
    { to: "data", label: "Import/Export" }
];

export default function AdminLayout() {
    return (
        <>
            <header className="header">
                <div className="wrap">
                    <div className="brand">
                        <img
                            src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='40'><rect width='80' height='40' fill='white' stroke='%23dde3ea'/><text x='10' y='26' font-size='18' font-family='system-ui' fill='%232563eb'>WOSC</text></svg>"
                            alt="WOSC logo"
                        />
                        <div>
                            <h1>WOSC — Labour Weekend</h1>
                            <div className="sub">
                                Registration, Submit Fish, Results & Prizegiving
                            </div>
                        </div>
                    </div>

                    <nav className="tabs">
                        {TABS.map(t => (
                            <NavLink
                                key={t.to}
                                to={t.to}
                                className={({ isActive }) =>
                                    isActive ? "active" : ""
                                }
                            >
                                {t.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </header>

            <main className="wrap main">
                <Outlet />
                <div className="footer">
                    React app. Competitors &amp; fish: Supabase (if configured)
                    or local-only fallback. Prizes/branding local for now.
                </div>
            </main>
        </>
    );
}
