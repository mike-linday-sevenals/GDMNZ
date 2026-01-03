import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { fetchSettings } from "@/services/api";

/* ============================================================================
   CLUB ADMIN — ADMIN SHELL
   - Renders under /clubadmin/:organisationId/admin
   - Settings card REMOVED
   - Child admin pages render via <Outlet />
   ========================================================================== */

type Settings = {
    compMode: "weight" | "measure";
    showTime: boolean;
    requireTime: boolean;
    prizeMode: "combined" | "split";
    activeSpeciesIds?: number[];
};

export default function Admin() {
    const [settings, setSettings] = useState<Settings | null>(null);

    useEffect(() => {
        (async () => {
            const st = await fetchSettings();
            setSettings(st);
        })();
    }, []);

    // Keep this guard if downstream admin pages depend on settings
    if (!settings) {
        return (
            <section className="card admin-card">
                <p className="muted">Loading…</p>
            </section>
        );
    }

    return (
        <>
            {/* ================= ADMIN CONTENT ================= */}
            <Outlet />
        </>
    );
}
