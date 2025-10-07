import { NavLink, Routes, Route, useLocation } from "react-router-dom";
import Register from "./pages/Register";
import Submit from "./pages/Submit";
import Results from "./pages/Results";
import Prizes from "./pages/Prizes";
import PrizeGiving from "./pages/PrizeGiving";
import Admin from "./pages/Admin";
import Data from "./pages/Data";

type Tab = { to: string; label: string; end?: boolean };

const TABS: Tab[] = [
  { to: "/", label: "Register", end: true },
  { to: "/submit", label: "Submit Fish" },
  { to: "/results", label: "Results" },
  { to: "/prizes", label: "Prizes" },
  { to: "/prizegiving", label: "Prize Giving" },
  { to: "/admin", label: "Admin" },
  { to: "/data", label: "Import/Export" }
];

export default function App(){
  const loc = useLocation();
  return (
    <>
      <header className="header">
        <div className="wrap">
          <div className="brand">
            <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='40'><rect width='80' height='40' fill='white' stroke='%23dde3ea'/><text x='10' y='26' font-size='18' font-family='system-ui' fill='%232563eb'>WOSC</text></svg>" alt="WOSC logo"/>
            <div>
              <h1>WOSC — Labour Weekend</h1>
              <div className="sub">Registration, Submit Fish, Results & Prizegiving</div>
            </div>
          </div>
          <nav className="tabs">
            {TABS.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap main">
        <Routes location={loc}>
          <Route path="/" element={<Register/>} />
          <Route path="/submit" element={<Submit/>} />
          <Route path="/results" element={<Results/>} />
          <Route path="/prizes" element={<Prizes/>} />
          <Route path="/prizegiving" element={<PrizeGiving/>} />
          <Route path="/admin" element={<Admin/>} />
          <Route path="/data" element={<Data/>} />
        </Routes>
        <div className="footer">React app. Competitors & fish: Supabase (if configured) or local-only fallback. Prizes/branding local for now.</div>
      </main>
    </>
  );
}
