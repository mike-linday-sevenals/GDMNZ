import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSettings } from '@/services/api'
// import { updateSettings, listSpecies } from '@/services/api'
// import { STORE_KEYS } from '@/utils'
// import AdminSponsors from './AdminSponsors'

/* ============================================================================
   TYPES (LEGACY / TRANSITION)
   ============================================================================ */

type Settings = {
    // earlyBirdCutoff?: string
    // fees: {
    //     Adult: { early: number; standard: number }
    //     Junior: { early: number; standard: number }
    // }
    // decimals: number

    compMode: 'weight' | 'measure'
    showTime: boolean
    requireTime: boolean
    prizeMode: 'combined' | 'split'
    activeSpeciesIds?: number[]
}

/* ============================================================================
   ADMIN PAGE (MINIMAL SAFE SHELL)
   ============================================================================ */

export default function Admin() {
    const [settings, setSettings] = useState<Settings | null>(null)

    /* ------------------------------------------------------------------------
       LOAD SETTINGS (NO MUTATION HERE)
       ------------------------------------------------------------------------ */
    useEffect(() => {
        (async () => {
            const st = await fetchSettings()
            setSettings(st)
        })()
    }, [])

    /* ------------------------------------------------------------------------
       LOADING STATE
       ------------------------------------------------------------------------ */
    if (!settings) {
        return (
            <section className="card settings-card">
                <h2>Settings</h2>
                <p className="muted">Loading…</p>
            </section>
        )
    }

    /* ------------------------------------------------------------------------
       RENDER
       ------------------------------------------------------------------------ */
    return (
        <section className="card settings-card">
            <h2>Settings</h2>

            {/* PRIMARY NAV ACTION */}
            <div style={{ marginBottom: 20 }}>
                <Link to="/admin/competitions">
                    <button className="btn primary">
                        Manage Competitions
                    </button>
                </Link>
            </div>

            {/* ================================================================
               ALL PREVIOUS ADMIN CONTROLS REMOVED SAFELY
               ================================================================ */}

            {/*
                Event Settings       → moved to Competition Admin
                Branding             → moved to Branding page
                Species visibility   → defined elsewhere
                Sponsors             → defined elsewhere
            */}
        </section>
    )
}
