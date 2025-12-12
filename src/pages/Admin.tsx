import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSettings, updateSettings, listSpecies } from '@/services/api'
import { STORE_KEYS } from '@/utils'
import AdminSponsors from './AdminSponsors'

type Settings = {
    earlyBirdCutoff?: string
    fees: { Adult: { early: number, standard: number }, Junior: { early: number, standard: number } }
    decimals: number
    compMode: 'weight' | 'measure'
    showTime: boolean
    requireTime: boolean
    prizeMode: 'combined' | 'split'
    activeSpeciesIds?: number[]
}

type Species = { id: number; name: string }

// ---------- tiny local helpers ----------
function loadLocal<T>(k: string, f: T): T {
    try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : structuredClone(f) }
    catch { return structuredClone(f) }
}
function saveLocal<T>(k: string, v: T) { localStorage.setItem(k, JSON.stringify(v)) }

// Money helpers
const nzMoney = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2 })

export default function Admin() {
    const [settings, setSettings] = useState<Settings | null>(null)
    const [savingSettings, setSavingSettings] = useState(false)
    const [branding, setBranding] = useState<any>(loadLocal(STORE_KEYS.branding, { logoDataUrl: null }))

    const [species, setSpecies] = useState<Species[]>([])
    const [activeSetLocal, setActiveSetLocal] = useState<Set<number>>(new Set())

    useEffect(() => {
        (async () => {
            const [st, sp] = await Promise.all([fetchSettings(), listSpecies()])
            setSettings(st)
            setSpecies(sp)

            const fromSettings = (Array.isArray(st.activeSpeciesIds) && st.activeSpeciesIds.length)
                ? new Set<number>(st.activeSpeciesIds)
                : new Set<number>(sp.map(x => x.id))

            setActiveSetLocal(fromSettings)
        })()
    }, [])

    const activeIdsArray = useMemo(
        () => Array.from(activeSetLocal.values()).sort((a, b) => a - b),
        [activeSetLocal]
    )

    async function onSaveSettings() {
        if (!settings) return
        try {
            setSavingSettings(true)
            await updateSettings({
                earlyBirdCutoff: settings.earlyBirdCutoff,
                compMode: settings.compMode,
                showTime: settings.showTime,
                requireTime: settings.requireTime,
                prizeMode: settings.prizeMode,
                activeSpeciesIds: activeIdsArray,
            })
            setSettings(s => s ? { ...s, activeSpeciesIds: activeIdsArray } : s)
            alert('Settings saved.')
        } catch (err) {
            console.error(err)
            alert('Failed to save settings.')
        } finally {
            setSavingSettings(false)
        }
    }

    function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]; if (!f) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const b = { ...branding, logoDataUrl: ev.target?.result }
            setBranding(b)
            saveLocal(STORE_KEYS.branding, b)

            const img = document.querySelector('header .brand img') as HTMLImageElement | null
            if (img) img.src = String(ev.target?.result || '')
        }
        reader.readAsDataURL(f)
    }

    if (!settings) return (
        <section className="card admin-card">
            <h2>Admin</h2>
            <p className="muted">Loading…</p>
        </section>
    )

    function MoneyInput({
        value,
        onChange,
    }: {
        value: number
        onChange: (next: number) => void
    }) {
        const [text, setText] = useState<string>(Number.isFinite(value) ? value.toFixed(2) : '')
        useEffect(() => {
            setText(Number.isFinite(value) ? value.toFixed(2) : '')
        }, [value])
        return (
            <div className="currency">
                <span>$</span>
                <input
                    inputMode="decimal"
                    value={text}
                    onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d.]/g, '')
                        const parts = raw.split('.')
                        const cleaned = parts.length > 2
                            ? parts[0] + '.' + parts.slice(1).join('')
                            : raw
                        setText(cleaned)
                        const n = Number(cleaned)
                        if (Number.isFinite(n)) onChange(n)
                    }}
                    onBlur={(e) => {
                        const n = Number(e.currentTarget.value)
                        setText(Number.isFinite(n) ? n.toFixed(2) : '')
                    }}
                />
            </div>
        )
    }

    function toggleAll(on: boolean) {
        setActiveSetLocal(new Set(on ? species.map(s => s.id) : []))
    }
    function toggleOne(id: number, on: boolean) {
        setActiveSetLocal(prev => {
            const next = new Set(prev)
            if (on) next.add(id)
            else next.delete(id)
            return next
        })
    }

    return (
        <section className="card admin-card">
            <h2>Admin</h2>

            {/* UPDATED BUTTON USING <Link> NOT <a> */}
            <div style={{ marginBottom: 20 }}>
                <Link to="/admin/competitions">
                    <button className="btn primary">
                        Manage Competitions
                    </button>
                </Link>
            </div>

            <div className="grid two admin-layout">

                {/* SETTINGS */}
                <div>
                    <h3>Event Settings</h3>

                    <div className="form-grid">
                        <div className="field span-4">
                            <label>Early-bird cutoff</label>
                            <input
                                type="date"
                                value={settings.earlyBirdCutoff || ''}
                                onChange={e => setSettings({
                                    ...settings,
                                    earlyBirdCutoff: e.target.value || undefined
                                })}
                            />
                        </div>

                        <div className="field span-4">
                            <label>Competition mode</label>
                            <select
                                value={settings.compMode}
                                onChange={e => setSettings({
                                    ...settings,
                                    compMode: e.target.value as Settings['compMode']
                                })}
                            >
                                <option value="weight">Weight</option>
                                <option value="measure">Measure (length)</option>
                            </select>
                        </div>

                        <div className="field span-4">
                            <label>Prize mode</label>
                            <select
                                value={settings.prizeMode}
                                onChange={e => setSettings({
                                    ...settings,
                                    prizeMode: e.target.value as Settings['prizeMode']
                                })}
                            >
                                <option value="combined">Combined</option>
                                <option value="split">Split Adult/Junior</option>
                            </select>
                        </div>

                        <div className="field span-4">
                            <label>Show catch time</label>
                            <select
                                value={settings.showTime ? '1' : '0'}
                                onChange={e => setSettings({
                                    ...settings,
                                    showTime: e.target.value === '1'
                                })}
                            >
                                <option value="1">Yes</option>
                                <option value="0">No</option>
                            </select>
                        </div>

                        <div className="field span-4">
                            <label>Require catch time</label>
                            <select
                                value={settings.requireTime ? '1' : '0'}
                                onChange={e => setSettings({
                                    ...settings,
                                    requireTime: e.target.value === '1'
                                })}
                            >
                                <option value="1">Yes</option>
                                <option value="0">No</option>
                            </select>
                        </div>

                        <div className="field span-4">
                            <label>Decimals</label>
                            <input
                                type="number"
                                step="1"
                                min="0"
                                max="3"
                                value={settings.decimals}
                                onChange={e => setSettings({
                                    ...settings,
                                    decimals: Number(e.target.value || 0)
                                })}
                            />
                        </div>

                        {/* Adult fees */}
                        <div className="field span-6">
                            <label>Adult early fee</label>
                            <MoneyInput
                                value={settings.fees.Adult.early}
                                onChange={(n) => setSettings({
                                    ...settings,
                                    fees: {
                                        ...settings.fees,
                                        Adult: { ...settings.fees.Adult, early: n }
                                    }
                                })}
                            />
                        </div>

                        <div className="field span-6">
                            <label>Adult standard fee</label>
                            <MoneyInput
                                value={settings.fees.Adult.standard}
                                onChange={(n) => setSettings({
                                    ...settings,
                                    fees: {
                                        ...settings.fees,
                                        Adult: { ...settings.fees.Adult, standard: n }
                                    }
                                })}
                            />
                        </div>

                        {/* Junior fees */}
                        <div className="field span-6">
                            <label>Junior early fee</label>
                            <MoneyInput
                                value={settings.fees.Junior.early}
                                onChange={(n) => setSettings({
                                    ...settings,
                                    fees: {
                                        ...settings.fees,
                                        Junior: { ...settings.fees.Junior, early: n }
                                    }
                                })}
                            />
                        </div>

                        <div className="field span-6">
                            <label>Junior standard fee</label>
                            <MoneyInput
                                value={settings.fees.Junior.standard}
                                onChange={(n) => setSettings({
                                    ...settings,
                                    fees: {
                                        ...settings.fees,
                                        Junior: { ...settings.fees.Junior, standard: n }
                                    }
                                })}
                            />
                        </div>

                    </div>

                    <div className="actions">
                        <button className="btn primary" disabled={savingSettings} onClick={onSaveSettings}>
                            {savingSettings ? 'Saving…' : 'Save Settings'}
                        </button>
                    </div>
                </div>

                {/* BRANDING + SPONSORS + SPECIES VISIBILITY */}
                <div>
                    <h3>Branding</h3>
                    <div className="form-grid">
                        <div className="field span-12">
                            <label>Upload logo (PNG/JPG)</label>
                            <input type="file" onChange={onLogoChange} accept="image/*" />
                        </div>
                    </div>

                    <hr className="divider" />

                    <h3>Species visibility</h3>
                    <p className="sub">
                        Only species checked here appear in Submit / Prizes / Results / Public leaderboard.
                    </p>

                    <div className="actions" style={{ marginBottom: 8 }}>
                        <button className="btn" onClick={() => toggleAll(true)}>Select all</button>
                        <button className="btn" onClick={() => toggleAll(false)}>Clear all</button>
                    </div>

                    <div className="form-grid">
                        {species.map(sp => (
                            <label key={sp.id} className="field span-4"
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <input
                                    type="checkbox"
                                    checked={activeSetLocal.has(sp.id)}
                                    onChange={e => toggleOne(sp.id, e.target.checked)}
                                    style={{ width: 18, height: 18 }}
                                />
                                <span>{sp.name}</span>
                            </label>
                        ))}
                    </div>

                    <div className="actions" style={{ marginTop: 10 }}>
                        <button className="btn primary" disabled={savingSettings} onClick={onSaveSettings}>
                            {savingSettings ? 'Saving…' : 'Save Visibility'}
                        </button>
                    </div>

                    <hr className="divider" />

                    <AdminSponsors />
                </div>
            </div>
        </section>
    )
}
