import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { NavLink, Routes, Route, useLocation } from "react-router-dom";
import Register from "./pages/Register";
import Submit from "./pages/Submit";
import Results from "./pages/Results";
import Prizes from "./pages/Prizes";
import PrizeGiving from "./pages/PrizeGiving";
import Admin from "./pages/Admin";
import Data from "./pages/Data";
const TABS = [
    { to: "/", label: "Register", end: true },
    { to: "/submit", label: "Submit Fish" },
    { to: "/results", label: "Results" },
    { to: "/prizes", label: "Prizes" },
    { to: "/prizegiving", label: "Prize Giving" },
    { to: "/admin", label: "Admin" },
    { to: "/data", label: "Import/Export" }
];
export default function App() {
    const loc = useLocation();
    return (_jsxs(_Fragment, { children: [_jsx("header", { className: "header", children: _jsxs("div", { className: "wrap", children: [_jsxs("div", { className: "brand", children: [_jsx("img", { src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='40'><rect width='80' height='40' fill='white' stroke='%23dde3ea'/><text x='10' y='26' font-size='18' font-family='system-ui' fill='%232563eb'>WOSC</text></svg>", alt: "WOSC logo" }), _jsxs("div", { children: [_jsx("h1", { children: "WOSC \u2014 Labour Weekend" }), _jsx("div", { className: "sub", children: "Registration, Submit Fish, Results & Prizegiving" })] })] }), _jsx("nav", { className: "tabs", children: TABS.map(t => (_jsx(NavLink, { to: t.to, end: t.end, className: ({ isActive }) => isActive ? 'active' : '', children: t.label }, t.to))) })] }) }), _jsxs("main", { className: "wrap main", children: [_jsxs(Routes, { location: loc, children: [_jsx(Route, { path: "/", element: _jsx(Register, {}) }), _jsx(Route, { path: "/submit", element: _jsx(Submit, {}) }), _jsx(Route, { path: "/results", element: _jsx(Results, {}) }), _jsx(Route, { path: "/prizes", element: _jsx(Prizes, {}) }), _jsx(Route, { path: "/prizegiving", element: _jsx(PrizeGiving, {}) }), _jsx(Route, { path: "/admin", element: _jsx(Admin, {}) }), _jsx(Route, { path: "/data", element: _jsx(Data, {}) })] }), _jsx("div", { className: "footer", children: "React app. Competitors & fish: Supabase (if configured) or local-only fallback. Prizes/branding local for now." })] })] }));
}
