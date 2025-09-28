import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// PrizeGiving.ts
import { useEffect, useState } from 'react';
import { fetchSettings, listFishJoined, listSpecies } from '@/services/api';
import { fmt } from '@/utils';
import { listPrizes } from '@/services/prizes';
export default function PrizeGiving() {
    const [settings, setSettings] = useState(null);
    const [entries, setEntries] = useState([]);
    const [species, setSpecies] = useState([]);
    const [prizeMap, setPrizeMap] = useState({});
    useEffect(() => {
        (async () => {
            const [st, fish, spRows, pRows] = await Promise.all([
                fetchSettings(),
                listFishJoined(),
                listSpecies(), // MUST return id + name
                listPrizes(), // from '@/services/prizes'
            ]);
            setSettings(st);
            setEntries(fish);
            setSpecies(spRows.map((s) => ({ id: s.id, name: s.name })));
            // Build: speciesName -> category -> { rank -> {label,sponsor} }
            const byId = new Map(spRows.map((s) => [s.id, s.name]));
            const m = {};
            for (const s of spRows) {
                m[s.name] = { combined: {}, adult: {}, junior: {} };
            }
            for (const p of pRows) {
                const sName = byId.get(p.species_id);
                if (!sName)
                    continue;
                const cat = (p.for_category ?? 'combined');
                m[sName] ??= { combined: {}, adult: {}, junior: {} };
                m[sName][cat][p.rank] = { label: p.label ?? '', sponsor: p.sponsor ?? '' };
            }
            setPrizeMap(m);
        })();
    }, []);
    function parseWeighIn(ts) {
        if (!ts)
            return Number.POSITIVE_INFINITY;
        const n = Date.parse(String(ts));
        return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    }
    function rankFor(arr) {
        const s = settings || { compMode: 'weight' };
        return arr.slice().sort((a, b) => {
            const pa = s.compMode === 'measure' ? (a.length_cm || 0) : (a.weight_kg || 0);
            const pb = s.compMode === 'measure' ? (b.length_cm || 0) : (b.weight_kg || 0);
            if (pb !== pa)
                return pb - pa;
            const ta = parseWeighIn(a.created_at);
            const tb = parseWeighIn(b.created_at);
            return ta - tb;
        });
    }
    const mode = settings?.prizeMode || 'combined';
    return (_jsxs("section", { className: "card", children: [_jsx("h2", { children: "Prize Giving" }), _jsxs("p", { className: "sub", children: ["Mode: ", _jsx("strong", { children: mode === 'combined' ? 'Combined' : 'Split (Adult & Junior)' }), " \u2014 shown in reverse order for announcing (3rd \u2192 1st)."] }), species.map(s => {
                const all = entries.filter(e => e.species?.name === s.name);
                const node = prizeMap[s.name] || { combined: {}, adult: {}, junior: {} };
                if (mode === 'combined') {
                    const pz = node.combined;
                    const places = Object.keys(pz).map(n => parseInt(n)).sort((a, b) => b - a);
                    if (places.length === 0) {
                        return _jsxs("section", { className: "card", children: [_jsx("h3", { children: s.name }), _jsx("p", { className: "muted", children: "No prizes configured." })] }, s.id);
                    }
                    const ranked = rankFor([...all]).slice(0, Math.max(...places));
                    return (_jsx(SpeciesBlock, { name: s.name, label: "Combined", places: places, ranked: ranked, prizeMap: pz, compMode: settings?.compMode || 'weight' }, s.id));
                }
                else {
                    const pzA = node.adult;
                    const pzJ = node.junior;
                    const placesA = Object.keys(pzA).map(n => parseInt(n)).sort((a, b) => b - a);
                    const placesJ = Object.keys(pzJ).map(n => parseInt(n)).sort((a, b) => b - a);
                    const rankedA = rankFor(all.filter(e => e.competitor?.category === 'adult')).slice(0, Math.max(0, ...placesA));
                    const rankedJ = rankFor(all.filter(e => e.competitor?.category === 'junior')).slice(0, Math.max(0, ...placesJ));
                    return (_jsxs("div", { children: [_jsxs("section", { className: "card", children: [_jsxs("h3", { children: [s.name, " \u2014 Adult"] }), placesA.length
                                        ? _jsx(Table, { places: placesA, ranked: rankedA, pz: pzA, compMode: settings?.compMode || 'weight', showCat: false })
                                        : _jsx("p", { className: "muted", children: "No Adult prizes." })] }), _jsxs("section", { className: "card", children: [_jsxs("h3", { children: [s.name, " \u2014 Junior"] }), placesJ.length
                                        ? _jsx(Table, { places: placesJ, ranked: rankedJ, pz: pzJ, compMode: settings?.compMode || 'weight', showCat: false })
                                        : _jsx("p", { className: "muted", children: "No Junior prizes." })] })] }, s.id));
                }
            })] }));
}
function SpeciesBlock({ name, label, places, ranked, prizeMap, compMode }) {
    return (_jsxs("section", { className: "card", children: [_jsxs("h3", { children: [name, " \u2014 ", label] }), _jsx(Table, { places: places, ranked: ranked, pz: prizeMap, compMode: compMode, showCat: true })] }));
}
function Table({ places, ranked, pz, compMode, showCat }) {
    return (_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Place" }), _jsx("th", { children: "Competitor" }), showCat && _jsx("th", { children: "Category" }), _jsx("th", { children: compMode === 'measure' ? 'Length (cm)' : 'Weight (kg)' }), _jsx("th", { children: "Prize" }), _jsx("th", { children: "Sponsor" })] }) }), _jsx("tbody", { children: places.map(place => {
                    const c = ranked[place - 1];
                    if (!c)
                        return _jsxs("tr", { children: [_jsx("td", { children: place }), _jsx("td", { colSpan: showCat ? 4 : 3, className: "muted", children: "\u2014 no qualified entry \u2014" })] }, place);
                    const prize = pz[place] || { label: '', sponsor: '' };
                    const catBadge = _jsx("span", { className: `cat-badge cat-${c.competitor?.category === 'adult' ? 'Adult' : 'Junior'}`, children: c.competitor?.category === 'adult' ? 'Adult' : 'Junior' });
                    const metric = compMode === 'measure'
                        ? (c.length_cm != null ? fmt(c.length_cm, 1) : '')
                        : (c.weight_kg != null ? fmt(c.weight_kg, 2) : '');
                    const juniorBeatingAdult = (c.competitor?.category === 'junior' && showCat);
                    return (_jsxs("tr", { children: [_jsxs("td", { children: [place, juniorBeatingAdult && ' ', " ", juniorBeatingAdult && _jsx("span", { className: "badge", children: "Junior!" })] }), _jsx("td", { children: c.competitor?.full_name || '' }), showCat && _jsx("td", { children: catBadge }), _jsx("td", { children: metric }), _jsx("td", { children: prize.label }), _jsx("td", { className: "sponsor", children: prize.sponsor || '' })] }, place));
                }) })] }));
}
