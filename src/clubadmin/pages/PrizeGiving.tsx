import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { listCompetitions } from "@/clubadmin/api/competitions";
import {
    loadPrizeGivingData,
    Division,
    Species,
    Entry,
    Prize,
} from "@/clubadmin/api/prizeGiving";

import "./PrizeGivingPrint.css";

type PrizeMap = Record<
    string, // division_id
    Record<number, Record<number, Prize>> // species_id → rank → prize
>;

export default function PrizeGiving() {
    const { organisationId } = useParams<{ organisationId: string }>();

    const [competitionId, setCompetitionId] = useState("");
    const [competitions, setCompetitions] = useState<any[]>([]);

    const [species, setSpecies] = useState<Species[]>([]);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [prizeMap, setPrizeMap] = useState<PrizeMap>({});

    const [activeDivision, setActiveDivision] = useState<Division | null>(
        null
    );
    const [compMode, setCompMode] =
        useState<"weight" | "length">("weight");

    /* --------------------------------------------------
       Load competitions
    -------------------------------------------------- */
    useEffect(() => {
        if (organisationId) {
            listCompetitions(organisationId).then(setCompetitions);
        }
    }, [organisationId]);

    /* --------------------------------------------------
       Load prize giving data
    -------------------------------------------------- */
    useEffect(() => {
        if (!organisationId || !competitionId) return;

        loadPrizeGivingData(organisationId, competitionId).then((data) => {
            setSpecies(data.species);
            setEntries(data.entries);
            setDivisions(data.divisions);
            setCompMode(data.competition.comp_mode);
            setActiveDivision(data.divisions[0] ?? null);

            const map: PrizeMap = {};
            data.prizes.forEach((p) => {
                map[p.division_id] ??= {};
                map[p.division_id][p.species_id] ??= {};
                map[p.division_id][p.species_id][p.rank] = p;
            });
            setPrizeMap(map);
        });
    }, [organisationId, competitionId]);

    /* --------------------------------------------------
    Helpers
 -------------------------------------------------- */
    function entriesForDivision(
        list: Entry[],
        division: Division
    ): Entry[] {
        return list.filter(
            (e) => e.division_id === division.id
        );
    }

    function rankFish(list: Entry[]) {
        return [...list].sort((a, b) => {
            const va =
                compMode === "length"
                    ? a.length_cm ?? 0
                    : a.weight_kg ?? 0;
            const vb =
                compMode === "length"
                    ? b.length_cm ?? 0
                    : b.weight_kg ?? 0;

            if (vb !== va) return vb - va;

            return (
                Date.parse(a.priority_timestamp) -
                Date.parse(b.priority_timestamp)
            );
        });
    }

    /* --------------------------------------------------
       Render
    -------------------------------------------------- */
    return (
        <section className="card prize-giving">
            <h2>Prize Giving</h2>

            <select
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
            >
                <option value="">-- Select Competition --</option>
                {competitions.map((c) => (
                    <option key={c.id} value={c.id}>
                        {c.name}
                    </option>
                ))}
            </select>

            {divisions.length > 1 && (
                <div className="division-tabs">
                    {divisions.map((d) => (
                        <button
                            key={d.id}
                            className={
                                activeDivision?.id === d.id
                                    ? "btn"
                                    : "btn btn-secondary"
                            }
                            onClick={() => setActiveDivision(d)}
                        >
                            {d.name}
                        </button>
                    ))}
                </div>
            )}

            {activeDivision &&
                species.map((s) => {
                    const prizes =
                        prizeMap[activeDivision.id]?.[s.id];
                    if (!prizes) return null;

                    const places = Object.keys(prizes)
                        .map(Number)
                        .sort((a, b) => b - a);

                    const ranked = rankFish(
                        entriesForDivision(
                            entries.filter(
                                (e) => e.species_id === s.id
                            ),
                            activeDivision
                        )
                    );

                    return (
                        <section key={s.id}>
                            <h3>{s.name}</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Place</th>
                                        <th>Angler</th>
                                        <th>
                                            {compMode === "length"
                                                ? "Length (cm)"
                                                : "Weight (kg)"}
                                        </th>
                                        <th>Prize</th>
                                        <th>Sponsor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {places.map((place) => {
                                        const fish =
                                            ranked[place - 1];
                                        const prize =
                                            prizes[place];

                                        return (
                                            <tr key={place}>
                                                <td>{place}</td>
                                                <td>
                                                    {fish?.competitor_name ??
                                                        "—"}
                                                </td>
                                                <td>
                                                    {fish
                                                        ? compMode ===
                                                            "length"
                                                            ? fish.length_cm
                                                            : fish.weight_kg
                                                        : "—"}
                                                </td>
                                                <td>{prize.label}</td>
                                                <td>
                                                    {prize.sponsor ??
                                                        "—"}
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
