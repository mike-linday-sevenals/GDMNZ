import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { STORE_KEYS } from '@/utils';
function loadLocal(k, f) { try {
    const r = localStorage.getItem(k);
    return r ? JSON.parse(r) : structuredClone(f);
}
catch {
    return structuredClone(f);
} }
function saveLocal(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
export default function Data() {
    function exportAll() {
        const data = {
            generatedAt: new Date().toISOString(),
            prizes: loadLocal(STORE_KEYS.prizes, {}),
            branding: loadLocal(STORE_KEYS.branding, { logoDataUrl: null }),
            sponsors: loadLocal(STORE_KEYS.sponsors, { overall: [] })
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wosc-local-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
    function importAll(file) {
        if (!file)
            return alert('Choose a file first.');
        if (!confirm('Importing will overwrite local data. Continue?'))
            return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(String(ev.target?.result || '{}'));
                if (data.prizes)
                    saveLocal(STORE_KEYS.prizes, data.prizes);
                if (data.branding)
                    saveLocal(STORE_KEYS.branding, data.branding);
                if (data.sponsors)
                    saveLocal(STORE_KEYS.sponsors, data.sponsors);
                alert('Import completed.');
            }
            catch (e) {
                alert('Import failed: ' + e.message);
            }
        };
        reader.readAsText(file);
    }
    function clearAll() {
        if (!confirm('Really clear local data (prizes/branding/sponsors)?'))
            return;
        [STORE_KEYS.prizes, STORE_KEYS.branding, STORE_KEYS.sponsors].forEach(k => localStorage.removeItem(k));
        alert('Local data cleared.');
    }
    return (_jsxs("section", { className: "card", children: [_jsx("h2", { children: "Import / Export (local parts)" }), _jsx("p", { className: "sub", children: "This exports/imports only local data: prizes, branding, sponsors. DB data (competitors/fish) stays in Supabase." }), _jsxs("div", { className: "grid two", children: [_jsxs("div", { children: [_jsx("h3", { children: "Export Data" }), _jsx("div", { className: "actions", children: _jsx("button", { className: "btn primary", onClick: exportAll, children: "Export JSON" }) })] }), _jsxs("div", { children: [_jsx("h3", { children: "Import Data" }), _jsx("p", { className: "sub", children: "Upload a previously exported JSON file. This overwrites local data only." }), _jsx("input", { type: "file", id: "imp-file", accept: "application/json" }), _jsx("div", { className: "actions", children: _jsx("button", { className: "btn warn", onClick: () => {
                                        const f = document.getElementById('imp-file').files?.[0];
                                        importAll(f || undefined);
                                    }, children: "Import" }) })] })] }), _jsx("hr", { style: { border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' } }), _jsx("h3", { children: "Danger Zone" }), _jsx("div", { className: "actions", children: _jsx("button", { className: "btn danger", onClick: clearAll, children: "Clear LOCAL Data" }) })] }));
}
