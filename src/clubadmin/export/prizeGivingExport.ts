// ============================================================================
// prizeGivingExport.ts
// Path: src/clubadmin/export/prizeGivingExport.ts
//
// DROP-IN (no JSX; safe in .ts)
//
// Behaviour (NO forced day page breaks):
//  ✅ Sections flow naturally (Day 2 can start immediately after Day 1 if it fits)
//  ✅ Each prize BLOCK/CARD only starts if it can fit fully on the current page
//     (wrap={false} + minPresenceAhead). If it won’t fit, it moves to next page.
//  ✅ Section title is kept with the first card (so “Day X” doesn’t orphan)
//  ✅ No `break` prop anywhere (avoids the “90% blank page” double-break bug)
// ============================================================================

import * as React from "react";
import type { CompetitionDay } from "@/types";
import {
    previewPrizeEngine,
    type PrizeEnginePreviewRow,
} from "@/clubadmin/api/prizeEngine";
import type { PrizeDefinitionRow } from "@/clubadmin/api/competitionPrizes";

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
} from "@react-pdf/renderer";

// ============================================================================
// MODEL TYPES
// ============================================================================

export type PrizeGivingPdfModel = {
    competitionName: string;
    generatedAt: string; // display string
    sections: PdfSection[];
};

export type PdfSection = {
    title: string; // Briefing / Day 1 / Day 2 / Prize Giving
    prizes: PdfPrizeBlock[];
};

export type PdfRenderHints = {
    keepTogether?: boolean;
    minPresenceAhead?: number;
    startsSection?: boolean;
    sectionTitle?: string;
};

export type PdfPrizeBlock = {
    title: string; // e.g. "Tuna · Heaviest (kg)" (section prefix stripped)
    rule: string | null;
    rows: PdfPrizeRow[];
    renderHints?: PdfRenderHints;
};

export type PdfPrizeRow = {
    placeLabel: string; // "1st", "2nd", "3rd"
    left: string; // "Kahawai — 2.36 kg" OR "No Result"
    winner: string; // "#7 John Smith" OR "Draw a Spot Prize: …"
};

// ============================================================================
// BUILDER HELPERS
// ============================================================================

function ordinalSuffix(n: number) {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    const mod10 = n % 10;
    if (mod10 === 1) return "st";
    if (mod10 === 2) return "nd";
    if (mod10 === 3) return "rd";
    return "th";
}

/**
 * Handles " · 1st", " - 1st", or trailing " 1st"
 */
function stripOrdinal(displayName: string): string {
    return displayName
        .replace(/\s*·\s*\d+(st|nd|rd|th)\b/i, "")
        .replace(/\s*-\s*\d+(st|nd|rd|th)\b/i, "")
        .replace(/\s+\d+(st|nd|rd|th)\b/i, "")
        .trim();
}

function getAwardedCount(prize: PrizeDefinitionRow): number {
    const match = prize.display_name.match(/\b(\d+)(st|nd|rd|th)\b/i);
    if (!match) return 1;
    const n = parseInt(match[1], 10);
    return Number.isNaN(n) || n < 1 ? 1 : n;
}

function isTaggedReleasedPrize(p: PrizeDefinitionRow): boolean {
    return /tagged\s*&\s*released/i.test(p.display_name);
}

function isHeaviestKgPrize(p: PrizeDefinitionRow): boolean {
    return /heaviest\s*\(kg\)/i.test(p.display_name);
}

function filterEngineRowsForPrize(
    prize: PrizeDefinitionRow,
    rows: PrizeEnginePreviewRow[]
): PrizeEnginePreviewRow[] {
    return rows.filter((r) => {
        const outcome = (r as any).outcome as string | null | undefined;
        const weightKg = (r as any).weight_kg as number | string | null | undefined;

        if (isTaggedReleasedPrize(prize)) return outcome === "tagged_released";
        if (isHeaviestKgPrize(prize)) return outcome !== "tagged_released" && weightKg != null;
        return true;
    });
}

/**
 * Tagged & released becomes explicit metric text (no "— —")
 */
