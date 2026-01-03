// src/pages/Data.tsx
import { useRef, useState } from 'react'
import { STORE_KEYS } from '@/utils'
import { client as supabase } from '@/services/api'

/* ---------------- local helpers for existing local-only export ---------------- */
function loadLocal<T>(k: string, f: T): T { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : structuredClone(f) } catch { return structuredClone(f) } }
function saveLocal<T>(k: string, v: T) { localStorage.setItem(k, JSON.stringify(v)) }

/* ---------------- types incoming JSON (loose/defensive) ---------------- */
type ImportJson = {
    generatedAt?: string
    settings?: any
    species?: string[]
    prizes?: Record<string, any>   // { "Snapper": { combined:{1:{desc,sponsor}}, adult:{}, junior:{} }, ... }
    competitors?: Array<{
        id?: string
        name: string
        category: string             // "Adult" | "Junior"
        email?: string
        phone?: string
        boat?: string
        paymentDate?: string         // YYYY-MM-DD
    }>
    sponsors?: { overall?: Array<{ name: string, order?: number, blurb?: string }> }
    // entries?: any[]             // fish import optional; see note at bottom
}

/* ---------------- tiny utils ---------------- */
const norm = (s?: string | null) => (s ?? '').trim()
const title = (s?: string) => s ? s.replace(/\s+/g, ' ').trim() : ''
const toCat = (x?: string) => (String(x || '').toLowerCase() === 'junior' ? 'junior' : 'adult')

/* ---------------- DB helpers (copied here to avoid API refactor) ---------------- */
async function getCurrentCompetitionId(): Promise<string> {
    if (!supabase) return 'local-only'
    const today = new Date().toISOString().slice(0, 10)
    let { data, error } = await supabase
        .from('competition').select('id, starts_at, ends_at')
        .lte('starts_at', today).gte('ends_at', today)
        .order('starts_at', { ascending: false }).limit(1)
    if (error) throw error
    if (data?.length) return data[0].id

    const { data: latest, error: err2 } = await supabase
        .from('competition').select('id')
        .order('starts_at', { ascending: false }).limit(1)
    if (err2) throw err2
    if (!latest?.length) throw new Error('No competitions found')
    return latest[0].id
}

async function getSettingsRowId(): Promise<string> {
    if (!supabase) return 'local-only'
    const { data, error } = await supabase.from('settings').select('id').limit(1).maybeSingle()
    if (error) throw error
    if (data?.id) return data.id
    const { data: created, error: insErr } = await supabase.from('settings').insert({}).select('id').single()
    if (insErr) throw insErr
    return created.id
}

async function ensureSponsorId(name: string): Promise<string | null> {
    if (!supabase) return null
    const nm = title(name)
    if (!nm) return null
    const { data: found, error: selErr } = await supabase
        .from('sponsors').select('id').ilike('name', nm).maybeSingle()
    if (selErr && selErr.code !== 'PGRST116') throw selErr
    if (found?.id) return found.id
    const { data: created, error: insErr } = await supabase
        .from('sponsors').insert({ name: nm }).select('id').single()
    if (insErr) throw insErr
    return created.id
}

async function linkSponsorToCompetition(sponsor_id: string, competition_id: string, display_order?: number | null, blurb?: string | null) {
    if (!supabase) return
    const payload: any = { competition_id, sponsor_id, display_order: display_order ?? null, blurb: blurb ?? null }
    const { error } = await supabase.from('competition_sponsor').insert(payload)
    if (error && error.code !== '23505') throw error  // ignore dup if you add a unique constraint
}

