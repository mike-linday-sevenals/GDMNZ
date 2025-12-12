import { useEffect, useMemo, useState } from "react";
import {
    fetchSettings,
    listCompetitions,
    listCompetitorsForCompetition,
    listCompetitionSpecies,
    addCompetitionResult
} from "@/services/api";

import type { Competitor, Species } from "@/types";
import { todayISO } from "@/utils";

type Settings = {
    compMode: "weight" | "measure";
    showTime: boolean;
    requireTime: boolean;
    activeSpeciesIds?: number[];
};

export default function Submit() {
    // -------------------------------
    // COMPETITION STATE
    // -------------------------------
    const [competitionId, setCompetitionId] = useState<string | null>(null);
    const [competitions, setCompetitions] = useState<any[]>([]);

    // -------------------------------
    // SETTINGS + COMPETITION-SPECIFIC SPECIES
    // -------------------------------
    const [settings, setSettings] = useState<Settings | null>(null);
    const [species, setSpecies] = useState<Species[]>([]);

    // -------------------------------
    // COMPETITORS FOR SELECTED COMPETITION
    // -------------------------------
    const [competitors, setCompetitors] = useState<Competitor[]>([]);

    // Load settings only (once)
    useEffect(() => {
        (async () => {
            const st = await fetchSettings();
            setSettings(st);
        })();
    }, []);

    // Load competition list
    useEffect(() => {
        (async () => {
            const comps = await listCompetitions();
            setCompetitions(comps);
        })();
    }, []);

    // Load competitor list based on selected competition
    useEffect(() => {
        if (!competitionId) {
            setCompetitors([]);
            return;
        }

        (async () => {
            const list = await listCompetitorsForCompetition(competitionId);
            setCompetitors(list);
        })();
    }, [competitionId]);

    // Load species list based on selected competition
    useEffect(() => {
        if (!competitionId) {
            setSpecies([]);
            return;
        }

        (async () => {
            const rows = await listCompetitionSpecies(competitionId);
            const extracted = rows.map(r => r.species); // extract species object
            setSpecies(extracted);
        })();
    }, [competitionId]);

    // -------------------------------
    // COMPETITOR SEARCH
    // -------------------------------
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return competitors.slice(0, 200);
        return competitors
            .filter((c) =>
                [c.full_name, c.boat || ""]
                    .join(" ")
                    .toLowerCase()
                    .includes(q)
            )
            .slice(0, 50);
    }, [search, competitors]);

    // -------------------------------
    // FORM STATE
    // -------------------------------
    const [competitorId, setCompetitorId] = useState<string>("");
    const [lengthCm, setLengthCm] = useState<string>("");
    const [weightKg, setWeightKg] = useState<string>("");
    const [specId, setSpecId] = useState<number | "">("");
    const [timeCaught, setTimeCaught] = useState<string>("");
    const [dateCaught, setDateCaught] = useState<string>(todayISO());
    const [keepAfter, setKeepAfter] = useState<boolean>(false);

    // -------------------------------
    // ACTIVE SPECIES + COMPETITION FILTER
    // -------------------------------

    // 1) Keep activeSet (from settings) ONLY for the restriction note
    const activeSet = useMemo(() => {
        if (!settings) return null;
        const ids = Array.isArray(settings.activeSpeciesIds)
            ? settings.activeSpeciesIds
            : species.map((s) => s.id);
        return new Set(ids);
    }, [settings, species]);

    // 2) Species the competition allows
    const [competitionSpecies, setCompetitionSpecies] = useState<Species[]>([]);

    // Load competition-specific species
    useEffect(() => {
        if (!competitionId) {
            setCompetitionSpecies([]);
            return;
        }

        (async () => {
            const rows = await listCompetitionSpecies(competitionId);

            // rows = [{ id, species: { id, name, is_measure } }]
            const extracted = rows.map((r) => r.species);
            setCompetitionSpecies(extracted);
        })();
    }, [competitionId]);

    // 3) Final dropdown list = EXACTLY the competition species
    const activeSpecies = useMemo(() => {
        return competitionSpecies;
    }, [competitionSpecies]);

    // 4) Reset selected species if invalid
    useEffect(() => {
        if (!specId) return;
        if (!activeSpecies.find((s) => s.id === Number(specId))) {
            setSpecId("");
        }
    }, [activeSpecies, specId]);



    // -------------------------------
    // SAVE HANDLER
    // -------------------------------
    async function save(stay: boolean) {
        if (!competitionId) return alert("Please select a competition.");
        if (!competitorId) return alert("Please select a competitor.");
        if (!specId) return alert("Please select a species.");
        if (!settings) return alert("Settings not loaded.");

        if (settings.compMode === "measure") {
            if (!lengthCm || Number(lengthCm) <= 0)
                return alert("Length is required.");
        } else {
            if (!weightKg || Number(weightKg) <= 0)
                return alert("Weight is required.");
        }

        if (settings.showTime && settings.requireTime && !timeCaught)
            return alert("Time is required.");

        const hhmm = timeCaught || "00:00";
        const dateIso = dateCaught || todayISO();
        const timeISO = `${dateIso}T${hhmm}`;

        await addCompetitionResult({
            competition_id: competitionId,
            competitor_id: competitorId,
            species_id: Number(specId),
            length_cm: settings.compMode === "measure" ? Number(lengthCm) : null,
            weight_kg: settings.compMode === "weight" ? Number(weightKg) : null,
            time_caught: settings.showTime ? timeISO : null
        });

        alert("Catch saved!");

        if (stay) {
            const keep = keepAfter ? competitorId : "";
            setLengthCm("");
            setWeightKg("");
            if (!settings.requireTime) setTimeCaught("");
            setSpecId("");
            if (!keep) setCompetitorId("");
            setSearch("");
        } else {
            location.href = "/results";
        }
    }

    // -------------------------------
    // RENDER
    // -------------------------------
    return (
        <section className="card">

            {/* HEADER ROW */}
            <h2
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "16px"
                }}
            >
                <span>Submit a Catch</span>

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

            {/* RESTRICTION NOTE */}
            {!!activeSet &&
                activeSpecies.length !== species.length && (
                    <p className="sub">
                        Only <strong>active species</strong> are listed.
                        Manage in <em>Settings → Species visibility</em>.
                    </p>
                )}

            <div className="row">
                {/* SEARCH */}
                <div className="col-6">
                    <label>Search competitor (name or boat)</label>
                    <input
                        disabled={!competitionId}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Type to filter by name or boat"
                    />
                    <div className="sub">Or pick from dropdown below.</div>
                </div>

                {/* COMPETITOR SELECT */}
                <div className="col-6">
                    <label>Competitor</label>
                    <select
                        disabled={!competitionId}
                        value={competitorId}
                        onChange={(e) => setCompetitorId(e.target.value)}
                    >
                        <option value="">— Select registered competitor —</option>
                        {filtered.map((c) => (
                            <option key={c.id} value={String(c.id)}>
                                {c.full_name} ({c.category === "adult" ? "Adult" : "Junior"}) — {c.boat || ""}
                            </option>
                        ))}
                    </select>
                </div>

                {/* MEASURE/WEIGHT FIELDS */}
                {settings?.compMode === "measure" ? (
                    <>
                        <div className="col-3">
                            <label>Length (cm) *</label>
                            <input
                                disabled={!competitionId}
                                type="number"
                                step="0.1"
                                value={lengthCm}
                                onChange={(e) => setLengthCm(e.target.value)}
                                placeholder="e.g., 55.2"
                            />
                        </div>

                        <div className="col-3">
                            <label>Weight (kg) (optional)</label>
                            <input
                                disabled={!competitionId}
                                type="number"
                                step="0.001"
                                value={weightKg}
                                onChange={(e) => setWeightKg(e.target.value)}
                                placeholder="e.g., 3.45"
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="col-3">
                            <label>Weight (kg) *</label>
                            <input
                                disabled={!competitionId}
                                type="number"
                                step="0.001"
                                value={weightKg}
                                onChange={(e) => setWeightKg(e.target.value)}
                                placeholder="e.g., 3.45"
                            />
                        </div>

                        <div className="col-3">
                            <label>Length (cm) (optional)</label>
                            <input
                                disabled={!competitionId}
                                type="number"
                                step="0.1"
                                value={lengthCm}
                                onChange={(e) => setLengthCm(e.target.value)}
                                placeholder="e.g., 55.2"
                            />
                        </div>
                    </>
                )}

                {/* SPECIES */}
                <div className="col-3">
                    <label>Species</label>
                    <select
                        disabled={!competitionId}
                        value={specId === "" ? "" : String(specId)}
                        onChange={(e) => {
                            const v = e.target.value;
                            setSpecId(v ? Number(v) : "");
                        }}
                    >
                        <option value="">Select species…</option>
                        {activeSpecies.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* TIME */}
                <div className={`col-3 ${settings?.showTime ? "" : "muted"}`}>
                    <label>
                        Time Caught {settings?.requireTime ? "*" : ""}
                    </label>
                    <input
                        disabled={!settings?.showTime || !competitionId}
                        type="time"
                        value={timeCaught}
                        onChange={(e) => setTimeCaught(e.target.value)}
                    />
                </div>

                {/* DATE */}
                <div className="col-3">
                    <label>Date Caught</label>
                    <input
                        disabled={!competitionId}
                        type="date"
                        value={dateCaught}
                        onChange={(e) => setDateCaught(e.target.value)}
                    />
                </div>

                {/* LOCAL ONLY FIELDS */}
                <div className="col-3">
                    <label>Location (local only)</label>
                    <input
                        disabled={!competitionId}
                        placeholder="e.g., Gulf Harbour"
                    />
                </div>

                <div className="col-12">
                    <label>Notes (local only)</label>
                    <textarea
                        disabled={!competitionId}
                        placeholder="Anything worth noting..."
                    />
                </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="actions">
                <label className="switch">
                    <input
                        disabled={!competitionId}
                        type="checkbox"
                        checked={keepAfter}
                        onChange={(e) => setKeepAfter(e.target.checked)}
                    />
                    Keep competitor after save
                </label>

                <button
                    className="btn primary"
                    disabled={!competitionId}
                    onClick={() => save(false)}
                >
                    Save Catch
                </button>

                <button
                    className="btn accent"
                    disabled={!competitionId}
                    onClick={() => save(true)}
                >
                    Save & Add Another
                </button>

                <button className="btn" onClick={() => location.reload()}>
                    Clear Form
                </button>
            </div>
        </section>
    );
}