function buildStageBits(r: PrizeEnginePreviewRow) {
    const species = r.species_name ?? "—";

    const anyRow = r as unknown as {
        outcome?: string | null;
        angler_number?: string | number | null;
    };

    const outcome = anyRow.outcome ?? null;

    const wRaw = r.weight_kg != null ? Number(r.weight_kg) : null;
    const hasWeight = wRaw != null && Number.isFinite(wRaw);

    const metric =
        outcome === "tagged_released"
            ? "Tagged & released"
            : hasWeight
                ? `${wRaw!.toFixed(2)} kg`
                : r.length_cm != null
                    ? `${r.length_cm} cm`
                    : "—";

    const anglerNo =
        anyRow.angler_number != null && String(anyRow.angler_number).trim().length > 0
            ? `#${String(anyRow.angler_number).trim()} `
            : "";

    const who = r.competitor_name ?? "Unknown";

    return {
        left: `${species} — ${metric}`,
        winner: `${anglerNo}${who}`.trim(),
    };
}

/**
 * Rough “points-ish” height estimate used by renderer to avoid starting a card
 * unless it can fit fully on the current page.
 */
function estimateMinPresenceAhead(rule: string | null, rowCount: number) {
    const header = 34;
    const ruleLine = rule ? 16 * Math.min(3, Math.ceil(rule.length / 70)) : 0;
    const tableHeader = 18;
    const perRow = 18;
    const padding = 18;
    return header + ruleLine + tableHeader + perRow * rowCount + padding;
}

function groupDeterministicPrizes(prizes: PrizeDefinitionRow[]) {
    const groups: Record<string, PrizeDefinitionRow[]> = {};

    for (const prize of prizes) {
        const key = stripOrdinal(prize.display_name);
        groups[key] ??= [];
        groups[key].push(prize);
    }

    return Object.entries(groups)
        .map(([key, group]) => {
            const authoritative = [...group].sort(
                (a, b) => getAwardedCount(b) - getAwardedCount(a)
            )[0];

            const minSort = group.reduce(
                (min, p) => Math.min(min, p.sort_order ?? 0),
                Number.POSITIVE_INFINITY
            );

            const isTagged = group.some(isTaggedReleasedPrize);

            return {
                key,
                prize: authoritative,
                awardedCount: getAwardedCount(authoritative),
                sortOrder: Number.isFinite(minSort)
                    ? minSort
                    : authoritative.sort_order ?? 0,
                isTagged,
            };
        })
        .sort((a, b) => {
            if (a.isTagged !== b.isTagged) return a.isTagged ? 1 : -1;
            return a.sortOrder - b.sortOrder;
        });
}

type SectionDef = {
    key: string;
    title: string;
    scope: "briefing" | "day";
    dayId: string | null;
    isFinal: boolean;
};

