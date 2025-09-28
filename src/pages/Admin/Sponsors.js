import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/pages/admin/Sponsors.tsx
import { useEffect, useState } from 'react';
import { listSponsors, createSponsor, updateSponsor, deleteSponsor } from '@/services/api';
export default function SponsorsAdmin() {
    const [items, setItems] = useState([]);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);
    async function refresh() { setItems(await listSponsors()); }
    useEffect(() => { refresh(); }, []);
    async function add() {
        if (!newName.trim())
            return;
        setSaving(true);
        try {
            const s = await createSponsor(newName.trim());
            setItems([...items, s].sort((a, b) => a.name.localeCompare(b.name)));
            setNewName('');
        }
        finally {
            setSaving(false);
        }
    }
    async function rename(id, name) {
        setSaving(true);
        try {
            const s = await updateSponsor(id, name);
            setItems(items.map(i => i.id === id ? s : i));
        }
        finally {
            setSaving(false);
        }
    }
    async function remove(id) {
        if (!confirm('Delete this sponsor? Prizes linked to it will lose the reference.'))
            return;
        setSaving(true);
        try {
            await deleteSponsor(id);
            setItems(items.filter(i => i.id !== id));
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("section", { className: "card", children: [_jsx("h2", { children: "Sponsors" }), _jsxs("div", { className: "row", children: [_jsx("div", { className: "col-8", children: _jsx("input", { placeholder: "New sponsor name", value: newName, onChange: e => setNewName(e.target.value) }) }), _jsx("div", { className: "col-4", children: _jsx("button", { className: "btn primary", disabled: saving, onClick: add, children: "Add sponsor" }) })] }), _jsxs("div", { className: "list", children: [items.map(i => (_jsxs("div", { className: "row", style: { alignItems: 'center', gap: 12, margin: '8px 0' }, children: [_jsx("input", { value: i.name, onChange: e => rename(i.id, e.target.value) }), _jsx("button", { className: "btn", onClick: () => remove(i.id), children: "Delete" })] }, i.id))), items.length === 0 && _jsx("div", { className: "muted", children: "No sponsors yet." })] })] }));
}
