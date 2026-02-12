import React from "react";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
} from "@react-pdf/renderer";
import type { PrizeGivingPdfModel } from "./prizeGivingExport";

const styles = StyleSheet.create({
    page: { padding: 28, fontSize: 10 },

    header: { marginBottom: 14 },
    title: { fontSize: 18, fontWeight: 700 },
    meta: { marginTop: 4, color: "#555" },

    // New: wrapper for each section (just spacing)
    sectionWrap: {
        marginTop: 14,
    },

    // New: this is the "section start" line + padding that must move with title + first block
    sectionStart: {
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: "#ddd",
    },

    sectionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 8 },

    prizeBlock: {
        marginBottom: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 6,
    },
    prizeTitle: { fontSize: 11, fontWeight: 700 },
    rule: { marginTop: 2, color: "#666" },

    table: { marginTop: 8, borderWidth: 1, borderColor: "#eee" },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f3f4f6",
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    headText: { fontWeight: 700 },

    row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#eee" },

    cellPlace: { width: 44, padding: 6, fontWeight: 700 },
    cellLeft: { flex: 1, padding: 6, lineHeight: 1.25 },
    cellWinner: { width: 190, padding: 6, lineHeight: 1.25 },

    footer: {
        position: "absolute",
        bottom: 18,
        left: 28,
        right: 28,
        color: "#777",
        fontSize: 9,
        flexDirection: "row",
        justifyContent: "space-between",
    },
});

// Rough “points-ish” height estimator for a prize block.
// The goal is: don’t start a block unless it can fit fully on the current page.
function estimatePrizeBlockMinPresenceAhead(p: {
    rule: string | null;
    rows: Array<any>;
}) {
    const title = 22;
    const rule = p.rule ? 14 * Math.min(3, Math.ceil(p.rule.length / 70)) : 0;
    const tableHeader = 18;
    const perRow = 18;
    const padding = 16;
    return title + rule + tableHeader + perRow * (p.rows?.length ?? 0) + padding;
}

function PrizeGivingPdfDoc({ model }: { model: PrizeGivingPdfModel }) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.title}>
                        {model.competitionName} — Prize Giving
                    </Text>
                    <Text style={styles.meta}>Generated: {model.generatedAt} (NZ)</Text>
                </View>

                {model.sections.map((s) => {
                    const first = s.prizes[0] ?? null;
                    const rest = s.prizes.slice(1);

                    // Ensure (section start line + title + first prize block) stay together
                    const SECTION_TITLE_HEIGHT = 26;
                    const SECTION_START_OVERHEAD = 16; // border+padding-ish

                    const firstMin = first ? estimatePrizeBlockMinPresenceAhead(first) : 0;
                    const headerGroupMinAhead =
                        SECTION_START_OVERHEAD + SECTION_TITLE_HEIGHT + firstMin;

                    return (
                        <View key={s.title} style={styles.sectionWrap}>
                            {/* ✅ This entire group moves together if it doesn’t fit */}
                            <View
                                style={styles.sectionStart}
                                wrap={false}
                                minPresenceAhead={headerGroupMinAhead}
                            >
                                <Text style={styles.sectionTitle}>{s.title}</Text>

                                {first ? (
                                    <View key={first.title} style={styles.prizeBlock} wrap={false}>
                                        <Text style={styles.prizeTitle}>{first.title}</Text>
                                        {first.rule ? (
                                            <Text style={styles.rule}>Rule: {first.rule}</Text>
                                        ) : null}

                                        <View style={styles.table}>
                                            <View style={styles.tableHeader}>
                                                <Text style={[styles.cellPlace, styles.headText]}>
                                                    Place
                                                </Text>
                                                <Text style={[styles.cellLeft, styles.headText]}>
                                                    Result
                                                </Text>
                                                <Text style={[styles.cellWinner, styles.headText]}>
                                                    Angler
                                                </Text>
                                            </View>

                                            {first.rows.map((r) => (
                                                <View
                                                    key={`${first.title}-${r.placeLabel}`}
                                                    style={styles.row}
                                                >
                                                    <Text style={styles.cellPlace}>{r.placeLabel}</Text>
                                                    <Text style={styles.cellLeft}>{r.left}</Text>
                                                    <Text style={styles.cellWinner}>{r.winner}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ) : null}
                            </View>

                            {/* Remaining prize blocks: “only start if it fits” */}
                            {rest.map((p) => {
                                const minAhead = estimatePrizeBlockMinPresenceAhead(p);

                                return (
                                    <View
                                        key={p.title}
                                        style={styles.prizeBlock}
                                        wrap={false}
                                        minPresenceAhead={minAhead}
                                    >
                                        <Text style={styles.prizeTitle}>{p.title}</Text>
                                        {p.rule ? <Text style={styles.rule}>Rule: {p.rule}</Text> : null}

                                        <View style={styles.table}>
                                            <View style={styles.tableHeader}>
                                                <Text style={[styles.cellPlace, styles.headText]}>
                                                    Place
                                                </Text>
                                                <Text style={[styles.cellLeft, styles.headText]}>
                                                    Result
                                                </Text>
                                                <Text style={[styles.cellWinner, styles.headText]}>
                                                    Angler
                                                </Text>
                                            </View>

                                            {p.rows.map((r) => (
                                                <View key={`${p.title}-${r.placeLabel}`} style={styles.row}>
                                                    <Text style={styles.cellPlace}>{r.placeLabel}</Text>
                                                    <Text style={styles.cellLeft}>{r.left}</Text>
                                                    <Text style={styles.cellWinner}>{r.winner}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    );
                })}

                <View style={styles.footer} fixed>
                    <Text>GDMNZ</Text>
                    <Text
                        render={({ pageNumber, totalPages }) =>
                            `Page ${pageNumber} / ${totalPages}`
                        }
                    />
                </View>
            </Page>
        </Document>
    );
}

export async function downloadPrizeGivingPdf(model: PrizeGivingPdfModel, filename: string) {
    const blob = await pdf(<PrizeGivingPdfDoc model={model} />).toBlob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
}
