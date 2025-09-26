import { STORE_KEYS } from '@/utils'

function loadLocal<T>(k:string, f:T):T{ try{const r=localStorage.getItem(k); return r?JSON.parse(r):structuredClone(f)}catch{ return structuredClone(f)} }
function saveLocal<T>(k:string, v:T){ localStorage.setItem(k, JSON.stringify(v)) }

export default function Data(){
  function exportAll(){
    const data = {
      generatedAt: new Date().toISOString(),
      prizes: loadLocal(STORE_KEYS.prizes, {}),
      branding: loadLocal(STORE_KEYS.branding, {logoDataUrl:null}),
      sponsors: loadLocal(STORE_KEYS.sponsors, {overall:[]})
    }
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `wosc-local-export-${new Date().toISOString().slice(0,10)}.json`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  function importAll(file?: File){
    if(!file) return alert('Choose a file first.')
    if(!confirm('Importing will overwrite local data. Continue?')) return
    const reader = new FileReader()
    reader.onload = (ev)=>{
      try{
        const data = JSON.parse(String(ev.target?.result||'{}'))
        if(data.prizes) saveLocal(STORE_KEYS.prizes, data.prizes)
        if(data.branding) saveLocal(STORE_KEYS.branding, data.branding)
        if(data.sponsors) saveLocal(STORE_KEYS.sponsors, data.sponsors)
        alert('Import completed.')
      }catch(e:any){ alert('Import failed: '+e.message) }
    }
    reader.readAsText(file)
  }
  function clearAll(){
    if(!confirm('Really clear local data (prizes/branding/sponsors)?')) return
    [STORE_KEYS.prizes, STORE_KEYS.branding, STORE_KEYS.sponsors].forEach(k=>localStorage.removeItem(k))
    alert('Local data cleared.')
  }

  return (
    <section className="card">
      <h2>Import / Export (local parts)</h2>
      <p className="sub">This exports/imports only local data: prizes, branding, sponsors. DB data (competitors/fish) stays in Supabase.</p>
      <div className="grid two">
        <div>
          <h3>Export Data</h3>
          <div className="actions"><button className="btn primary" onClick={exportAll}>Export JSON</button></div>
        </div>
        <div>
          <h3>Import Data</h3>
          <p className="sub">Upload a previously exported JSON file. This overwrites local data only.</p>
          <input type="file" id="imp-file" accept="application/json"/>
          <div className="actions"><button className="btn warn" onClick={()=>{
            const f = (document.getElementById('imp-file') as HTMLInputElement).files?.[0]
            importAll(f||undefined)
          }}>Import</button></div>
        </div>
      </div>
      <hr style={{border:'none',borderTop:'1px solid var(--border)',margin:'12px 0'}}/>
      <h3>Danger Zone</h3>
      <div className="actions"><button className="btn danger" onClick={clearAll}>Clear LOCAL Data</button></div>
    </section>
  )
}
