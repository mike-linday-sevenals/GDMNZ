// src/pages/admin/Sponsors.tsx
import { useEffect, useState } from 'react'
import { listSponsors, createSponsor, updateSponsor, deleteSponsor } from '@/services/api'

export default function SponsorsAdmin() {
  const [items, setItems] = useState<{id:string,name:string}[]>([])
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  async function refresh(){ setItems(await listSponsors()) }
  useEffect(()=>{ refresh() }, [])

  async function add(){
    if(!newName.trim()) return
    setSaving(true)
    try{
      const s = await createSponsor(newName.trim())
      setItems([ ...items, s ].sort((a,b)=>a.name.localeCompare(b.name)))
      setNewName('')
    } finally { setSaving(false) }
  }

  async function rename(id:string, name:string){
    setSaving(true)
    try{
      const s = await updateSponsor(id, name)
      setItems(items.map(i=>i.id===id?s:i))
    } finally { setSaving(false) }
  }

  async function remove(id:string){
    if(!confirm('Delete this sponsor? Prizes linked to it will lose the reference.')) return
    setSaving(true)
    try{
      await deleteSponsor(id)
      setItems(items.filter(i=>i.id!==id))
    } finally { setSaving(false) }
  }

  return (
    <section className="card">
      <h2>Sponsors</h2>
      <div className="row">
        <div className="col-8">
          <input
            placeholder="New sponsor name"
            value={newName}
            onChange={e=>setNewName(e.target.value)}
          />
        </div>
        <div className="col-4">
          <button className="btn primary" disabled={saving} onClick={add}>Add sponsor</button>
        </div>
      </div>

      <div className="list">
        {items.map(i=>(
          <div key={i.id} className="row" style={{alignItems:'center', gap:12, margin:'8px 0'}}>
            <input
              value={i.name}
              onChange={e=>rename(i.id, e.target.value)}
            />
            <button className="btn" onClick={()=>remove(i.id)}>Delete</button>
          </div>
        ))}
        {items.length===0 && <div className="muted">No sponsors yet.</div>}
      </div>
    </section>
  )
}
