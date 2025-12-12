// ================================================================
// EXISTING TYPES (unchanged)
// ================================================================
export type Category = 'Adult' | 'Junior'

export interface Settings {
    earlyBirdCutoff?: string
    fees: { Adult: { early: number, standard: number }, Junior: { early: number, standard: number } }
    decimals: number
    compMode: 'weight' | 'measure'
    showTime: boolean
    requireTime: boolean
    prizeMode: 'combined' | 'split'
    activeSpeciesIds?: number[]
}

export interface Species {
    id: number
    name: string
    is_measure?: boolean
}

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
    competitor?: {
        id: string | number
        full_name: string
        category: 'adult' | 'junior'
        boat?: string | null
        paid_on?: string | null
    } | null
    species?: { id: number; name: string } | null
}

// ================================================================
// NEW TYPES FOR COMPETITIONS
// ================================================================

export interface CompMode {
    id: string
    name: string // "weight", "length"
}

export interface PrizeMode {
    id: string
    name: string // "combined", "split"
}

/**
 * Competition row structure.
 * Supabase returns comp_mode and prize_mode as *single objects*, not arrays.
 */
export interface Competition {
    id: string
    name: string
    starts_at: string | null
    ends_at: string | null

    /** FK columns */
    comp_mode_id?: string | null
    prize_mode_id?: string | null

    /** JOIN results from Supabase (single-row relations) */
    comp_mode?: { id: string; name: string } | null
    prize_mode?: { id: string; name: string } | null
}

export interface CompetitionDay {
    id: string
    competition_id: string
    day_date: string

    fishing_start_type: "None" | "Required"
    fishing_start_time?: string | null

    fishing_end_time?: string | null
    fishing_end_type?: "None" | "Required"

    weighin_type: "None" | "Optional" | "Required"
    weighin_start_time?: string | null
    weighin_end_time?: string | null

    overnight_allowed: boolean
    notes?: string | null

    /** UI-only expansion flag */
    _open?: boolean
}

export interface CompetitionBriefing {
    id: string
    competition_id: string
    briefing_date: string | null
    briefing_time: string | null
    location: string | null
    notes?: string | null
}

/**
 * Competition species row — used in listCompetitionSpecies()
 */
export interface CompetitionSpeciesRow {
    id: string
    species: Species
}
