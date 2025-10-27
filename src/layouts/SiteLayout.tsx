// src/layouts/SiteLayout.tsx
import { Outlet, NavLink } from 'react-router-dom'
import logo from '@/images/GDMNZ_logo.png' // <- your logo in src/images

export default function SiteLayout() {
    return (
        <>
            <header className="header">
                <div
                    className="wrap"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
                >
                    {/* Brand: logo only (clickable to home) */}
                    <a href="/" className="brand" style={{ display: 'flex', alignItems: 'center' }}>
                        <img
                            src={logo}
                            alt="Game Day Manager NZ"
                            // Inline styles override the global `.brand img { height:40px }`
                            style={{
                                height: 64,           // bigger logo
                                width: 'auto',
                                borderRadius: 10,
                                border: '1px solid var(--border)',
                                background: '#fff',
                                padding: 6,           // small inset so the border doesn’t touch the art
                            }}
                        />
                        {/* keep an accessible label but no visible text */}
                        <span className="sr-only">Game Day Manager NZ</span>
                    </a>

                    {/* Single button */}
                    <nav className="tabs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <NavLink to="/results" className={({ isActive }) => (isActive ? 'active' : '')}>
                            Results for WOSC &amp; 100% HOME WHANGAMATA
                        </NavLink>
                    </nav>
                </div>
            </header>

            <main className="main">
                <div className="wrap">
                    <Outlet />
                </div>
            </main>
        </>
    )
}
