import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import ClienteView from './components/Clientes/ClienteView';
import PerfilClienteView from './components/Clientes/PerfilClienteView';
import EmpleadoView from './components/Empleado/EmpleadoView';
import LoginView from './components/Empleado/LoginView';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

export default function App() {
    useEffect(() => {
        const originalAlert = window.alert;

        window.alert = (mensaje) => {
            const texto = String(mensaje);
            const esError = /error|incorrect|falló|no se pudo|inválid|inválido|denegado|faltan/i.test(texto);

            if (esError) {
                toast.error(texto);
            } else {
                toast.success(texto);
            }
        };

        return () => {
            window.alert = originalAlert;
        };
    }, []);

    return (
        <BrowserRouter>
            <Toaster
                position="top-right"
                richColors
                theme="dark"
                toastOptions={{
                    style: {
                        background: '#141414',
                        border: '1px solid #8c734b',
                        color: '#f5f5f5',
                        fontSize: '14px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                    },
                }}
            />
            <div className="app-container">
                <main className="app-main-content">
                    <Routes>
                        {/* Vista principal del cliente (Catálogo público y retorno de Stripe) */}
                        <Route path="/" element={<ClienteView />} />
                        <Route path="/cliente" element={<ClienteView />} />

                        {/* Login de clientes / perfil */}
                        <Route path="/perfil" element={<PerfilClienteView />} />

                        {/* Login administrativo (Empleados / Admins) */}
                        <Route path="/login" element={<LoginView />} />

                        {/* Panel protegido para Admin y Empleados */}
                        <Route element={<ProtectedRoute allowedRoles={['admin', 'empleado']} />}>
                            <Route path="/admin" element={<EmpleadoView />} />
                        </Route>

                        {/* Redirección por defecto al catálogo */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}