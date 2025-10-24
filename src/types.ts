export type Category = 'Adult' | 'Junior'

export interface Settings {
    earlyBirdCutoff?: string
    fees: { Adult: { early: number, standard: number }, Junior: { early: number, standard: number } }
    decimals: number
    compMode: 'weight' | 'measure'
    showTime: boolean
    requireTime: boolean
    prizeMode: 'combined' | 'split'
    activeSpeciesIds?: number[]   // ← NEW
}

export interface Species { id:number; name:string; is_measure?: boolean }

export interface Competitor {
  id: string | number
  full_name: string
  category: 'adult' | 'junior'
  boat?: string | null
  email?: string | null
  phone?: string | null
  paid_on: string
  created_at?: string
}

export interface FishJoined {
  id: string | number
  weight_kg?: number | null
  length_cm?: number | null
  time_caught?: string | null
  created_at?: string | null
  competitor?: { id: string|number; full_name:string; category:'adult'|'junior'; boat?:string|null; paid_on?:string|null } | null
  species?: { id:number; name:string } | null
}