function buildSections(
    prizeDefs: PrizeDefinitionRow[],
    competitionDays: CompetitionDay[]
): SectionDef[] {
    const briefingExists = prizeDefs.some((p) => p.scope_kind === "briefing");
    const dayDefs = prizeDefs.filter((p) => p.scope_kind === "day");
    const competitionDefs = prizeDefs.filter((p) => p.scope_kind === "competition");

    const uniqueDayIds = Array.from(
        new Set(
            dayDefs
                .map((p) => p.competition_day_id)
                .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
    );

    const daysSorted = [...competitionDays]
        .filter((d): d is CompetitionDay & { id: string } => typeof d?.id === "string")
        .filter((d) => uniqueDayIds.includes(d.id))
        .sort((a, b) => String(a.day_date ?? "").localeCompare(String(b.day_date ?? "")));

    const sections: SectionDef[] = [];

    if (briefingExists) {
        sections.push({
            key: "briefing",
            title: "Briefing",
            scope: "briefing",
            dayId: null,
            isFinal: false,
        });
    }

    if (daysSorted.length) {
        daysSorted.forEach((d, idx) => {
            sections.push({
                key: `day-${d.id}`,
                title: `Day ${idx + 1}`,
                scope: "day",
                dayId: d.id,
                isFinal: false,
            });
        });
    } else {
        uniqueDayIds.forEach((dayId, idx) => {
            sections.push({
                key: `day-${dayId}`,
                title: `Day ${idx + 1}`,
                scope: "day",
                dayId,
                isFinal: false,
            });
        });
    }

    if (competitionDefs.length > 0) {
        sections.push({
            key: "final",
            title: "Prize Giving",
            scope: "day",
            dayId: null,
            isFinal: true,
        });
    }

    return sections;
}

function prizeAppliesToSection(prize: PrizeDefinitionRow, section: SectionDef) {
    if (section.scope === "briefing") return prize.scope_kind === "briefing";

    if (section.scope === "day") {
        if (prize.scope_kind === "day") return prize.competition_day_id === section.dayId;
        if (prize.scope_kind === "competition") return section.isFinal;
    }

    return false;
}

function stripSectionPrefix(title: string, sectionTitle: string) {
    const prefix = `${sectionTitle} · `;
    if (title.startsWith(prefix)) return title.slice(prefix.length).trim();

    const compPrefix = "Competition · ";
    if (title.startsWith(compPrefix)) return title.slice(compPrefix.length).trim();

    return title.trim();
}

// ============================================================================
// BUILDER (exported)
// ============================================================================

export async function buildPrizeGivingPdfModel(args: {
    competitionId: string;
    competitionName: string;
    prizeDefs: PrizeDefinitionRow[];
    competitionDays: CompetitionDay[];
    fallbackSpotPrizeNameBySection?: Record<string, string | null>;
}): Promise<PrizeGivingPdfModel> {
    const { competitionId, competitionName, prizeDefs, competitionDays } = args;

    const sections = buildSections(prizeDefs, competitionDays);

    const deterministic = prizeDefs.filter((p) => p.active && p.prize_type !== "spot");
    const engineRowsByPrizeId: Record<string, PrizeEnginePreviewRow[]> = {};

    await Promise.all(
        deterministic.map(async (p) => {
            const raw = await previewPrizeEngine(competitionId, p.id);
            engineRowsByPrizeId[p.id] = filterEngineRowsForPrize(p, raw ?? []);
        })
    );

    const pdfSections: PdfSection[] = sections
        .map((sec) => {
            const applicable = prizeDefs.filter(
                (p) => p.active && p.prize_type !== "spot" && prizeAppliesToSection(p, sec)
            );

            const grouped = groupDeterministicPrizes(applicable);

            const fallbackSpot =
                args.fallbackSpotPrizeNameBySection?.[sec.key] ?? "Spot Prize";

            const blocks: PdfPrizeBlock[] = grouped.map(
                ({ key, prize, awardedCount }, idx) => {
                    const rows = engineRowsByPrizeId[prize.id] ?? [];
                    const availableCount = Math.min(awardedCount, rows.length);
                    const bestFirst = rows.slice(0, availableCount);

                    const cleanTitle = stripSectionPrefix(key, sec.title);

                    const lines: PdfPrizeRow[] = Array.from({ length: awardedCount }).map(
                        (_, i) => {
                            const place = i + 1;
                            const placeLabel = `${place}${ordinalSuffix(place)}`;

                            const hasResult = place <= availableCount;

                            if (!hasResult) {
                                return {
                                    placeLabel,
                                    left: "No Result",
                                    winner: `Draw a Spot Prize: ${fallbackSpot}`,
                                };
                            }

                            const rowForPlace = bestFirst[place - 1];
                            const bits = rowForPlace
                                ? buildStageBits(rowForPlace)
                                : { left: "—", winner: "—" };

                            return {
                                placeLabel,
                                left: bits.left,
                                winner: bits.winner,
                            };
                        }
                    );

                    return {
                        title: cleanTitle,
                        rule: prize.award_rule ?? null,
                        rows: lines,
                        renderHints: {
                            keepTogether: true,
                            minPresenceAhead: estimateMinPresenceAhead(
                                prize.award_rule ?? null,
                                awardedCount
                            ),
                            startsSection: idx === 0,
                            sectionTitle: idx === 0 ? sec.title : undefined,
                        },
                    };
                }
            );

            return { title: sec.title, prizes: blocks };
        })
        .filter((s) => s.prizes.length > 0);

    const generatedAt = new Date().toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland",
    });

    return { competitionName, generatedAt, sections: pdfSections };
}

// ============================================================================
// PDF RENDERER (exported)
// ============================================================================

const el = React.createElement;

// Only used to avoid orphan section headers (NOT a forced day page break)
const SECTION_TITLE_HEIGHT = 26;

