import { Outlet, NavLink } from 'react-router-dom';
import AdminGate from '@/components/AdminGate';

export default function AdminSection() {
    return (
        <AdminGate>
            <nav
                className="tabs"
                style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}
            >
                {/* LEFT GROUP (left -> right) */}
                <div style={{ display: 'flex', gap: 6 }}>
                    <NavLink to="/admin/register" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Register
                    </NavLink>
                    <NavLink to="/admin/submit" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Submit
                    </NavLink>
                    <NavLink to="/admin/prizegiving" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Prize giving
                    </NavLink>
                </div>

                {/* Spacer creates the gap */}
                <div style={{ flex: 1 }} />

                {/* RIGHT GROUP (right -> left) */}
                <div style={{ display: 'flex', gap: 6, flexDirection: 'row-reverse' }}>
                    <NavLink to="/admin/data" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Data
                    </NavLink>
                    <NavLink to="/admin/sponsors" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Sponsors
                    </NavLink>
                    <NavLink to="/admin/prizes" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Prizes
                    </NavLink>
                    <NavLink end to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Settings
                    </NavLink>
                </div>
            </nav>

            <Outlet />
        </AdminGate>
    );
}
