import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/pages/Admin.tsx
import { useEffect, useState } from 'react';
import { fetchSettings, updateSettings } from '@/services/api';
import { STORE_KEYS } from '@/utils';
import AdminSponsors from './AdminSponsors';
function loadLocal(k, f) {
    try {
        const r = localStorage.getItem(k);
        return r ? JSON.parse(r) : structuredClone(f);
    }
    catch {
        return structuredClone(f);
    }
}
function saveLocal(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
// Money helpers
const nzMoney = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2 });
const fmt = (n) => isFinite(n) ? nzMoney.format(n) : '';
const parseMoney = (v) => {
    // allow "$1,234.56" or "1234.56" etc
    const n = Number((v ?? '').replace(/[^\d.]/g, ''));
    return isFinite(n) ? n : 0;
};
export default function Admin() {
    const [settings, setSettings] = useState(null);
    const [savingSettings, setSavingSettings] = useState(false);
    const [branding, setBranding] = useState(loadLocal(STORE_KEYS.branding, { logoDataUrl: null }));
    useEffect(() => {
        (async () => {
            const s = await fetchSettings();
            setSettings(s);
        })();
    }, []);
    async function onSaveSettings() {
        if (!settings)
            return;
        try {
            setSavingSettings(true);
            await updateSettings({
                earlyBirdCutoff: settings.earlyBirdCutoff,
                compMode: settings.compMode,
                showTime: settings.showTime,
                requireTime: settings.requireTime,
            });
            alert('Settings saved.');
        }
        catch (err) {
            console.error(err);
            alert('Failed to save settings.');
        }
        finally {
            setSavingSettings(false);
        }
    }
    function onLogoChange(e) {
        const f = e.target.files?.[0];
        if (!f)
            return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const b = { ...branding, logoDataUrl: ev.target?.result };
            setBranding(b);
            saveLocal(STORE_KEYS.branding, b);
            const img = document.querySelector('header .brand img');
            if (img)
                img.src = String(ev.target?.result || '');
        };
        reader.readAsDataURL(f);
    }
    if (!settings)
        return null;
    // Reusable money input with $ adornment + parse/format
    function MoneyInput({ value, onChange, }) {
        // store & display only numeric text; adornment supplies the "$"
        const [text, setText] = useState(Number.isFinite(value) ? value.toFixed(2) : '');
        useEffect(() => {
            setText(Number.isFinite(value) ? value.toFixed(2) : '');
        }, [value]);
        return (_jsxs("div", { className: "currency", children: [_jsx("span", { children: "$" }), _jsx("input", { inputMode: "decimal", value: text, onChange: (e) => {
                        // allow digits and a single dot
                        const raw = e.target.value.replace(/[^\d.]/g, '');
                        const parts = raw.split('.');
                        const cleaned = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw;
                        setText(cleaned);
                        const n = Number(cleaned);
                        if (Number.isFinite(n))
                            onChange(n);
                    }, onBlur: (e) => {
                        const n = Number(e.currentTarget.value);
                        setText(Number.isFinite(n) ? n.toFixed(2) : '');
                    } })] }));
    }
    return (_jsxs("section", { className: "card admin-card", children: [_jsx("h2", { children: "Admin" }), _jsxs("div", { className: "grid two admin-layout", children: [_jsxs("div", { children: [_jsx("h3", { children: "Event Settings" }), _jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "field span-4", children: [_jsx("label", { children: "Early-bird cutoff" }), _jsx("input", { type: "date", value: settings.earlyBirdCutoff || '', onChange: e => setSettings({ ...settings, earlyBirdCutoff: e.target.value || undefined }) })] }), _jsxs("div", { className: "field span-4", children: [_jsx("label", { children: "Competition mode" }), _jsxs("select", { value: settings.compMode, onChange: e => setSettings({ ...settings, compMode: e.target.value }), children: [_jsx("option", { value: "weight", children: "Weight" }), _jsx("option", { value: "measure", children: "Measure (length)" })] })] }), _jsxs("div", { className: "field span-4", children: [_jsx("label", { children: "Prize mode" }), _jsxs("select", { value: settings.prizeMode, onChange: e => setSettings({ ...settings, prizeMode: e.target.value }), children: [_jsx("option", { value: "combined", children: "Combined" }), _jsx("option", { value: "split", children: "Split Adult/Junior" })] })] }), _jsxs("div", { className: "field span-4", children: [_jsx("label", { children: "Show catch time" }), _jsxs("select", { value: settings.showTime ? '1' : '0', onChange: e => setSettings({ ...settings, showTime: e.target.value === '1' }), children: [_jsx("option", { value: "1", children: "Yes" }), _jsx("option", { value: "0", children: "No" })] })] }), _jsxs("div", { className: "field span-4", children: [_jsx("label", { children: "Require catch time" }), _jsxs("select", { value: settings.requireTime ? '1' : '0', onChange: e => setSettings({ ...settings, requireTime: e.target.value === '1' }), children: [_jsx("option", { value: "1", children: "Yes" }), _jsx("option", { value: "0", children: "No" })] })] }), _jsxs("div", { className: "field span-4", children: [_jsx("label", { children: "Decimals" }), _jsx("input", { type: "number", step: "1", min: "0", max: "3", value: settings.decimals, onChange: e => setSettings({ ...settings, decimals: Number(e.target.value || 0) }) })] }), _jsxs("div", { className: "field span-6", children: [_jsx("label", { children: "Adult early fee" }), _jsx(MoneyInput, { value: settings.fees.Adult.early, onChange: (n) => setSettings({
                                                    ...settings,
                                                    fees: { ...settings.fees, Adult: { ...settings.fees.Adult, early: n } }
                                                }) })] }), _jsxs("div", { className: "field span-6", children: [_jsx("label", { children: "Adult standard fee" }), _jsx(MoneyInput, { value: settings.fees.Adult.standard, onChange: (n) => setSettings({
                                                    ...settings,
                                                    fees: { ...settings.fees, Adult: { ...settings.fees.Adult, standard: n } }
                                                }) })] }), _jsxs("div", { className: "field span-6", children: [_jsx("label", { children: "Junior early fee" }), _jsx(MoneyInput, { value: settings.fees.Junior.early, onChange: (n) => setSettings({
                                                    ...settings,
                                                    fees: { ...settings.fees, Junior: { ...settings.fees.Junior, early: n } }
                                                }) })] }), _jsxs("div", { className: "field span-6", children: [_jsx("label", { children: "Junior standard fee" }), _jsx(MoneyInput, { value: settings.fees.Junior.standard, onChange: (n) => setSettings({
                                                    ...settings,
                                                    fees: { ...settings.fees, Junior: { ...settings.fees.Junior, standard: n } }
                                                }) })] })] }), _jsx("div", { className: "actions", children: _jsx("button", { className: "btn primary", disabled: savingSettings, onClick: onSaveSettings, children: savingSettings ? 'Saving…' : 'Save Settings' }) })] }), _jsxs("div", { children: [_jsx("h3", { children: "Branding" }), _jsx("div", { className: "form-grid", children: _jsxs("div", { className: "field span-12", children: [_jsx("label", { children: "Upload logo (PNG/JPG)" }), _jsx("input", { type: "file", onChange: onLogoChange, accept: "image/*" })] }) }), _jsx("hr", { className: "divider" }), _jsx(AdminSponsors, {})] })] })] }));
}
