import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { addFish, fetchSettings, listCompetitors, listSpecies, listFishJoined } from '@/services/api';
import { todayISO } from '@/utils';
export default function Submit() {
    const [settings, setSettings] = useState(null);
    const [species, setSpecies] = useState([]);
    const [competitors, setCompetitors] = useState([]);
    useEffect(() => {
        (async () => {
            setSettings(await fetchSettings());
            setSpecies(await listSpecies());
            setCompetitors(await listCompetitors());
        })();
    }, []);
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q)
            return competitors.slice(0, 50);
        return competitors.filter(c => [c.full_name, c.boat || ''].join(' ').toLowerCase().includes(q)).slice(0, 50);
    }, [search, competitors]);
    const [competitorId, setCompetitorId] = useState('');
    const [lengthCm, setLengthCm] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [specId, setSpecId] = useState('');
    const [timeCaught, setTimeCaught] = useState('');
    const [dateCaught, setDateCaught] = useState(todayISO());
    const [keepAfter, setKeepAfter] = useState(false);
    async function save(stay) {
        if (!competitorId) {
            alert('Please select a registered competitor');
            return;
        }
        if (!specId) {
            alert('Please select a species');
            return;
        }
        if (settings.compMode === 'measure') {
            if (!lengthCm || Number(lengthCm) <= 0) {
                alert('Length is required');
                return;
            }
        }
        else {
            if (!weightKg || Number(weightKg) <= 0) {
                alert('Weight is required');
                return;
            }
        }
        if (settings.showTime && settings.requireTime && !timeCaught) {
            alert('Time is required');
            return;
        }
        const timeISO = (dateCaught || todayISO()) + 'T' + (timeCaught || '00:00');
        await addFish({
            competitor_id: competitorId,
            species_id: Number(specId),
            length_cm: settings.compMode === 'measure' ? Number(lengthCm || 0) : null,
            weight_kg: settings.compMode === 'weight' ? Number(weightKg || 0) : null,
            time_caught: settings.showTime ? timeISO : null
        });
        await listFishJoined();
        alert('Catch saved');
        if (stay) {
            const keep = keepAfter ? competitorId : '';
            setLengthCm('');
            setWeightKg('');
            if (!settings.requireTime)
                setTimeCaught('');
            setSpecId('');
            if (!keep)
                setCompetitorId('');
            setSearch('');
        }
        else {
            location.href = '/results';
        }
    }
    return (_jsxs("section", { className: "card", children: [_jsx("h2", { children: "Submit a Catch" }), _jsxs("div", { className: "row", children: [_jsxs("div", { className: "col-6", children: [_jsx("label", { children: "Search competitor (name or boat)" }), _jsx("input", { value: search, onChange: e => setSearch(e.target.value), placeholder: "Type to filter by name or boat" }), _jsx("div", { className: "sub", children: "Or pick from dropdown below." })] }), _jsxs("div", { className: "col-6", children: [_jsx("label", { children: "Competitor" }), _jsxs("select", { value: competitorId, onChange: e => setCompetitorId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 Select registered competitor \u2014" }), filtered.map(c => (_jsxs("option", { value: String(c.id), children: [c.full_name, " (", c.category === 'adult' ? 'Adult' : 'Junior', ") \u2014 ", c.boat || ''] }, String(c.id))))] })] }), settings?.compMode === 'measure' ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "col-3", children: [_jsxs("label", { children: ["Length (cm) ", _jsx("span", { className: "muted", children: "*" })] }), _jsx("input", { value: lengthCm, onChange: e => setLengthCm(e.target.value), type: "number", step: "0.1", placeholder: "e.g., 55.2" })] }), _jsxs("div", { className: "col-3", children: [_jsxs("label", { children: ["Weight (kg) ", _jsx("span", { className: "muted", children: "(optional)" })] }), _jsx("input", { value: weightKg, onChange: e => setWeightKg(e.target.value), type: "number", step: "0.001", placeholder: "e.g., 3.45" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "col-3", children: [_jsxs("label", { children: ["Weight (kg) ", _jsx("span", { className: "muted", children: "*" })] }), _jsx("input", { value: weightKg, onChange: e => setWeightKg(e.target.value), type: "number", step: "0.001", placeholder: "e.g., 3.45" })] }), _jsxs("div", { className: "col-3", children: [_jsxs("label", { children: ["Length (cm) ", _jsx("span", { className: "muted", children: "(optional)" })] }), _jsx("input", { value: lengthCm, onChange: e => setLengthCm(e.target.value), type: "number", step: "0.1", placeholder: "e.g., 55.2" })] })] })), _jsxs("div", { className: "col-3", children: [_jsx("label", { children: "Species" }), _jsxs("select", { value: String(specId), onChange: e => setSpecId(Number(e.target.value)), children: [_jsx("option", { value: "", children: "Select species\u2026" }), species.map(s => _jsx("option", { value: s.id, children: s.name }, s.id))] })] }), _jsxs("div", { className: `col-3 ${settings?.showTime ? '' : 'muted'}`, children: [_jsxs("label", { children: ["Time Caught ", settings?.requireTime ? _jsx("span", { className: "muted", children: "*" }) : null] }), _jsx("input", { type: "time", disabled: !settings?.showTime, value: timeCaught, onChange: e => setTimeCaught(e.target.value) })] }), _jsxs("div", { className: "col-3", children: [_jsx("label", { children: "Date Caught" }), _jsx("input", { type: "date", value: dateCaught, onChange: e => setDateCaught(e.target.value) })] }), _jsxs("div", { className: "col-3", children: [_jsx("label", { children: "Location (local only)" }), _jsx("input", { placeholder: "e.g., Gulf Harbour" })] }), _jsxs("div", { className: "col-12", children: [_jsx("label", { children: "Notes (local only)" }), _jsx("textarea", { placeholder: "Anything worth noting..." })] })] }), _jsxs("div", { className: "actions", children: [_jsxs("label", { className: "switch", children: [_jsx("input", { type: "checkbox", checked: keepAfter, onChange: e => setKeepAfter(e.target.checked) }), " Keep competitor after save"] }), _jsx("button", { className: "btn primary", onClick: () => save(false), children: "Save Catch" }), _jsx("button", { className: "btn accent", onClick: () => save(true), children: "Save & Add another" }), _jsx("button", { className: "btn", onClick: () => location.reload(), children: "Clear Form" })] })] }));
}
