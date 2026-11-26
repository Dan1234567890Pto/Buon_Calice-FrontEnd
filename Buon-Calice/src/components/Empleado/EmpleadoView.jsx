import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getProductos,
    getProductoPorId,
    guardarProducto,
    eliminarProducto,
    getPedidos,
    actualizarEstadoPedido,
    getReporteVentas
} from '../../services/api';
import Swal from 'sweetalert2';

// Funciones de notificación autocontenidas usando SweetAlert2
const mostrarExito = (titulo, texto) => {
    Swal.fire({
        background: '#16120E',
        color: '#F3ECE0',
        icon: 'success',
        iconColor: '#4ade80',
        title: titulo,
        text: texto,
        confirmButtonColor: '#C5A059'
    });
};

const mostrarError = (titulo, texto) => {
    Swal.fire({
        background: '#16120E',
        color: '#F3ECE0',
        icon: 'error',
        iconColor: '#f87171',
        title: titulo,
        text: texto,
        confirmButtonColor: '#C5A059'
    });
};

const mostrarToast = (titulo, icono = 'info') => {
    Swal.fire({
        toast: true,
        position: 'top-end',
        background: '#16120E',
        color: '#F3ECE0',
        icon: icono,
        title: titulo,
        showConfirmButton: false,
        timer: 2500
    });
};