/* ---------------- Importer core ---------------- */
async function importToDatabase(file: File, log: (s: string) => void) {
    if (!supabase) { alert('Supabase is not configured in this environment.'); return }
    const text = await file.text()
    const json: ImportJson = JSON.parse(text)

    /* SETTINGS */
    try {
        log('• Updating settings…')
        const rowId = await getSettingsRowId()
        const s = json.settings || {}
        const compMode = s.compMode ?? (s.weighMethod === 'longest' ? 'measure' : 'weight')
        const patch: any = {
            early_bird_cutoff: s.earlyBirdCutoff ?? null,
            comp_mode: compMode,
            prize_mode: s.prizeMode ?? 'combined',
            time_visible: !!s.showTime,
            time_required: !!s.requireTime,
        }
        const { data: upd, error } = await supabase.from('settings').update(patch).eq('id', rowId).select('id')
        if (error || !upd?.length) throw error || new Error('0 rows updated (RLS?)')
        log('  ✓ settings updated')
    } catch (e: any) { log(`  ✗ settings: ${e?.message || e}`) }

    /* SPECIES */
    const nameToId = new Map<string, number>()
    try {
        log('• Upserting species…')
        const wanted = (json.species ?? []).map(title).filter(Boolean)
        const { data: current, error } = await supabase.from('species').select('id,name')
        if (error) throw error
        current?.forEach(r => nameToId.set(title(r.name), r.id))
        for (const nm of wanted) {
            if (nameToId.has(nm)) continue
            const { data: created, error: insErr } = await supabase.from('species').insert({ name: nm }).select('id').single()
            if (insErr) throw insErr
            nameToId.set(nm, created.id)
        }
        log(`  ✓ species ready (${nameToId.size} total)`)
    } catch (e: any) { log(`  ✗ species: ${e?.message || e}`) }

    /* PRIZES */
    try {
        const prizes = json.prizes || {}
        const compId = await getCurrentCompetitionId()
        let count = 0
        log('• Importing prizes…')
        for (const [spName, cats] of Object.entries(prizes)) {
            const sid = nameToId.get(title(spName))
            if (!sid) { log(`  • skipped prizes for unknown species "${spName}"`); continue }
            for (const catKey of ['combined', 'adult', 'junior'] as const) {
                const block = (cats?.[catKey] || {}) as Record<string, { desc?: string, label?: string, sponsor?: string | null }>
                const ranks = Object.keys(block).map(n => parseInt(n, 10)).filter(n => n > 0).sort((a, b) => a - b)
                for (const rank of ranks) {
                    const cell = block[String(rank)]
                    const sponsorText = norm(cell?.sponsor)
                    let sponsor_id: string | null = null
                    if (sponsorText) {
                        sponsor_id = await ensureSponsorId(sponsorText)
                        if (sponsor_id) await linkSponsorToCompetition(sponsor_id, compId, null, null)
                    }
                    const payload: any = {
                        rank,
                        label: norm(cell?.label) || norm(cell?.desc) || null,
                        species_id: sid,
                        sponsor: sponsorText || null,     // display text
                        sponsor_id,
                        for_category: catKey,
                        active: true
                    }
                    const { error } = await supabase.from('prize').insert(payload)
                    if (error) throw error
                    count++
                }
            }
        }
        log(`  ✓ prizes inserted: ${count}`)
    } catch (e: any) { log(`  ✗ prizes: ${e?.message || e}`) }

    /* COMPETITORS */
    try {
        const incoming = (json.competitors ?? []).filter(c => title(c.name))
        if (!incoming.length) { log('• Competitors: none in file'); }
        else {
            log(`• Importing competitors (${incoming.length})…`)
            const { data: current, error } = await supabase.from('competitor').select('id,full_name,category,boat')
            if (error) throw error
            const key = (n: string, cat: string, b?: string) => `${title(n)}|${toCat(cat)}|${title(b || '')}`
            const existing = new Set((current || []).map(r => key(r.full_name, r.category, r.boat)))
            let added = 0, skipped = 0
            for (const c of incoming) {
                const k = key(c.name, c.category, c.boat)
                if (existing.has(k)) { skipped++; continue }
                const row: any = {
                    full_name: title(c.name),
                    category: toCat(c.category),
                    boat: norm(c.boat) || null,
                    email: norm(c.email) || null,
                    phone: norm(c.phone) || null,
                    paid_on: norm(c.paymentDate) || null,
                }
                const { error: insErr } = await supabase.from('competitor').insert(row)
                if (insErr) throw insErr
                added++
            }
            log(`  ✓ competitors added: ${added} (skipped ${skipped})`)
        }
    } catch (e: any) { log(`  ✗ competitors: ${e?.message || e}`) }

    /* SPONSORS (overall list → link to current competition) */
    try {
        const overall = json.sponsors?.overall ?? []
        if (!overall.length) { log('• Sponsors: none in file') }
        else {
            const compId = await getCurrentCompetitionId()
            log(`• Importing sponsors (${overall.length})…`)
            for (const s of overall) {
                const sid = await ensureSponsorId(s.name)
                if (sid) await linkSponsorToCompetition(sid, compId, s.order ?? null, s.blurb ?? null)
            }
            log('  ✓ sponsors imported/linked')
        }
    } catch (e: any) { log(`  ✗ sponsors: ${e?.message || e}`) }

    log('Done.')
}

