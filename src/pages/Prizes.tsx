// src/pages/Prizes.tsx
import { useEffect, useState } from "react";
import {
    listCompetitions,
    listCompetitionSpecies,
} from "@/services/api";
import {
    listPrizesForCompetition,
    upsertPrize,
    type PrizeRow,
} from "@/services/prizes";
import { listSponsors } from "@/services/sponsors";




/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */
type Competition = {
    id: string;
    name: string;
};

type Species = {
    id: number;
    name: string;
};

type Sponsor = {
    id: string;
    name: string;
};

/* ------------------------------------------------------------------ */
/* Page */
/* ------------------------------------------------------------------ */
export default function Prizes() {
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [competitionId, setCompetitionId] = useState<string>("");

    const [species, setSpecies] = useState<Species[]>([]);
    const [prizes, setPrizes] = useState<PrizeRow[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);

    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    /* -------------------------------------------------- */
    /* Load competitions + sponsors */
    /* -------------------------------------------------- */
    useEffect(() => {
        (async () => {
            const [comps, sps] = await Promise.all([
                listCompetitions(),
                listSponsors(),
            ]);

            setCompetitions(comps);
            setSponsors(sps);

            if (comps.length) {
                setCompetitionId(comps[0].id);
            } else {
                setLoading(false);
            }
        })();
    }, []);

    /* -------------------------------------------------- */
    /* Load species + prizes */
    /* -------------------------------------------------- */
    useEffect(() => {
        if (!competitionId) return;

        (async () => {
            setLoading(true);

            const [spRows, prizeRows] = await Promise.all([
                listCompetitionSpecies(competitionId),
                listPrizesForCompetition(competitionId),
            ]);

            setSpecies(spRows.map((r: any) => r.species));
            setPrizes(prizeRows);
            setLoading(false);
        })();
    }, [competitionId]);

    /* -------------------------------------------------- */
    /* Save prize */
    /* -------------------------------------------------- */
    async function savePrize(p: {
        id?: string;
        species_id: number;
        rank: number;
        label: string | null;
        sponsor_id: string | null;
    }) {
        setSavingId(p.id ?? "new");

        await upsertPrize({
            id: p.id,
            competition_id: competitionId,
            species_id: p.species_id,
            rank: p.rank,
            label: p.label,
            for_category: "combined",
            sponsor_id: p.sponsor_id,
        });

        setPrizes(await listPrizesForCompetition(competitionId));
        setSavingId(null);
    }

    /* -------------------------------------------------- */
    /* Remove prize (soft delete) */
    /* -------------------------------------------------- */
    async function removePrize(p: PrizeRow) {
        if (!confirm("Remove this prize?")) return;

        setSavingId(p.id);

        await upsertPrize({
            id: p.id,
            competition_id: competitionId,
            species_id: p.species_id,
            rank: p.rank,
            label: p.label,
            for_category: "combined",
            sponsor_id: p.sponsor_id,
        });


        setPrizes(await listPrizesForCompetition(competitionId));
        setSavingId(null);
    }

    /* -------------------------------------------------- */
    /* Loading */
    /* -------------------------------------------------- */
    if (loading) {
        return (
            <section className="card">
                <h3>Prizes</h3>
                <p className="muted">Loading…</p>
            </section>
        );
    }

    /* -------------------------------------------------- */
    /* Render */
    /* -------------------------------------------------- */
    return (
        <section className="card">
            <h2 style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <span>Prizes</span>

                <select
                    value={competitionId}
                    onChange={(e) => setCompetitionId(e.target.value)}
                    style={{
                        padding: "6px 10px",
                        width: "30%",
                        minWidth: "220px",
                        maxWidth: "300px",
                        textAlign: "left"
                    }}
                >
                    {competitions.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </h2>

            {species.map((s) => {
                const rows = prizes
                    .filter((p) => p.species_id === s.id)
                    .sort((a, b) => a.rank - b.rank);

                const nextRank =
                    rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.rank)) + 1;

                return (
                    <section key={s.id} className="card">
                        <header
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 8,
                            }}
                        >
                            <h3>{s.name}</h3>
                            <button
                                className="btn"
                                onClick={() =>
                                    savePrize({
                                        species_id: s.id,
                                        rank: nextRank,
                                        label: "",
                                        sponsor_id: null,
                                    })
                                }
                            >
                                + Add prize
                            </button>
                        </header>

                        <table>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Prize</th>
                                    <th>Sponsor</th>
                                    <th></th>
                                </tr>
                            </thead>

                            <tbody>
                                {rows.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.rank}</td>

                                        <td>
                                            <input
                                                value={p.label ?? ""}
                                                onChange={(e) =>
                                                    setPrizes((prev) =>
                                                        prev.map((x) =>
                                                            x.id === p.id
                                                                ? { ...x, label: e.target.value }
                                                                : x
                                                        )
                                                    )
                                                }
                                                onBlur={() =>
                                                    savePrize({
                                                        id: p.id,
                                                        species_id: p.species_id,
                                                        rank: p.rank,
                                                        label: p.label,
                                                        sponsor_id: p.sponsor_id,
                                                    })
                                                }
                                            />
                                        </td>

                                        <td>
                                            <select
                                                value={p.sponsor_id ?? ""}
                                                onChange={(e) =>
                                                    savePrize({
                                                        id: p.id,
                                                        species_id: p.species_id,
                                                        rank: p.rank,
                                                        label: p.label,
                                                        sponsor_id: e.target.value || null,
                                                    })
                                                }
                                            >
                                                <option value="">— Select sponsor —</option>
                                                {sponsors.map((sp) => (
                                                    <option key={sp.id} value={sp.id}>
                                                        {sp.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        <td>
                                            <button
                                                className="btn btn-danger"
                                                disabled={savingId === p.id}
                                                onClick={() => removePrize(p)}
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                );
            })}
        </section>
    );
}
