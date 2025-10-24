// src/pages/LandingPage.tsx
import hero from '@/images/2f36b425-d08f-4142-8153-104ee5ff83a5.png'

export default function LandingPage() {
    return (
        <div
            style={{
                margin: '14px -20px 0',      // edge-to-edge inside <main>
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 6px rgba(26,46,60,.06)',
            }}
        >
            <img
                src={hero}
                alt=""
                style={{
                    display: 'block',
                    width: '100%',
                    height: 'calc(100vh - 110px)',  // adjust if your header height differs
                    objectFit: 'cover',
                }}
            />
        </div>
    )
}