/* ---------------- UI (local export + local import + DB import) ---------------- */
export default function Data() {
    const localFileRef = useRef<HTMLInputElement>(null)
    const dbFileRef = useRef<HTMLInputElement>(null)
    const [log, setLog] = useState<string[]>([])
    const addLog = (s: string) => setLog(x => [...x, s])

    function exportAll() {
        const data = {
            generatedAt: new Date().toISOString(),
            prizes: loadLocal(STORE_KEYS.prizes, {}),
            branding: loadLocal(STORE_KEYS.branding, { logoDataUrl: null }),
            sponsors: loadLocal(STORE_KEYS.sponsors, { overall: [] }),
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `wosc-local-export-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    }

    function importLocal(file?: File) {
        if (!file) return alert('Choose a file first.')
        if (!confirm('Importing will overwrite local data. Continue?')) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(String(ev.target?.result || '{}'))
                if (data.prizes) saveLocal(STORE_KEYS.prizes, data.prizes)
                if (data.branding) saveLocal(STORE_KEYS.branding, data.branding)
                if (data.sponsors) saveLocal(STORE_KEYS.sponsors, data.sponsors)
                alert('Local import completed.')
            } catch (e: any) { alert('Import failed: ' + e.message) }
        }
        reader.readAsText(file)
    }

    async function importDb() {
        const f = dbFileRef.current?.files?.[0]
        if (!f) return alert('Choose a file first.')
        if (!confirm('Import to DATABASE? This writes to settings/species/prize/competitor/sponsors.')) return
        setLog([])
        try { await importToDatabase(f, addLog) }
        catch (e: any) { addLog('Fatal error: ' + (e?.message || e)) }
    }

    function clearAll() {
        if (!confirm('Really clear local data (prizes/branding/sponsors)?')) return
            ;[STORE_KEYS.prizes, STORE_KEYS.branding, STORE_KEYS.sponsors].forEach(k => localStorage.removeItem(k))
        alert('Local data cleared.')
    }

    return (
        <section className="card">
            <h2>Import / Export</h2>
            <p className="sub">Use <strong>Import to Database</strong> to ingest into Supabase. Local import/export remains the same.</p>

            <div className="grid two">
                <div>
                    <h3>Export Local Data</h3>
                    <div className="actions"><button className="btn primary" onClick={exportAll}>Export JSON</button></div>
                </div>
                <div>
                    <h3>Import Local Data</h3>
                    <p className="sub">Overwrites local-only prizes/branding/sponsors.</p>
                    <input ref={localFileRef} type="file" accept="application/json" />
                    <div className="actions"><button className="btn warn" onClick={() => importLocal(localFileRef.current?.files?.[0])}>Import (local)</button></div>
                </div>
            </div>

            <hr className="divider" />

            <h3>Import to Database</h3>
            <p className="sub">Writes to <code>settings, species, prize, competitor, sponsors, competition_sponsor</code>. Ensure RLS policies are in place.</p>
            <input ref={dbFileRef} type="file" accept="application/json" />
            <div className="actions"><button className="btn accent" onClick={importDb}>Import (to DB)</button></div>

            {log.length > 0 && (
                <>
                    <hr className="divider" />
                    <pre className="pad-around" style={{ whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>
                </>
            )}

            <hr className="divider" />
            <h3>Danger Zone</h3>
            <div className="actions"><button className="btn danger" onClick={clearAll}>Clear LOCAL Data</button></div>
        </section>
    )
}
