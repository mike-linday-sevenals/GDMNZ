import { Navigate } from "react-router-dom";
import { useAdmin } from "./AdminContext";

export default function AdminGate({ children }: { children: JSX.Element }) {
    const { isPlatformAdmin } = useAdmin();

    if (!isPlatformAdmin) {
        return <Navigate to="/" replace />;
    }

    return children;
}
