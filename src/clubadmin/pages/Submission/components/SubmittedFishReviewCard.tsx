// ============================================================================
// SubmittedFishReviewCard.tsx
// Path: src/Submission/components/SubmittedFishReviewCard.tsx
// Description:
//  - Lists submitted catch rows for a competition
//  - Defaults to ALL days (no day filter)
//  - Day filter dropdown (All / Day 1 / Day 2 / ...)
//  - ✅ Date formatting unified across: Submitted / Day filter / Date-Time column
//  - ✅ Expanded 2-row layout for editing to fix horizontal overflow
//  - ✅ Layout updated to use standard card wrapper for consistent width
// ============================================================================

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import {
    listSubmittedFish,
    updateSubmittedFish,
    listSpecies,
    type SubmittedFishRow,
} from "@/services/api";

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const DASH = "—";

function stripReplacementGlyph(s: string) {
    return s.replace(/\uFFFD/g, "").trim(); // Unicode replacement char
}

function show(v: any, fallback: string = DASH): string {
    if (v === null || v === undefined) return fallback;
    const s = stripReplacementGlyph(String(v));
    if (!s) return fallback;
    if (s === "") return fallback;
    return s;
}

function toNumber(v: any): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function formatWeightKg(v: any): string {
    const n = toNumber(v);
    if (n === null) return DASH;
    return n.toFixed(3);
}

