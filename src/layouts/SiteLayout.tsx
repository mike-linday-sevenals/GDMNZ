// src/layouts/SiteLayout.tsx

import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { listCompetitions } from "@/services/api";
import logo from "@/images/GDMNZ_logo.png";

export default function SiteLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const [competitions, setCompetitions] = useState<any[]>([]);
    const [selectedComp, setSelectedComp] = useState<string>("");

    // Load competitions once
    useEffect(() => {
        (async () => {
            try {
                const comps = await listCompetitions();
                setCompetitions(comps || []);
            } catch (err) {
                console.error("Failed to load competitions", err);
            }
        })();
    }, []);

    // Sync dropdown with ?competition=
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const id = params.get("competition") || "";
        setSelectedComp(id);
    }, [location.search]);

    // Handle dropdown selection
    function handleSelect(id: string) {
        setSelectedComp(id);
        if (id) navigate(`/results?competition=${id}`);
        else navigate("/results");   // <-- clears the results screen
    }

    return (
        <>
            <header className="header">
                <div
                    className="wrap"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                    }}
                >
                    {/* Logo */}
                    <Link
                        to="/"
                        className="brand"
                        style={{ display: "flex", alignItems: "center" }}
                    >
                        <img
                            src={logo}
                            alt="Game Day Manager NZ"
                            style={{
                                height: 64,
                                width: "auto",
                                borderRadius: 10,
                                border: "1px solid var(--border)",
                                background: "#fff",
                                padding: 6,
                            }}
                        />
                        <span className="sr-only">Game Day Manager NZ</span>
                    </Link>

                    {/* Competition Selector */}
                    <nav
                        className="tabs"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <button
                            className="btn"
                            onClick={() => navigate("/results")}
                        >
                            View Results
                        </button>
                    </nav>
                </div>
            </header>

            <main className="main">
                <div className="wrap">
                    <Outlet />
                </div>
            </main>
        </>
    );
}
