import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute({ allowedRoles }) {
    // Lee ÚNICAMENTE la sesión administrativa (ignora cualquier sesión de cliente)
    const sesionRaw = localStorage.getItem('usuario_admin');
    const usuarioSesion = sesionRaw ? JSON.parse(sesionRaw) : null;

    if (!usuarioSesion) {
        return <Navigate to="/login" replace />;
    }

    const rolUsuario = usuarioSesion?.rol?.toLowerCase();
    const rolesPermitidos = allowedRoles ? allowedRoles.map(r => r.toLowerCase()) : [];

    if (allowedRoles && !rolesPermitidos.includes(rolUsuario)) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}