function formatLengthCm(v: any): string {
    const n = toNumber(v);
    if (n === null) return DASH;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatOutcome(v: any): string {
    const o = show(v, "");
    if (!o) return DASH;

    if (o === "landed") return "Landed";
    if (o === "tagged_released") return "Tagged/Released";

    if (o.toLowerCase() === "tagged/released") return "Tagged/Released";
    if (o.toLowerCase() === "landed") return "Landed";

    return o;
}

function parsePgTimestamp(ts: string | null | undefined): Date | null {
    const raw = show(ts, "");
    if (!raw) return null;

    // "2026-02-05 02:13:10.097171+00" -> "2026-02-05T02:13:10.097171+00"
    const isoish = raw.includes("T") ? raw : raw.replace(" ", "T");
    const d = new Date(isoish);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatDmyFromDate(d: Date): string {
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day}/${month}/${year}`; // no leading zeros (matches your screenshots)
}

function ymdToDmy(ymd: string): string {
    // ymd = "YYYY-MM-DD"
    const yyyy = ymd.slice(0, 4);
    const mm = ymd.slice(5, 7);
    const dd = ymd.slice(8, 10);
    if (!yyyy || !mm || !dd) return ymd;
    return `${Number(dd)}/${Number(mm)}/${yyyy}`;
}


// YYYY-MM-DD -> locale date (stable parse)
function formatDateLikeSubmitted(dateStr: string | null | undefined): string {
    const raw = show(dateStr, "");
    if (!raw) return DASH;

    // If it's YYYY-MM-DD, don't use locale — keep it stable.
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return ymdToDmy(raw);
    }

    // Otherwise try parse
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : formatDmyFromDate(d);
}


function formatSubmitted(createdAt: string | null | undefined) {
    const d = parsePgTimestamp(createdAt);
    if (!d) return { date: DASH, time: "" };

    // date only (no time)
    const date = formatDmyFromDate(d);
    return { date, time: "" };
}

function formatCaughtTime(t: string | null | undefined) {
    const s = show(t, "");
    if (!s) return "";
    return s.length >= 5 ? s.slice(0, 5) : s; // "00:00:00" -> "00:00"
}

function caughtSortKey(r: SubmittedFishRow) {
    const d = show(r.date_caught, "");
    const t = show(r.time_caught, "");
    if (d) {
        const time = t ? (t.length >= 8 ? t.slice(0, 8) : t) : "00:00:00";
        const dt = new Date(`${d}T${time}`);
        if (!Number.isNaN(dt.getTime())) return dt.getTime();
    }

    const created = parsePgTimestamp(r.created_at);
    return created ? created.getTime() : 0;
}

// ---------------------------------------------------------------------------
// Day filtering + labels
// ---------------------------------------------------------------------------

type DayOption = {
    id: string; // competition_day_id or special "__NO_DAY__"
    label: string;
    sortDate: string; // raw YYYY-MM-DD for ordering
};

const ALL_DAYS = "__ALL_DAYS__";
const NO_DAY = "__NO_DAY__";

// ---------------------------------------------------------------------------
// Editing model
// ---------------------------------------------------------------------------

type EditDraft = {
    competition_day_id: string; // NO_DAY or actual uuid
    species_id: string; // "" means null
    outcome: "" | "landed" | "tagged_released";
    weight_kg: string; // keep as text while editing
    length_cm: string;
    date_caught: string; // YYYY-MM-DD
    time_caught: string; // HH:MM
};

function buildDraftFromRow(r: SubmittedFishRow): EditDraft {
    return {
        competition_day_id: show(r.competition_day_id, "") || NO_DAY,
        species_id: show(r.species_id, "") || "",
        outcome: (show(r.outcome, "") as any) || "",
        weight_kg:
            r.weight_kg === null || r.weight_kg === undefined ? "" : String(r.weight_kg),
        length_cm:
            r.length_cm === null || r.length_cm === undefined ? "" : String(r.length_cm),
        date_caught: show(r.date_caught, "") || "",
        time_caught: formatCaughtTime(r.time_caught) || "",
    };
}

function draftToPatch(
    original: SubmittedFishRow,
    draft: EditDraft
): Partial<SubmittedFishRow> {
    const patch: Partial<SubmittedFishRow> = {};

    // day
    {
        const origDay = show(original.competition_day_id, "") || NO_DAY;
        if (draft.competition_day_id !== origDay) {
            patch.competition_day_id =
                draft.competition_day_id === NO_DAY ? null : draft.competition_day_id;
        }
    }

    // species
    {
        const origSpecies = show(original.species_id, "");
        const nextSpecies = draft.species_id || "";
        if ((origSpecies || "") !== nextSpecies) {
            patch.species_id = nextSpecies ? nextSpecies : null;
        }
    }

    // outcome
    {
        const origOutcome = show(original.outcome, "");
        const nextOutcome = draft.outcome || "";
        if ((origOutcome || "") !== nextOutcome) {
            patch.outcome = nextOutcome ? (nextOutcome as any) : null;
        }
    }

    // weight
    {
        const orig =
            original.weight_kg === null || original.weight_kg === undefined
                ? ""
                : String(original.weight_kg);
        const next = draft.weight_kg.trim();
        if (orig !== next) {
            patch.weight_kg = next === "" ? null : (toNumber(next) as any);
        }
    }

    // length
    {
        const orig =
            original.length_cm === null || original.length_cm === undefined
                ? ""
                : String(original.length_cm);
        const next = draft.length_cm.trim();
        if (orig !== next) {
            patch.length_cm = next === "" ? null : (toNumber(next) as any);
        }
    }

    // date
    {
        const orig = show(original.date_caught, "");
        const next = draft.date_caught.trim();
        if ((orig || "") !== (next || "")) {
            patch.date_caught = next === "" ? null : next;
        }
    }

    // time (store HH:MM:SS on API side)
    {
        const orig = formatCaughtTime(original.time_caught);
        const next = draft.time_caught.trim();
        if ((orig || "") !== (next || "")) {
            patch.time_caught = next === "" ? null : next; // api.cleanTime normalizes
        }
    }

    return patch;
}

// ---------------------------------------------------------------------------

export default function SubmittedFishReviewCard(props: {
    competitionId: string | null;
    visible?: boolean;
}) {
    const { competitionId, visible = true } = props;

    // ✅ If parent hides the card, render nothing (fixes "visible" prop usage)
    if (!visible) return null;

    const [rows, setRows] = useState<SubmittedFishRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [speciesOptions, setSpeciesOptions] = useState<
        { id: number; name: string }[]
    >([]);
    const [speciesLoading, setSpeciesLoading] = useState(false);

    const [dayFilter, setDayFilter] = useState<string>(ALL_DAYS);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, EditDraft>>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [rowError, setRowError] = useState<Record<string, string | null>>({});

    const load = useCallback(async () => {
        // ✅ competitionId can now be null
        if (!competitionId) return;

        setLoading(true);
        setError(null);

        try {
            const data = await listSubmittedFish(competitionId);
            setRows(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setRows([]);
            setError(show(e?.message, "Failed to load submissions"));
        } finally {
            setLoading(false);
        }
    }, [competitionId]);

    useEffect(() => {
        // ✅ don’t try load when there is no competition selected
        if (!competitionId) {
            setRows([]);
            setLoading(false);
            setError(null);
            return;
        }
        load();
    }, [competitionId, load]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            setSpeciesLoading(true);
            try {
                const all = await listSpecies();
                if (!mounted) return;
                setSpeciesOptions(
                    (all ?? []).map((s: any) => ({
                        id: Number(s.id),
                        name: String(s.name),
                    }))
                );
            } catch {
                // species is nice-to-have for editing; don't block page
            } finally {
                if (mounted) setSpeciesLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const rowMap = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);


    // Day options from existing rows
    const dayOptions: DayOption[] = useMemo(() => {
        const map = new Map<string, { minDate: string }>();

        for (const r of rows) {
            const rawId = show(r.competition_day_id, "");
            const id = rawId ? rawId : NO_DAY;

            const d = show(r.date_caught, "");
            const existing = map.get(id);

            if (!existing) {
                map.set(id, { minDate: d || "" });
            } else if (d && (!existing.minDate || d < existing.minDate)) {
                existing.minDate = d;
            }
        }

        const sorted = [...map.entries()].sort((a, b) => {
            const da = a[1].minDate || "9999-12-31";
            const db = b[1].minDate || "9999-12-31";
            return da.localeCompare(db);
        });

        return sorted.map(([id, meta], idx) => {
            const raw = meta.minDate || "";
            const pretty = raw ? formatDateLikeSubmitted(raw) : "";
            const suffix = pretty ? ` (${pretty})` : "";
            const label = id === NO_DAY ? `No day${suffix}` : `Day ${idx + 1}${suffix}`;
            return { id, label, sortDate: raw };
        });
    }, [rows]);

    useEffect(() => {
        if (dayFilter === ALL_DAYS) return;

        const exists =
            dayFilter === NO_DAY
                ? dayOptions.some((d) => d.id === NO_DAY)
                : dayOptions.some((d) => d.id === dayFilter);

        if (!exists) setDayFilter(ALL_DAYS);
    }, [dayFilter, dayOptions]);

    const filteredRows = useMemo(() => {
        const base = [...rows].sort((a, b) => caughtSortKey(b) - caughtSortKey(a));
        if (dayFilter === ALL_DAYS) return base;

        return base.filter((r) => {
            const rawId = show(r.competition_day_id, "");
            const id = rawId ? rawId : NO_DAY;
            return id === dayFilter;
        });
    }, [rows, dayFilter]);

    const filterLabel = useMemo(() => {
        if (dayFilter === ALL_DAYS) return "All days";
        const opt = dayOptions.find((d) => d.id === dayFilter);
        return opt?.label ?? "All days";
    }, [dayFilter, dayOptions]);

    const countLabel = useMemo(() => {
        const n = filteredRows.length;
        return `${n} submission${n === 1 ? "" : "s"}`;
    }, [filteredRows.length]);

    const startEdit = useCallback(
        (id: string) => {
            const row = rowMap.get(id);
            if (!row) return;

            setRowError((p) => ({ ...p, [id]: null }));
            setDrafts((p) => ({ ...p, [id]: buildDraftFromRow(row) }));
            setEditingId(id);
        },
        [rowMap]
    );

    const cancelEdit = useCallback((id: string) => {
        setRowError((p) => ({ ...p, [id]: null }));
        setDrafts((p) => {
            const next = { ...p };
            delete next[id];
            return next;
        });
        setEditingId((cur) => (cur === id ? null : cur));
    }, []);

    const setDraftField = useCallback(
        (id: string, field: keyof EditDraft, value: string) => {
            setDrafts((p) => ({
                ...p,
                [id]: { ...(p[id] ?? ({} as EditDraft)), [field]: value },
            }));
        },
        []
    );

    const saveEdit = useCallback(
        async (id: string) => {
            const original = rowMap.get(id);
            const draft = drafts[id];
            if (!original || !draft) return;

            const w = draft.weight_kg.trim();
            if (w && toNumber(w) === null) {
                setRowError((p) => ({ ...p, [id]: "Weight must be a number." }));
                return;
            }
            const l = draft.length_cm.trim();
            if (l && toNumber(l) === null) {
                setRowError((p) => ({ ...p, [id]: "Length must be a number." }));
                return;
            }

            const patch = draftToPatch(original, draft);
            if (Object.keys(patch).length === 0) {
                cancelEdit(id);
                return;
            }

            setSavingId(id);
            setRowError((p) => ({ ...p, [id]: null }));

            try {
                await updateSubmittedFish(id, patch);
                cancelEdit(id);
                await load();
            } catch (e: any) {
                setRowError((p) => ({ ...p, [id]: show(e?.message, "Failed to save changes") }));
            } finally {
                setSavingId((cur) => (cur === id ? null : cur));
            }
        },
        [cancelEdit, drafts, load, rowMap]
    );

    // ------------------------------------------------------------
    // Render Styles (Editor) — COMPACT (no horiz scroll @ ~900px)
    // ------------------------------------------------------------
    const labelStyle = {
        display: "block",
        fontSize: 11,
        fontWeight: 700,
        color: "rgba(0,0,0,0.5)",
        marginBottom: 4,
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
    };

    const inputStyle = {
        width: "100%",
        minWidth: 0,
        height: 36,
        borderRadius: 8,
        padding: "6px 8px",
        border: "1px solid rgba(0,0,0,0.2)",
        background: "white",
        fontSize: 13,
        fontWeight: 500,
        outline: "none",
        boxSizing: "border-box" as const,
    };

    const headerSelectStyle = {
        height: 34,
        borderRadius: 10,
        padding: "6px 10px",
        border: "1px solid rgba(0,0,0,0.15)",
        background: "white",
        fontWeight: 600,
        minWidth: 160,
        maxWidth: 220,
    };

    const headerBtnStyle = {
        height: 34,
        borderRadius: 10,
        padding: "0 12px",
        border: "1px solid rgba(0,0,0,0.15)",
        background: "rgba(0,0,0,0.02)",
        cursor: "pointer",
        fontWeight: 600,
        whiteSpace: "nowrap" as const,
    };

    const editBtnStyle = {
        height: 30,
        borderRadius: 10,
        padding: "0 10px",
        border: "1px solid rgba(0,0,0,0.15)",
        background: "white",
        cursor: "pointer",
        fontWeight: 800,
        whiteSpace: "nowrap" as const,
    };

    return (
        <section
            className="card"
            style={{
                marginTop: 16,
                width: "100%",
                alignSelf: "stretch",
                padding: 14, // ✅ remove “heaps of padding”
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap", // ✅ prevents header overflow
                    marginBottom: 10,
                }}
            >
                <div style={{ minWidth: 220 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>
                        Submitted Fish
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", marginTop: 4 }}>
                        {loading ? "Loading…" : `${countLabel} • ${filterLabel}`}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                        value={dayFilter}
                        onChange={(e) => setDayFilter(e.target.value)}
                        style={headerSelectStyle}
                        title="Filter by competition day"
                    >
                        <option value={ALL_DAYS}>All days</option>
                        {dayOptions.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.label}
                            </option>
                        ))}
                    </select>

                    <button type="button" onClick={load} style={headerBtnStyle}>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div
                    style={{
                        marginBottom: 10,
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: "rgba(255,0,0,0.06)",
                        border: "1px solid rgba(255,0,0,0.18)",
                        color: "rgba(120,0,0,0.9)",
                        fontSize: 13,
                    }}
                >
                    {error}
                </div>
            )}

            {/* Table — remove forced minWidth so the Edit column stays on-screen */}
            <div style={{ overflowX: "hidden" }}>
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        tableLayout: "fixed",
                    }}
                >
                    {/* ✅ Column widths that actually fit inside ~900px */}
                    <colgroup>
                        <col style={{ width: "10%" }} />  {/* Submitted */}
                        <col style={{ width: "22%" }} />  {/* Angler / Boat */}
                        <col style={{ width: "16%" }} />  {/* Species */}
                        <col style={{ width: "12%" }} />  {/* Outcome */}
                        <col style={{ width: "9%" }} />   {/* Weight */}
                        <col style={{ width: "8%" }} />   {/* Length */}
                        <col style={{ width: "13%" }} />  {/* Date / Time */}
                        <col style={{ width: "10%" }} />  {/* Actions */}
                    </colgroup>

                    <thead>
                        <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            {["Submitted", "Angler / Boat", "Species", "Outcome", "Weight", "Length", "Date / Time", ""].map(
                                (name) => (
                                    <th
                                        key={name}
                                        style={{
                                            textAlign: "left",
                                            padding: "6px 6px", // ✅ tighter
                                            fontSize: 12,
                                            fontWeight: 800,
                                            color: "rgba(0,0,0,0.75)",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {name}
                                    </th>
                                )
                            )}
                        </tr>
                    </thead>

                    <tbody>
                        {!loading && filteredRows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    style={{
                                        padding: 12,
                                        color: "rgba(0,0,0,0.6)",
                                        fontSize: 13,
                                    }}
                                >
                                    No submissions found for this filter yet.
                                </td>
                            </tr>
                        )}

                        {filteredRows.map((r) => {
                            const submitted = formatSubmitted(r.created_at);

                            const isEditing = editingId === r.id;
                            const draft = drafts[r.id] ?? buildDraftFromRow(r);

                            const anglerNo = show(r.angler_number, "");
                            const anglerLine = anglerNo ? `#${anglerNo}` : DASH;

                            const caughtDatePretty = formatDateLikeSubmitted(r.date_caught);
                            const caughtTime = formatCaughtTime(r.time_caught);
                            const caughtLine2 = caughtTime ? caughtTime : "00:00";

                            const errMsg = rowError[r.id];

                            const cellStyle = {
                                verticalAlign: "top" as const,
                                padding: "8px 6px", // ✅ tighter (fixes “heaps of padding”)
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap" as const,
                            };

                            return (
                                <Fragment key={r.id}>
                                    {/* --- VIEW ROW --- */}
                                    <tr
                                        style={{
                                            borderBottom: isEditing
                                                ? "none"
                                                : "1px solid rgba(0,0,0,0.06)",
                                            background: isEditing ? "rgba(0,0,0,0.025)" : "transparent",
                                        }}
                                    >
                                        {/* Submitted */}
                                        <td style={cellStyle}>
                                            <div style={{ fontSize: 13 }}>{show(submitted.date, DASH)}</div>
                                        </td>

                                        {/* Angler / Boat */}
                                        <td style={cellStyle}>
                                            <div style={{ fontSize: 13, fontWeight: 800 }}>
                                                {show(anglerLine, DASH)}
                                            </div>
                                            <div style={{ fontSize: 13 }}>{show(r.competitor_name, DASH)}</div>
                                            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
                                                {show(r.boat_name, "")}
                                            </div>
                                        </td>

                                        {/* Species */}
                                        <td style={cellStyle}>
                                            <div style={{ fontSize: 13 }}>{show(r.species_name, DASH)}</div>
                                        </td>

                                        {/* Outcome */}
                                        <td style={cellStyle}>
                                            <div style={{ fontSize: 13 }}>{formatOutcome(r.outcome)}</div>
                                        </td>

                                        {/* Weight */}
                                        <td style={cellStyle}>
                                            <div style={{ fontSize: 13 }}>{formatWeightKg(r.weight_kg)}</div>
                                        </td>

                                        {/* Length */}
                                        <td style={cellStyle}>
                                            <div style={{ fontSize: 13 }}>{formatLengthCm(r.length_cm)}</div>
                                        </td>

                                        {/* Date / Time */}
                                        <td style={cellStyle}>
                                            <div style={{ fontSize: 13 }}>{caughtDatePretty}</div>
                                            <div style={{ fontSize: 13 }}>{caughtLine2}</div>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ ...cellStyle, textAlign: "right" as const }}>
                                            {!isEditing && (
                                                <button type="button" onClick={() => startEdit(r.id)} style={editBtnStyle}>
                                                    Edit
                                                </button>
                                            )}
                                            {isEditing && (
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 800,
                                                        color: "rgba(0,0,0,0.4)",
                                                    }}
                                                >
                                                    Editing…
                                                </div>
                                            )}
                                        </td>
                                    </tr>

                                    {/* --- EXPANDED EDITOR ROW --- */}
                                    {isEditing && (
                                        <tr key={`${r.id}-edit`} style={{ background: "rgba(0,0,0,0.025)" }}>
                                            <td
                                                colSpan={8}
                                                style={{
                                                    padding: "0 8px 12px 8px", // ✅ tighter
                                                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        background: "white",
                                                        border: "1px solid rgba(0,0,0,0.12)",
                                                        borderRadius: 12,
                                                        padding: 12, // ✅ tighter
                                                        display: "grid",
                                                        gridTemplateColumns: "repeat(12, minmax(0, 1fr))", // ✅ allow shrink
                                                        gap: 12, // ✅ tighter
                                                        alignItems: "end",
                                                        overflow: "hidden", // ✅ prevent tiny overflow
                                                    }}
                                                >
                                                    {/* ROW 1: Day (3), Species (5), Outcome (4) */}
                                                    <div style={{ gridColumn: "span 3", minWidth: 0 }}>
                                                        <label style={labelStyle}>Day</label>
                                                        <select
                                                            value={draft.competition_day_id}
                                                            onChange={(e) =>
                                                                setDraftField(r.id, "competition_day_id", e.target.value)
                                                            }
                                                            style={inputStyle}
                                                            title="Day"
                                                        >
                                                            <option value={NO_DAY}>No day</option>
                                                            {dayOptions
                                                                .filter((d) => d.id !== NO_DAY)
                                                                .map((d) => (
                                                                    <option key={d.id} value={d.id}>
                                                                        {d.label}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>

                                                    <div style={{ gridColumn: "span 5", minWidth: 0 }}>
                                                        <label style={labelStyle}>
                                                            Species {speciesLoading && "(Loading…)"}
                                                        </label>
                                                        <select
                                                            value={draft.species_id}
                                                            onChange={(e) =>
                                                                setDraftField(r.id, "species_id", e.target.value)
                                                            }
                                                            style={inputStyle}
                                                            title="Species"
                                                        >
                                                            <option value="">(None)</option>
                                                            {speciesOptions.map((s) => (
                                                                <option key={s.id} value={String(s.id)}>
                                                                    {s.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div style={{ gridColumn: "span 4", minWidth: 0 }}>
                                                        <label style={labelStyle}>Outcome</label>
                                                        <select
                                                            value={draft.outcome}
                                                            onChange={(e) => setDraftField(r.id, "outcome", e.target.value)}
                                                            style={inputStyle}
                                                            title="Outcome"
                                                        >
                                                            <option value="">(None)</option>
                                                            <option value="landed">Landed</option>
                                                            <option value="tagged_released">Tagged/Released</option>
                                                        </select>
                                                    </div>

                                                    {/* ROW 2: Weight (2), Length (2), Date (4), Time (4) */}
                                                    <div style={{ gridColumn: "span 2", minWidth: 0 }}>
                                                        <label style={labelStyle}>Weight (kg)</label>
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            value={draft.weight_kg}
                                                            onChange={(e) => setDraftField(r.id, "weight_kg", e.target.value)}
                                                            style={inputStyle}
                                                            placeholder="0.000"
                                                        />
                                                    </div>

                                                    <div style={{ gridColumn: "span 2", minWidth: 0 }}>
                                                        <label style={labelStyle}>Length (cm)</label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={draft.length_cm}
                                                            onChange={(e) => setDraftField(r.id, "length_cm", e.target.value)}
                                                            style={inputStyle}
                                                            placeholder="0.0"
                                                        />
                                                    </div>

                                                    <div style={{ gridColumn: "span 4", minWidth: 0 }}>
                                                        <label style={labelStyle}>Date Caught</label>
                                                        <input
                                                            type="date"
                                                            value={draft.date_caught}
                                                            onChange={(e) => setDraftField(r.id, "date_caught", e.target.value)}
                                                            style={inputStyle}
                                                        />
                                                    </div>

                                                    <div style={{ gridColumn: "span 4", minWidth: 0 }}>
                                                        <label style={labelStyle}>Time Caught</label>
                                                        <input
                                                            type="time"
                                                            value={draft.time_caught}
                                                            onChange={(e) => setDraftField(r.id, "time_caught", e.target.value)}
                                                            style={inputStyle}
                                                        />
                                                    </div>

                                                    {/* ROW 3: Footer Actions */}
                                                    <div
                                                        style={{
                                                            gridColumn: "1 / -1",
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                            flexWrap: "wrap", // ✅ prevents overflow
                                                            gap: 10,
                                                            borderTop: "1px solid rgba(0,0,0,0.06)",
                                                            paddingTop: 10,
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                                                            {errMsg && (
                                                                <div
                                                                    style={{
                                                                        fontSize: 13,
                                                                        color: "rgba(180,0,0,0.9)",
                                                                        background: "rgba(255,0,0,0.04)",
                                                                        border: "1px solid rgba(255,0,0,0.1)",
                                                                        padding: "6px 10px",
                                                                        borderRadius: 8,
                                                                        display: "inline-block",
                                                                    }}
                                                                >
                                                                    ⚠️ {errMsg}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => cancelEdit(r.id)}
                                                                disabled={savingId === r.id}
                                                                style={{
                                                                    height: 34,
                                                                    borderRadius: 8,
                                                                    padding: "0 14px",
                                                                    border: "1px solid rgba(0,0,0,0.15)",
                                                                    background: "white",
                                                                    color: "rgba(0,0,0,0.7)",
                                                                    cursor: savingId === r.id ? "default" : "pointer",
                                                                    fontWeight: 800,
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                Cancel
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => saveEdit(r.id)}
                                                                disabled={savingId === r.id}
                                                                style={{
                                                                    height: 34,
                                                                    borderRadius: 8,
                                                                    padding: "0 16px",
                                                                    border: "none",
                                                                    background: "#222",
                                                                    color: "white",
                                                                    cursor: savingId === r.id ? "default" : "pointer",
                                                                    fontWeight: 900,
                                                                    opacity: savingId === r.id ? 0.7 : 1,
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                {savingId === r.id ? "Saving…" : "Save Changes"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                Tip: hit <b>Edit</b> to correct species/outcome/weight/length/date/time, then{" "}
                <b>Save</b>.
            </div>
        </section>
    );
}