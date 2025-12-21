import { useEffect, useState, useMemo } from "react";
import {
    fetchSettings,
    listCompetitions,
    listCompetitionSpecies,
    listFishJoinedForCompetition,
} from "@/services/api";
import { listPrizesForCompetition } from "@/services/prizes";

type Category = "combined" | "adult" | "junior";

type PrizeCell = {
    label: string;
    sponsor: string | null;
};

type PrizeMap = Record<
    string,
    {
        combined: Record<number, PrizeCell>;
        adult: Record<number, PrizeCell>;
        junior: Record<number, PrizeCell>;
    }
>;

export default function PrizeGiving() {
    const [competitionId, setCompetitionId] = useState<string | null>(null);
    const [competitions, setCompetitions] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [species, setSpecies] = useState<any[]>([]);
    const [entries, setEntries] = useState<any[]>([]);
    const [prizeMap, setPrizeMap] = useState<PrizeMap>({});

    /* -------------------------------------------------- */
    /* Load competitions + settings */
    /* -------------------------------------------------- */
    useEffect(() => {
        listCompetitions().then(setCompetitions);
        fetchSettings().then(setSettings);
    }, []);

    /* -------------------------------------------------- */
    /* Load species, entries, prizes */
    /* -------------------------------------------------- */
    useEffect(() => {
        if (!competitionId) return;

        (async () => {
            const [spRows, results, prizeRows] = await Promise.all([
                listCompetitionSpecies(competitionId),
                listFishJoinedForCompetition(competitionId),
                listPrizesForCompetition(competitionId),
            ]);

            const sp = spRows.map((r: any) => ({
                id: r.species.id,
                name: r.species.name,
            }));

            setSpecies(sp);
            setEntries(results);

            const byId = new Map<number, string>(sp.map(s => [s.id, s.name]));
            const map: PrizeMap = {};

            for (const s of sp) {
                map[s.name] = { combined: {}, adult: {}, junior: {} };
            }

            for (const p of prizeRows) {
                const sName = byId.get(p.species_id);
                if (!sName) continue;

                const cat = (p.for_category ?? "combined") as Category;

                map[sName][cat][p.rank] = {
                    label: p.label ?? "",
                    sponsor: p.sponsor_name || p.sponsor || null,
                };
            }

            setPrizeMap(map);
        })();
    }, [competitionId]);

    /* -------------------------------------------------- */
    /* Helpers */
    /* -------------------------------------------------- */
    function parseWeighIn(ts?: string | null) {
        if (!ts) return Number.POSITIVE_INFINITY;
        const n = Date.parse(String(ts));
        return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    }

    function rankFor(arr: any[]) {
        const s = settings || { compMode: "weight" };
        return arr.slice().sort((a, b) => {
            const pa =
                s.compMode === "measure" ? a.length_cm || 0 : a.weight_kg || 0;
            const pb =
                s.compMode === "measure" ? b.length_cm || 0 : b.weight_kg || 0;

            if (pb !== pa) return pb - pa;
            return parseWeighIn(a.created_at) - parseWeighIn(b.created_at);
        });
    }

    function competitorForPlace(ranked: any[], place: number) {
        return ranked[place - 1] ?? null;
    }

    const mode: "combined" | "split" = settings?.prizeMode || "combined";

    /* -------------------------------------------------- */
    /* Render */
    /* -------------------------------------------------- */
    return (
        <section className="card">
            <h2 style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <span>Prize Giving</span>

                <select
                    value={competitionId || ""}
                    onChange={(e) => setCompetitionId(e.target.value)}
                    style={{
                        padding: "6px 10px",
                        width: "30%",
                        minWidth: "220px",
                        maxWidth: "300px",
                        textAlign: "left"
                    }}
                >
                    <option value="">-- Select Competition --</option>
                    {competitions
                        .slice()
                        .sort(
                            (a, b) =>
                                new Date(b.starts_at).getTime() -
                                new Date(a.starts_at).getTime()
                        )
                        .map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                </select>
            </h2>

            {species.map((s) => {
                const all = entries.filter((e) => e.species?.id === s.id);
                const node = prizeMap[s.name] || {
                    combined: {},
                    adult: {},
                    junior: {},
                };

                const pz = node.combined;

                // 🔔 Announcement order: 3 → 2 → 1
                const places = Object.keys(pz)
                    .map(Number)
                    .sort((a, b) => b - a);

                if (!places.length) {
                    return (
                        <section className="card" key={s.id}>
                            <h3>{s.name}</h3>
                            <p className="muted">No prizes configured.</p>
                        </section>
                    );
                }

                const ranked = rankFor(all).slice(0, Math.max(...places));

                return (
                    <section className="card" key={s.id}>
                        <h3>{s.name}</h3>

                        <table>
                            <thead>
                                <tr>
                                    <th>Place</th>
                                    <th>Competitor</th>
                                    <th>Category</th>
                                    <th>
                                        {settings?.compMode === "measure"
                                            ? "Length (cm)"
                                            : "Weight (kg)"}
                                    </th>
                                    <th>Entry date</th>
                                    <th>Entry time</th>
                                    <th>Prize</th>
                                    <th>Sponsor</th>
                                </tr>
                            </thead>

                            <tbody>
                                {places.map((place) => {
                                    const c = competitorForPlace(ranked, place);

                                    if (!c) {
                                        return (
                                            <tr key={place}>
                                                <td>{place}</td>
                                                <td colSpan={7} className="muted">
                                                    — no qualified entry —
                                                </td>
                                            </tr>
                                        );
                                    }

                                    const prize = pz[place] || { label: "", sponsor: "" };
                                    const dt = new Date(c.created_at);

                                    return (
                                        <tr key={place}>
                                            <td>{place}</td>
                                            <td>{c.competitor?.full_name}</td>
                                            <td>
                                                {c.competitor?.category === "adult"
                                                    ? "Adult"
                                                    : "Junior"}
                                            </td>
                                            <td>
                                                {settings?.compMode === "measure"
                                                    ? c.length_cm
                                                    : c.weight_kg}
                                            </td>
                                            <td>
                                                {dt.toLocaleDateString("en-NZ", {
                                                    day: "2-digit",
                                                    month: "short",
                                                })}
                                            </td>
                                            <td>
                                                {dt.toLocaleTimeString("en-NZ", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </td>
                                            <td>{prize.label}</td>
                                            <td className="sponsor">{prize.sponsor}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </section>
                );
            })}
        </section>
    );
}
