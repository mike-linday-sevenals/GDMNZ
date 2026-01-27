// ============================================================================
// src/App.tsx
// ============================================================================

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
import SubmissionPage from "./clubadmin/pages/Submission/SubmissionPage";
import ClubResults from "./clubadmin/pages/Results";
import ClubData from "./clubadmin/pages/Data";
import AdminSponsors from "./clubadmin/pages/AdminSponsors";

/* =====================================================================
   🧭 CLUB ADMIN (COMPETITION / ORG ADMIN)
   ===================================================================== */
import Admin from "./clubadmin/pages/Admin";
import CompetitionsList from "./clubadmin/pages/Competitions/CompetitionsList";
import AddCompetition from "./clubadmin/pages/Competitions/AddCompetition";
import EditCompetition from "./clubadmin/pages/Competitions/EditCompetition";
import PrizeEngineValidationPage from "./clubadmin/pages/Competitions/PrizeEngine/PrizeEngineValidationPage";

/* =====================================================================
   🎰 RANDOM LISTS
   ===================================================================== */
import DrawRandomListPage from "./clubadmin/pages/RandomLists/DrawRandomListPage";

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
import AdminDashboard from "@/admin/pages/Dashboard";

import AdminSettings from "@/admin/pages/Settings";
import SettingsLanding from "@/admin/pages/Settings/Landing";

import FishingSettings from "@/admin/pages/Settings/Fishing";
import FishingLanding from "@/admin/pages/Settings/Fishing/Landing";
import FishingSpecies from "@/admin/pages/Settings/Fishing/Species";

// ============================================================================
// APP ROUTER
// ============================================================================

export default function App() {
    return (
        <Routes>

            {/* ===============================================================
               🌍 PUBLIC SITE
               =============================================================== */}
            <Route element={<SiteLayout />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/results" element={<PublicResultsPage />} />
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
                <Route path="submit" element={<SubmissionPage />} />
                <Route path="results" element={<ClubResults />} />
                <Route path="data" element={<ClubData />} />

                {/* Sponsors */}
                <Route path="sponsors" element={<AdminSponsors />} />

                {/* ===========================================================
                   🧭 ADMIN AREA
                   =========================================================== */}
                <Route path="admin" element={<Admin />}>
                    <Route
                        index
                        element={<Navigate to="competitions" replace />}
                    />

                    <Route path="competitions" element={<CompetitionsList />}>
                        <Route path="add" element={<AddCompetition />} />

                        <Route path=":id">
                            <Route
                                index
                                element={<Navigate to="edit" replace />}
                            />

                            <Route path="edit" element={<EditCompetition />}>
                                <Route
                                    path="prize-giving"
                                    element={<PrizeEngineValidationPage embedded />}
                                />
                            </Route>
                        </Route>
                    </Route>

                    {/* =======================================================
                       🎰 RANDOM LIST DRAW
                       ======================================================= */}
                    <Route
                        path="random-lists/:randomListId/draw"
                        element={<DrawRandomListPage />}
                    />
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
                <Route index element={<AdminDashboard />} />

                <Route path="settings" element={<AdminSettings />}>
                    <Route index element={<SettingsLanding />} />

                    <Route path="sports">
                        <Route path="fishing" element={<FishingSettings />}>
                            <Route index element={<FishingLanding />} />
                            <Route
                                path="species"
                                element={<FishingSpecies />}
                            />
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
