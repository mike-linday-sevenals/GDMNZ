import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
    listCompetitions,
    listCompetitionSpecies,
    getCompetition
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

type PrizeMode = "combined" | "split";
type PrizeCategory = "combined" | "junior" | "adult";

/* ------------------------------------------------------------------ */
/* Page */
/* ------------------------------------------------------------------ */
export default function Prizes() {
    const { organisationId } = useParams<{ organisationId: string }>();

    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [competitionId, setCompetitionId] = useState<string>("");

    const [species, setSpecies] = useState<Species[]>([]);
    const [prizes, setPrizes] = useState<PrizeRow[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);

    const [prizeMode, setPrizeMode] = useState<PrizeMode>("combined");
    const [activeCategory, setActiveCategory] =
        useState<"junior" | "adult">("adult");

    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    /* -------------------------------------------------- */
    /* Load competitions + sponsors (ORG SCOPED) */
    /* -------------------------------------------------- */
    useEffect(() => {
        if (!organisationId) return;

        (async () => {
            const [comps, sps] = await Promise.all([
                listCompetitions(organisationId),
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
    }, [organisationId]);

    /* -------------------------------------------------- */
    /* Load prize mode + species + prizes */
    /* -------------------------------------------------- */
    useEffect(() => {
        if (!organisationId || !competitionId) return;

        (async () => {
            setLoading(true);

            const [comp, spRows, prizeRows] = await Promise.all([
                getCompetition(organisationId, competitionId),
                listCompetitionSpecies(organisationId, competitionId),
                listPrizesForCompetition(organisationId, competitionId),
            ]);

            setPrizeMode(
                comp.prize_mode?.name === "split" ? "split" : "combined"
            );

            setSpecies(spRows.map((r: any) => r.species));
            setPrizes(prizeRows);
            setLoading(false);
        })();
    }, [organisationId, competitionId]);

    /* -------------------------------------------------- */
    /* Helpers */
    /* -------------------------------------------------- */
    const currentCategory: PrizeCategory =
        prizeMode === "combined" ? "combined" : activeCategory;

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
            await listPrizesForCompetition(organisationId!, competitionId));
        setSavingId(null);
    }

    /* -------------------------------------------------- */
    /* Remove prize (hard delete or soft handled in API) */
    /* -------------------------------------------------- */
    async function removePrize(p: PrizeRow) {
        if (!confirm("Remove this prize?")) return;

        setSavingId(p.id);

        await upsertPrize({
            ...p,
            for_category: p.for_category,
            is_deleted: true, // assumes soft delete support
        } as any);

        setPrizes(
            await listPrizesForCompetition(organisationId!, competitionId));

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
                    marginBottom: 12,
                    flexWrap: "wrap",
                }}
            >
                <h2 style={{ margin: 0, flex: 1 }}>Prizes</h2>

                {/* ---------- Prize Mode Label ---------- */}
                <div className="muted" style={{ whiteSpace: "nowrap" }}>
                    Prize Mode:
                </div>

                {/* ---------- Combined / Split Toggle ---------- */}
                {prizeMode === "combined" ? (
                    <strong>Combined</strong>
                ) : (
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

                {/* ---------- Competition Selector ---------- */}
                <select
                    value={competitionId}
                    onChange={(e) => {
                        setCompetitionId(e.target.value);

                        // 🔑 Reset category when switching competitions
                        if (prizeMode === "split") {
                            setActiveCategory("adult");
                        }
                    }}
                    style={{ maxWidth: 320 }}
                >
                    <option value="">-- Select Competition --</option>
                    {competitions.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
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
