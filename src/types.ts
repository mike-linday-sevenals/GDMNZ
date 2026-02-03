// ================================================================
// EXISTING TYPES (unchanged)
// ================================================================

export type Category = "Adult" | "Junior";

export interface Settings {
    earlyBirdCutoff?: string;
    fees: {
        Adult: { early: number; standard: number };
        Junior: { early: number; standard: number };
    };
    decimals: number;
    compMode: "weight" | "measure";
    showTime: boolean;
    requireTime: boolean;
    prizeMode: "combined" | "split";
    activeSpeciesIds?: number[];
}

export interface Species {
    id: number;
    name: string;
    is_measure?: boolean;

    fish_type_id: string;
    species_category_id: string;

    species_category: {
        species_category_id: string;
        name: string;
    };
}

export type Competitor = {
    id: string;
    created_at: string;

    full_name: string;
    category: "adult" | "junior";
    paid_on: string | null;

    boat: string | null;
    membership_no: string | null;
    boat_type: "Launch" | "Trailer" | "Charter" | null;
};


export interface FishJoined {
    id: string | number;
    weight_kg?: number | null;
    length_cm?: number | null;
    time_caught?: string | null;
    created_at?: string | null;
    competitor?: {
        id: string | number;
        full_name: string;
        category: "adult" | "junior";
        boat?: string | null;
        paid_on?: string | null;
    } | null;
    species?: { id: number; name: string } | null;
}

// ================================================================
// LOOKUP TYPES
// ================================================================

export interface CompetitionType {
    id: string;
    code?: string;
    name: string;
    description: string | null;
}

export type CompMode = {
    id: string;
    name: string;
};

export type PrizeMode = {
    id: string;
    name: string;
};

// ================================================================
// COMPETITION
// ================================================================

/**
 * Competition row structure.
 * Supabase returns joined relations as single objects (not arrays).
 */
export interface Competition {
    id: string;
    name: string;
    starts_at: string | null;
    ends_at: string | null;

    // -----------------------------
    // Structure flags
    // -----------------------------
    briefing_required: boolean;

    // -----------------------------
    // Foreign key columns
    // -----------------------------
    competition_type_id?: string | null;
    comp_mode_id?: string | null;
    prize_mode_id?: string | null;

    // -----------------------------
    // Joined lookup objects
    // -----------------------------
    competition_type?: CompetitionType | null;
    comp_mode?: CompMode | null;
    prize_mode?: PrizeMode | null;

    // Public slug (registration/results)
    public_results_slug?: string | null;
}

// ================================================================
// COMPETITION DAYS (FULLY ALIGNED WITH DB)
// ================================================================

export interface CompetitionDay {
    id: string;
    competition_id: string;

    day_date: string;
    sort_order?: number | null;

    // -----------------------------
    // Fishing window
    // -----------------------------
    fishing_start_type: "None" | "Required";
    fishing_start_time?: string | null;

    fishing_end_type?: "None" | "Required";
    fishing_end_time?: string | null;

    // -----------------------------
    // Overnight rules
    // -----------------------------
    overnight_allowed: boolean;

    // -----------------------------
    // Weigh-in window
    // -----------------------------
    weighin_type: "None" | "Optional" | "Required";
    weighin_start_time?: string | null;
    weighin_end_time?: string | null;
    weighin_cutoff_time?: string | null;

    // -----------------------------
    // Notes
    // -----------------------------
    notes?: string | null;

    // -----------------------------
    // Meta
    // -----------------------------
    created_at?: string;

    /** UI-only expansion flag */
    _open?: boolean;
}

// ================================================================
// COMPETITION BRIEFING
// ================================================================

export interface CompetitionBriefing {
    id: string;
    competition_id: string;
    briefing_date: string | null;
    briefing_time: string | null;
    location: string | null;
    notes?: string | null;
}

// ================================================================
// COMPETITION SPECIES
// ================================================================

export interface CompetitionSpeciesRow {
    id: string;
    species: Species;
}

// ================================================================
// COMPETITION FEES
// ================================================================

export interface CompetitionFees {
    id: string;
    competition_id: string;

    earlybird_fee_adult: number | null;
    earlybird_fee_junior: number | null;
    earlybird_cutoff_date: string | null;

    full_fee_adult: number | null;
    full_fee_junior: number | null;

    nonmember_fee_adult: number | null;
    nonmember_fee_junior: number | null;

    extra?: any;
}

// ================================================================
// BOAT / TEAM REGISTRATION (RPC CONTRACTS)
// ================================================================

export type PersonCategory = "adult" | "junior" | "senior" | "";
export type BoatType = "Launch" | "Trailer" | "Charter";

export type RegisterBoatPayload = {
    competition_id: string;
    boat_name: string;
    boat_type?: BoatType | null;
    join_code?: string | null;
    skipper: {
        full_name: string;
        membership_no?: string | null;
        email?: string | null;
        phone?: string | null;
        category: PersonCategory;
    };
    team: {
        full_name: string;
        membership_no?: string | null;
        email?: string | null;
        phone?: string | null;
        category: PersonCategory;
    }[];
};

export type RegisterBoatResult = {
    boat_number: string;
    anglers: {
        competitor_id: string;
        full_name: string;
        angler_number: string;
    }[];
};

export type JoinBoatPayload = {
    competition_id: string;
    boat_number: string;
    boat_name?: string | null;
    join_code?: string | null;
    member: {
        full_name: string;
        membership_no?: string | null;
        email?: string | null;
        phone?: string | null;
        category: PersonCategory;
    };
};

export type JoinBoatResult = {
    boat_number: string;
    angler_number: string;
    competitor_id: string;
    boat_name: string | null;
    [key: string]: any;
};
