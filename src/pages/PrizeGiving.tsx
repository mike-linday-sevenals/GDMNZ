import { useEffect, useState } from 'react'
import { fetchSettings, listFishJoined, listSpecies } from '@/services/api'
import { STORE_KEYS, fmt } from '@/utils'

function loadLocal<T>(k:string, f:T):T{ try{const r=localStorage.getItem(k); return r?JSON.parse(r):structuredClone(f)}catch{ return structuredClone(f)} }

export default function PrizeGiving(){
  const [settings, setSettings] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [species, setSpecies] = useState<string[]>([])

  useEffect(()=>{ (async()=>{
    setSettings(await fetchSettings())
    setEntries(await listFishJoined())
    setSpecies((await listSpecies()).map(s=>s.name))
  })() }, [])

  const P = loadLocal<any>(STORE_KEYS.prizes, {})

  function parseWeighIn(ts?: string | null){
    if (!ts) return Number.POSITIVE_INFINITY
    const n = Date.parse(String(ts)); return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n
  }
  function rankFor(arr:any[]){
    const s = settings || { compMode:'weight' }
    return arr.slice().sort((a,b)=>{
      const pa = s.compMode==='measure' ? (a.length_cm||0) : (a.weight_kg||0)
      const pb = s.compMode==='measure' ? (b.length_cm||0) : (b.weight_kg||0)
      if (pb !== pa) return pb - pa
      const ta = parseWeighIn(a.created_at)
      const tb = parseWeighIn(b.created_at)
      return ta - tb
    })
  }

  return (
    <section className="card">
      <h2>Prize Giving</h2>
      <p className="sub">Mode: <strong>{settings?.prizeMode==='combined'?'Combined':'Split (Adult & Junior)'}</strong> — shown in reverse order for announcing (3rd → 1st).</p>
      {species.map(s=>{
        const all = entries.filter(e=>e.species?.name===s)
        const node = P[s] || {}
        if((settings?.prizeMode||'combined')==='combined'){
          const pz = node.combined || {}
          const places = Object.keys(pz).map(n=>parseInt(n)).sort((a,b)=>b-a)
          if(places.length===0) return <section className="card" key={s}><h3>{s}</h3><p className="muted">No prizes configured.</p></section>
          const ranked = rankFor([...all]).slice(0, Math.max(...places))
          return <SpeciesBlock key={s} name={s} label="Combined" places={places} ranked={ranked} prizeMap={pz} compMode={settings?.compMode||'weight'} />
        }else{
          const pzA = node.adult || {}; const pzJ = node.junior || {}
          const placesA = Object.keys(pzA).map(n=>parseInt(n)).sort((a,b)=>b-a)
          const placesJ = Object.keys(pzJ).map(n=>parseInt(n)).sort((a,b)=>b-a)
          const rankedA = rankFor(all.filter(e=>e.competitor?.category==='adult')).slice(0, Math.max(0,...placesA))
          const rankedJ = rankFor(all.filter(e=>e.competitor?.category==='junior')).slice(0, Math.max(0,...placesJ))
          return (
            <div key={s}>
              <section className="card"><h3>{s} — Adult</h3>{placesA.length?<Table places={placesA} ranked={rankedA} pz={pzA} compMode={settings?.compMode||'weight'} showCat={false}/>:<p className="muted">No Adult prizes.</p>}</section>
              <section className="card"><h3>{s} — Junior</h3>{placesJ.length?<Table places={placesJ} ranked={rankedJ} pz={pzJ} compMode={settings?.compMode||'weight'} showCat={false}/>:<p className="muted">No Junior prizes.</p>}</section>
            </div>
          )
        }
      })}
    </section>
  )
}

function SpeciesBlock({name,label,places,ranked,prizeMap,compMode}:{name:string;label:string;places:number[];ranked:any[];prizeMap:any;compMode:'weight'|'measure'}){
  return (
    <section className="card">
      <h3>{name} — {label}</h3>
      <Table places={places} ranked={ranked} pz={prizeMap} compMode={compMode} showCat />
    </section>
  )
}

function Table({places,ranked,pz,compMode,showCat}:{places:number[];ranked:any[];pz:any;compMode:'weight'|'measure';showCat:boolean}){
  return (
    <table>
      <thead><tr><th>Place</th><th>Competitor</th>{showCat && <th>Category</th>}<th>{compMode==='measure'?'Length (cm)':'Weight (kg)'}</th><th>Prize</th><th>Sponsor</th></tr></thead>
      <tbody>
        {places.map(place=>{
          const c = ranked[place-1]
          if(!c) return <tr key={place}><td>{place}</td><td colSpan={showCat?4:3} className="muted">— no qualified entry —</td></tr>
          const prize = pz[place] || {}
          const catBadge = <span className={`cat-badge cat-${c.competitor?.category==='adult'?'Adult':'Junior'}`}>{c.competitor?.category==='adult'?'Adult':'Junior'}</span>
          const metric = compMode==='measure' ? (c.length_cm!=null?fmt(c.length_cm,1):'') : (c.weight_kg!=null?fmt(c.weight_kg,2):'')
          const juniorBeatingAdult = (c.competitor?.category==='junior' && showCat)
          return (
            <tr key={place}>
              <td>{place}{juniorBeatingAdult && ' '} {juniorBeatingAdult && <span className="badge">Junior!</span>}</td>
              <td>{c.competitor?.full_name || ''}</td>
              {showCat && <td>{catBadge}</td>}
              <td>{metric}</td>
              <td>{(prize.desc||'')}{prize.value?` ($${Number(prize.value).toFixed(0)})`:''}</td>
              <td className="sponsor">{prize.sponsor||''}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
