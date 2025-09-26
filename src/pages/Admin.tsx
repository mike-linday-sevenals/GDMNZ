import { useEffect, useState } from 'react'
import { fetchSettings } from '@/services/api'
import { STORE_KEYS } from '@/utils'

function loadLocal<T>(k:string, f:T):T{ try{const r=localStorage.getItem(k); return r?JSON.parse(r):structuredClone(f)}catch{ return structuredClone(f)} }
function saveLocal<T>(k:string, v:T){ localStorage.setItem(k, JSON.stringify(v)) }

export default function Admin(){
  const [s, setS] = useState<any>(null)
  const [branding, setBranding] = useState<any>(loadLocal(STORE_KEYS.branding, {logoDataUrl:null}))
  const [sponsors, setSponsors] = useState<any>(loadLocal(STORE_KEYS.sponsors, {overall:[]}))

  useEffect(()=>{ (async()=> setS(await fetchSettings()))() }, [])

  function saveSettings(){
    alert('Settings saved (local parts only in this React build). To persist DB fields, wire up update calls.')
  }

  function onLogoChange(e: any){
    const f = e.target.files?.[0]; if(!f) return;
    const reader = new FileReader(); reader.onload = (ev)=>{
      const b = { ...branding, logoDataUrl: ev.target?.result }
      setBranding(b); saveLocal(STORE_KEYS.branding, b)
      const img = document.querySelector('header .brand img') as HTMLImageElement | null
      if (img) img.src = String(ev.target?.result || '')
    }; reader.readAsDataURL(f)
  }

  function addSponsor(v: string){
    const cur = { ...sponsors }; cur.overall.push(v); setSponsors(cur); saveLocal(STORE_KEYS.sponsors, cur)
  }
  function removeSponsor(i:number){
    const cur = { ...sponsors }; cur.overall.splice(i,1); setSponsors(cur); saveLocal(STORE_KEYS.sponsors, cur)
  }

  if(!s) return null

  return (
    <section className="card">
      <h2>Admin</h2>
      <div className="grid two">
        <div>
          <h3>Event Settings</h3>
          <p className="sub">These fields mirror the DB where applicable. Fees & decimals are local-only for now.</p>
          <div className="row">
            <div className="col-6">
              <label>Early-bird cutoff (DB)</label>
              <div className="pad-around" style={{border:0,boxShadow:'none',background:'transparent',padding:0}}>
                <input type="date" defaultValue={s.earlyBirdCutoff} />
              </div>
            </div>
            <div className="col-3"><label>Adult Early (local)</label><input type="number" step="1" defaultValue={s.fees.Adult.early}/></div>
            <div className="col-3"><label>Adult Standard (local)</label><input type="number" step="1" defaultValue={s.fees.Adult.standard}/></div>
            <div className="col-3"><label>Junior Early (local)</label><input type="number" step="1" defaultValue={s.fees.Junior.early}/></div>
            <div className="col-3"><label>Junior Standard (local)</label><input type="number" step="1" defaultValue={s.fees.Junior.standard}/></div>
            <div className="col-3"><label>Decimals (local)</label><input type="number" step="1" min="0" max="3" defaultValue={s.decimals}/></div>
            <div className="col-3"><label>Comp Mode (DB)</label><select defaultValue={s.compMode}><option value="weight">Weight</option><option value="measure">Measure (length)</option></select></div>
            <div className="col-3"><label>Show Time? (DB)</label><select defaultValue={s.showTime?'1':'0'}><option value="1">Yes</option><option value="0">No</option></select></div>
            <div className="col-3"><label>Require Time? (DB)</label><select defaultValue={s.requireTime?'1':'0'}><option value="1">Yes</option><option value="0">No</option></select></div>
            <div className="col-3"><label>Prize Mode (local)</label><select defaultValue={s.prizeMode}><option value="combined">Combined</option><option value="split">Split Adult/Junior</option></select></div>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={saveSettings}>Save Settings</button>
          </div>
        </div>
        <div>
          <h3>Branding (local)</h3>
          <div className="grid">
            <div><label>Upload Logo (PNG/JPG)</label><input type="file" onChange={onLogoChange} accept="image/*"/></div>
            <div className="sub">Logo is stored locally in this browser for offline use.</div>
          </div>
          <hr style={{border:'none',borderTop:'1px solid var(--border)',margin:'12px 0'}}/>
          <h3>Overall Sponsors (local)</h3>
          <div className="actions">
            <input id="sponsor-input" placeholder="Add sponsor name"/>
            <button className="btn" onClick={()=>{
              const v = (document.getElementById('sponsor-input') as HTMLInputElement).value.trim()
              if(!v) return; addSponsor(v); (document.getElementById('sponsor-input') as HTMLInputElement).value=''
            }}>Add Sponsor</button>
          </div>
          <div className="flex" style={{marginTop:8}}>
            {(sponsors.overall||[]).map((n:string,i:number)=>(
              <span className="pill" key={i}>{n} <button className="btn danger" style={{padding:'4px 8px'}} onClick={()=>removeSponsor(i)}>remove</button></span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
