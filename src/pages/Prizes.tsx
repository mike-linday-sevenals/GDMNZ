import { useEffect, useState } from 'react'
import { fetchSettings, listSpecies } from '@/services/api'
import { STORE_KEYS } from '@/utils'

function loadLocal<T>(k:string, f:T):T{ try{const r=localStorage.getItem(k); return r?JSON.parse(r):structuredClone(f)}catch{ return structuredClone(f)} }
function saveLocal<T>(k:string, v:T){ localStorage.setItem(k, JSON.stringify(v)) }
const cssId = (s:string)=> s.toLowerCase().replace(/[^a-z0-9]+/g,'-')

export default function Prizes(){
  const [settings, setSettings] = useState<any>(null)
  const [species, setSpecies] = useState<string[]>([])
  const [prizes, setPrizes] = useState<any>({})

  useEffect(()=>{ (async()=>{
    setSettings(await fetchSettings())
    setSpecies((await listSpecies()).map(s=>s.name))
    const P = loadLocal(STORE_KEYS.prizes, {})
    setPrizes(P)
  })() }, [])

  function saveMode(){
    alert('Prize mode saved (local).')
  }

  function addPrize(name:string, key:'combined'|'adult'|'junior'){
    setPrizes((prev:any)=>{
      const P = {...prev}; P[name] ??= {}; P[name][key] ??= {}
      const next = (Object.keys(P[name][key]).map(n=>parseInt(n)).reduce((a,b)=>Math.max(a,b),0) || 0) + 1
      P[name][key][next] = {desc:'', value:null, sponsor:''}
      saveLocal(STORE_KEYS.prizes, P); return P
    })
  }
  function saveAll(){
    saveLocal(STORE_KEYS.prizes, prizes); alert('Prizes saved (local).')
  }
  function removePrize(name:string, key:string, place:number){
    setPrizes((prev:any)=>{
      const P = {...prev}; if(P[name]?.[key]) delete P[name][key][place]
      saveLocal(STORE_KEYS.prizes, P); return P
    })
  }

  return (
    <section className="card">
      <h2>Prize Setup <span className="badge">Local for now</span></h2>
      <p className="sub">Admin note: This screen currently saves prizes locally. Next stage: map to Supabase <code>prize</code> table.</p>
      <div className="actions">
        <span>Mode:</span>
        <label className="switch"><input type="radio" name="pmode" defaultChecked={settings?.prizeMode==='combined'} value="combined" /> <span>Combined</span></label>
        <label className="switch"><input type="radio" name="pmode" defaultChecked={settings?.prizeMode==='split'} value="split" /> <span>Split: Adult & Junior</span></label>
        <div style={{flex:'1 1 auto'}} />
        <button className="btn" onClick={saveMode}>Save Mode</button>
      </div>

      <div className="grid">
        {species.map(s => {
          const node = prizes[s] || {}
          const mode = settings?.prizeMode || 'combined'
          return (
            <details key={s} open>
              <summary><strong>{s}</strong> <span className="muted">— {/* count */}</span></summary>
              <div style={{margin:'10px 0'}}>
                {mode==='combined' ? (
                  <PrizeTable name={s} map={node.combined||{}} onAdd={()=>addPrize(s,'combined')} onRemove={(place)=>removePrize(s,'combined',place)} />
                ) : (
                  <>
                    <h4>Adult</h4>
                    <PrizeTable name={s} map={node.adult||{}} onAdd={()=>addPrize(s,'adult')} onRemove={(place)=>removePrize(s,'adult',place)} />
                    <h4>Junior</h4>
                    <PrizeTable name={s} map={node.junior||{}} onAdd={()=>addPrize(s,'junior')} onRemove={(place)=>removePrize(s,'junior',place)} />
                  </>
                )}
              </div>
            </details>
          )
        })}
      </div>

      <div className="actions" style={{marginTop:10}}>
        <button className="btn" onClick={saveAll}>Save All</button>
      </div>
    </section>
  )
}

function PrizeTable({name,map,onAdd,onRemove}:{name:string;map:any;onAdd:()=>void;onRemove:(place:number)=>void}){
  const keys = Object.keys(map).map(k=>parseInt(k)).sort((a,b)=>a-b)
  return (
    <div id={`area-${cssId(name)}`}>
      <table>
        <thead><tr><th>Place</th><th>Prize (description)</th><th>Value</th><th>Sponsor</th><th></th></tr></thead>
        <tbody>
          {keys.map(place => (
            <tr key={place}>
              <td><input defaultValue={place} className="pz-place" type="number" min={1} step={1} /></td>
              <td><input defaultValue={map[place]?.desc||''} className="pz-desc" placeholder="e.g., $200 voucher" /></td>
              <td><input defaultValue={map[place]?.value??''} className="pz-val" type="number" step="0.01" placeholder="e.g., 200" /></td>
              <td><input defaultValue={map[place]?.sponsor||''} className="pz-sponsor" placeholder="Sponsor name" /></td>
              <td><button className="btn danger" onClick={()=>onRemove(place)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions" style={{marginTop:10}}>
        <button className="btn accent" onClick={onAdd}>Add Prize</button>
      </div>
    </div>
  )
}
