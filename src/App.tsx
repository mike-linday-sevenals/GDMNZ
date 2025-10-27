import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import PublicResultsPage from './pages/PublicResultsPage';
import Admin from './pages/Admin';
import Prizes from './pages/Prizes';
import PrizeGiving from './pages/PrizeGiving';
import Data from './pages/Data';
import Register from './pages/Register';
import Submit from './pages/Submit';
import AdminSponsorsPage from './pages/AdminSponsorsPage';
import AdminSection from './pages/AdminSection';
import SiteLayout from './layouts/SiteLayout';

export default function App() {
    return (
        <Routes>
            <Route element={<SiteLayout />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/results" element={<PublicResultsPage />} />

                {/* All admin routes are gated and get the admin sub-nav */}
                <Route path="/admin" element={<AdminSection />}>
                    <Route index element={<Admin />} />                     {/* Settings */}
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
