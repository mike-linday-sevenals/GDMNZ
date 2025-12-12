// src/pages/PrizeGiving.ts
import { useEffect, useState, useMemo } from "react";
import {
    fetchSettings,
    listCompetitions,
    listCompetitionSpecies,
    listFishJoinedForCompetition
} from "@/services/api";

import { listPrizes } from "@/services/prizes";
import { fmt } from "@/utils";

type Category = "combined" | "adult" | "junior";
type PrizeCell = { label: string; sponsor: string | null };

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

    // Load competitions
    useEffect(() => {
        (async () => {
            const comps = await listCompetitions();
            setCompetitions(comps);
        })();
    }, []);

    // Load settings
    useEffect(() => {
        (async () => {
            const st = await fetchSettings();
            setSettings(st);
        })();
    }, []);

    // Load species + entries + prizes WHEN competition is selected
    useEffect(() => {
        if (!competitionId) return;

        (async () => {
            const [spRows, results, pRows] = await Promise.all([
                listCompetitionSpecies(competitionId),
                listFishJoinedForCompetition(competitionId),
                listPrizes()
            ]);

            const sp = spRows.map((r: any) => ({
                id: r.species.id,
                name: r.species.name
            }));

            setSpecies(sp);
            setEntries(results);

            const byId = new Map<number, string>(sp.map((s) => [s.id, s.name]));
            const m: PrizeMap = {};

            for (const s of sp) {
                m[s.name] = { combined: {}, adult: {}, junior: {} };
            }

            for (const p of pRows) {
                const sName = byId.get(p.species_id);
                if (!sName) continue;

                const cat: Category = (p.for_category ?? "combined") as Category;
                m[sName][cat][p.rank] = {
                    label: p.label ?? "",
                    sponsor: p.sponsor ?? ""
                };
            }

            setPrizeMap(m);
        })();
    }, [competitionId]);

    const activeSet = useMemo(() => {
        if (!settings) return null;
        const ids = Array.isArray(settings.activeSpeciesIds)
            ? settings.activeSpeciesIds
            : species.map((s) => s.id);
        return new Set(ids);
    }, [settings, species]);

    function parseWeighIn(ts?: string | null) {
        if (!ts) return Number.POSITIVE_INFINITY;
        const n = Date.parse(String(ts));
        return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    }

    function rankFor(arr: any[]) {
        const s = settings || { compMode: "weight" };
        return arr.slice().sort((a, b) => {
            const pa =
                s.compMode === "measure"
                    ? a.length_cm || 0
                    : a.weight_kg || 0;
            const pb =
                s.compMode === "measure"
                    ? b.length_cm || 0
                    : b.weight_kg || 0;

            if (pb !== pa) return pb - pa;
            return parseWeighIn(a.created_at) - parseWeighIn(b.created_at);
        });
    }

    const mode: "combined" | "split" = settings?.prizeMode || "combined";
    const speciesToShow = species;

    return (
        <section className="card">
            <h2 style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <span>Prize Giving</span>

                <select
                    value={competitionId || ""}
                    onChange={(e) => setCompetitionId(e.target.value)}
                >
                    <option value="">-- Select Competition --</option>
                    {competitions
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

            {speciesToShow.map((s) => {
                const all = entries.filter((e) => e.species?.id === s.id);
                const node = prizeMap[s.name] || {
                    combined: {},
                    adult: {},
                    junior: {}
                };

                if (mode === "combined") {
                    const pz = node.combined;
                    const places = Object.keys(pz)
                        .map(Number)
                        .sort((a, b) => b - a);

                    if (!places.length)
                        return (
                            <section className="card" key={s.id}>
                                <h3>{s.name}</h3>
                                <p className="muted">No prizes configured.</p>
                            </section>
                        );

                    const ranked = rankFor(all).slice(0, Math.max(...places));

                    return (
                        <SpeciesBlock
                            key={s.id}
                            name={s.name}
                            label="Combined"
                            places={places}
                            ranked={ranked}
                            prizeMap={pz}
                            compMode={settings?.compMode || "weight"}
                        />
                    );
                }

                return null;
            })}
        </section>
    );
}
function SpeciesBlock({
    name,
    label,
    places,
    ranked,
    prizeMap,
    compMode
}: {
    name: string;
    label: string;
    places: number[];
    ranked: any[];
    prizeMap: Record<number, { label: string; sponsor: string | null }>;
    compMode: "measure" | "weight";
}) {
    return (
        <section className="card">
            <h3>
                {name} — {label}
            </h3>

            <Table
                places={places}
                ranked={ranked}
                pz={prizeMap}
                compMode={compMode}
                showCat
            />
        </section>
    );
}

function Table({
    places,
    ranked,
    pz,
    compMode,
    showCat
}: {
    places: number[];
    ranked: any[];
    pz: Record<number, { label: string; sponsor: string | null }>;
    compMode: "measure" | "weight";
    showCat: boolean;
}) {
    return (
        <table>
            <thead>
                <tr>
                    <th>Place</th>
                    <th>Competitor</th>
                    {showCat && <th>Category</th>}
                    <th>{compMode === "measure" ? "Length (cm)" : "Weight (kg)"}</th>
                    <th>Entry date</th>
                    <th>Entry time</th>
                    <th>Prize</th>
                    <th>Sponsor</th>
                </tr>
            </thead>

            <tbody>
                {places.map((place) => {
                    const c = ranked[place - 1];

                    if (!c) {
                        const colspan =
                            1 +
                            1 +
                            (showCat ? 1 : 0) +
                            1 +
                            1 +
                            1 +
                            1;

                        return (
                            <tr key={place}>
                                <td>{place}</td>
                                <td colSpan={colspan} className="muted">
                                    — no qualified entry —
                                </td>
                            </tr>
                        );
                    }

                    const prize = pz[place] || { label: "", sponsor: "" };
                    const catLabel =
                        c.competitor?.category === "adult"
                            ? "Adult"
                            : "Junior";

                    const metric =
                        compMode === "measure"
                            ? c.length_cm ?? ""
                            : c.weight_kg ?? "";

                    const dt = new Date(c.created_at);
                    const entryDate = dt.toLocaleDateString("en-NZ", {
                        day: "2-digit",
                        month: "short"
                    });
                    const entryTime = dt.toLocaleTimeString("en-NZ", {
                        hour: "2-digit",
                        minute: "2-digit"
                    });

                    return (
                        <tr key={place}>
                            <td>{place}</td>
                            <td>{c.competitor?.full_name}</td>
                            {showCat && <td>{catLabel}</td>}
                            <td>{metric}</td>
                            <td>{entryDate}</td>
                            <td>{entryTime}</td>
                            <td>{prize.label}</td>
                            <td className="sponsor">{prize.sponsor}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/* helpers unchanged */
