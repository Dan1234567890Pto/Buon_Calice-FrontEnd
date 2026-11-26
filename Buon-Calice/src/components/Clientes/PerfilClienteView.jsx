import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PerfilClienteView() {
    const navigate = useNavigate();
    const API_AUTH = 'https://buon-calice-fhfefadvd2bygphx.westcentralus-01.azurewebsites.net/api/auth';

    const [esRegistro, setEsRegistro] = useState(false);
    const [cargando, setCargando] = useState(false);

    // Estados para verificación de correo (OTP)
    const [esperandoCodigo, setEsperandoCodigo] = useState(false);
    const [correoPendiente, setCorreoPendiente] = useState('');
    const [codigoOTP, setCodigoOTP] = useState('');

    // Obtener sesión previa si existe
    const [cliente, setCliente] = useState(() => {
        const guardado = localStorage.getItem('cliente_buoncalice') || localStorage.getItem('usuario_cliente');
        return guardado ? JSON.parse(guardado) : null;
    });

    const [formData, setFormData] = useState({
        nombre: '',
        correo: '',
        password: '',
        telefono: ''
    });

    const handleNombreChange = (e) => {
        const valorLimpio = e.target.value.replace(/[0-9]/g, '');
        setFormData(prev => ({ ...prev, nombre: valorLimpio }));
    };

    const handleTelefonoChange = (e) => {
        const soloNumeros = e.target.value.replace(/\D/g, '');
        if (soloNumeros.length <= 10) {
            setFormData(prev => ({ ...prev, telefono: soloNumeros }));
        }
    };

    const handleInputChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const iniciarSesionLocal = (rawUsuario) => {
        const usuarioObj = {
            ...rawUsuario,
            rol: (rawUsuario.rol || 'cliente').toLowerCase()
        };
        localStorage.setItem('cliente_buoncalice', JSON.stringify(usuarioObj));
        localStorage.setItem('usuario_cliente', JSON.stringify(usuarioObj));
        setCliente(usuarioObj);
        navigate('/');
    };

    // Envío de Login
    const handleLogin = async (e) => {
        e.preventDefault();
        if (!formData.correo.trim() || !formData.password.trim()) {
            alert('⚠️ Ingrese su correo y contraseña.');
            return;
        }

        setCargando(true);
        try {
            const res = await fetch(`${API_AUTH}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: formData.correo.trim(),
                    password: formData.password
                })
            });

            const data = await res.json();

            // Si el correo aún no está verificado, abrir pantalla OTP
            if (!res.ok) {
                if (data.requiereVerificacion) {
                    setCorreoPendiente(formData.correo.trim());
                    setEsperandoCodigo(true);
                    alert(`📩 ${data.mensaje}`);
                    return;
                }
                throw new Error(data.mensaje || 'Credenciales incorrectas');
            }

            iniciarSesionLocal(data.usuario || data);
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        } finally {
            setCargando(false);
        }
    };

    // Envío de Registro
    const handleRegistro = async (e) => {
        e.preventDefault();

        if (!formData.nombre.trim() || !formData.correo.trim() || !formData.password.trim() || !formData.telefono.trim()) {
            alert('⚠️ Todos los campos son obligatorios.');
            return;
        }

        if (formData.telefono.length !== 10) {
            alert('⚠️ El número de teléfono debe tener exactamente 10 dígitos.');
            return;
        }

        const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regexEmail.test(formData.correo)) {
            alert('⚠️ Ingrese un correo electrónico válido.');
            return;
        }

        setCargando(true);
        try {
            const res = await fetch(`${API_AUTH}/registrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: formData.nombre.trim(),
                    correo: formData.correo.trim(),
                    password: formData.password,
                    telefono: formData.telefono.trim(),
                    rol: 'cliente'
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje || data.error || 'Error al registrar usuario.');

            setCorreoPendiente(formData.correo.trim());
            setCodigoOTP('');
            setEsperandoCodigo(true);
            alert('📩 Te enviamos un código de 6 dígitos a tu correo para activar tu cuenta.');
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        } finally {
            setCargando(false);
        }
    };

    // Validar código de 6 dígitos
    const handleVerificarCodigo = async (e) => {
        e.preventDefault();
        if (codigoOTP.trim().length !== 6) {
            alert('⚠️ Ingresa el código completo de 6 dígitos.');
            return;
        }

        setCargando(true);
        try {
            const res = await fetch(`${API_AUTH}/verificar-correo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: correoPendiente,
                    codigo: codigoOTP.trim()
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje || 'Código incorrecto.');

            alert('🎉 ¡Correo verificado con éxito! Bienvenido a Buon Calice.');
            setEsperandoCodigo(false);

            if (data.usuario) {
                iniciarSesionLocal(data.usuario);
            } else {
                setEsRegistro(false);
                setFormData(prev => ({ ...prev, correo: correoPendiente, password: '' }));
            }
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        } finally {
            setCargando(false);
        }
    };

    // Reenviar código de 6 dígitos
    const handleReenviarCodigo = async () => {
        setCargando(true);
        try {
            const res = await fetch(`${API_AUTH}/reenviar-codigo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo: correoPendiente })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje || 'No se pudo reenviar el código.');

            alert('📨 Nuevo código enviado a tu correo.');
        } catch (err) {
            alert(`⚠️ ${err.message}`);
        } finally {
            setCargando(false);
        }
    };

    const handleCerrarSesion = () => {
        localStorage.removeItem('cliente_buoncalice');
        localStorage.removeItem('usuario_cliente');
        setCliente(null);
    };

    const inputStyle = {
        width: '100%',
        padding: '0.75rem',
        borderRadius: '8px',
        border: '1px solid #26201B',
        backgroundColor: '#0D0B0A',
        color: '#fff',
        outline: 'none',
        boxSizing: 'border-box'
    };

    if (cliente) {
        return (
            <div style={{ padding: '2rem', backgroundColor: '#0D0B0A', minHeight: '100vh', color: '#fff', maxWidth: '500px', margin: '0 auto', boxSizing: 'border-box' }}>
                <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '16px', border: '1px solid #26201B', textAlign: 'center' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>👤</span>
                    <h2 style={{ color: '#C5A059', fontFamily: 'serif', margin: '0 0 0.5rem 0' }}>{cliente.nombre || 'Cliente Buon Calice'}</h2>
                    <p style={{ color: '#aaa', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>{cliente.correo}</p>
                    {cliente.telefono && <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>📞 {cliente.telefono}</p>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button onClick={() => navigate('/')} style={{ padding: '0.8rem', backgroundColor: '#C5A059', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                            Ver Catálogo
                        </button>
                        <button onClick={handleCerrarSesion} style={{ padding: '0.8rem', backgroundColor: 'transparent', color: '#dc2626', border: '1px solid #dc2626', borderRadius: '8px', cursor: 'pointer' }}>
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (esperandoCodigo) {
        return (
            <div style={{ padding: '2rem', backgroundColor: '#0D0B0A', minHeight: '100vh', color: '#fff', maxWidth: '450px', margin: '0 auto', boxSizing: 'border-box' }}>
                <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '16px', border: '1px solid #C5A059', textAlign: 'center' }}>
                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>✉️</span>
                    <h2 style={{ color: '#C5A059', fontFamily: 'serif', marginTop: 0 }}>Verifica tu Correo</h2>
                    <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        Ingresa el código de 6 dígitos que enviamos a <strong style={{ color: '#fff' }}>{correoPendiente}</strong>
                    </p>

                    <form onSubmit={handleVerificarCodigo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input
                            type="text"
                            maxLength={6}
                            value={codigoOTP}
                            onChange={(e) => setCodigoOTP(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            required
                            style={{
                                ...inputStyle,
                                textAlign: 'center',
                                fontSize: '1.8rem',
                                letterSpacing: '8px',
                                fontWeight: 'bold',
                                color: '#C5A059',
                                border: '1px solid #C5A059'
                            }}
                        />

                        <button
                            type="submit"
                            disabled={cargando}
                            style={{ padding: '0.85rem', backgroundColor: '#C5A059', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            {cargando ? 'Verificando...' : 'Confirmar Cuenta'}
                        </button>
                    </form>

                    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button
                            type="button"
                            disabled={cargando}
                            onClick={handleReenviarCodigo}
                            style={{ background: 'none', border: 'none', color: '#C5A059', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            No recibí el correo, reenviar código
                        </button>
                        <button
                            type="button"
                            onClick={() => setEsperandoCodigo(false)}
                            style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                            ← Volver
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', backgroundColor: '#0D0B0A', minHeight: '100vh', color: '#fff', maxWidth: '450px', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '16px', border: '1px solid #26201B' }}>
                <h2 style={{ color: '#C5A059', fontFamily: 'serif', textAlign: 'center', marginTop: 0 }}>
                    {esRegistro ? 'Crear Cuenta' : 'Iniciar Sesión'}
                </h2>

                <form onSubmit={esRegistro ? handleRegistro : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {esRegistro && (
                        <>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.4rem' }}>NOMBRE COMPLETO</label>
                                <input
                                    type="text"
                                    name="nombre"
                                    value={formData.nombre}
                                    onChange={handleNombreChange}
                                    required
                                    placeholder="Solo letras"
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.4rem' }}>TELÉFONO (10 DÍGITOS)</label>
                                <input
                                    type="tel"
                                    name="telefono"
                                    value={formData.telefono}
                                    onChange={handleTelefonoChange}
                                    required
                                    maxLength={10}
                                    placeholder="10 dígitos numéricos"
                                    style={inputStyle}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.4rem' }}>CORREO ELECTRÓNICO</label>
                        <input
                            type="email"
                            name="correo"
                            value={formData.correo}
                            onChange={handleInputChange}
                            required
                            placeholder="ejemplo@correo.com"
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.4rem' }}>CONTRASEÑA</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                            placeholder="••••••••"
                            style={inputStyle}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={cargando}
                        style={{ padding: '0.85rem', backgroundColor: '#C5A059', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}
                    >
                        {cargando ? 'Procesando...' : (esRegistro ? 'Registrarse' : 'Ingresar')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button
                        onClick={() => {
                            setEsRegistro(!esRegistro);
                            setFormData({ nombre: '', correo: '', password: '', telefono: '' });
                        }}
                        style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        {esRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
                    </button>
                </div>
            </div>
        </div>
    );
}