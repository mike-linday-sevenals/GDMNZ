const STORAGE_KEY = 'gdmnz.admin.unlocked';

export function isAdminUnlocked(): boolean {
    try { return sessionStorage.getItem(STORAGE_KEY) === 'yes'; } catch { return false; }
}
export function lockAdmin(): void {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { }
}
export function tryUnlockAdmin(inputCode: string): boolean {
    const expected = String((import.meta as any).env?.VITE_ADMIN_CODE ?? '1234');
    const ok = inputCode === expected;
    if (ok) { try { sessionStorage.setItem(STORAGE_KEY, 'yes'); } catch { } }
    return ok;
}
