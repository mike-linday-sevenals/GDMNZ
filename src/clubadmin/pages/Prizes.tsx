import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
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
type Species = {
    id: number;
    name: string;
};

type Sponsor = {
    id: string;
    name: string;
};

type PrizeMode = "combined" | "split";
type PrizeCategory = "combined" | "junior" | "adult";

/* ------------------------------------------------------------------ */
/* Props */
/* ------------------------------------------------------------------ */
type Props = {
    organisationId: string;
    competitionId: string;
    prizeMode: PrizeMode;
};

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */
export default function Prizes({
    organisationId,
    competitionId,
    prizeMode,
}: Props) {
    const [species, setSpecies] = useState<Species[]>([]);
    const [prizes, setPrizes] = useState<PrizeRow[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);

    const [activeCategory, setActiveCategory] =
        useState<"junior" | "adult">("adult");

    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    /* -------------------------------------------------- */
    /* Load species + prizes + sponsors */
    /* -------------------------------------------------- */
    useEffect(() => {
        if (!organisationId || !competitionId) return;

        (async () => {
            setLoading(true);

            const [spRows, prizeRows, sps] = await Promise.all([
                listCompetitionSpecies(organisationId, competitionId),
                listPrizesForCompetition(organisationId, competitionId),
                listSponsors(),
            ]);

            setSpecies(spRows.map((r: any) => r.species));
            setPrizes(prizeRows);
            setSponsors(sps);

            setLoading(false);
        })();
    }, [organisationId, competitionId]);

    /* -------------------------------------------------- */
    /* Helpers */
    /* -------------------------------------------------- */
    const currentCategory: PrizeCategory =
        prizeMode === "combined" ? "combined" : activeCategory;

    const hasAnyPrizes = prizes.length > 0;

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
            sponsor_id: p.sponsor_id,
            for_category: currentCategory,
        });

        setPrizes(
            await listPrizesForCompetition(organisationId, competitionId)
        );

        setSavingId(null);
    }

    /* -------------------------------------------------- */
    /* Remove prize */
    /* -------------------------------------------------- */
    async function removePrize(p: PrizeRow) {
        if (!confirm("Remove this prize?")) return;

        setSavingId(p.id);

        await upsertPrize({
            ...p,
            is_deleted: true,
        } as any);

        setPrizes(
            await listPrizesForCompetition(organisationId, competitionId)
        );

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
            {/* ================= HEADER ================= */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                }}
            >
                <h2 style={{ margin: 0, flex: 1 }}>Prizes</h2>

                {prizeMode === "split" && (
                    <div style={{ display: "flex", gap: 4 }}>
                        <button
                            type="button"
                            className={
                                activeCategory === "junior"
                                    ? "btn"
                                    : "btn btn-secondary"
                            }
                            onClick={() => setActiveCategory("junior")}
                        >
                            Junior
                        </button>

                        <button
                            type="button"
                            className={
                                activeCategory === "adult"
                                    ? "btn"
                                    : "btn btn-secondary"
                            }
                            onClick={() => setActiveCategory("adult")}
                        >
                            Adult
                        </button>
                    </div>
                )}

                {/* 🔑 PRIZE GIVING CTA */}
                <Link
                    to="prize-giving"
                    className={`btn primary ${!hasAnyPrizes ? "disabled" : ""}`}
                    aria-disabled={!hasAnyPrizes}
                    onClick={(e) => {
                        if (!hasAnyPrizes) e.preventDefault();
                    }}
                >
                    Prize Giving →
                </Link>
            </div>

            {/* ================= SPECIES ================= */}
            {species.map((s) => {
                const rows = prizes
                    .filter(
                        (p) =>
                            p.species_id === s.id &&
                            p.for_category === currentCategory
                    )
                    .sort((a, b) => a.rank - b.rank);

                const nextRank =
                    rows.length === 0
                        ? 1
                        : Math.max(...rows.map((r) => r.rank)) + 1;

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
                            <h3>
                                {s.name}
                                {prizeMode === "split" && (
                                    <span className="muted">
                                        {" "}
                                        — {activeCategory}
                                    </span>
                                )}
                            </h3>

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
                                                                ? {
                                                                    ...x,
                                                                    label:
                                                                        e
                                                                            .target
                                                                            .value,
                                                                }
                                                                : x
                                                        )
                                                    )
                                                }
                                                onBlur={() =>
                                                    savePrize({
                                                        id: p.id,
                                                        species_id:
                                                            p.species_id,
                                                        rank: p.rank,
                                                        label: p.label,
                                                        sponsor_id:
                                                            p.sponsor_id,
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
                                                        species_id:
                                                            p.species_id,
                                                        rank: p.rank,
                                                        label: p.label,
                                                        sponsor_id:
                                                            e.target.value ||
                                                            null,
                                                    })
                                                }
                                            >
                                                <option value="">
                                                    — Select sponsor —
                                                </option>
                                                {sponsors.map((sp) => (
                                                    <option
                                                        key={sp.id}
                                                        value={sp.id}
                                                    >
                                                        {sp.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        <td>
                                            <button
                                                className="btn btn-danger"
                                                disabled={savingId === p.id}
                                                onClick={() =>
                                                    removePrize(p)
                                                }
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
