// ============================================================================
// File: BoatPointsPage.tsx
// Path: src/clubadmin/pages/BoatPointsPage.tsx
// Description:
//  - Boat points viewer (per competition / day)
//  - Uses DMY date formatting (dd-mm-yyyy) everywhere shown in UI
//  - Weight formatted to 2dp
//  - Expanded fish list sorted newest -> oldest + zebra rows
//  - Supports query params:
//      ?competitionId=...&dayId=...&from=prize-giving
// ============================================================================

import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { listCompetitions, listCompetitionDays } from "@/clubadmin/api/competitions";
import type { CompetitionDay } from "@/types";

import {
  listBoatPointsRows,
  buildBoatPoints,
  type BoatPointsBoatRow,
  type BoatPointsFishRow,
} from "../api/boatPoints";

// ============================================================================
// Helpers
// ============================================================================

// Expecting YYYY-MM-DD
function fmtDateDMY(date?: string | null) {
  if (!date) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return date; // fallback if not ISO
  const [, yyyy, mm, dd] = m;
  return `${dd}-${mm}-${yyyy}`;
}

function fmtWhen(date?: string | null, time?: string | null) {
  const d = date ? fmtDateDMY(date) : "—";
  const t = (time ?? "").slice(0, 5);
  const out = [d, t].filter(Boolean).join(" ");
  return out.trim() || "—";
}

function fmtWeightKg(w: number | null | undefined) {
  if (w == null || !Number.isFinite(Number(w))) return "—";
  return `${Number(w).toFixed(2)} kg`;
}

function fmtOutcome(o: string | null | undefined) {
  if (!o) return "—";
  if (o === "tagged_released") return "Tag & Release";
  if (o === "landed") return "Weighed";
  return o.replace(/_/g, " ");
}

function zebraStyle(idx: number) {
  return idx % 2 === 0 ? { background: "#ffffff" } : { background: "#f8fafc" };
}

// ============================================================================
// Component
// ============================================================================

