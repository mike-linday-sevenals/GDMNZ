import { useEffect, useMemo, useState } from "react";
import { getPublicResults, PublicResultRow } from "../services/publicResults";

type DayTab = "overall" | 1 | 2;

function useInterval(cb: () => void, ms: number) {
    useEffect(() => {
        const id = setInterval(cb, ms);
        return () => clearInterval(id);
    }, [cb, ms]);
}

export default function WoscResultsLanding() {
    const [day, setDay] = useState<DayTab>("overall");
    const [rows, setRows] = useState<PublicResultRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    async function load() {
        try {
            setLoading(true);
            const data = await getPublicResults(day === "overall" ? null : day);
            setRows(data);
            setErr(null);
            setLastUpdated(new Date());
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load results.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [day]);
    useInterval(load, 30000); // refresh every 30s

    const bySpecies = useMemo(() => {
        const map = new Map<string, PublicResultRow[]>();
        for (const r of rows) {
            const key = r.species?.toUpperCase() || "OTHER";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }
        // sort each species by weight desc, then submitted_at asc
        for (const [k, arr] of map) {
            arr.sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0) || new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [rows]);

    const topOverall = useMemo(() => {
        const clone = [...rows];
        clone.sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0));
        return clone.slice(0, 10);
    }, [rows]);

    return (
        <div className="wrap" style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1rem" }}>
            {/* HERO */}
            <section className="hero card">
                <div className="hero__logos">
                    <img src="/assets/gdmnz.svg" alt="GDMNZ" />
                    <span className="hero__x">×</span>
                    <img src="/assets/wosc.png" alt="WOSC" />
                    <span className="hero__x">×</span>
                    <img src="/assets/100home.png" alt="100% Home Whangamatā" />
                </div>
                <h1>WOSC — Labour Weekend Live Leaderboard</h1>
                <p className="hero__sub">
                    Whangamatā Ocean Sports Club • Fishing: Sat & Sun • Prize-Giving Sun 7:30pm
                </p>

                <div className="hero__tabs">
                    <button className={`pill ${day === "overall" ? "pill--active" : ""}`} onClick={() => setDay("overall")}>Overall</button>
                    <button className={`pill ${day === 1 ? "pill--active" : ""}`} onClick={() => setDay(1)}>Day 1</button>
                    <button className={`pill ${day === 2 ? "pill--active" : ""}`} onClick={() => setDay(2)}>Day 2</button>
                </div>

                <div className="hero__kpis">
                    <div className="kpi">
                        <div className="kpi__label">Species</div>
                        <div className="kpi__value">{bySpecies.length}</div>
                    </div>
                    <div className="kpi">
                        <div className="kpi__label">Total Entries</div>
                        <div className="kpi__value">{rows.length}</div>
                    </div>
                    <div className="kpi">
                        <div className="kpi__label">Last Update</div>
                        <div className="kpi__value">{lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}</div>
                    </div>
                </div>
            </section>

            {/* OVERALL TABLE */}
            <section className="card" style={{ marginTop: 16 }}>
                <div className="card__hdr">
                    <h2>Top 10 — Heaviest Fish {day === "overall" ? "(Overall)" : day === 1 ? "(Day 1)" : "(Day 2)"} </h2>
                    {loading && <span className="badge">Refreshing…</span>}
                    {err && <span className="badge badge--warn">{err}</span>}
                </div>
                <table className="leaderboard">
                    <thead>
                        <tr>
                            <th style={{ width: 56 }}>#</th>
                            <th>Angler</th>
                            <th>Team/Boat</th>
                            <th>Species</th>
                            <th style={{ textAlign: "right" }}>Weight (kg)</th>
                            <th style={{ width: 160 }}>Submitted</th>
                        </tr>
                    </thead>
                    <tbody>
                        {topOverall.map((r, i) => (
                            <tr key={`${r.id}-${i}`}>
                                <td>{i + 1}</td>
                                <td>{r.angler}</td>
                                <td>{r.team ?? "—"}</td>
                                <td>{r.species}</td>
                                <td style={{ textAlign: "right" }}>{fmtKg(r.weight_kg)}</td>
                                <td>{new Date(r.submitted_at).toLocaleString()}</td>
                            </tr>
                        ))}
                        {!loading && topOverall.length === 0 && (
                            <tr><td colSpan={6} style={{ opacity: 0.7, textAlign: "center", padding: "1rem" }}>No results yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </section>

            {/* SPECIES GROUPS */}
            <section className="card" style={{ marginTop: 16 }}>
                <div className="card__hdr"><h2>Leaders by Species</h2></div>
                <div className="species-grid">
                    {bySpecies.map(([species, list]) => (
                        <div className="species-card" key={species}>
                            <header>
                                <h3>{species}</h3>
                                <span className="badge">{list.length} weigh-ins</span>
                            </header>
                            <table className="leaderboard leaderboard--compact">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>#</th>
                                        <th>Angler</th>
                                        <th>Team</th>
                                        <th style={{ textAlign: "right" }}>kg</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.slice(0, 5).map((r, i) => (
                                        <tr key={`${species}-${r.id}-${i}`}>
                                            <td>{i + 1}</td>
                                            <td>{r.angler}</td>
                                            <td>{r.team ?? "—"}</td>
                                            <td style={{ textAlign: "right" }}>{fmtKg(r.weight_kg)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    {!loading && bySpecies.length === 0 && (
                        <div style={{ padding: "1rem" }}>No species recorded yet.</div>
                    )}
                </div>
            </section>

            <footer style={{ margin: "24px 0", textAlign: "center", opacity: 0.7 }}>
                Powered by <strong>GDMNZ</strong> • Data refreshes every 30s • For official results see prize-giving.
            </footer>
        </div>
    );
}

function fmtKg(v?: number | null) {
    return (v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
