import { useEffect, useMemo, useState } from 'react'
import {
    addCompetitor,
    deleteCompetitors,
    fetchSettings,
    listCompetitors,
    updateCompetitor,
} from '@/services/api'
import type { Competitor } from '@/types'
import { computeFee, formatNZ, todayISO } from '@/utils'

type DisplayCategory = 'Adult' | 'Junior'
type DomainCategory = 'adult' | 'junior'

function toDisplayCat(domain: DomainCategory): DisplayCategory {
    return domain === 'adult' ? 'Adult' : 'Junior'
}
function toDomainCat(display: DisplayCategory): DomainCategory {
    return display === 'Adult' ? 'adult' : 'junior'
}

// Normalise for duplicate checks: trim, collapse whitespace, lowercase
function normName(s: string) {
    return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

export default function Register() {
    const [settings, setSettings] = useState<any>(null)
    const [rows, setRows] = useState<Competitor[]>([])
    const [selected, setSelected] = useState<Set<string | number>>(new Set())

    // Create form
    const [name, setName] = useState('')
    const [category, setCategory] = useState<DisplayCategory>('Adult')
    const [paidOn, setPaidOn] = useState(todayISO())
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [boat, setBoat] = useState('')
    const [notes, setNotes] = useState('') // local-only

    // Edit state (row-level inline edit)
    const [editingId, setEditingId] = useState<string | number | null>(null)
    const [draft, setDraft] = useState<{
        full_name: string
        category: DisplayCategory
        paid_on: string
        email: string
        phone: string
        boat: string
    } | null>(null)

    // Simple confirm banner state
    const [confirm, setConfirm] = useState<null | {
        message: string
        onYes: () => void
        onNo: () => void
    }>(null)

    useEffect(() => {
        (async () => {
            setSettings(await fetchSettings())
            setRows(await listCompetitors())
        })()
    }, [])

    const fee = useMemo(
        () => (settings ? computeFee(settings, category, paidOn) : null),
        [settings, category, paidOn]
    )

    // Inline “duplicate exists” hint while typing on the create form
    const duplicateOnCreate = useMemo(() => {
        const n = normName(name)
        if (!n) return null
        return rows.find(r => normName(r.full_name) === n) || null
    }, [name, rows])

    async function doAdd(keepBoat: boolean) {
        await addCompetitor({
            full_name: name.trim(),
            category: toDomainCat(category),
            paid_on: paidOn,
            email: email.trim() || null,
            phone: phone.trim() || null,
            boat: boat.trim() || null,
        } as any)
        setRows(await listCompetitors())
        // stay on the registration page; just reset fields
        setName(''); setEmail(''); setPhone(''); setNotes('')
        if (!keepBoat) setBoat('')
    }

    function save(keepBoat: boolean) {
        if (!name.trim()) { alert('Full Name is required'); return }
        if (!paidOn) { alert('Payment Date is required'); return }

        const dup = duplicateOnCreate
        if (dup) {
            setConfirm({
                message: `A competitor named "${dup.full_name}" already exists. Do you want to continue and add another with the same name?`,
                onYes: async () => {
                    setConfirm(null)
                    await doAdd(keepBoat)
                },
                onNo: () => setConfirm(null),
            })
            return
        }
        // no duplicate → add immediately
        doAdd(keepBoat)
    }

    async function removeSelected() {
        if (selected.size === 0) { alert('Select at least one'); return }
        if (!confirmWindow('Delete selected competitors? This will also remove their fish.')) return
        await deleteCompetitors(Array.from(selected))
        setRows(await listCompetitors())
        setSelected(new Set())
    }

    function startEdit(r: Competitor) {
        if (editingId && editingId !== r.id) {
            const ok = confirmWindow('Discard current changes?')
            if (!ok) return
        }
        setEditingId(r.id as any)
        setDraft({
            full_name: r.full_name || '',
            category: toDisplayCat(r.category as any),
            paid_on: (r.paid_on || '').slice(0, 10),
            email: r.email || '',
            phone: r.phone || '',
            boat: r.boat || '',
        })
    }

    function cancelEdit() {
        setEditingId(null)
        setDraft(null)
    }

    // Duplicate check for edits against other rows
    function findDuplicateForEdit(d: typeof draft, id: string | number | null) {
        if (!d || !d.full_name) return null
        const n = normName(d.full_name)
        return rows.find(r => String(r.id) !== String(id) && normName(r.full_name) === n) || null
    }

    async function doSaveEdit() {
        if (!editingId || !draft) return
        await updateCompetitor(editingId, {
            full_name: draft.full_name.trim(),
            category: toDomainCat(draft.category),
            paid_on: draft.paid_on,
            email: draft.email.trim() || null,
            phone: draft.phone.trim() || null,
            boat: draft.boat.trim() || null,
        } as any)
        setRows(await listCompetitors())
        setEditingId(null)
        setDraft(null)
    }

    function saveEdit() {
        if (!editingId || !draft) return
        if (!draft.full_name.trim()) { alert('Full Name is required'); return }
        if (!draft.paid_on) { alert('Payment Date is required'); return }

        const dup = findDuplicateForEdit(draft, editingId)
        if (dup) {
            setConfirm({
                message: `A competitor named "${dup.full_name}" already exists. Do you want to continue and keep the same name?`,
                onYes: async () => {
                    setConfirm(null)
                    await doSaveEdit()
                },
                onNo: () => setConfirm(null),
            })
            return
        }
        doSaveEdit()
    }

    const [search, setSearch] = useState('')
    const filtered = rows.filter(r =>
        !search ||
        [r.full_name, r.email, r.boat].join(' ').toLowerCase().includes(search.toLowerCase())
    )

    // Live fee for the editing row (only for that row)
    function feeForDraft(d: typeof draft | null) {
        if (!d || !settings) return ''
        const f = computeFee(settings, d.category, d.paid_on)
        return isFinite(f as any) ? `$${(f as number).toFixed(0)}` : ''
    }

    return (
        <>
            {/* Duplicate confirm banner */}
            {confirm && (
                <div className="card" style={{ background: '#fff7ed', borderColor: '#fed7aa', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="badge" style={{ background: '#fdba74' }}>Warning</span>
                        <div style={{ flex: 1 }}>{confirm.message}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn" onClick={confirm.onNo}>Cancel</button>
                            <button type="button" className="btn primary" onClick={confirm.onYes}>Continue</button>
                        </div>
                    </div>
                </div>
            )}

            <section className="card">
                <h2>Competition Registration</h2>

                <div className="row">
                    <div className="col-6">
                        <label>Full Name *</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="First Last"
                            required
                        />
                        {!!duplicateOnCreate && (
                            <div className="muted" style={{ color: '#b45309', marginTop: 4 }}>
                                A competitor with this name already exists: <strong>{duplicateOnCreate.full_name}</strong>.
                                You can still proceed — you’ll be asked to confirm.
                            </div>
                        )}
                    </div>

                    <div className="col-3">
                        <label>Category *</label>
                        <select value={category} onChange={e => setCategory(e.target.value as DisplayCategory)}>
                            <option>Adult</option><option>Junior</option>
                        </select>
                    </div>

                    <div className="col-3">
                        <label>Payment Date *</label>
                        <input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} />
                    </div>

                    <div className="col-6"><label>Email</label><input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></div>
                    <div className="col-3"><label>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+64 ..." /></div>
                    <div className="col-3"><label>Boat / Team</label><input value={boat} onChange={e => setBoat(e.target.value)} placeholder="Boat or Team name" /></div>
                    <div className="col-12"><label>Notes (local only)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything we should know... (not stored in DB)" /></div>
                </div>

                <div className="actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', marginTop: 6 }}>
                    <span className="pill">Fee: <strong style={{ marginLeft: 6 }}>{fee != null ? `$${fee.toFixed(0)}` : '$0'}</strong></span>
                    <div style={{ flex: '1 1 auto' }} />
                    <button type="button" className="btn primary" onClick={() => save(false)}>Register Competitor</button>
                    <button type="button" className="btn accent" onClick={() => save(true)}>Save &amp; Register Another (same boat)</button>
                    <button type="button" className="btn" onClick={() => { setName(''); setEmail(''); setPhone(''); setBoat(''); setNotes(''); }}>Clear</button>
                    {settings && (
                        <div id="r-fee-rule" style={{ flex: '1 0 100%', order: 2, marginTop: 6, lineHeight: 1.3 }}>
                            Early-bird cutoff: <span className="badge">{formatNZ(settings.earlyBirdCutoff)}</span> —
                            {' '}Adult ${settings.fees.Adult.early} → ${settings.fees.Adult.standard} after; Junior ${settings.fees.Junior.early} → ${settings.fees.Junior.standard}.
                        </div>
                    )}
                </div>
            </section>

            <section className="card">
                <h3>Registered Competitors</h3>
                <div className="actions">
                    <input placeholder="Search by name / email / boat..." value={search} onChange={e => setSearch(e.target.value)} />
                    <button type="button" className="btn" onClick={() => setRows(r => [...r].sort((a, b) => a.full_name.localeCompare(b.full_name)))}>Sort A → Z</button>
                    <button type="button" className="btn danger" onClick={removeSelected} disabled={!!editingId}>Delete Selected</button>
                </div>

                <div style={{ overflow: 'auto', marginTop: 10 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            if ((e.target as HTMLInputElement).checked) setSelected(new Set(filtered.map(x => x.id)))
                                            else setSelected(new Set())
                                        }}
                                        disabled={!!editingId}
                                    />
                                </th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Boat/Team</th>
                                <th>Payment Date</th>
                                <th>Fee</th>
                                <th>Edit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => {
                                const isEditing = editingId === r.id
                                const dispCat = toDisplayCat(r.category as any)
                                const feeRow = settings ? computeFee(settings, dispCat as any, r.paid_on) : null

                                if (!isEditing) {
                                    return (
                                        <tr key={String(r.id)}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(r.id)}
                                                    onChange={(e) => {
                                                        const s = new Set(selected)
                                                        if ((e.target as HTMLInputElement).checked) s.add(r.id); else s.delete(r.id)
                                                        setSelected(s)
                                                    }}
                                                />
                                            </td>
                                            <td>{r.full_name}</td>
                                            <td>{dispCat}</td>
                                            <td>{r.email || ''}</td>
                                            <td>{r.phone || ''}</td>
                                            <td>{r.boat || ''}</td>
                                            <td className="nz-date">{formatNZ(r.paid_on)}</td>
                                            <td>{feeRow != null ? ('$' + feeRow.toFixed(0)) : ''}</td>
                                            <td>
                                                <button type="button" className="btn" onClick={() => startEdit(r)}>Edit</button>
                                            </td>
                                        </tr>
                                    )
                                }

                                // Editing row
                                return (
                                    <tr key={String(r.id)}>
                                        <td><input type="checkbox" disabled /></td>
                                        <td>
                                            <input
                                                value={draft?.full_name || ''}
                                                onChange={e => setDraft(d => ({ ...(d as any), full_name: e.target.value }))}
                                                placeholder="First Last"
                                            />
                                            {/* inline duplicate hint for edit */}
                                            {!!findDuplicateForEdit(draft, editingId) && (
                                                <div className="muted" style={{ color: '#b45309', marginTop: 4 }}>
                                                    Another competitor already has this name. You can still save — you’ll be asked to confirm.
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <select
                                                value={draft?.category || 'Adult'}
                                                onChange={e => setDraft(d => ({ ...(d as any), category: e.target.value as DisplayCategory }))}
                                            >
                                                <option>Adult</option><option>Junior</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                value={draft?.email || ''}
                                                onChange={e => setDraft(d => ({ ...(d as any), email: e.target.value }))}
                                                placeholder="name@example.com"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                value={draft?.phone || ''}
                                                onChange={e => setDraft(d => ({ ...(d as any), phone: e.target.value }))}
                                                placeholder="+64 ..."
                                            />
                                        </td>
                                        <td>
                                            <input
                                                value={draft?.boat || ''}
                                                onChange={e => setDraft(d => ({ ...(d as any), boat: e.target.value }))}
                                                placeholder="Boat or Team name"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="date"
                                                value={draft?.paid_on || todayISO()}
                                                onChange={e => setDraft(d => ({ ...(d as any), paid_on: e.target.value }))}
                                            />
                                        </td>
                                        <td>{feeForDraft(draft)}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <button type="button" className="btn primary" onClick={saveEdit}>Save</button>
                                            <button type="button" className="btn" onClick={cancelEdit} style={{ marginLeft: 8 }}>Cancel</button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 && <tr><td colSpan={9} className="muted">No competitors yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    )
}

// Tiny helper so we can lint-disable no-alert if needed, and for consistency with custom modals
function confirmWindow(msg: string) {
    return window.confirm(msg)
}
