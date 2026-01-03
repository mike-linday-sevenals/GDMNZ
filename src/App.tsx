import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

/* =====================================================================
   🌍 PUBLIC PAGES
   ===================================================================== */
import LandingPage from "./clubadmin/pages/LandingPage";
import PublicResultsPage from "./clubadmin/pages/PublicResultsPage";

/* =====================================================================
   🛠️ CLUB OPERATIONS (ORG-SCOPED)
   ===================================================================== */
import ClubRegister from "./clubadmin/pages/Register";
import ClubSubmit from "./clubadmin/pages/Submit";
import ClubResults from "./clubadmin/pages/Results";
import ClubPrizes from "./clubadmin/pages/Prizes";
import ClubPrizeGiving from "./clubadmin/pages/PrizeGiving";
import ClubData from "./clubadmin/pages/Data";
import AdminSponsors from "./clubadmin/pages/AdminSponsors";

/* =====================================================================
   🧭 CLUB ADMIN (COMPETITION / ORG ADMIN)
   ===================================================================== */
import Admin from "./clubadmin/pages/Admin";

import CompetitionsList from "./clubadmin/pages/Competitions/CompetitionsList";
import AddCompetition from "./clubadmin/pages/Competitions/AddCompetition";
import EditCompetition from "./clubadmin/pages/Competitions/EditCompetition";

/* =====================================================================
   🧱 LAYOUTS
   ===================================================================== */
import SiteLayout from "./layouts/SiteLayout";
import ClubAdminLayout from "./layouts/ClubAdminLayout";
import PlatformAdminLayout from "./layouts/PlatformAdminLayout";

/* =====================================================================
   🔐 PLATFORM ADMIN
   ===================================================================== */
import { AdminProvider } from "./admin/AdminContext";
import AdminGate from "./admin/AdminGate";
import AdminDashboard from "./admin/pages/Dashboard";

export default function App() {
    const location = useLocation();

    return (
        <Routes>

            {/* ===============================================================
               🌍 PUBLIC SITE
               =============================================================== */}
            <Route element={<SiteLayout />}>
                <Route path="/" element={<LandingPage />} />
                <Route
                    path="/results"
                    element={<PublicResultsPage key={location.search} />}
                />
            </Route>

            {/* ===============================================================
               🛠️ CLUB ADMIN (ORG-SCOPED)
               =============================================================== */}
            <Route
                path="/clubadmin/:organisationId"
                element={<ClubAdminLayout />}
            >
                {/* Default landing */}
                <Route index element={<Admin />} />

                {/* Core operations */}
                <Route path="register" element={<ClubRegister />} />
                <Route path="submit" element={<ClubSubmit />} />
                <Route path="results" element={<ClubResults />} />
                <Route path="prizes" element={<ClubPrizes />} />
                <Route path="prizegiving" element={<ClubPrizeGiving />} />
                <Route path="data" element={<ClubData />} />

                {/* ✅ Sponsors (ORG-LEVEL, matches nav tab) */}
                <Route path="sponsors" element={<AdminSponsors />} />

                {/* ===========================================================
                   🧭 ADMIN AREA (competition + system admin)
                   =========================================================== */}
                <Route path="admin" element={<Admin />}>
                    {/* Default admin landing → Competitions */}
                    <Route
                        index
                        element={<Navigate to="competitions" replace />}
                    />

                    {/* 🏆 Competitions */}
                    <Route path="competitions" element={<CompetitionsList />}>
                        <Route path="add" element={<AddCompetition />} />
                        <Route path=":id" element={<EditCompetition />} />
                    </Route>
                </Route>
            </Route>

            {/* ===============================================================
               🔐 PLATFORM ADMIN
               =============================================================== */}
            <Route
                path="/admin"
                element={
                    <AdminProvider>
                        <AdminGate>
                            <PlatformAdminLayout />
                        </AdminGate>
                    </AdminProvider>
                }
            >
                <Route index element={<AdminDashboard />} />
            </Route>

            {/* ===============================================================
               🚑 FALLBACK
               =============================================================== */}
            <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
    );
}
