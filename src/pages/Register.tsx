import { useEffect, useMemo, useState } from 'react'
import { addCompetitor, deleteCompetitors, fetchSettings, listCompetitors } from '@/services/api'
import type { Competitor, Settings } from '@/types'
import { computeFee, formatNZ, todayISO } from '@/utils'

export default function Register(){
  const [settings, setSettings] = useState<Settings | null>(null)
  const [rows, setRows] = useState<Competitor[]>([])
  const [selected, setSelected] = useState<Set<Competitor['id']>>(new Set())

  const [name, setName] = useState('')
  const [category, setCategory] = useState<'Adult'|'Junior'>('Adult')
  const [paidOn, setPaidOn] = useState(todayISO())
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [boat, setBoat] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(()=>{ (async()=>{
    setSettings(await fetchSettings())
    setRows(await listCompetitors())
  })() }, [])

  const fee = useMemo(()=> settings ? computeFee(settings, category, paidOn) : null, [settings, category, paidOn])

  async function save(keepBoat:boolean){
    if(!settings){ alert('Settings not loaded yet'); return }
    if(!name.trim()){ alert('Full Name is required'); return }
    if(!paidOn){ alert('Payment Date is required'); return }
    const payload: Omit<Competitor,'id'|'created_at'> = {
      full_name: name.trim(),
      category: category === 'Adult' ? 'adult' : 'junior',
      paid_on: paidOn,
      email: email.trim() || null,
      phone: phone.trim() || null,
      boat: boat.trim() || null
    }
    await addCompetitor(payload)
    setRows(await listCompetitors())
    setName(''); setEmail(''); setPhone(''); setNotes('')
    if(!keepBoat) setBoat('')
  }

  async function removeSelected(){
    if(selected.size===0) { alert('Select at least one'); return }
    if(!confirm('Delete selected competitors? This will also remove their fish.')) return
    await deleteCompetitors(Array.from(selected))
    setRows(await listCompetitors())
    setSelected(new Set())
  }

  const [search, setSearch] = useState('')
  const filtered = rows.filter(r => !search || [r.full_name, r.email, r.boat].join(' ').toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <section className="card">
        <h2>Competition Registration</h2>
        <div className="row">
          <div className="col-6"><label>Full Name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="First Last" required/></div>
            <div className="col-3"><label>Category *</label>
              <select value={category} onChange={e=>setCategory(e.target.value as 'Adult'|'Junior')}>
              <option>Adult</option><option>Junior</option>
            </select>
          </div>
          <div className="col-3">
            <label>Payment Date *</label>
            <input type="date" value={paidOn} onChange={e=>setPaidOn(e.target.value)} />
          </div>
          <div className="col-6"><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></div>
          <div className="col-3"><label>Phone</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+64 ..."/></div>
          <div className="col-3"><label>Boat / Team</label><input value={boat} onChange={e=>setBoat(e.target.value)} placeholder="Boat or Team name"/></div>
          <div className="col-12"><label>Notes (local only)</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Anything we should know... (not stored in DB)"/></div>
        </div>
        <div className="actions" style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'8px 12px',marginTop:6}}>
          <span className="pill">Fee: <strong style={{marginLeft:6}}>{fee!=null?`$${fee.toFixed(0)}`:'$0'}</strong></span>
          <div style={{flex:'1 1 auto'}} />
          <button className="btn primary" onClick={()=>save(false)}>Register Competitor</button>
          <button className="btn accent" onClick={()=>save(true)}>Save &amp; Register Another (same boat)</button>
          <button className="btn" onClick={()=>{ setName(''); setEmail(''); setPhone(''); setBoat(''); setNotes(''); }}>Clear</button>
          {settings && (
            <div id="r-fee-rule" style={{flex:'1 0 100%',order:2,marginTop:6,lineHeight:1.3}}>
              Early-bird cutoff: <span className="badge">{formatNZ(settings.earlyBirdCutoff)}</span> —
              {' '}Adult ${settings.fees.Adult.early} → ${settings.fees.Adult.standard} after; Junior ${settings.fees.Junior.early} → ${settings.fees.Junior.standard}.
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Registered Competitors</h3>
        <div className="actions">
          <input placeholder="Search by name / email / boat..." value={search} onChange={e=>setSearch(e.target.value)} />
          <button className="btn" onClick={()=>setRows(r=>[...r].sort((a,b)=>a.full_name.localeCompare(b.full_name)))}>Sort A → Z</button>
          <button className="btn danger" onClick={removeSelected}>Delete Selected</button>
        </div>
        <div style={{overflow:'auto', marginTop:10}}>
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" onChange={(e)=>{
                  if((e.target as HTMLInputElement).checked) setSelected(new Set(filtered.map(x=>x.id)))
                  else setSelected(new Set())
                }}/></th>
                <th>Name</th><th>Category</th><th>Email</th><th>Phone</th>
                <th>Boat/Team</th><th>Payment Date</th><th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r=>{
                const dispCat = r.category==='adult' ? 'Adult' : 'Junior'
                const feeRow = settings ? computeFee(settings, dispCat, r.paid_on) : null
                return (
                  <tr key={String(r.id)}>
                    <td><input type="checkbox" checked={selected.has(r.id)} onChange={(e)=>{
                      const s = new Set(selected); if((e.target as HTMLInputElement).checked) s.add(r.id); else s.delete(r.id); setSelected(s)
                    }}/></td>
                    <td>{r.full_name}</td>
                    <td>{dispCat}</td>
                    <td>{r.email||''}</td>
                    <td>{r.phone||''}</td>
                    <td>{r.boat||''}</td>
                    <td className="nz-date">{formatNZ(r.paid_on)}</td>
                    <td>{feeRow!=null ? ('$'+feeRow.toFixed(0)) : ''}</td>
                  </tr>
                )
              })}
              {filtered.length===0 && <tr><td colSpan={8} className="muted">No competitors yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