export default function BoatPointsPage() {
  const { organisationId } = useParams<{ organisationId: string }>();

  // ✅ Hooks MUST be inside the component body
  const [searchParams] = useSearchParams();
  const qpCompetitionId = searchParams.get("competitionId");
  const qpDayId = searchParams.get("dayId");
  const from = searchParams.get("from");

  const [competitions, setCompetitions] = useState<any[]>([]);
  const [competitionId, setCompetitionId] = useState<string>("");
  const [competitionName, setCompetitionName] = useState<string>("");

  const [days, setDays] = useState<CompetitionDay[]>([]);
  const [dayId, setDayId] = useState<string | null>(null); // null = all days

  const [onlyOfficial, setOnlyOfficial] = useState(false);

  const [loading, setLoading] = useState(false);
  const [boats, setBoats] = useState<BoatPointsBoatRow[]>([]);
  const [expandedBoat, setExpandedBoat] = useState<string | null>(null);

  // =====================================================================
  // Load competitions
  // =====================================================================

  useEffect(() => {
    if (!organisationId) return;

    listCompetitions(organisationId).then((data) => {
      const list = data ?? [];
      setCompetitions(list);

      // only set default once (when competitionId is empty)
      if (!competitionId && list.length) {
        const fromQuery =
          qpCompetitionId && list.some((c: any) => c.id === qpCompetitionId)
            ? qpCompetitionId
            : null;

        const active = list.find((c: any) => c.status === "active");
        setCompetitionId(fromQuery ?? active?.id ?? list[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  // Keep competition name for detail rows
  useEffect(() => {
    const c = competitions.find((x: any) => x.id === competitionId);
    setCompetitionName(c?.name ?? "");
  }, [competitions, competitionId]);

  // =====================================================================
  // Load days for selected competition
  // =====================================================================

  useEffect(() => {
    if (!organisationId || !competitionId) return;

    listCompetitionDays(organisationId, competitionId).then((d) => {
      const sorted = [...(d ?? [])].sort((a: any, b: any) =>
        String(a.day_date ?? "").localeCompare(String(b.day_date ?? ""))
      );

      setDays(sorted);

      // Apply day query param if valid, else all days
      const validDay =
        qpDayId && sorted.some((x: any) => String(x.id) === String(qpDayId))
          ? String(qpDayId)
          : null;

      setDayId(validDay);
    });
  }, [organisationId, competitionId, qpDayId]);

  // =====================================================================
  // Load boat points rows and build boats
  // =====================================================================

  useEffect(() => {
    if (!competitionId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const rows = await listBoatPointsRows(competitionId, dayId);
        const built = buildBoatPoints(rows, { onlyOfficial });
        if (!cancelled) setBoats(built);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [competitionId, dayId, onlyOfficial]);

  // =====================================================================
  // Labels
  // =====================================================================

  const dayLabel = useMemo(() => {
    if (!dayId) return "All days";
    const d = days.find((x: any) => String(x.id) === String(dayId));
    return d?.day_date ? `Day (${fmtDateDMY(d.day_date)})` : "Day";
  }, [dayId, days]);

  // =====================================================================
  // Render
  // =====================================================================

  return (
    <section className="card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Boat Points</h2>

        {organisationId && from === "prize-giving" && competitionId && (
          <Link
            className="btn btn-secondary"
            to={`/clubadmin/${organisationId}/prize-giving?competitionId=${competitionId}`}
            title="Back to Prize Giving"
          >
            ← Prize Giving
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          <div className="muted">Competition</div>
          <select
            value={competitionId}
            onChange={(e) => {
              setCompetitionId(e.target.value);
              setExpandedBoat(null);
            }}
          >
            <option value="">-- Select Competition --</option>
            {competitions.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div className="muted">Day</div>
          <select
            value={dayId ?? ""}
            onChange={(e) => {
              setDayId(e.target.value ? e.target.value : null);
              setExpandedBoat(null);
            }}
            disabled={!days.length}
          >
            <option value="">All days</option>
            {days.map((d: CompetitionDay, idx: number) => (
              <option key={String(d.id)} value={String(d.id)}>
                Day {idx + 1} — {d.day_date ? fmtDateDMY(d.day_date) : "—"}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 18 }}>
          <input
            type="checkbox"
            checked={onlyOfficial}
            onChange={(e) => setOnlyOfficial(e.target.checked)}
          />
          Only official (used for result)
        </label>

        <div style={{ marginLeft: "auto", marginTop: 18 }} className="muted">
          Viewing: {dayLabel}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading && (
          <div className="muted" style={{ padding: 12 }}>
            Loading…
          </div>
        )}

        {!loading && boats.length === 0 && (
          <div className="muted" style={{ padding: 12 }}>
            No scoring boat points yet (or no boat-points rules apply).
          </div>
        )}

        {!loading && boats.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>Boat</th>
                  <th style={{ textAlign: "center", padding: 8 }}>Tag &amp; Release</th>
                  <th style={{ textAlign: "center", padding: 8 }}>Weighed</th>
                  <th style={{ textAlign: "center", padding: 8 }}>Total Fish</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Boat Points</th>
                </tr>
              </thead>

              <tbody>
                {boats.map((b: BoatPointsBoatRow) => {
                  const open = expandedBoat === b.boat;

                  const tagReleaseTotal = b.fish.filter(
                    (x: BoatPointsFishRow) => x.outcome === "tagged_released"
                  ).length;

                  const weighedTotal = b.fish.filter(
                    (x: BoatPointsFishRow) => x.outcome !== "tagged_released"
                  ).length;

                  return (
                    <Fragment key={b.boat}>
                      <tr
                        onClick={() => setExpandedBoat(open ? null : b.boat)}
                        style={{
                          cursor: "pointer",
                          borderTop: "1px solid #e5e7eb",
                        }}
                        title="Click to expand"
                      >
                        <td style={{ padding: 8, fontWeight: 700 }}>
                          {open ? "▾ " : "▸ "}
                          {b.boat}
                        </td>

                        <td style={{ padding: 8, textAlign: "center" }}>{tagReleaseTotal}</td>
                        <td style={{ padding: 8, textAlign: "center" }}>{weighedTotal}</td>
                        <td style={{ padding: 8, textAlign: "center" }}>{b.total_fish}</td>

                        <td style={{ padding: 8, textAlign: "right", fontWeight: 800 }}>
                          {b.boat_points.toFixed(2)}
                        </td>
                      </tr>

                      {open && (
                        <tr>
                          <td colSpan={5} style={{ padding: 10, background: "#f1f5f9" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "baseline",
                                justifyContent: "space-between",
                                gap: 12,
                                marginBottom: 8,
                              }}
                            >
                              <div style={{ fontWeight: 800 }}>Fish contributing to points</div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {competitionName || "Competition"} • {dayLabel}
                              </div>
                            </div>

                            <div style={{ overflowX: "auto" }}>
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  background: "#ffffff",
                                  borderRadius: 8,
                                }}
                              >
                                <thead>
                                  <tr style={{ background: "#f8fafc" }}>
                                    <th style={{ textAlign: "left", padding: 8 }}>Competition</th>
                                    <th style={{ textAlign: "left", padding: 8 }}>Angler</th>
                                    <th style={{ textAlign: "left", padding: 8 }}>Species</th>
                                    <th style={{ textAlign: "right", padding: 8 }}>Weight</th>
                                    <th style={{ textAlign: "left", padding: 8 }}>Outcome</th>
                                    <th style={{ textAlign: "left", padding: 8 }}>When</th>
                                    <th style={{ textAlign: "right", padding: 8 }}>Points</th>
                                  </tr>
                                </thead>

                                              <tbody>
                                                  {[...b.fish]
                                                      .sort((a: BoatPointsFishRow, c: BoatPointsFishRow) => {
                                                          const ta = a.priority_timestamp
                                                              ? new Date(a.priority_timestamp).getTime()
                                                              : 0;
                                                          const tc = c.priority_timestamp
                                                              ? new Date(c.priority_timestamp).getTime()
                                                              : 0;
                                                          return tc - ta;
                                                      })
                                                      .map((f: BoatPointsFishRow, idx: number) => {
                                                          const fullName = f.competitor_name ?? "Unknown";
                                                          const anglerNumber = f.angler_number ? `#${String(f.angler_number)}` : null;

                                                          return (
                                                              <tr
                                                                  key={`${b.boat}-${f.competitor_id}-${f.species_id}-${idx}`}
                                                                  style={{
                                                                      borderTop: "1px solid #e5e7eb",
                                                                      ...zebraStyle(idx),
                                                                  }}
                                                              >
                                                                  <td style={{ padding: 8 }}>{competitionName || "—"}</td>

                                                                  {/* ✅ Name on one line, number on another */}
                                                                  <td style={{ padding: 8 }}>
                                                                      <div style={{ fontWeight: 600, lineHeight: 1.15 }}>{fullName}</div>
                                                                      {anglerNumber && (
                                                                          <div
                                                                              className="muted"
                                                                              style={{ fontSize: 12, lineHeight: 1.15, marginTop: 2 }}
                                                                          >
                                                                              {anglerNumber}
                                                                          </div>
                                                                      )}
                                                                  </td>

                                                                  <td style={{ padding: 8 }}>{f.species_name ?? "—"}</td>
                                                                  <td style={{ padding: 8, textAlign: "right" }}>
                                                                      {fmtWeightKg(f.weight_kg)}
                                                                  </td>
                                                                  <td style={{ padding: 8 }}>{fmtOutcome(f.outcome)}</td>
                                                                  <td style={{ padding: 8 }}>
                                                                      {fmtWhen(f.date_caught, f.time_caught)}
                                                                  </td>
                                                                  <td style={{ padding: 8, textAlign: "right", fontWeight: 800 }}>
                                                                      {Number(f.fish_points ?? 0).toFixed(2)}
                                                                  </td>
                                                              </tr>
                                                          );
                                                      })}
                                              </tbody>

                              </table>
                            </div>

                            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                              Tip: this list is sorted newest → oldest.
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
        )}
      </div>
    </section>
  );
}
