import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { fetchSettings, listFishJoined, deleteFish, listSpecies } from '@/services/api';
import { fmt, formatNZ } from '@/utils';
export default function Results() {
    const [settings, setSettings] = useState(null);
    const [rows, setRows] = useState([]);
    const [species, setSpecies] = useState([]);
    useEffect(() => {
        (async () => {
            setSettings(await fetchSettings());
            setRows(await listFishJoined());
            setSpecies(await listSpecies());
        })();
    }, []);
    const [q, setQ] = useState('');
    const [sp, setSp] = useState('All');
    const filtered = useMemo(() => {
        const ql = q.toLowerCase();
        return rows.filter(r => (sp === 'All' || r.species?.name === sp))
            .filter(r => !ql || [r.competitor?.full_name, r.species?.name].join(' ').toLowerCase().includes(ql));
    }, [rows, q, sp]);
    const [selected, setSelected] = useState(new Set());
    function sortByMetric() {
        const cmp = (a, b) => {
            const va = settings.compMode === 'measure' ? (a.length_cm || 0) : (a.weight_kg || 0);
            const vb = settings.compMode === 'measure' ? (b.length_cm || 0) : (b.weight_kg || 0);
            return vb - va;
        };
        setRows(r => [...r].sort(cmp));
    }
    function sortByTime() {
        setRows(r => [...r].sort((a, b) => String(a.time_caught || '').localeCompare(String(b.time_caught || ''))));
    }
    async function removeSelected() {
        if (selected.size === 0) {
            alert('Select at least one row');
            return;
        }
        if (!confirm('Delete selected entries?'))
            return;
        await deleteFish(Array.from(selected));
        setRows(await listFishJoined());
        setSelected(new Set());
    }
    return (_jsxs("section", { className: "card", children: [_jsx("h2", { children: "Results" }), _jsxs("div", { className: "grid two", children: [_jsxs("div", { children: [_jsx("label", { children: "Filter by species" }), _jsxs("select", { value: sp, onChange: e => setSp(e.target.value), children: [_jsx("option", { children: "All" }), species.map(s => _jsx("option", { children: s.name }, s.id))] })] }), _jsxs("div", { children: [_jsx("label", { children: "Search" }), _jsx("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "Name / notes..." })] })] }), _jsxs("div", { className: "actions", children: [_jsx("button", { className: "btn", onClick: sortByMetric, children: "Sort by Weight/Length" }), _jsx("button", { className: "btn", onClick: sortByTime, children: "Sort by Time" }), _jsx("button", { className: "btn danger", onClick: removeSelected, children: "Delete Selected" })] }), _jsx("div", { style: { overflow: 'auto', marginTop: 10 }, children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: _jsx("input", { type: "checkbox", onChange: (e) => {
                                                if (e.target.checked)
                                                    setSelected(new Set(filtered.map(r => r.id)));
                                                else
                                                    setSelected(new Set());
                                            } }) }), _jsx("th", { children: "Name" }), _jsx("th", { children: "Category" }), _jsx("th", { children: "Species" }), _jsx("th", { children: settings?.compMode === 'measure' ? 'Length (cm)' : 'Weight (kg)' }), _jsxs("th", { children: [settings?.compMode === 'measure' ? 'Weight (kg)' : 'Length (cm)', " ", _jsx("span", { className: "muted", children: "(opt)" })] }), _jsx("th", { children: "Date" }), _jsx("th", { children: "Time" })] }) }), _jsxs("tbody", { children: [filtered.map(r => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("input", { type: "checkbox", checked: selected.has(r.id), onChange: (e) => {
                                                    const s = new Set(selected);
                                                    if (e.target.checked)
                                                        s.add(r.id);
                                                    else
                                                        s.delete(r.id);
                                                    setSelected(s);
                                                } }) }), _jsx("td", { children: r.competitor?.full_name || '' }), _jsx("td", { children: _jsx("span", { className: `cat-badge cat-${(r.competitor?.category === 'adult' ? 'Adult' : 'Junior')}`, children: r.competitor?.category === 'adult' ? 'Adult' : 'Junior' }) }), _jsx("td", { children: r.species?.name || '' }), _jsx("td", { children: settings?.compMode === 'measure' ? (r.length_cm != null ? fmt(r.length_cm, 1) : '') : (r.weight_kg != null ? fmt(r.weight_kg, settings?.decimals || 2) : '') }), _jsx("td", { children: settings?.compMode === 'measure' ? (r.weight_kg != null ? fmt(r.weight_kg, settings?.decimals || 2) : '') : (r.length_cm != null ? fmt(r.length_cm, 1) : '') }), _jsx("td", { className: "nz-date", children: r.time_caught ? formatNZ(r.time_caught.slice(0, 10)) : '' }), _jsx("td", { children: r.time_caught ? new Date(r.time_caught).toTimeString().slice(0, 5) : '' })] }, String(r.id)))), filtered.length === 0 && _jsx("tr", { children: _jsx("td", { colSpan: 8, className: "muted", children: "No results yet." }) })] })] }) })] }));
}
