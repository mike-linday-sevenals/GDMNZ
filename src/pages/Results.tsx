console.log("🔥 RESULTS FILE LOADED 🔥");

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
    fetchSettings,
    listFishJoinedForCompetition,
    listSpecies,
    getCompetition,
    listCompetitions
} from "@/services/api";

import { fmt, formatNZ } from "@/utils";
import type { FishJoined, Species } from "@/types";

type Settings = {
    compMode: "measure" | "weight";
    decimals?: number;
    activeSpeciesIds?: number[];
};

export default function Results() {
    const location = useLocation();
    const navigate = useNavigate();

    const params = new URLSearchParams(location.search);
    const competitionId = params.get("competition");

    // ------------------------------------------------------------------
    // STATE
    // ------------------------------------------------------------------
    const [competitions, setCompetitions] = useState<any[]>([]);
    const [competitionName, setCompetitionName] = useState("");
    const [settings, setSettings] = useState<Settings | null>(null);
    const [rows, setRows] = useState<FishJoined[]>([]);
    const [species, setSpecies] = useState<Species[]>([]);
    const [loading, setLoading] = useState(false);

    // ------------------------------------------------------------------
    // LOAD COMPETITIONS FOR DROPDOWN
    // ------------------------------------------------------------------
    useEffect(() => {
        (async () => {
            const list = await listCompetitions();
            setCompetitions(list || []);
        })();
    }, []);

    // ------------------------------------------------------------------
    // LOAD RESULTS WHEN COMPETITION CHANGES
    // ------------------------------------------------------------------
    useEffect(() => {
        console.log("[Results] competitionId changed:", competitionId);

        // reset state
        setCompetitionName("");
        setSettings(null);
        setRows([]);
        setSpecies([]);
        setLoading(false);

        if (!competitionId) return;

        setLoading(true);

        (async () => {
            try {
                const comp = await getCompetition({ id: competitionId });

                const [st, fish, sp] = await Promise.all([
                    fetchSettings(),
                    listFishJoinedForCompetition(competitionId),
                    listSpecies()
                ]);

                setCompetitionName(comp?.name || "");
                setSettings(st);
                setRows(fish ?? []);
                setSpecies(sp ?? []);
            } catch (err) {
                console.error("[Results] failed to load", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [competitionId]);

    // ------------------------------------------------------------------
    // ACTIVE SPECIES
    // ------------------------------------------------------------------
    const activeSet = useMemo(() => {
        if (!settings) return null;

        const ids = Array.isArray(settings.activeSpeciesIds)
            ? settings.activeSpeciesIds
            : species.map((s) => s.id);

        return new Set(ids);
    }, [settings, species]);

    const filtered = useMemo(() => {
        return rows.filter((r) => {
            const sid = r.species?.id;
            return !activeSet || sid == null || activeSet.has(sid);
        });
    }, [rows, activeSet]);

    // ------------------------------------------------------------------
    // HANDLERS
    // ------------------------------------------------------------------
    function onCompetitionChange(id: string) {
        if (!id) return;
        navigate(`/results?competition=${id}`);
    }

    // ------------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------------
    return (
        <section className="card">
            {/* 🔽 COMPETITION SELECTOR (NEW) */}
            <div style={{ marginBottom: 16 }}>
                <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                    Select competition results
                </label>

                <select
                    value={competitionId ?? ""}
                    onChange={(e) => onCompetitionChange(e.target.value)}
                    style={{ maxWidth: 360 }}
                >
                    <option value="">— Select competition —</option>
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
            </div>

            {/* TITLE */}
            <h2>
                Results {competitionName && <>— {competitionName}</>}
            </h2>

            {loading && <p className="muted">Loading results…</p>}

            {!loading && competitionId && rows.length === 0 && (
                <p className="muted">No results for this competition.</p>
            )}

            {/* SIMPLE TABLE (confirmed working) */}
            {filtered.length > 0 && (
                <div style={{ overflow: "auto", marginTop: 10 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Competitor</th>
                                <th>Species</th>
                                <th>
                                    {settings?.compMode === "measure"
                                        ? "Length (cm)"
                                        : "Weight (kg)"}
                                </th>
                                <th>Entry date</th>
                                <th>Entry time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => {
                                const ts = r.created_at
                                    ? new Date(r.created_at)
                                    : null;

                                return (
                                    <tr key={String(r.id)}>
                                        <td>{r.competitor?.full_name}</td>
                                        <td>{r.species?.name}</td>
                                        <td>
                                            {settings?.compMode === "measure"
                                                ? r.length_cm != null
                                                    ? fmt(r.length_cm, 1)
                                                    : ""
                                                : r.weight_kg != null
                                                    ? fmt(
                                                        r.weight_kg,
                                                        settings?.decimals || 2
                                                    )
                                                    : ""}
                                        </td>
                                        <td>
                                            {ts ? formatNZ(ts.toISOString().slice(0, 10)) : ""}
                                        </td>
                                        <td>
                                            {ts ? ts.toTimeString().slice(0, 5) : ""}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
