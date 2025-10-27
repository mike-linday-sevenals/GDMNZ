import React, { useState } from 'react';
import { isAdminUnlocked, tryUnlockAdmin, lockAdmin } from '@/auth/simpleGate';

export default function AdminGate({ children }: { children: React.ReactNode }) {
    const [unlocked, setUnlocked] = useState(isAdminUnlocked());
    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (tryUnlockAdmin(code.trim())) { setUnlocked(true); setCode(''); }
        else setError('Incorrect code. Try again.');
    };
    const relock = () => { lockAdmin(); setUnlocked(false); setCode(''); };

    return (
        <>
            {children}
            {!unlocked && (
                <div className="admin-gate__backdrop" aria-modal role="dialog" aria-label="Admin authentication">
                    <div className="admin-gate__panel">
                        <h2 className="admin-gate__title">Admin access</h2>
                        <p className="admin-gate__subtitle">Enter the authentication code to continue.</p>
                        <form onSubmit={submit} className="admin-gate__form">
                            <input type="password" inputMode="numeric" autoFocus className="admin-gate__input"
                                placeholder="Enter code" value={code} onChange={(e) => setCode(e.target.value)} />
                            <button type="submit" className="admin-gate__button">Unlock</button>
                            {error && <div className="admin-gate__error" role="alert">{error}</div>}
                        </form>
                        <p className="admin-gate__hint">Temporary gate only. Full user logins coming soon.</p>
                    </div>
                </div>
            )}
            {unlocked && (
                <button onClick={relock} className="admin-gate__lockbtn" title="Re-lock (dev only)">Lock</button>
            )}
            <style>{styles}</style>
        </>
    );
}

const styles = `
.admin-gate__backdrop{position:fixed;inset:0;background:rgba(7,16,29,.66);display:grid;place-items:center;z-index:9999;backdrop-filter:blur(2px)}
.admin-gate__panel{width:min(92vw,420px);background:#0B274A;color:#fff;border-radius:14px;padding:22px 22px 18px;box-shadow:0 10px 40px rgba(0,0,0,.45)}
.admin-gate__title{margin:0 0 6px;font-size:22px;line-height:1.2}
.admin-gate__subtitle{margin:0 0 16px;opacity:.85;font-size:14px}
.admin-gate__form{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}
.admin-gate__input{height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#fff;padding:0 12px;outline:none}
.admin-gate__input::placeholder{color:rgba(255,255,255,.7)}
.admin-gate__button{height:40px;padding:0 14px;border-radius:10px;border:none;cursor:pointer}
.admin-gate__error{grid-column:1/-1;color:#FFDADA;background:rgba(255,77,77,.12);margin-top:6px;padding:8px 10px;border-radius:8px;font-size:13px}
.admin-gate__hint{margin:14px 0 0;font-size:12px;opacity:.75}
.admin-gate__lockbtn{position:fixed;right:10px;bottom:10px;opacity:.4;background:#eee;border:1px solid #ddd;border-radius:8px;padding:6px 8px;font-size:12px;cursor:pointer;z-index:1}
`;
