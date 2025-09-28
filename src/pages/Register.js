import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { addCompetitor, deleteCompetitors, fetchSettings, listCompetitors } from '@/services/api';
import { computeFee, formatNZ, todayISO } from '@/utils';
export default function Register() {
    const [settings, setSettings] = useState(null);
    const [rows, setRows] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [name, setName] = useState('');
    const [category, setCategory] = useState('Adult');
    const [paidOn, setPaidOn] = useState(todayISO());
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [boat, setBoat] = useState('');
    const [notes, setNotes] = useState('');
    useEffect(() => {
        (async () => {
            setSettings(await fetchSettings());
            setRows(await listCompetitors());
        })();
    }, []);
    const fee = useMemo(() => settings ? computeFee(settings, category, paidOn) : null, [settings, category, paidOn]);
    async function save(keepBoat) {
        if (!name.trim()) {
            alert('Full Name is required');
            return;
        }
        if (!paidOn) {
            alert('Payment Date is required');
            return;
        }
        await addCompetitor({
            full_name: name.trim(),
            category: category.toLowerCase(),
            paid_on: paidOn,
            email: email.trim() || null,
            phone: phone.trim() || null,
            boat: boat.trim() || null
        });
        setRows(await listCompetitors());
        setName('');
        setEmail('');
        setPhone('');
        setNotes('');
        if (!keepBoat)
            setBoat('');
    }
    async function removeSelected() {
        if (selected.size === 0) {
            alert('Select at least one');
            return;
        }
        if (!confirm('Delete selected competitors? This will also remove their fish.'))
            return;
        await deleteCompetitors(Array.from(selected));
        setRows(await listCompetitors());
        setSelected(new Set());
    }
    const [search, setSearch] = useState('');
    const filtered = rows.filter(r => !search || [r.full_name, r.email, r.boat].join(' ').toLowerCase().includes(search.toLowerCase()));
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: "card", children: [_jsx("h2", { children: "Competition Registration" }), _jsxs("div", { className: "row", children: [_jsxs("div", { className: "col-6", children: [_jsx("label", { children: "Full Name *" }), _jsx("input", { value: name, onChange: e => setName(e.target.value), placeholder: "First Last", required: true })] }), _jsxs("div", { className: "col-3", children: [_jsx("label", { children: "Category *" }), _jsxs("select", { value: category, onChange: e => setCategory(e.target.value), children: [_jsx("option", { children: "Adult" }), _jsx("option", { children: "Junior" })] })] }), _jsxs("div", { className: "col-3", children: [_jsx("label", { children: "Payment Date *" }), _jsx("input", { type: "date", value: paidOn, onChange: e => setPaidOn(e.target.value) })] }), _jsxs("div", { className: "col-6", children: [_jsx("label", { children: "Email" }), _jsx("input", { value: email, onChange: e => setEmail(e.target.value), placeholder: "name@example.com" })] }), _jsxs("div", { className: "col-3", children: [_jsx("label", { children: "Phone" }), _jsx("input", { value: phone, onChange: e => setPhone(e.target.value), placeholder: "+64 ..." })] }), _jsxs("div", { className: "col-3", children: [_jsx("label", { children: "Boat / Team" }), _jsx("input", { value: boat, onChange: e => setBoat(e.target.value), placeholder: "Boat or Team name" })] }), _jsxs("div", { className: "col-12", children: [_jsx("label", { children: "Notes (local only)" }), _jsx("textarea", { value: notes, onChange: e => setNotes(e.target.value), placeholder: "Anything we should know... (not stored in DB)" })] })] }), _jsxs("div", { className: "actions", style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', marginTop: 6 }, children: [_jsxs("span", { className: "pill", children: ["Fee: ", _jsx("strong", { style: { marginLeft: 6 }, children: fee != null ? `$${fee.toFixed(0)}` : '$0' })] }), _jsx("div", { style: { flex: '1 1 auto' } }), _jsx("button", { className: "btn primary", onClick: () => save(false), children: "Register Competitor" }), _jsx("button", { className: "btn accent", onClick: () => save(true), children: "Save & Register Another (same boat)" }), _jsx("button", { className: "btn", onClick: () => { setName(''); setEmail(''); setPhone(''); setBoat(''); setNotes(''); }, children: "Clear" }), settings && (_jsxs("div", { id: "r-fee-rule", style: { flex: '1 0 100%', order: 2, marginTop: 6, lineHeight: 1.3 }, children: ["Early-bird cutoff: ", _jsx("span", { className: "badge", children: formatNZ(settings.earlyBirdCutoff) }), " \u2014", ' ', "Adult $", settings.fees.Adult.early, " \u2192 $", settings.fees.Adult.standard, " after; Junior $", settings.fees.Junior.early, " \u2192 $", settings.fees.Junior.standard, "."] }))] })] }), _jsxs("section", { className: "card", children: [_jsx("h3", { children: "Registered Competitors" }), _jsxs("div", { className: "actions", children: [_jsx("input", { placeholder: "Search by name / email / boat...", value: search, onChange: e => setSearch(e.target.value) }), _jsx("button", { className: "btn", onClick: () => setRows(r => [...r].sort((a, b) => a.full_name.localeCompare(b.full_name))), children: "Sort A \u2192 Z" }), _jsx("button", { className: "btn danger", onClick: removeSelected, children: "Delete Selected" })] }), _jsx("div", { style: { overflow: 'auto', marginTop: 10 }, children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: _jsx("input", { type: "checkbox", onChange: (e) => {
                                                        if (e.target.checked)
                                                            setSelected(new Set(filtered.map(x => x.id)));
                                                        else
                                                            setSelected(new Set());
                                                    } }) }), _jsx("th", { children: "Name" }), _jsx("th", { children: "Category" }), _jsx("th", { children: "Email" }), _jsx("th", { children: "Phone" }), _jsx("th", { children: "Boat/Team" }), _jsx("th", { children: "Payment Date" }), _jsx("th", { children: "Fee" })] }) }), _jsxs("tbody", { children: [filtered.map(r => {
                                            const dispCat = r.category === 'adult' ? 'Adult' : 'Junior';
                                            const feeRow = settings ? computeFee(settings, dispCat, r.paid_on) : null;
                                            return (_jsxs("tr", { children: [_jsx("td", { children: _jsx("input", { type: "checkbox", checked: selected.has(r.id), onChange: (e) => {
                                                                const s = new Set(selected);
                                                                if (e.target.checked)
                                                                    s.add(r.id);
                                                                else
                                                                    s.delete(r.id);
                                                                setSelected(s);
                                                            } }) }), _jsx("td", { children: r.full_name }), _jsx("td", { children: dispCat }), _jsx("td", { children: r.email || '' }), _jsx("td", { children: r.phone || '' }), _jsx("td", { children: r.boat || '' }), _jsx("td", { className: "nz-date", children: formatNZ(r.paid_on) }), _jsx("td", { children: feeRow != null ? ('$' + feeRow.toFixed(0)) : '' })] }, String(r.id)));
                                        }), filtered.length === 0 && _jsx("tr", { children: _jsx("td", { colSpan: 8, className: "muted", children: "No competitors yet." }) })] })] }) })] })] }));
}
