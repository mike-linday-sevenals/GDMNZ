import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/pages/AdminSponsors.tsx
import { useEffect, useRef, useState } from 'react';
import { createSponsor, fetchDefaultGroupLevels, addSponsorToCompetition, listCompetitionSponsors, } from '@/services/sponsors';
import { supabase } from '@/services/db';
const BLURB_MAX = 240;
// Helper: get current competition (running today, else latest)
async function getCurrentCompetitionId() {
    const today = new Date().toISOString().slice(0, 10);
    let { data, error } = await supabase
        .from('competition')
        .select('id, starts_at, ends_at')
        .lte('starts_at', today)
        .gte('ends_at', today)
        .order('starts_at', { ascending: false })
        .limit(1);
    if (error)
        throw error;
    if (data?.length)
        return data[0].id;
    const { data: latest, error: err2 } = await supabase
        .from('competition')
        .select('id')
        .order('starts_at', { ascending: false })
        .limit(1);
    if (err2)
        throw err2;
    if (!latest?.length)
        throw new Error('No competitions found');
    return latest[0].id;
}
export default function AdminSponsors() {
    const [competitionId, setCompetitionId] = useState('');
    // form fields
    const [name, setName] = useState('');
    const [levels, setLevels] = useState([]);
    const [levelId, setLevelId] = useState('');
    const [displayOrder, setDisplayOrder] = useState('');
    const [blurb, setBlurb] = useState('');
    // sponsors already linked
    const [linked, setLinked] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const blurbRef = useRef(null);
    const blurbCount = blurb.length;
    // auto-resize the textarea
    function autosize(el) {
        el.style.height = '0px';
        el.style.height = el.scrollHeight + 'px';
    }
    useEffect(() => {
        if (blurbRef.current)
            autosize(blurbRef.current);
    }, [blurb]);
    useEffect(() => {
        ;
        (async () => {
            try {
                const [cid, lvls] = await Promise.all([
                    getCurrentCompetitionId(),
                    fetchDefaultGroupLevels(),
                ]);
                setCompetitionId(cid);
                setLevels(lvls);
                if (lvls.length)
                    setLevelId(lvls[0].id);
                const rows = await listCompetitionSponsors(cid);
                setLinked(rows);
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    async function handleAdd() {
        if (!name.trim())
            return;
        setSaving(true);
        try {
            const sponsor = await createSponsor(name.trim());
            await addSponsorToCompetition({
                competition_id: competitionId,
                sponsor_id: sponsor.id,
                level_id: levelId || null,
                display_order: displayOrder === '' ? null : Number(displayOrder),
                blurb: blurb || null,
            });
            const rows = await listCompetitionSponsors(competitionId);
            setLinked(rows);
            setName('');
            setDisplayOrder('');
            setBlurb('');
        }
        finally {
            setSaving(false);
        }
    }
    if (loading) {
        return (_jsxs("section", { className: "card", children: [_jsx("h3", { children: "Sponsors (DB)" }), _jsx("p", { className: "muted", children: "Loading\u2026" })] }));
    }
    return (_jsxs("section", { className: "card", children: [_jsx("h3", { children: "Sponsors (DB)" }), _jsxs("p", { className: "sub", children: ["Competition: ", competitionId.slice(0, 8), "\u2026"] }), _jsxs("div", { className: "grid", style: {
                    gridTemplateColumns: 'minmax(280px, 1fr) 180px 110px auto',
                    gap: '8px',
                    alignItems: 'center',
                }, children: [_jsx("input", { placeholder: "Sponsor name", value: name, onChange: (e) => setName(e.target.value) }), _jsxs("select", { value: levelId, onChange: (e) => setLevelId(e.target.value), children: [levels.map((l) => (_jsx("option", { value: l.id, children: l.label }, l.id))), !levels.length && _jsx("option", { value: "", children: "(no levels)" })] }), _jsx("input", { type: "number", placeholder: "Order", value: displayOrder, onChange: (e) => setDisplayOrder(e.target.value) }), _jsx("button", { className: "btn", onClick: handleAdd, disabled: saving || !name.trim(), children: saving ? 'Saving…' : 'Add' })] }), _jsxs("div", { style: { marginTop: 8 }, children: [_jsx("label", { className: "muted", htmlFor: "s-blurb", children: "Blurb (optional)" }), _jsx("textarea", { id: "s-blurb", ref: blurbRef, value: blurb, maxLength: BLURB_MAX, onInput: (e) => {
                            const el = e.currentTarget;
                            setBlurb(el.value);
                            autosize(el);
                        }, placeholder: "Short sponsor description shown on prizegiving pages\u2026", style: {
                            width: '100%',
                            minHeight: 44,
                            resize: 'none',
                            overflow: 'hidden',
                        } }), _jsxs("div", { className: "muted", style: { textAlign: 'right', fontSize: 12 }, children: [blurbCount, "/", BLURB_MAX] })] }), _jsxs("ul", { className: "list", style: { marginTop: 12 }, children: [linked.length === 0 && (_jsx("li", { className: "muted", children: "No sponsors linked for this competition." })), linked.map((row) => (_jsxs("li", { children: [_jsx("strong", { children: row.display_order ?? '—' }), "\u00A0", row.sponsor_name, row.level_label && (_jsxs("span", { className: "muted", children: [" (", row.level_label, ")"] })), row.blurb && _jsxs("span", { className: "muted", children: [" \u2014 ", row.blurb] })] }, row.id)))] })] }));
}
