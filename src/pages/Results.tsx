import { useEffect, useMemo, useState } from 'react'
import { fetchSettings, listFishJoined, deleteFish, listSpecies } from '@/services/api'
import { fmt, formatNZ } from '@/utils'
import type { FishJoined, Species } from '@/types'

export default function Results(){
  const [settings, setSettings] = useState<any>(null)
  const [rows, setRows] = useState<FishJoined[]>([])
  const [species, setSpecies] = useState<Species[]>([])

  useEffect(()=>{ (async()=>{
    setSettings(await fetchSettings())
    setRows(await listFishJoined())
    setSpecies(await listSpecies())
  })() }, [])

  const [q, setQ] = useState('')
  const [sp, setSp] = useState('All')
  const filtered = useMemo(()=>{
    const ql = q.toLowerCase()
    return rows.filter(r => (sp==='All' || r.species?.name===sp))
               .filter(r => !ql || [r.competitor?.full_name, r.species?.name].join(' ').toLowerCase().includes(ql))
  }, [rows, q, sp])

  const [selected, setSelected] = useState<Set<string|number>>(new Set())

  function sortByMetric(){
    const cmp = (a:FishJoined, b:FishJoined) => {
      const va = settings.compMode==='measure' ? (a.length_cm||0) : (a.weight_kg||0)
      const vb = settings.compMode==='measure' ? (b.length_cm||0) : (b.weight_kg||0)
      return vb - va
    }
    setRows(r => [...r].sort(cmp))
  }
  function sortByTime(){
    setRows(r => [...r].sort((a,b)=> String(a.time_caught||'').localeCompare(String(b.time_caught||'')) ))
  }

  async function removeSelected(){
    if(selected.size===0){ alert('Select at least one row'); return }
    if(!confirm('Delete selected entries?')) return
    await deleteFish(Array.from(selected))
    setRows(await listFishJoined())
    setSelected(new Set())
  }

  return (
    <section className="card">
      <h2>Results</h2>
      <div className="grid two">
        <div>
          <label>Filter by species</label>
          <select value={sp} onChange={e=>setSp(e.target.value)}>
            <option>All</option>
            {species.map(s => <option key={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label>Search</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Name / notes..." />
        </div>
      </div>
      <div className="actions">
        <button className="btn" onClick={sortByMetric}>Sort by Weight/Length</button>
        <button className="btn" onClick={sortByTime}>Sort by Time</button>
        <button className="btn danger" onClick={removeSelected}>Delete Selected</button>
      </div>
      <div style={{overflow:'auto', marginTop:10}}>
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" onChange={(e)=>{
                if((e.target as HTMLInputElement).checked) setSelected(new Set(filtered.map(r=>r.id)))
                else setSelected(new Set())
              }}/></th>
              <th>Name</th><th>Category</th><th>Species</th>
              <th>{settings?.compMode==='measure'?'Length (cm)':'Weight (kg)'}</th>
              <th>{settings?.compMode==='measure'?'Weight (kg)':'Length (cm)'} <span className="muted">(opt)</span></th>
              <th>Date</th><th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={String(r.id)}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={(e)=>{
                  const s = new Set(selected); if((e.target as HTMLInputElement).checked) s.add(r.id); else s.delete(r.id); setSelected(s)
                }}/></td>
                <td>{r.competitor?.full_name || ''}</td>
                <td><span className={`cat-badge cat-${(r.competitor?.category==='adult'?'Adult':'Junior')}`}>{r.competitor?.category==='adult'?'Adult':'Junior'}</span></td>
                <td>{r.species?.name || ''}</td>
                <td>{settings?.compMode==='measure' ? (r.length_cm!=null?fmt(r.length_cm,1):'') : (r.weight_kg!=null?fmt(r.weight_kg,settings?.decimals||2):'')}</td>
                <td>{settings?.compMode==='measure' ? (r.weight_kg!=null?fmt(r.weight_kg,settings?.decimals||2):'') : (r.length_cm!=null?fmt(r.length_cm,1):'')}</td>
                <td className="nz-date">{r.time_caught ? formatNZ(r.time_caught.slice(0,10)) : ''}</td>
                <td>{r.time_caught ? new Date(r.time_caught).toTimeString().slice(0,5) : ''}</td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={8} className="muted">No results yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
