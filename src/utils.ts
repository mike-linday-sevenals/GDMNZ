import type { Settings } from "@/types";

export const DEFAULT_SPECIES = [
  'Snapper','Kingfish','Kahawai','Trevally','Gurnard','John Dory',
  'Crayfish / Cray (Diver)','Dive Snapper','Yellow Fin Tuna'
]

export const DEFAULT_SETTINGS = {
  earlyBirdCutoff: '2025-10-01',
  fees: { Adult:{early:80,standard:100}, Junior:{early:40,standard:50} },
  decimals: 2,
  showTime: true,
  requireTime: false,
  compMode: 'weight' as const,
  prizeMode: 'combined' as const
}

export const STORE_KEYS = {
  prizes: 'easterfish.prizes.v3',
  branding: 'easterfish.branding.v1',
  sponsors: 'easterfish.sponsors.v1',
  competitors: 'local.competitors',
  fish: 'local.fish'
}

export function todayISO(){ return new Date().toISOString().slice(0,10) }
export function fmt(n:number, d=2){ return Number(n).toFixed(d) }
export function formatNZ(iso?: string | null){
  if(!iso) return ''
  const d = new Date((iso.length===10? iso+'T00:00:00': iso))
  const dd=String(d.getDate()).padStart(2,'0')
  const mm=String(d.getMonth()+1).padStart(2,'0')
  const yy=d.getFullYear()
  return `${dd}/${mm}/${yy}`
}

// No replaceAll — works on older targets
export function escapeHtml(s: string){
  const v = s ?? ''
  return v
    .replace(/&/g, '&amp;')   // & first so we don't double-encode
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function computeFee(
  settings: Pick<Settings, 'earlyBirdCutoff' | 'fees'>,
  category: 'Adult' | 'Junior',
  paidOn: string | null | undefined
): number | null {
  if(!paidOn) return null
  const cutoff = new Date(settings.earlyBirdCutoff)
  if(Number.isNaN(cutoff.getTime())) return null
  const paidDate = new Date(paidOn)
  if(Number.isNaN(paidDate.getTime())) return null
  const fees = settings.fees[category]
  return paidDate <= cutoff ? fees.early : fees.standard
}
