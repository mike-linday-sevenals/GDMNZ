import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import PublicResultsPage from "./pages/PublicResultsPage";
import Admin from "./pages/Admin";
import Prizes from "./pages/Prizes";
import PrizeGiving from "./pages/PrizeGiving";
import Data from "./pages/Data";
import Register from "./pages/Register";
import Submit from "./pages/Submit";
import AdminSponsorsPage from "./pages/AdminSponsorsPage";
import AdminSection from "./pages/AdminSection";
import SiteLayout from "./layouts/SiteLayout";
import CompetitionsList from "./pages/Competitions/CompetitionsList";
import EditCompetition from "./pages/Competitions/EditCompetition";


export default function App() {
    // 🔑 READ LOCATION ONCE AT ROUTER LEVEL
    const location = useLocation();

    return (
        <Routes>
            <Route element={<SiteLayout />}>
                <Route path="/" element={<LandingPage />} />

                {/* 🔥 RESULTS — FORCE REMOUNT WHEN QUERY STRING CHANGES */}
                <Route
                    path="/results"
                    element={<PublicResultsPage key={location.search} />}
                />

                {/* All admin routes go inside this section */}
                <Route path="/admin" element={<AdminSection />}>
                    {/* DEFAULT admin page → settings */}
                    <Route index element={<Admin />} />

                    {/* Competitions */}
                    <Route path="competitions" element={<CompetitionsList />} />
                    <Route path="competitions/:id" element={<EditCompetition />} />

                    {/* Existing admin pages */}
                    <Route path="sponsors" element={<AdminSponsorsPage />} />
                    <Route path="prizes" element={<Prizes />} />
                    <Route path="prizegiving" element={<PrizeGiving />} />
                    <Route path="data" element={<Data />} />
                    <Route path="register" element={<Register />} />
                    <Route path="submit" element={<Submit />} />


                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
