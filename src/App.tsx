import { Routes, Route, Navigate } from "react-router-dom";

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
import { AdminProvider } from "@/admin/AdminContext";
import AdminGate from "@/admin/AdminGate";
import AdminDashboard from "@/admin/pages/Dashboard";

import AdminSettings from "@/admin/pages/Settings";
import SettingsLanding from "@/admin/pages/Settings/Landing";

import FishingSettings from "@/admin/pages/Settings/Fishing";
import FishingLanding from "@/admin/pages/Settings/Fishing/Landing";
import FishingSpecies from "@/admin/pages/Settings/Fishing/Species";




export default function App() {
    return (
        <Routes>

            {/* ===============================================================
               🌍 PUBLIC SITE
               =============================================================== */}
            <Route element={<SiteLayout />}>
                <Route path="/" element={<LandingPage />} />

                {/* Public results selector */}
                <Route path="/results" element={<PublicResultsPage />} />

                {/* Shareable public results (deep link) */}
                <Route path="/results/:slug" element={<PublicResultsPage />} />
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

                {/* Sponsors (ORG-level) */}
                <Route path="sponsors" element={<AdminSponsors />} />

                {/* ===========================================================
                   🧭 ADMIN AREA (competition + system admin)
                   =========================================================== */}
                <Route path="admin" element={<Admin />}>
                    <Route
                        index
                        element={<Navigate to="competitions" replace />}
                    />

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
                        <PlatformAdminLayout />
                    </AdminProvider>
                }
            >
                {/* Dashboard */}
                <Route index element={<AdminDashboard />} />

                {/* Settings */}
                <Route path="settings" element={<AdminSettings />}>
                    {/* Settings landing */}
                    <Route index element={<SettingsLanding />} />

                    <Route path="sports">
                        <Route path="fishing" element={<FishingSettings />}>
                            {/* Fishing landing */}
                            <Route index element={<FishingLanding />} />

                            {/* Fishing sub-pages */}
                            <Route path="species" element={<FishingSpecies />} />
                        </Route>
                    </Route>
                </Route>
            </Route>




            {/* ===============================================================
               🚑 FALLBACK
               =============================================================== */}
            <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
    );
}