const styles = StyleSheet.create({
    page: {
        paddingTop: 28,
        paddingBottom: 34,
        paddingHorizontal: 28,
        fontSize: 10,
        fontFamily: "Helvetica",
        color: "#111827",
    },
    header: { marginBottom: 12 },
    competitionName: { fontSize: 16, fontWeight: 700, marginBottom: 3 },
    generatedAt: { fontSize: 9, color: "#6b7280" },

    sectionTitle: {
        fontSize: 13,
        fontWeight: 700,
        marginTop: 12,
        marginBottom: 8,
    },

    card: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
        backgroundColor: "#ffffff",
    },
    blockTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
    rule: { fontSize: 9, color: "#6b7280", marginBottom: 8 },

    tableHeader: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: "#e5e7eb",
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
        paddingVertical: 6,
        backgroundColor: "#f9fafb",
    },
    th: { fontSize: 9, fontWeight: 700, color: "#374151" },
    row: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
        paddingVertical: 6,
    },
    td: { fontSize: 9, color: "#111827" },

    colPlace: { width: 46, paddingRight: 8 },
    colResult: { flexGrow: 1, paddingRight: 10 },
    colWinner: { width: 170 },

    footer: {
        position: "absolute",
        left: 28,
        right: 28,
        bottom: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        fontSize: 8,
        color: "#9ca3af",
    },
});

function PrizeCard(props: { block: PdfPrizeBlock }) {
    const b = props.block;

    return el(
        View,
        { style: styles.card },
        el(Text, { style: styles.blockTitle }, b.title),
        b.rule ? el(Text, { style: styles.rule }, `Rule: ${b.rule}`) : null,

        el(
            View,
            { style: styles.tableHeader },
            el(Text, { style: [styles.th, styles.colPlace] }, "Place"),
            el(Text, { style: [styles.th, styles.colResult] }, "Result"),
            el(Text, { style: [styles.th, styles.colWinner] }, "Angler")
        ),

        ...b.rows.map((r, idx) =>
            el(
                View,
                { key: `${b.title}-${idx}`, style: styles.row },
                el(Text, { style: [styles.td, styles.colPlace] }, r.placeLabel),
                el(Text, { style: [styles.td, styles.colResult] }, r.left),
                el(Text, { style: [styles.td, styles.colWinner] }, r.winner)
            )
        )
    );
}

export function PrizeGivingPdfDocument(props: { model: PrizeGivingPdfModel }) {
    const model = props.model;

    return el(
        Document,
        null,
        el(
            Page,
            { size: "A4", style: styles.page },

            // Header
            el(
                View,
                { style: styles.header },
                el(Text, { style: styles.competitionName }, model.competitionName),
                el(Text, { style: styles.generatedAt }, `Generated: ${model.generatedAt}`)
            ),

            // Sections (NO break; flow naturally)
            ...model.sections.map((sec) => {
                const firstBlockMin = sec.prizes[0]?.renderHints?.minPresenceAhead ?? 0;
                const titleMinAhead = firstBlockMin + SECTION_TITLE_HEIGHT;

                return el(
                    View,
                    { key: sec.title },

                    // Section title: keep with first card (NOT a forced new page)
                    el(
                        Text as any,
                        { style: styles.sectionTitle, minPresenceAhead: titleMinAhead } as any,
                        sec.title
                    ),

                    // Cards: only start if they can fit fully, else go to next page
                    ...sec.prizes.map((block, i) =>
                        el(
                            View as any,
                            {
                                key: `${sec.title}-${block.title}-${i}`,
                                wrap: false,
                                minPresenceAhead: block.renderHints?.minPresenceAhead ?? 0,
                            } as any,
                            el(PrizeCard as any, { block } as any)
                        )
                    )
                );
            }),

            // Footer (fixed)
            el(
                View as any,
                { style: styles.footer, fixed: true } as any,
                el(Text, null, "GDMNZ"),
                el(Text as any, {
                    render: ({ pageNumber, totalPages }: any) =>
                        `Page ${pageNumber} / ${totalPages}`,
                } as any)
            )
        )
    );
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export async function renderPrizeGivingPdfBlob(model: PrizeGivingPdfModel): Promise<Blob> {
    const instance = pdf(el(PrizeGivingPdfDocument as any, { model } as any));
    return await instance.toBlob();
}
