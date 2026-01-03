import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
    fetchSettings,
    listCompetitions,
    listCompetitionSpecies,
    listFishJoinedForCompetition,
    getCompetition,
    listPrizesForCompetition,
} from "@/services/api";

import "./prizeGivingPrint.css";

/* ======================================================================
   TYPES
   ====================================================================== */

type PrizeMode = "combined" | "split";
type Category = "combined" | "adult" | "junior";

type PrizeCell = {
    label: string;
    sponsor: string | null;
};

type PrizeMap = Record<
    number,
    {
        combined: Record<number, PrizeCell>;
        adult: Record<number, PrizeCell>;
        junior: Record<number, PrizeCell>;
    }
>;

/* ======================================================================
   COMPONENT
   ====================================================================== */

export default function PrizeGiving() {
    const { organisationId } = useParams<{ organisationId: string }>();

    const [competitionId, setCompetitionId] = useState("");
    const [competitions, setCompetitions] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [species, setSpecies] = useState<any[]>([]);
    const [entries, setEntries] = useState<any[]>([]);
    const [prizeMap, setPrizeMap] = useState<PrizeMap>({});
    const [prizeMode, setPrizeMode] = useState<PrizeMode>("combined");

    // 🔀 View toggle (only relevant when split)
    const [viewCategory, setViewCategory] =
        useState<Category>("combined");

    /* -------------------------------------------------- */
    /* Load competitions + settings */
    /* -------------------------------------------------- */
    useEffect(() => {
        if (!organisationId) return;

        listCompetitions(organisationId).then(setCompetitions);
        fetchSettings().then(setSettings);
    }, [organisationId]);

    /* -------------------------------------------------- */
    /* Load species, entries, prizes */
    /* -------------------------------------------------- */
    useEffect(() => {
        if (!organisationId || !competitionId) return;

        (async () => {
            try {
                const [comp, spRows, results, prizeRows] = await Promise.all([
                    getCompetition(organisationId, competitionId),
                    listCompetitionSpecies(organisationId, competitionId),
                    listFishJoinedForCompetition(competitionId),
                    listPrizesForCompetition(organisationId, competitionId),
                ]);

                const mode: PrizeMode =
                    comp.prize_mode?.name === "split"
                        ? "split"
                        : "combined";

                setPrizeMode(mode);

                // ✅ Enforce valid view
                setViewCategory(mode === "split" ? "junior" : "combined");

                const sp = spRows.map((r: any) => r.species);
                setSpecies(sp);
                setEntries(results);

                const map: PrizeMap = {};
                for (const s of sp) {
                    map[s.id] = { combined: {}, adult: {}, junior: {} };
                }

                for (const p of prizeRows) {
                    const cat: Category =
                        p.for_category === "adult" || p.for_category === "junior"
                            ? p.for_category
                            : "combined";

                    if (!map[p.species_id]) continue;

                    map[p.species_id][cat][p.rank] = {
                        label: p.label ?? "",
                        sponsor: p.sponsor ?? null,
                    };
                }

                setPrizeMap(map);
            } catch (err) {
                console.error("❌ Failed to load Prize Giving data", err);
            }
        })();
    }, [organisationId, competitionId]);

    /* -------------------------------------------------- */
    /* Helpers */
    /* -------------------------------------------------- */

    function parseWeighIn(ts?: string | null) {
        if (!ts) return Number.POSITIVE_INFINITY;
        const n = Date.parse(ts);
        return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    }

    function rankEntries(arr: any[]) {
        const mode = settings?.compMode ?? "weight";

        return arr.slice().sort((a, b) => {
            const pa =
                mode === "measure" ? a.length_cm || 0 : a.weight_kg || 0;
            const pb =
                mode === "measure" ? b.length_cm || 0 : b.weight_kg || 0;

            if (pb !== pa) return pb - pa;
            return parseWeighIn(a.created_at) - parseWeighIn(b.created_at);
        });
    }

    function competitorForPlace(ranked: any[], place: number) {
        return ranked[place - 1] ?? null;
    }

    /* -------------------------------------------------- */
    /* Render */
    /* -------------------------------------------------- */

    return (
        <section className="card prize-giving">

            {/* ================= HEADER ================= */}
            <h2
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 12,
                }}
            >
                {/* LEFT: Dynamic title */}
                <span>
                    Prize Giving
                    {prizeMode === "split" && viewCategory !== "combined" && (
                        <> – {viewCategory === "junior" ? "Junior" : "Adult"}</>
                    )}
                </span>

                {/* RIGHT: Controls (hidden in print via CSS) */}
                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                    }}
                    className="no-print"
                >
                    <select
                        value={competitionId}
                        onChange={(e) => setCompetitionId(e.target.value)}
                        style={{ maxWidth: 320 }}
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

                    <button
                        className="btn btn-secondary"
                        onClick={() => window.print()}
                        disabled={!competitionId}
                    >
                        Print
                    </button>
                </div>
            </h2>


            {/* ================= CATEGORY TOGGLE ================= */}
            {prizeMode === "split" && (
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        marginBottom: 16,
                    }}
                >
                    {(["junior", "adult"] as Category[]).map((c) => (
                        <button
                            key={c}
                            className={
                                viewCategory === c
                                    ? "btn"
                                    : "btn btn-secondary"
                            }
                            onClick={() => setViewCategory(c)}
                        >
                            {c === "junior" ? "Junior" : "Adult"}
                        </button>
                    ))}
                </div>
            )}

            {/* ================= RESULTS ================= */}
            {species.map((s) => {
                const allEntries = entries.filter(
                    (e) => e.species?.id === s.id
                );

                const prizeNode = prizeMap[s.id];
                if (!prizeNode) return null;

                const category: Category =
                    prizeMode === "split" ? viewCategory : "combined";

                const relevantEntries =
                    category === "combined"
                        ? allEntries
                        : allEntries.filter(
                            (e) =>
                                e.competitor?.category === category
                        );

                const prizes = prizeNode[category];
                const places = Object.keys(prizes)
                    .map(Number)
                    .sort((a, b) => b - a); // 3 → 2 → 1

                if (!places.length) return null;

                const ranked = rankEntries(relevantEntries).slice(
                    0,
                    Math.max(...places)
                );

                return (
                    <section className="card" key={s.id}>
                        <h3>{s.name}</h3>

                        <table>
                            <thead>
                                <tr>
                                    <th>Place</th>
                                    <th>Competitor</th>
                                    <th>
                                        {settings?.compMode === "measure"
                                            ? "Length (cm)"
                                            : "Weight (kg)"}
                                    </th>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Prize</th>
                                    <th>Sponsor</th>
                                </tr>
                            </thead>

                            <tbody>
                                {places.map((place) => {
                                    const c = competitorForPlace(
                                        ranked,
                                        place
                                    );

                                    if (!c) {
                                        return (
                                            <tr key={place}>
                                                <td>{place}</td>
                                                <td
                                                    colSpan={6}
                                                    className="muted"
                                                >
                                                    — no qualified entry —
                                                </td>
                                            </tr>
                                        );
                                    }

                                    const prize = prizes[place];
                                    const dt = new Date(c.created_at);

                                    return (
                                        <tr key={place}>
                                            <td>{place}</td>
                                            <td>
                                                {c.competitor?.full_name}
                                            </td>
                                            <td>
                                                {settings?.compMode ===
                                                    "measure"
                                                    ? c.length_cm
                                                    : c.weight_kg}
                                            </td>
                                            <td>
                                                {dt.toLocaleDateString(
                                                    "en-NZ"
                                                )}
                                            </td>
                                            <td>
                                                {dt.toLocaleTimeString(
                                                    "en-NZ",
                                                    {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    }
                                                )}
                                            </td>
                                            <td>{prize?.label}</td>
                                            <td>
                                                {prize?.sponsor ?? "—"}
                                            </td>
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
