/* ============================================================================
   File: src/admin/pages/Settings/index.tsx
   Purpose: Platform Admin Settings layout (renders child routes)
   ========================================================================== */

import { Outlet } from "react-router-dom";

/* ============================================================================
   SETTINGS — PLATFORM (LAYOUT)
   ========================================================================== */

export default function AdminSettings() {
    return (
        <>
            <h1 className="sr-only">Settings</h1>

            {/* Child routes render here */}
            <Outlet />
        </>
    );
}
