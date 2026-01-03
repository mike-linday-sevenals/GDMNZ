import { NavLink, Outlet, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";

/* ============================================================================
   CLUB ADMIN LAYOUT (ORG CONTEXT AWARE)
   ========================================================================== */

export default function ClubAdminLayout() {
    const { organisationId } = useParams<{ organisationId: string }>();
    const [orgName, setOrgName] = useState<string>("");

    useEffect(() => {
        if (!organisationId) return;

        (async () => {
            const { data, error } = await supabase
                .from("organisation")
                .select("organisation_name")
                .eq("organisation_id", organisationId)
                .single();

            if (!error && data) {
                setOrgName(data.organisation_name);
            } else {
                setOrgName("Unknown organisation");
            }
        })();
    }, [organisationId]);

    if (!organisationId) {
        return (
            <main className="wrap main">
                <p className="muted">No organisation selected.</p>
            </main>
        );
    }

    return (
        <>
            {/* ================= HEADER ================= */}
            <header className="header">
                <div className="wrap">
                    <div
                        style={{
                            fontWeight: 600,
                            fontSize: 16,
                            marginBottom: 8,
                        }}
                    >
                        {orgName || "Loading organisation…"}
                    </div>

                    <nav
                        className="tabs"
                        style={{ justifyContent: "space-between" }}
                    >
                        {/* LEFT */}
                        <div style={{ display: "flex", gap: 6 }}>
                            <NavLink to="register">Register</NavLink>
                            <NavLink to="submit">Submit</NavLink>
                            <NavLink to="prizegiving">Prize Giving</NavLink>
                        </div>

                        {/* RIGHT */}
                        <div style={{ display: "flex", gap: 6 }}>
                            <NavLink to="prizes">Prizes</NavLink>
                            <NavLink to="sponsors">Sponsors</NavLink>
                            <NavLink to="admin">Admin</NavLink>
                            <NavLink to="data">Data</NavLink>
                        </div>

                    </nav>
                </div>
            </header>

            {/* ================= CONTENT ================= */}
            <main className="wrap main">
                <Outlet />

                <div className="footer">
                    React app. Competitors &amp; fish: Supabase (if configured) or
                    local-only fallback. Prizes/branding local for now.
                </div>
            </main>
        </>
    );
}
