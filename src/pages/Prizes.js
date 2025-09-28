import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// File: src/pages/Prizes.tsx
import { useEffect, useMemo, useState } from 'react';
import { fetchSettings, listSpecies } from '../services/api.js';
import { listPrizes, createPrizeRow, updatePrizeRow, deletePrizeRow, getNextRank, } from '../services/prizes.js';
import { listCompetitionSponsors } from '@/services/sponsors';
import { supabase } from '@/services/db';
const cssId = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export default function Prizes() {
    const [settings, setSettings] = useState(null);
    const [species, setSpecies] = useState([]);
    const [prizes, setPrizes] = useState({});
    const [competitionId, setCompetitionId] = useState('');
    const [compSponsors, setCompSponsors] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        ;
        (async () => {
            const [st, sp, rows] = await Promise.all([
                fetchSettings(),
                listSpecies(),
                listPrizes(),
            ]);
            setSettings(st);
            setSpecies(sp.map((s) => ({ id: s.id, name: s.name })));
            setPrizes(groupRows(rows));
            const cid = await getCurrentCompetitionId();
            setCompetitionId(cid);
            const sponsorRows = await listCompetitionSponsors(cid);
            setCompSponsors(sponsorRows);
            setLoading(false);
        })().catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);
    const mode = settings?.prizeMode || 'combined';
    function groupRows(rows) {
        const out = {};
        for (const r of rows) {
            out[r.species_id] ??= { combined: [], adult: [], junior: [] };
            out[r.species_id][r.for_category].push(r);
        }
        for (const sid of Object.keys(out)) {
            ;
            ['combined', 'adult', 'junior'].forEach((c) => {
                out[+sid][c] = out[+sid][c].slice().sort((a, b) => a.rank - b.rank);
            });
        }
        return out;
    }
    function immSetRows(sid, cat, rows) {
        return {
            ...prizes,
            [sid]: {
                ...(prizes[sid] ?? { combined: [], adult: [], junior: [] }),
                [cat]: rows.slice().sort((a, b) => a.rank - b.rank),
            },
        };
    }
    async function addPrize(species_id, cat) {
        const next = await getNextRank(species_id, cat);
        // optimistic temp row
        const temp = {
            id: `tmp-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
            rank: next,
            label: '',
            species_id,
            sponsor: '',
            sponsor_id: null,
            for_category: cat,
            active: true,
            created_at: new Date().toISOString(),
        };
        setPrizes((prev) => {
            const cur = (prev[species_id]?.[cat] ?? []).slice();
            cur.push(temp);
            return {
                ...prev,
                [species_id]: {
                    ...(prev[species_id] ?? { combined: [], adult: [], junior: [] }),
                    [cat]: cur.sort((a, b) => a.rank - b.rank),
                },
            };
        });
        try {
            const created = await createPrizeRow({
                rank: next,
                label: '',
                species_id,
                sponsor: '',
                sponsor_id: null,
                for_category: cat,
                active: true,
            });
            // swap temp -> real
            setPrizes((prev) => {
                const cur = (prev[species_id]?.[cat] ?? []).filter((r) => !String(r.id).startsWith('tmp-'));
                return immSetRows(species_id, cat, [...cur, created]);
            });
        }
        catch (e) {
            // revert optimistic add
            setPrizes((prev) => {
                const cur = (prev[species_id]?.[cat] ?? []).filter((r) => !String(r.id).startsWith('tmp-'));
                return immSetRows(species_id, cat, cur);
            });
            alert(`Failed to add prize: ${e?.message ?? e}`);
        }
    }
    function editPrize(id, species_id, cat, patch) {
        // optimistic UI
        setPrizes((prev) => {
            const cur = (prev[species_id]?.[cat] ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r));
            return immSetRows(species_id, cat, cur);
        });
        // persist
        updatePrizeRow(id, patch).catch((e) => {
            console.error('Failed to save prize patch', e);
        });
    }
    async function removePrize(id, species_id, cat) {
        const before = prizes[species_id]?.[cat] ?? [];
        setPrizes((prev) => immSetRows(species_id, cat, before.filter((r) => r.id !== id)));
        try {
            await deletePrizeRow(id);
        }
        catch (e) {
            // rollback
            setPrizes((prev) => immSetRows(species_id, cat, before));
            alert(`Failed to remove prize: ${e?.message ?? e}`);
        }
    }
    function saveMode() {
        // If you persist settings.prizeMode in DB, do it here.
        alert('Prize mode saved.');
    }
    const sponsorOptions = useMemo(() => [
        { id: '', name: '— No sponsor —' },
        ...compSponsors
            .slice()
            .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.sponsor_name.localeCompare(b.sponsor_name))
            .map((r) => ({ id: r.sponsor_id, name: r.sponsor_name })),
    ], [compSponsors]);
    if (loading) {
        return (_jsxs("section", { className: "card", children: [_jsx("h2", { children: "Prize Setup" }), _jsx("p", { className: "muted", children: "Loading\u2026" })] }));
    }
    return (_jsxs("section", { className: "card", children: [_jsxs("h2", { children: ["Prize Setup ", _jsx("span", { className: "badge", children: "DB-backed" })] }), _jsxs("p", { className: "sub", children: ["Prizes are stored in Supabase ", _jsx("code", { children: "prize" }), " table. Sponsors shown below are configured for this competition."] }), _jsxs("div", { className: "actions", children: [_jsx("span", { children: "Mode:" }), _jsxs("label", { className: "switch", children: [_jsx("input", { type: "radio", name: "pmode", defaultChecked: mode === 'combined', value: "combined" }), " ", _jsx("span", { children: "Combined" })] }), _jsxs("label", { className: "switch", children: [_jsx("input", { type: "radio", name: "pmode", defaultChecked: mode === 'split', value: "split" }), ' ', _jsx("span", { children: "Split: Adult & Junior" })] }), _jsx("div", { style: { flex: '1 1 auto' } }), _jsx("button", { className: "btn", onClick: saveMode, children: "Save Mode" })] }), _jsx("div", { className: "grid", children: species.map((sp) => {
                    const byCat = prizes[sp.id] ?? { combined: [], adult: [], junior: [] };
                    return (_jsxs("details", { open: true, children: [_jsx("summary", { children: _jsx("strong", { children: sp.name }) }), _jsx("div", { style: { margin: '10px 0' }, children: mode === 'combined' ? (_jsx(PrizeTable, { title: "", name: sp.name, speciesId: sp.id, rows: byCat.combined, sponsorOptions: sponsorOptions, onAdd: () => addPrize(sp.id, 'combined'), onEdit: (id, patch) => editPrize(id, sp.id, 'combined', patch), onRemove: (id) => removePrize(id, sp.id, 'combined') })) : (_jsxs(_Fragment, { children: [_jsx("h4", { children: "Adult" }), _jsx(PrizeTable, { title: "Adult", name: sp.name, speciesId: sp.id, rows: byCat.adult, sponsorOptions: sponsorOptions, onAdd: () => addPrize(sp.id, 'adult'), onEdit: (id, patch) => editPrize(id, sp.id, 'adult', patch), onRemove: (id) => removePrize(id, sp.id, 'adult') }), _jsx("h4", { children: "Junior" }), _jsx(PrizeTable, { title: "Junior", name: sp.name, speciesId: sp.id, rows: byCat.junior, sponsorOptions: sponsorOptions, onAdd: () => addPrize(sp.id, 'junior'), onEdit: (id, patch) => editPrize(id, sp.id, 'junior', patch), onRemove: (id) => removePrize(id, sp.id, 'junior') })] })) })] }, sp.id));
                }) })] }));
}
// ---- helper: choose the running competition or latest by start date ----
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
function PrizeTable({ title, name, speciesId: _speciesId, rows, sponsorOptions, onAdd, onEdit, onRemove, }) {
    return (_jsxs("div", { id: `area-${cssId(name)}${title ? `-${cssId(title)}` : ''}`, children: [_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Place" }), _jsx("th", { children: "Prize (label/description)" }), _jsx("th", { style: { width: '34%' }, children: "Sponsor" }), _jsx("th", {})] }) }), _jsxs("tbody", { children: [rows.map((r) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("input", { className: "pz-place", type: "number", min: 1, step: 1, value: r.rank, onChange: (e) => onEdit(r.id, { rank: Number(e.target.value) || 1 }), onBlur: (e) => onEdit(r.id, { rank: Number(e.target.value) || 1 }) }) }), _jsx("td", { children: _jsx("input", { className: "pz-desc", placeholder: "e.g., $200 voucher", value: r.label ?? '', onChange: (e) => onEdit(r.id, { label: e.target.value }), onBlur: (e) => onEdit(r.id, { label: e.target.value }) }) }), _jsx("td", { children: _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }, children: [_jsx("select", { value: r.sponsor_id ?? '', onChange: (e) => onEdit(r.id, { sponsor_id: e.target.value || null }), onBlur: (e) => onEdit(r.id, { sponsor_id: e.target.value || null }), children: sponsorOptions.map((opt) => (_jsx("option", { value: opt.id, children: opt.name }, opt.id || 'none'))) }), _jsx("input", { className: "pz-sponsor", placeholder: "Display name (optional)", value: r.sponsor ?? '', onChange: (e) => onEdit(r.id, { sponsor: e.target.value }), onBlur: (e) => onEdit(r.id, { sponsor: e.target.value }) })] }) }), _jsx("td", { children: _jsx("button", { className: "btn danger", onClick: () => onRemove(r.id), children: "Remove" }) })] }, r.id))), !rows.length && (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "muted", children: "No prizes yet." }) }))] })] }), _jsx("div", { className: "actions", style: { marginTop: 10 }, children: _jsx("button", { className: "btn accent", onClick: onAdd, children: "Add Prize" }) })] }));
}