export default function EmpleadoView() {
    const navigate = useNavigate();

    // Lee ÚNICAMENTE la sesión administrativa (nunca toca cliente_buoncalice)
    const [usuarioSesion] = useState(() => {
        try {
            const guardado = localStorage.getItem('usuario_admin');
            return guardado ? JSON.parse(guardado) : null;
        } catch {
            return null;
        }
    });

    // Estado de conexión nativo
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const esPrimerRender = useRef(true);

    const [productos, setProductos] = useState([]);
    const [cargandoProductos, setCargandoProductos] = useState(true);
    const [errorProductos, setErrorProductos] = useState('');

    // Paginación de Inventario (5 productos por página)
    const [paginaActual, setPaginaActual] = useState(1);
    const [filtroInventario, setFiltroInventario] = useState('');
    const productosPorPagina = 5;

    const [pedidos, setPedidos] = useState([]);
    const [todosLosPedidos, setTodosLosPedidos] = useState([]);
    const [cargandoPedidos, setCargandoPedidos] = useState(true);
    const [errorPedidos, setErrorPedidos] = useState('');
    const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);

    const [pedidosEliminados, setPedidosEliminados] = useState([]);
    const [reporteVentas, setReporteVentas] = useState({ totalPedidos: 0, totalVendido: 0, ticketPromedio: 0 });

    // Filtros de ventas por mes, día y hora
    const [filtroMes, setFiltroMes] = useState('');
    const [filtroFecha, setFiltroFecha] = useState('');
    const [filtroHora, setFiltroHora] = useState('');

    const [productoEditandoId, setProductoEditandoId] = useState(null);
    const [idBusqueda, setIdBusqueda] = useState('');
    const [productoBuscado, setProductoBuscado] = useState(null);
    const [codigoPedidoBorrar, setCodigoPedidoBorrar] = useState('');

    const [formData, setFormData] = useState({
        nombre: '',
        categoria: 'Whisky',
        precio: '',
        stock: '',
        imagen: '',
        descripcion: ''
    });

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (!usuarioSesion) {
            navigate('/login', { replace: true });
        }
    }, [usuarioSesion, navigate]);

    useEffect(() => {
        if (!usuarioSesion) return;

        if (esPrimerRender.current) {
            esPrimerRender.current = false;
            if (!isOnline) {
                mostrarError('Sin conexión a Internet', 'Reconectate a internet para poder continuar');
            }
            return;
        }

        if (!isOnline) {
            mostrarError('Sin conexión a Internet', 'Reconectate a internet para poder continuar');
        } else {
            mostrarToast('🟢 Conexión restablecida. Actualizando datos...', 'success');
            obtenerPedidos();
            obtenerMetricasVentas();
            obtenerProductos();
        }
    }, [isOnline, usuarioSesion]);

    useEffect(() => {
        if (!usuarioSesion) return;

        obtenerProductos();
        obtenerPedidos();
        obtenerMetricasVentas();

        const intervalo = setInterval(() => {
            obtenerPedidos();
            obtenerMetricasVentas();
        }, 5000);

        return () => clearInterval(intervalo);
    }, [pedidosEliminados, usuarioSesion]);

    const obtenerMetricasVentas = async () => {
        if (!navigator.onLine) return;
        try {
            const data = await getReporteVentas();
            setReporteVentas({
                totalPedidos: data.totalPedidos || data.TotalPedidos || 0,
                totalVendido: data.totalVendido || data.TotalVendido || 0,
                ticketPromedio: data.ticketPromedio || data.TicketPromedio || 0
            });
        } catch (err) {
            console.error('Error al cargar reporte de ventas:', err);
        }
    };

    const obtenerPedidos = async () => {
        if (!navigator.onLine) return;

        try {
            const data = await getPedidos();
            setTodosLosPedidos(Array.isArray(data) ? data : []);

            const pedidosValidos = (data || []).filter(p => {
                const idPed = (p.idPedido || p.id_pedido || p.id || '').toString();
                const cod = (p.codigo || '').toUpperCase();
                return !pedidosEliminados.includes(idPed) && !pedidosEliminados.includes(cod);
            });

            setPedidos(pedidosValidos);

            setPedidoSeleccionado(prevSel => {
                if (!prevSel) {
                    return pedidosValidos.length > 0 ? {
                        ...pedidosValidos[0],
                        idPedido: pedidosValidos[0].idPedido || pedidosValidos[0].id_pedido || pedidosValidos[0].id
                    } : null;
                }

                const prevId = (prevSel.idPedido || prevSel.id_pedido || prevSel.id || '').toString();
                const coincidencia = pedidosValidos.find(p => {
                    const idActual = (p.idPedido || p.id_pedido || p.id || '').toString();
                    return idActual === prevId || (p.codigo && p.codigo === prevSel.codigo);
                });

                if (coincidencia) {
                    return {
                        ...coincidencia,
                        idPedido: coincidencia.idPedido || coincidencia.id_pedido || coincidencia.id
                    };
                }

                return pedidosValidos.length > 0 ? {
                    ...pedidosValidos[0],
                    idPedido: pedidosValidos[0].idPedido || pedidosValidos[0].id_pedido || pedidosValidos[0].id
                } : null;
            });

        } catch (err) {
            console.error(err);
            setErrorPedidos('No se pudieron obtener los pedidos en tiempo real.');
        } finally {
            setCargandoPedidos(false);
        }
    };

    const obtenerProductos = async () => {
        if (!navigator.onLine) {
            setCargandoProductos(false);
            return;
        }
        setCargandoProductos(true);
        setErrorProductos('');
        try {
            const data = await getProductos(false);
            setProductos(data || []);
        } catch (err) {
            console.error(err);
            setErrorProductos('No se pudo cargar el inventario de productos.');
        } finally {
            setCargandoProductos(false);
        }
    };

    const handleSeleccionarPedido = (pedido) => {
        setPedidoSeleccionado({
            ...pedido,
            idPedido: pedido.idPedido || pedido.id_pedido || pedido.id
        });
    };

    const handleCambiarEstadoPedido = async (nuevoEstado) => {
        if (!navigator.onLine) {
            mostrarError('Sin conexión a Internet', 'Reconectate a internet para poder continuar');
            return;
        }
        if (!pedidoSeleccionado) return;

        const idReal = pedidoSeleccionado.idPedido || pedidoSeleccionado.id_pedido || pedidoSeleccionado.id;

        if (!idReal || isNaN(Number(idReal))) {
            mostrarError('Selección Inválida', `ID de pedido no válido (${idReal}). Selecciona el pedido nuevamente.`);
            return;
        }

        try {
            await actualizarEstadoPedido(idReal, nuevoEstado);
            setPedidoSeleccionado(prev => ({ ...prev, estado: nuevoEstado }));
            await obtenerPedidos();
            mostrarToast(`📦 Pedido actualizado a ${nuevoEstado}`, 'success');
        } catch (err) {
            console.error('Error al cambiar estado:', err);
            mostrarError('Error al Actualizar', err.message || 'No se pudo guardar el nuevo estado.');
        }
    };

    const handleEntregarYBorrar = async (e) => {
        e.preventDefault();
        if (!navigator.onLine) {
            mostrarError('Sin conexión a Internet', 'Reconectate a internet para poder continuar');
            return;
        }
        if (!codigoPedidoBorrar) return;

        const entradaLimpia = codigoPedidoBorrar.trim().toUpperCase();

        const pedidoEncontrado = pedidos.find(p => {
            const cod = (p.codigo || '').toUpperCase();
            const idPed = (p.idPedido || p.id_pedido || p.id || '').toString();
            return cod === entradaLimpia || cod === `BC-${entradaLimpia}` || `BC-${cod}` === entradaLimpia || idPed === entradaLimpia;
        });

        if (!pedidoEncontrado) {
            mostrarError('Pedido No Encontrado', 'No se encontró ningún pedido activo asociado al código ingresado.');
            return;
        }

        const idReal = (pedidoEncontrado.idPedido || pedidoEncontrado.id_pedido || pedidoEncontrado.id || '').toString();
        const codigoReal = (pedidoEncontrado.codigo || '').toUpperCase();

        try {
            await actualizarEstadoPedido(idReal, 'ENTREGADO');

            setPedidosEliminados(prev => [...prev, idReal, codigoReal, entradaLimpia]);

            const nuevaLista = pedidos.filter(p => {
                const idP = (p.idPedido || p.id_pedido || p.id || '').toString();
                const codP = (p.codigo || '').toUpperCase();
                return idP !== idReal && codP !== codigoReal && codP !== entradaLimpia;
            });

            setPedidos(nuevaLista);

            if (pedidoSeleccionado && ((pedidoSeleccionado.idPedido || pedidoSeleccionado.id_pedido || pedidoSeleccionado.id || '').toString() === idReal)) {
                setPedidoSeleccionado(nuevaLista.length > 0 ? nuevaLista[0] : null);
            }

            await obtenerPedidos();
            await obtenerMetricasVentas();

            mostrarExito('Pedido Entregado', `El pedido #${entradaLimpia} fue marcado como entregado y registrado en las ventas.`);
            setCodigoPedidoBorrar('');
        } catch (err) {
            mostrarError('Error de Entrega', err.message || 'No se pudo procesar la entrega del pedido.');
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEditarProducto = (prod) => {
        if (!navigator.onLine) {
            mostrarError('Sin conexión a Internet', 'Reconectate a internet para poder continuar');
            return;
        }
        const id = prod.idProducto || prod.id_producto || prod.id;
        setProductoEditandoId(id);
        setFormData({
            nombre: prod.nombre || '',
            categoria: prod.categoria || 'Whisky',
            precio: prod.precio ?? '',
            stock: prod.stock ?? '',
            imagen: prod.imagen || prod.urlImagen || prod.icono || '',
            descripcion: prod.descripcion || ''
        });
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const handleCancelarEditar = () => {
        setProductoEditandoId(null);
        setFormData({ nombre: '', categoria: 'Whisky', precio: '', stock: '', imagen: '', descripcion: '' });
    };

    const handleGuardarProducto = async (e) => {
        e.preventDefault();
        if (!navigator.onLine) {
            mostrarError('Sin conexión a Internet', 'Reconectate a internet para poder continuar');
            return;
        }
        try {
            const payload = {
                ...formData,
                precio: Number(formData.precio),
                stock: Number(formData.stock),
                ...(productoEditandoId && { idProducto: productoEditandoId })
            };

            await guardarProducto(payload);

            mostrarExito(
                productoEditandoId ? 'Producto Actualizado' : 'Producto Registrado',
                productoEditandoId ? 'Los cambios del producto se guardaron correctamente.' : 'El nuevo producto fue añadido al catálogo.'
            );
            handleCancelarEditar();
            obtenerProductos();
        } catch (err) {
            mostrarError('Error al Guardar', err.message || 'Ocurrió un problema al guardar el producto.');
        }
    };

    const handleEliminarProducto = async (id) => {
        if (!navigator.onLine) {
            mostrarError('Sin conexión a Internet', 'Reconectate a internet para poder continuar');
            return;
        }

        const result = await Swal.fire({
            background: '#16120E',
            color: '#E2D9CC',
            title: '¿Eliminar producto?',
            text: `Confirmas la eliminación permanente del producto #${id}`,
            icon: 'warning',
            iconColor: '#F87171',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#382E26',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        try {
            await eliminarProducto(id);
            mostrarExito('Eliminado', 'El producto se ha removido del inventario.');
            setPaginaActual(1);
            obtenerProductos();
        } catch (err) {
            mostrarError('Error al Eliminar', err.message || 'No se pudo eliminar el producto.');
        }
    };

    const handleBuscarPorId = async (e) => {
        e.preventDefault();
        if (!navigator.onLine) {
            mostrarError('Sin conexión a Internet', 'Reconectate a internet para poder continuar');
            return;
        }
        if (!idBusqueda) return;
        try {
            const data = await getProductoPorId(idBusqueda);
            setProductoBuscado(data);
        } catch (err) {
            mostrarError('Búsqueda sin Resultados', err.message || 'No se encontró el producto especificado.');
            setProductoBuscado(null);
        }
    };

    const handleCerrarSesion = () => {
        localStorage.removeItem('usuario_admin');
        mostrarToast('Sesión de administrador cerrada', 'info');
        navigate('/login', { replace: true });
    };

    if (!usuarioSesion) return null;

    // Filtrado de ventas entregadas por mes, fecha (día) y hora
    const ventasEntregadas = todosLosPedidos.filter((p) => {
        const estado = (p.estado || '').toUpperCase();
        if (estado !== 'ENTREGADO') return false;

        const rawFecha = p.fechaPedido || p.fecha || p.createdAt;
        if (!rawFecha && (filtroMes || filtroFecha || filtroHora !== '')) return false;

        if (rawFecha) {
            const fechaObj = new Date(rawFecha);
            if (!isNaN(fechaObj.getTime())) {
                const yyyy = fechaObj.getFullYear();
                const mm = String(fechaObj.getMonth() + 1).padStart(2, '0');
                const dd = String(fechaObj.getDate()).padStart(2, '0');

                if (filtroMes && `${yyyy}-${mm}` !== filtroMes) return false;
                if (filtroFecha && `${yyyy}-${mm}-${dd}` !== filtroFecha) return false;

                if (filtroHora !== '') {
                    const horaPedido = String(fechaObj.getHours()).padStart(2, '0');
                    if (horaPedido !== filtroHora) return false;
                }
            }
        }
        return true;
    });

    const hayFiltroVentas = Boolean(filtroMes || filtroFecha || filtroHora !== '');

    const metricasMostradas = hayFiltroVentas
        ? {
            totalPedidos: ventasEntregadas.length,
            totalVendido: ventasEntregadas.reduce((acc, p) => acc + Number(p.total || 0), 0),
            ticketPromedio: ventasEntregadas.length > 0
                ? ventasEntregadas.reduce((acc, p) => acc + Number(p.total || 0), 0) / ventasEntregadas.length
                : 0
        }
        : reporteVentas;

    const productosFiltradosInventario = productos.filter(p =>
        (p.nombre || '').toLowerCase().includes(filtroInventario.toLowerCase()) ||
        (p.categoria || '').toLowerCase().includes(filtroInventario.toLowerCase())
    );

    const totalPaginas = Math.max(1, Math.ceil(productosFiltradosInventario.length / productosPorPagina));
    const paginaSegura = Math.min(paginaActual, totalPaginas);
    const indiceInicio = (paginaSegura - 1) * productosPorPagina;
    const productosPaginados = productosFiltradosInventario.slice(indiceInicio, indiceInicio + productosPorPagina);

    const itemsPedido = pedidoSeleccionado?.productos || pedidoSeleccionado?.detalles || pedidoSeleccionado?.items || [];

    const estiloInput = {
        padding: '1rem 1.15rem',
        backgroundColor: '#0D0B0A',
        border: '1px solid #382E26',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '1rem',
        outline: 'none',
        opacity: isOnline ? 1 : 0.5
    };

    return (
        <div style={{ padding: '2.5rem 2rem 4rem 2rem', backgroundColor: '#0D0B0A', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', maxWidth: '1150px', margin: '0 auto' }}>

            {!isOnline && (
                <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#fda4af', padding: '1.1rem', borderRadius: '14px', fontSize: '1rem', marginBottom: '2rem', textAlign: 'center', fontWeight: 'bold' }}>
                    📡 Reconectate a internet para poder continuar
                </div>
            )}

            {/* ENCABEZADO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem', borderBottom: '1px solid #26201B', paddingBottom: '1.75rem' }}>
                <div>
                    <span style={{ fontSize: '0.9rem', color: '#C5A059', letterSpacing: '0.15em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>{isOnline ? '🟢' : '🔴'}</span> PANEL DE {(usuarioSesion.rol || 'EMPLEADO').toUpperCase()}
                    </span>
                    <h1 style={{ fontFamily: 'serif', color: '#F3ECE0', margin: '0.4rem 0 0.6rem 0', fontSize: '2.6rem', lineHeight: 1.2 }}>
                        Gestión de Inventario y Pedidos
                    </h1>
                    <p style={{ margin: 0, color: '#aaa', fontSize: '1.05rem' }}>
                        Usuario activo: <strong style={{ color: '#F3ECE0' }}>{usuarioSesion.nombre || usuarioSesion.correo || 'Administrador Élite'}</strong>
                    </p>
                </div>
                <button
                    onClick={handleCerrarSesion}
                    style={{ padding: '0.85rem 1.6rem', backgroundColor: '#16120E', color: '#E2D9CC', border: '1px solid #382E26', borderRadius: '12px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                >
                    Cerrar Sesión
                </button>
            </div>

            {/* FILTRO DE VENTAS POR MES, DÍA Y HORA */}
            <div style={{ backgroundColor: '#16120E', padding: '1.5rem', borderRadius: '18px', border: '1px solid #26201B', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <span style={{ fontSize: '0.95rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.06em' }}>
                        📅 FILTRAR VENTAS POR MES, DÍA Y HORA
                    </span>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            type="month"
                            title="Filtrar por mes"
                            value={filtroMes}
                            onChange={(e) => {
                                setFiltroMes(e.target.value);
                                setFiltroFecha('');
                            }}
                            style={{ padding: '0.6rem 0.9rem', backgroundColor: '#0D0B0A', border: '1px solid #382E26', borderRadius: '10px', color: '#fff', fontSize: '0.9rem' }}
                        />

                        <input
                            type="date"
                            title="Filtrar por día exacto"
                            value={filtroFecha}
                            onChange={(e) => {
                                setFiltroFecha(e.target.value);
                                setFiltroMes('');
                            }}
                            style={{ padding: '0.6rem 0.9rem', backgroundColor: '#0D0B0A', border: '1px solid #382E26', borderRadius: '10px', color: '#fff', fontSize: '0.9rem' }}
                        />

                        <select
                            value={filtroHora}
                            onChange={(e) => setFiltroHora(e.target.value)}
                            style={{ padding: '0.6rem 0.9rem', backgroundColor: '#0D0B0A', border: '1px solid #382E26', borderRadius: '10px', color: '#fff', fontSize: '0.9rem' }}
                        >
                            <option value="">Todas las horas</option>
                            {Array.from({ length: 24 }, (_, h) => {
                                const hh = String(h).padStart(2, '0');
                                return (
                                    <option key={hh} value={hh}>
                                        {hh}:00 - {hh}:59 hrs
                                    </option>
                                );
                            })}
                        </select>

                        {hayFiltroVentas && (
                            <button
                                onClick={() => {
                                    setFiltroMes('');
                                    setFiltroFecha('');
                                    setFiltroHora('');
                                }}
                                style={{ padding: '0.6rem 1rem', backgroundColor: 'rgba(220, 38, 38, 0.15)', color: '#f87171', border: '1px solid #dc2626', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                            >
                                ✕ Limpiar filtro
                            </button>
                        )}
                    </div>
                </div>

                {hayFiltroVentas && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #26201B' }}>
                        {ventasEntregadas.length === 0 ? (
                            <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>
                                No hay ventas entregadas registradas en ese periodo.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                                {ventasEntregadas.map((v) => {
                                    const idV = v.codigo || `#BC-${v.idPedido || v.id}`;
                                    const fechaTxt = v.fechaPedido ? new Date(v.fechaPedido).toLocaleString() : 'Sin fecha';
                                    return (
                                        <div key={v.idPedido || v.id || Math.random()} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0D0B0A', padding: '0.65rem 1rem', borderRadius: '10px', border: '1px solid #26201B', fontSize: '0.9rem' }}>
                                            <div>
                                                <strong style={{ color: '#C5A059' }}>{idV}</strong>
                                                <span style={{ color: '#888', marginLeft: '0.75rem' }}>{fechaTxt}</span>
                                            </div>
                                            <strong style={{ color: '#4ade80' }}>${Number(v.total || 0).toFixed(2)}</strong>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* TARJETAS DE MÉTRICAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ backgroundColor: '#16120E', padding: '1.75rem', borderRadius: '18px', border: '1px solid #26201B' }}>
                    <span style={{ fontSize: '0.9rem', color: '#9E8E7E', display: 'block', marginBottom: '0.5rem', letterSpacing: '0.08em', fontWeight: 'bold' }}>
                        <span style={{ fontSize: '1.25rem', marginRight: '0.4rem' }}>💰</span> TOTAL VENDIDO {hayFiltroVentas ? '(FILTRADO)' : ''}
                    </span>
                    <strong style={{ fontSize: '2.4rem', color: '#4ade80', fontFamily: 'serif' }}>
                        ${Number(metricasMostradas.totalVendido).toFixed(2)}
                    </strong>
                </div>

                <div style={{ backgroundColor: '#16120E', padding: '1.75rem', borderRadius: '18px', border: '1px solid #26201B' }}>
                    <span style={{ fontSize: '0.9rem', color: '#9E8E7E', display: 'block', marginBottom: '0.5rem', letterSpacing: '0.08em', fontWeight: 'bold' }}>
                        <span style={{ fontSize: '1.25rem', marginRight: '0.4rem' }}>📦</span> PEDIDOS ENTREGADOS
                    </span>
                    <strong style={{ fontSize: '2.4rem', color: '#C5A059', fontFamily: 'serif' }}>
                        {metricasMostradas.totalPedidos}
                    </strong>
                </div>

                <div style={{ backgroundColor: '#16120E', padding: '1.75rem', borderRadius: '18px', border: '1px solid #26201B' }}>
                    <span style={{ fontSize: '0.9rem', color: '#9E8E7E', display: 'block', marginBottom: '0.5rem', letterSpacing: '0.08em', fontWeight: 'bold' }}>
                        <span style={{ fontSize: '1.25rem', marginRight: '0.4rem' }}>📊</span> TICKET PROMEDIO
                    </span>
                    <strong style={{ fontSize: '2.4rem', color: '#60a5fa', fontFamily: 'serif' }}>
                        ${Number(metricasMostradas.ticketPromedio).toFixed(2)}
                    </strong>
                </div>
            </div>

            {/* DASHBOARD DE PEDIDOS ACUMULADOS */}
            <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '20px', border: '1px solid #26201B', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '1rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>📜</span> DASHBOARD DE PEDIDOS ACUMULADOS ({pedidos.length})
                    </span>
                    <button
                        onClick={() => {
                            if (!navigator.onLine) {
                                mostrarError('Sin conexión a Internet', 'Reconectate a internet para poder continuar');
                                return;
                            }
                            obtenerPedidos();
                        }}
                        disabled={!isOnline}
                        style={{ background: '#0D0B0A', border: '1px solid #382E26', padding: '0.6rem 1.1rem', borderRadius: '10px', color: isOnline ? '#C5A059' : '#555', cursor: isOnline ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: 'bold' }}
                    >
                        🔄 Recargar Pedidos
                    </button>
                </div>

                {cargandoPedidos && pedidos.length === 0 ? (
                    <p style={{ color: '#aaa', textAlign: 'center', margin: '1.5rem 0', fontSize: '1.05rem' }}>Cargando pedidos...</p>
                ) : errorPedidos && pedidos.length === 0 ? (
                    <p style={{ color: '#fda4af', textAlign: 'center', margin: '1.5rem 0', fontSize: '1.05rem' }}>{errorPedidos}</p>
                ) : pedidos.length === 0 ? (
                    <p style={{ color: '#aaa', textAlign: 'center', margin: '1.5rem 0', fontSize: '1.05rem' }}>No hay pedidos registrados por el momento.</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                        {pedidos.map((ped) => {
                            const idCodigo = ped.codigo || `#BC-${ped.idPedido || ped.id}`;
                            const idNum = ped.idPedido || ped.id_pedido || ped.id;
                            const esSeleccionado = pedidoSeleccionado && (
                                (pedidoSeleccionado.idPedido && pedidoSeleccionado.idPedido === idNum) ||
                                (pedidoSeleccionado.codigo && pedidoSeleccionado.codigo === ped.codigo)
                            );

                            return (
                                <div
                                    key={idNum || ped.codigo || Math.random()}
                                    onClick={() => handleSeleccionarPedido(ped)}
                                    style={{
                                        backgroundColor: '#0D0B0A',
                                        padding: '1.35rem',
                                        borderRadius: '16px',
                                        border: esSeleccionado ? '2px solid #C5A059' : '1px solid #26201B',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <strong style={{ color: '#C5A059', fontSize: '1.2rem' }}>{idCodigo}</strong>
                                        <span style={{ fontSize: '0.95rem', color: '#9E8E7E' }}>Cliente: {ped.cliente || ped.nombreCliente || `Usuario #${ped.usuarioId || ''}`}</span>
                                        <span style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>Total: ${ped.total}</span>
                                    </div>
                                    <span style={{
                                        backgroundColor: ['LISTO', 'ENTREGADO'].includes((ped.estado || '').toUpperCase()) ? 'rgba(34, 197, 94, 0.15)' : ['EN PREPARACION', 'EN_PREPARACION'].includes((ped.estado || '').toUpperCase()) ? 'rgba(197, 160, 89, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                                        color: ['LISTO', 'ENTREGADO'].includes((ped.estado || '').toUpperCase()) ? '#4ade80' : ['EN PREPARACION', 'EN_PREPARACION'].includes((ped.estado || '').toUpperCase()) ? '#C5A059' : '#60a5fa',
                                        padding: '0.45rem 0.9rem',
                                        borderRadius: '14px',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}>
                                        {ped.estado || 'PENDIENTE'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* VERIFICAR / ENTREGAR PEDIDO POR CÓDIGO */}
            <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '20px', border: '1px solid #26201B', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '1rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.06em' }}>
                        🔎 VERIFICAR / ENTREGAR PEDIDO POR CÓDIGO
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#888' }}>Búsqueda rápida</span>
                </div>
                <form onSubmit={handleEntregarYBorrar} style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        disabled={!isOnline}
                        placeholder="CÓDIGO DEL PEDIDO (EJ: BC-X9123)"
                        value={codigoPedidoBorrar}
                        onChange={(e) => setCodigoPedidoBorrar(e.target.value)}
                        style={{ ...estiloInput, flex: 1, minWidth: '250px' }}
                    />
                    <button
                        type="submit"
                        disabled={!isOnline}
                        style={{
                            padding: '1rem 2rem',
                            backgroundColor: isOnline ? '#C5A059' : '#26201B',
                            color: isOnline ? '#000' : '#777',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            cursor: isOnline ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {isOnline ? '✅ Entregar y Borrar' : '📡 Sin conexión'}
                    </button>
                </form>
            </div>

            {/* DETALLE DEL PEDIDO SELECCIONADO */}
            {pedidoSeleccionado && (
                <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '20px', border: '1px solid #26201B', marginBottom: '2.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <span style={{ fontSize: '0.95rem', color: '#9E8E7E', letterSpacing: '0.08em', fontWeight: 'bold' }}>ATENDIENDO PEDIDO</span>
                        <span style={{ backgroundColor: 'rgba(197, 160, 89, 0.2)', color: '#C5A059', padding: '0.45rem 1rem', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {pedidoSeleccionado.estado || 'PENDIENTE'}
                        </span>
                    </div>

                    <h2 style={{ fontFamily: 'serif', color: '#C5A059', margin: '0 0 1.5rem 0', fontSize: '2.5rem' }}>
                        {pedidoSeleccionado.codigo || `#BC-${pedidoSeleccionado.idPedido || pedidoSeleccionado.id}`}
                    </h2>

                    <div style={{ backgroundColor: '#0D0B0A', padding: '1.35rem', borderRadius: '14px', border: '1px solid #26201B', marginBottom: '1.5rem', fontSize: '1rem', lineHeight: 1.7 }}>
                        <p style={{ margin: '0 0 0.5rem 0' }}><strong>Cliente / Usuario:</strong> {pedidoSeleccionado.cliente || pedidoSeleccionado.nombreCliente || pedidoSeleccionado.usuarioId || 'General'}</p>
                        <p style={{ margin: '0 0 0.5rem 0' }}><strong>Método de Pago:</strong> {pedidoSeleccionado.metodoPago || 'Pagar al recoger'}</p>
                        <p style={{ margin: 0 }}><strong>Fecha:</strong> {pedidoSeleccionado.fechaPedido ? new Date(pedidoSeleccionado.fechaPedido).toLocaleString() : 'Fecha no registrada'}</p>
                    </div>

                    <div style={{ backgroundColor: '#0D0B0A', padding: '1.35rem', borderRadius: '14px', border: '1px solid #26201B', marginBottom: '1.75rem' }}>
                        <span style={{ fontSize: '0.95rem', color: '#C5A059', fontWeight: 'bold', display: 'block', marginBottom: '1rem', letterSpacing: '0.06em' }}>
                            🛒 PRODUCTOS SOLICITADOS ({itemsPedido.length})
                        </span>
                        {itemsPedido.length === 0 ? (
                            <p style={{ color: '#aaa', margin: 0, fontSize: '1rem' }}>No hay detalles cargados para este pedido.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {itemsPedido.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', paddingBottom: '0.6rem', borderBottom: idx < itemsPedido.length - 1 ? '1px solid #1c1815' : 'none' }}>
                                        <span>{item.cantidad}x {item.nombreProducto || item.nombre || `Producto #${item.productoId}`}</span>
                                        <span style={{ color: '#C5A059', fontWeight: 'bold' }}>${(item.cantidad * item.precioUnitario).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => handleCambiarEstadoPedido('EN PREPARACION')}
                            disabled={!isOnline}
                            style={{
                                flex: 1,
                                minWidth: '200px',
                                padding: '1.1rem',
                                backgroundColor: isOnline ? '#26201B' : '#14110E',
                                color: isOnline ? '#F3ECE0' : '#555',
                                border: '1px solid #382E26',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                fontSize: '1.05rem',
                                cursor: isOnline ? 'pointer' : 'not-allowed'
                            }}
                        >
                            👨‍🍳 En Preparación
                        </button>
                        <button
                            onClick={() => handleCambiarEstadoPedido('LISTO')}
                            disabled={!isOnline}
                            style={{
                                flex: 1,
                                minWidth: '200px',
                                padding: '1.1rem',
                                backgroundColor: isOnline ? '#C5A059' : '#26201B',
                                color: isOnline ? '#000' : '#777',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                fontSize: '1.05rem',
                                cursor: isOnline ? 'pointer' : 'not-allowed'
                            }}
                        >
                            ✅ Marcar Listo
                        </button>
                    </div>
                </div>
            )}

            {/* INVENTARIO GENERAL */}
            <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '20px', border: '1px solid #26201B', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '1rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>📦</span> INVENTARIO GENERAL ({productosFiltradosInventario.length})
                    </span>

                    <input
                        type="text"
                        placeholder="🔍 Filtrar por nombre o categoría..."
                        value={filtroInventario}
                        onChange={(e) => {
                            setFiltroInventario(e.target.value);
                            setPaginaActual(1);
                        }}
                        style={{
                            padding: '0.65rem 1rem',
                            backgroundColor: '#0D0B0A',
                            border: '1px solid #382E26',
                            borderRadius: '10px',
                            color: '#fff',
                            fontSize: '0.95rem',
                            minWidth: '260px',
                            outline: 'none'
                        }}
                    />
                </div>

                {cargandoProductos ? (
                    <p style={{ color: '#aaa', textAlign: 'center', fontSize: '1.05rem', padding: '1.5rem 0' }}>Cargando inventario...</p>
                ) : errorProductos ? (
                    <p style={{ color: '#fda4af', textAlign: 'center', fontSize: '1.05rem', padding: '1.5rem 0' }}>{errorProductos}</p>
                ) : productosPaginados.length === 0 ? (
                    <p style={{ color: '#aaa', textAlign: 'center', fontSize: '1.05rem', padding: '1.5rem 0' }}>No se encontraron productos en el inventario.</p>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {productosPaginados.map((prod) => {
                                const idProd = prod.idProducto || prod.id_producto || prod.id;
                                const urlImg = prod.imagen || prod.urlImagen || prod.icono;
                                return (
                                    <div key={idProd} style={{
                                        backgroundColor: '#0D0B0A',
                                        padding: '1.25rem 1.5rem',
                                        borderRadius: '14px',
                                        border: '1px solid #26201B',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '1rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {urlImg && (
                                                <div style={{ width: '56px', height: '56px', flexShrink: 0, backgroundColor: '#16120E', borderRadius: '10px', border: '1px solid #26201B', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px' }}>
                                                    <img
                                                        src={urlImg}
                                                        alt={prod.nombre}
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#C5A059', fontWeight: 'bold' }}>#{idProd}</span>
                                                    <strong style={{ fontSize: '1.1rem', color: '#F3ECE0' }}>{prod.nombre}</strong>
                                                    <span style={{ fontSize: '0.8rem', backgroundColor: '#16120E', border: '1px solid #382E26', padding: '0.2rem 0.6rem', borderRadius: '8px', color: '#9E8E7E' }}>
                                                        {prod.categoria}
                                                    </span>
                                                </div>
                                                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.95rem', color: '#aaa' }}>
                                                    Precio: <strong style={{ color: '#4ade80' }}>${Number(prod.precio || 0).toFixed(2)}</strong> • Stock: <strong style={{ color: Number(prod.stock) <= 3 ? '#f87171' : '#F3ECE0' }}>{prod.stock} uds</strong>
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                                            <button
                                                onClick={() => handleEditarProducto(prod)}
                                                disabled={!isOnline}
                                                style={{
                                                    padding: '0.6rem 1.1rem',
                                                    backgroundColor: isOnline ? '#26201B' : '#14110E',
                                                    color: isOnline ? '#C5A059' : '#555',
                                                    border: '1px solid #382E26',
                                                    borderRadius: '10px',
                                                    cursor: isOnline ? 'pointer' : 'not-allowed',
                                                    fontWeight: 'bold',
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                ✏️ Editar
                                            </button>
                                            <button
                                                onClick={() => handleEliminarProducto(idProd)}
                                                disabled={!isOnline}
                                                style={{
                                                    padding: '0.6rem 1.1rem',
                                                    backgroundColor: isOnline ? 'rgba(220, 38, 38, 0.15)' : '#14110E',
                                                    color: isOnline ? '#f87171' : '#555',
                                                    border: isOnline ? '1px solid #dc2626' : '1px solid #382E26',
                                                    borderRadius: '10px',
                                                    cursor: isOnline ? 'pointer' : 'not-allowed',
                                                    fontWeight: 'bold',
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                🗑️ Eliminar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {totalPaginas > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                                <button
                                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                                    disabled={paginaSegura === 1}
                                    style={{ padding: '0.6rem 1.1rem', backgroundColor: '#0D0B0A', color: paginaSegura === 1 ? '#555' : '#C5A059', border: '1px solid #382E26', borderRadius: '10px', cursor: paginaSegura === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                                >
                                    ← Anterior
                                </button>
                                <span style={{ color: '#aaa', fontSize: '0.95rem' }}>
                                    Página <strong style={{ color: '#F3ECE0' }}>{paginaSegura}</strong> de <strong style={{ color: '#F3ECE0' }}>{totalPaginas}</strong>
                                </span>
                                <button
                                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                                    disabled={paginaSegura === totalPaginas}
                                    style={{ padding: '0.6rem 1.1rem', backgroundColor: '#0D0B0A', color: paginaSegura === totalPaginas ? '#555' : '#C5A059', border: '1px solid #382E26', borderRadius: '10px', cursor: paginaSegura === totalPaginas ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                                >
                                    Siguiente →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* BÚSQUEDA DIRECTA DE PRODUCTO POR ID */}
            <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '20px', border: '1px solid #26201B', marginBottom: '2.5rem' }}>
                <span style={{ fontSize: '1rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.06em', display: 'block', marginBottom: '1.25rem' }}>
                    🔍 CONSULTAR PRODUCTO POR ID
                </span>
                <form onSubmit={handleBuscarPorId} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <input
                        type="number"
                        disabled={!isOnline}
                        placeholder="Ingresa el ID del producto (ej: 1)"
                        value={idBusqueda}
                        onChange={(e) => setIdBusqueda(e.target.value)}
                        style={{ ...estiloInput, flex: 1, minWidth: '220px' }}
                    />
                    <button
                        type="submit"
                        disabled={!isOnline}
                        style={{
                            padding: '1rem 1.75rem',
                            backgroundColor: isOnline ? '#26201B' : '#14110E',
                            color: isOnline ? '#C5A059' : '#555',
                            border: '1px solid #382E26',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: isOnline ? 'pointer' : 'not-allowed'
                        }}
                    >
                        Buscar ID
                    </button>
                </form>

                {productoBuscado && (
                    <div style={{ marginTop: '1.25rem', padding: '1.25rem', backgroundColor: '#0D0B0A', borderRadius: '14px', border: '1px solid #C5A059', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <strong style={{ color: '#C5A059', fontSize: '1.15rem' }}>
                                #{productoBuscado.idProducto || productoBuscado.id} — {productoBuscado.nombre}
                            </strong>
                            <p style={{ margin: '0.35rem 0 0 0', color: '#aaa' }}>
                                Categoría: {productoBuscado.categoria} • Precio: ${Number(productoBuscado.precio || 0).toFixed(2)} • Stock: {productoBuscado.stock}
                            </p>
                        </div>
                        <button
                            onClick={() => handleEditarProducto(productoBuscado)}
                            disabled={!isOnline}
                            style={{
                                padding: '0.6rem 1.2rem',
                                backgroundColor: isOnline ? '#C5A059' : '#26201B',
                                color: isOnline ? '#000' : '#777',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: 'bold',
                                cursor: isOnline ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Editar este producto
                        </button>
                    </div>
                )}
            </div>

            {/* FORMULARIO PARA AGREGAR O EDITAR PRODUCTO */}
            <div style={{ backgroundColor: '#16120E', padding: '2rem', borderRadius: '20px', border: productoEditandoId ? '2px solid #C5A059' : '1px solid #26201B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '1.1rem', color: '#C5A059', fontWeight: 'bold', letterSpacing: '0.06em' }}>
                        {productoEditandoId ? `✏️ EDITANDO PRODUCTO #${productoEditandoId}` : '➕ AGREGAR NUEVO PRODUCTO AL CATÁLOGO'}
                    </span>
                    {productoEditandoId && (
                        <button
                            type="button"
                            onClick={handleCancelarEditar}
                            style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #dc2626', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Cancelar Edición
                        </button>
                    )}
                </div>

                {!isOnline && (
                    <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.35)', color: '#fda4af', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.25rem', fontSize: '0.95rem', fontWeight: 'bold' }}>
                        📡 Reconectate a internet para poder continuar
                    </div>
                )}

                <form onSubmit={handleGuardarProducto} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#9E8E7E', fontWeight: 'bold' }}>NOMBRE DEL PRODUCTO</label>
                        <input
                            type="text"
                            name="nombre"
                            disabled={!isOnline}
                            placeholder="Ej: Macallan 18 Años"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            required
                            style={estiloInput}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#9E8E7E', fontWeight: 'bold' }}>CATEGORÍA</label>
                        <select
                            name="categoria"
                            disabled={!isOnline}
                            value={formData.categoria}
                            onChange={handleInputChange}
                            style={estiloInput}
                        >
                            <option value="Whisky">Whisky</option>
                            <option value="Bourbon">Bourbon</option>
                            <option value="Tequila">Tequila</option>
                            <option value="Vino Tinto">Vino Tinto</option>
                            <option value="Vino Blanco">Vino Blanco</option>
                            <option value="Mezcal">Mezcal</option>
                            <option value="Coñac">Coñac</option>
                            <option value="Ginebra">Ginebra</option>
                            <option value="Ron">Ron</option>
                            <option value="Vodka">Vodka</option>
                            <option value="Champagne">Champagne</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#9E8E7E', fontWeight: 'bold' }}>PRECIO ($ MXN)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            name="precio"
                            disabled={!isOnline}
                            placeholder="0.00"
                            value={formData.precio}
                            onChange={handleInputChange}
                            required
                            style={estiloInput}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#9E8E7E', fontWeight: 'bold' }}>STOCK DISPONIBLE</label>
                        <input
                            type="number"
                            min="0"
                            name="stock"
                            disabled={!isOnline}
                            placeholder="Cantidad en inventario"
                            value={formData.stock}
                            onChange={handleInputChange}
                            required
                            style={estiloInput}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.85rem', color: '#9E8E7E', fontWeight: 'bold' }}>URL DE LA IMAGEN</label>
                        <input
                            type="text"
                            name="imagen"
                            disabled={!isOnline}
                            placeholder="https://..."
                            value={formData.imagen}
                            onChange={handleInputChange}
                            style={estiloInput}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.85rem', color: '#9E8E7E', fontWeight: 'bold' }}>DESCRIPCIÓN / NOTAS DE CATA</label>
                        <textarea
                            name="descripcion"
                            rows="3"
                            disabled={!isOnline}
                            placeholder="Notas de sabor, añejamiento, origen..."
                            value={formData.descripcion}
                            onChange={handleInputChange}
                            style={{ ...estiloInput, resize: 'vertical', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button
                            type="submit"
                            disabled={!isOnline}
                            style={{
                                flex: 1,
                                padding: '1.15rem',
                                backgroundColor: isOnline ? '#C5A059' : '#26201B',
                                color: isOnline ? '#000' : '#777',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                fontSize: '1.05rem',
                                cursor: isOnline ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {!isOnline
                                ? '📡 Reconectate a internet para poder continuar'
                                : productoEditandoId
                                    ? '💾 Guardar Cambios del Producto'
                                    : '➕ Registrar Producto en Catálogo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}