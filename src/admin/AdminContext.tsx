import { createContext, useContext } from "react";

type AdminContextType = {
    isPlatformAdmin: boolean;
};

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
    // later: pull from auth / roles
    const value = {
        isPlatformAdmin: true,
    };

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    );
}

export function useAdmin() {
    const ctx = useContext(AdminContext);
    if (!ctx) {
        throw new Error("useAdmin must be used inside AdminProvider");
    }
    return ctx;
}
