import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProductos, crearPedido } from '../../services/api';
import './Cliente.css';

const API_BASE_URL = 'https://buon-calice-fhfefadvd2bygphx.westcentralus-01.azurewebsites.net/api';
const API_PEDIDOS_URL = `${API_BASE_URL}/Pedidos`;
const API_PAGOS_URL = `${API_BASE_URL}/Pagos`;

const RenderImagenBotella = ({ url, alt, className = "w-full h-full object-contain p-2" }) => {
    const esUrlValida = typeof url === 'string' && (
        url.startsWith('http://') ||
        url.startsWith('https://') ||
        url.startsWith('data:image')
    );

    if (esUrlValida) {
        return (
            <img
                src={url}
                alt={alt || 'Botella'}
                className={className}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&h=400&fit=crop';
                }}
            />
        );
    }

    return (
        <div className="text-4xl flex items-center justify-center w-full h-full">
            {url || '🍷'}
        </div>
    );
};

export default function ClienteView() {
    const navigate = useNavigate();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [seccion, setSeccion] = useState('sec-catalogo');
    const [productos, setProductos] = useState([]);
    const [cargandoApi, setCargandoApi] = useState(true);

    // Persistencia del carrito en localStorage para no perder artículos sin conexión
    const [carrito, setCarrito] = useState(() => {
        try {
            const guardado = localStorage.getItem('carrito_buoncalice');
            return guardado ? JSON.parse(guardado) : [];
        } catch {
            return [];
        }
    });

    const [prodSeleccionado, setProdSeleccionado] = useState(null);
    const [cantSeleccionada, setCantSeleccionada] = useState(1);
    const [filtroCat, setFiltroCat] = useState('Todos');
    const [busqueda, setBusqueda] = useState('');
    const [mostrarBuscador, setMostrarBuscador] = useState(false);
    const [splashVisible, setSplashVisible] = useState(true);

    // Paginación de 10 en 10 para "Todos" y cada categoría
    const [paginaCatalogo, setPaginaCatalogo] = useState(1);
    const PRODUCTOS_POR_PAGINA = 10;

    const [usuarioSesion, setUsuarioSesion] = useState(null);

    const [ultimoPedido, setUltimoPedido] = useState(() => {
        try {
            const data = localStorage.getItem('ultimoPedido');
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    });

    // Historial completo de pedidos anteriores del cliente
    const [historialPedidos, setHistorialPedidos] = useState([]);
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
    const [pedidoExpandidoId, setPedidoExpandidoId] = useState(null);

    const [cliNombre, setCliNombre] = useState('');
    const [cliCorreo, setCliCorreo] = useState('');
    const [cliTelefono, setCliTelefono] = useState('');
    const [errorTelefono, setErrorTelefono] = useState('');
    const [metodoPago, setMetodoPago] = useState('Pagar en línea');
    const [procesandoPago, setProcesandoPago] = useState(false);

    const [perfil, setPerfil] = useState({
        nombre: 'No registrado',
        correo: 'No registrado',
        telefono: 'No registrado'
    });

    // Sincronizar carrito en localStorage cada vez que cambie
    useEffect(() => {
        try {
            localStorage.setItem('carrito_buoncalice', JSON.stringify(carrito));
        } catch (e) {
            console.error('Error guardando carrito local:', e);
        }
    }, [carrito]);

    // Detección de conexión a internet en tiempo real
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

    // Cargar sesión del cliente y splash screen
    useEffect(() => {
        const timer = setTimeout(() => {
            setSplashVisible(false);
        }, 1500);

        const clienteGuardado = localStorage.getItem('cliente_buoncalice') || localStorage.getItem('usuario_cliente');
        if (clienteGuardado) {
            try {
                const parsed = JSON.parse(clienteGuardado);
                setUsuarioSesion(parsed);
                setCliNombre(parsed.nombre || '');
                setCliCorreo(parsed.correo || '');
                setCliTelefono(parsed.telefono || '');
                setPerfil({
                    nombre: parsed.nombre || 'Sin nombre',
                    correo: parsed.correo || 'Sin correo',
                    telefono: parsed.telefono || 'Sin teléfono'
                });
            } catch (e) {
                console.error("Error al leer la sesión del cliente", e);
            }
        }

        return () => clearTimeout(timer);
    }, []);

    // Validar regreso oficial desde Stripe Checkout (?pago=exito o ?pago=cancelado)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const estadoPago = params.get('pago');
        const sessionId = params.get('session_id');
        const pedidoId = params.get('pedidoId');

        if (!estadoPago || !pedidoId) return;

        const verificarRetornoStripe = async () => {
            setSplashVisible(false);

            if (estadoPago === 'exito' && sessionId) {
                try {
                    const res = await fetch(`${API_PAGOS_URL}/confirmar-pago`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: sessionId,
                            pedidoId: parseInt(pedidoId, 10)
                        })
                    });

                    const data = await res.json();

                    if (res.ok && data.pagado) {
                        setCarrito([]);
                        localStorage.removeItem('carrito_buoncalice');

                        const pedidoPrevio = JSON.parse(localStorage.getItem('ultimoPedido') || '{}');
                        const pedidoConfirmado = {
                            ...pedidoPrevio,
                            idPedido: parseInt(pedidoId, 10),
                            codigo: pedidoPrevio.codigo || `BC-${pedidoId}`,
                            metodoPago: `Stripe PAGADO (${data.transaccionId || 'Confirmado'})`,
                            estado: pedidoPrevio.estado || 'PENDIENTE'
                        };
                        localStorage.setItem('ultimoPedido', JSON.stringify(pedidoConfirmado));
                        setUltimoPedido(pedidoConfirmado);
                        setSeccion('sec-exito');
                    } else {
                        alert(`⚠️ Stripe aún reporta el estado: ${data.estado || 'pendiente'}. Tu pedido #${pedidoId} sigue como PENDIENTE.`);
                        setSeccion('sec-estado');
                    }
                } catch (err) {
                    console.error('Error al confirmar pago con Stripe:', err);
                    alert('No se pudo validar el pago con el servidor. Revisa tu conexión.');
                }
            } else if (estadoPago === 'cancelado') {
                alert(`❌ Pago cancelado o rechazado en Stripe. Tu pedido #${pedidoId} permanece PENDIENTE en el sistema.`);
                setSeccion('sec-estado');
            }

            // Limpiar parámetros de la URL para evitar re-ejecuciones al recargar
            window.history.replaceState({}, document.title, '/');
        };

        verificarRetornoStripe();
    }, []);

    // Cargar catálogo al iniciar y recargarlo automáticamente si vuelve internet
    useEffect(() => {
        if (!isOnline) {
            setCargandoApi(false);
            return;
        }

        let activo = true;
        const cargarCatalogo = async () => {
            try {
                setCargandoApi(true);
                const data = await getProductos(true);
                if (!activo) return;
                const adaptados = (data || []).map(p => ({
                    id: p.idProducto || p.id,
                    nombre: p.nombre,
                    categoria: p.categoria || 'Vino Tinto',
                    precio: p.precio,
                    stock: p.stock,
                    icono: p.icono || p.imagenUrl || p.imagen || '',
                    desc: p.descripcion || 'Selección exclusiva de la casa.'
                }));
                setProductos(adaptados);
            } catch (error) {
                console.error("Error conectando con la API de Buon Calice:", error);
            } finally {
                if (activo) setCargandoApi(false);
            }
        };

        cargarCatalogo();
        return () => { activo = false; };
    }, [isOnline]);

    // Función para cargar el historial completo de pedidos del cliente desde Azure
    const cargarHistorialPedidos = async () => {
        if (!navigator.onLine) return;

        const clienteGuardado = localStorage.getItem('cliente_buoncalice') || localStorage.getItem('usuario_cliente');
        const usuarioActivo = clienteGuardado ? JSON.parse(clienteGuardado) : usuarioSesion;

        if (!usuarioActivo) {
            setHistorialPedidos([]);
            return;
        }

        const idUsuario = Number(usuarioActivo.id_usuario || usuarioActivo.idUsuario || usuarioActivo.id);
        if (!idUsuario || isNaN(idUsuario)) {
            setHistorialPedidos([]);
            return;
        }

        try {
            setCargandoHistorial(true);
            const res = await fetch(`${API_PEDIDOS_URL}?usuarioId=${idUsuario}`);
            if (!res.ok) return;
            const data = await res.json();
            const lista = Array.isArray(data) ? data : [];

            setHistorialPedidos(lista);
        } catch (err) {
            console.error('Error cargando historial de pedidos:', err);
        } finally {
            setCargandoHistorial(false);
        }
    };

    // Cargar historial automáticamente al entrar a "Pedido" o "Perfil"
    useEffect(() => {
        if ((seccion === 'sec-estado' || seccion === 'sec-perfil') && isOnline) {
            cargarHistorialPedidos();
        }
    }, [seccion, isOnline, usuarioSesion]);

    // Polling para rastrear pedidos en tiempo real desde Azure
    useEffect(() => {
        if (!ultimoPedido || !isOnline) return;

        const idBuscar = ultimoPedido.idPedido || ultimoPedido.id_pedido || ultimoPedido.id;
        if (!idBuscar) return;

        const consultarEstado = async () => {
            if (!navigator.onLine) return;
            try {
                const res = await fetch(`${API_PEDIDOS_URL}/${idBuscar}`);
                if (res.ok) {
                    const data = await res.json();
                    const pedidoApi = data.pedido || data;
                    const nuevoEstado = pedidoApi?.estado || pedidoApi?.Estado;

                    if (nuevoEstado && nuevoEstado !== ultimoPedido.estado) {
                        const pedidoActualizado = { ...ultimoPedido, estado: nuevoEstado };
                        setUltimoPedido(pedidoActualizado);
                        localStorage.setItem('ultimoPedido', JSON.stringify(pedidoActualizado));
                        if (seccion === 'sec-estado') {
                            cargarHistorialPedidos();
                        }
                    }
                }
            } catch (err) {
                console.log('Esperando actualización de estado...', err);
            }
        };

        consultarEstado();
        const interval = setInterval(consultarEstado, 4000);

        return () => clearInterval(interval);
    }, [ultimoPedido, isOnline, seccion]);

    const verDetalle = (prod) => {
        if (!navigator.onLine) {
            alert('Para seguir comprando reconectate a internet');
            return;
        }
        setProdSeleccionado(prod);
        setCantSeleccionada(1);
        setSeccion('sec-detalle');
    };

    const cambiarCant = (delta) => {
        if (prodSeleccionado) {
            const nueva = cantSeleccionada + delta;
            if (nueva >= 1 && nueva <= prodSeleccionado.stock) {
                setCantSeleccionada(nueva);
            }
        }
    };

    const agregarCarrito = () => {
        if (!navigator.onLine) {
            alert('Para seguir comprando reconectate a internet');
            return;
        }
        if (!prodSeleccionado || prodSeleccionado.stock <= 0) {
            alert('Producto agotado');
            return;
        }
        setCarrito((prev) => {
            const idx = prev.findIndex((item) => item.id === prodSeleccionado.id);
            if (idx > -1) {
                const copia = [...prev];
                copia[idx].cantidad = Math.min(prodSeleccionado.stock, copia[idx].cantidad + cantSeleccionada);
                return copia;
            }
            return [...prev, { ...prodSeleccionado, cantidad: cantSeleccionada }];
        });
        alert('Producto añadido al carrito.');
        setSeccion('sec-carrito');
    };

    const eliminarDelCarrito = (idProducto) => {
        if (!navigator.onLine) {
            alert('Para seguir comprando reconectate a internet');
            return;
        }
        setCarrito((prev) => prev.filter((item) => item.id !== idProducto));
    };

    // Volver a pedir los artículos de un pedido anterior
    const volverAPedir = (pedidoHistorial) => {
        if (!navigator.onLine) {
            alert('Para seguir comprando reconectate a internet');
            return;
        }

        const detalles = pedidoHistorial.productos || pedidoHistorial.detalles || pedidoHistorial.items || [];
        if (detalles.length === 0) {
            alert('Este pedido no tiene el desglose de productos disponible.');
            return;
        }

        let agregados = 0;
        setCarrito((prev) => {
            const copia = [...prev];
            detalles.forEach((det) => {
                const idProd = det.productoId || det.idProducto || det.id;
                const prodCatalogo = productos.find((p) => p.id === idProd);
                if (prodCatalogo && prodCatalogo.stock > 0) {
                    const cantDeseada = Math.min(prodCatalogo.stock, Number(det.cantidad || 1));
                    const idxExistente = copia.findIndex((item) => item.id === idProd);
                    if (idxExistente > -1) {
                        copia[idxExistente].cantidad = Math.min(prodCatalogo.stock, copia[idxExistente].cantidad + cantDeseada);
                    } else {
                        copia.push({ ...prodCatalogo, cantidad: cantDeseada });
                    }
                    agregados += 1;
                }
            });
            return copia;
        });

        if (agregados > 0) {
            alert(`Se añadieron ${agregados} producto(s) disponibles a tu carrito.`);
            setSeccion('sec-carrito');
        } else {
            alert('Los productos de este pedido se encuentran agotados actualmente.');
        }
    };

    const confirmarYEnviarPedido = async (e) => {
        e.preventDefault();

        if (!navigator.onLine) {
            alert('Para seguir comprando reconectate a internet');
            return;
        }

        const clienteGuardado = localStorage.getItem('cliente_buoncalice') || localStorage.getItem('usuario_cliente');
        const usuarioActivo = clienteGuardado ? JSON.parse(clienteGuardado) : usuarioSesion;

        // Validar que el teléfono coincida con el registrado en la sesión del cliente
        const telefonoGuardado = (usuarioActivo?.telefono || '').toString().replace(/\D/g, '');
        const telefonoIngresado = (cliTelefono || '').toString().replace(/\D/g, '');

        if (telefonoGuardado && telefonoIngresado !== telefonoGuardado) {
            setErrorTelefono('Ingresa el numero anteriormente ingresado');
            alert('Ingresa el numero anteriormente ingresado');
            return;
        }

        setErrorTelefono('');
        setProcesandoPago(true);

        const idUsuarioReal = usuarioActivo
            ? (usuarioActivo.id_usuario || usuarioActivo.idUsuario || usuarioActivo.id)
            : 1;

        const total = carrito.reduce((acc, curr) => acc + curr.precio * curr.cantidad, 0);
        const esPagoStripe = metodoPago === 'Pagar en línea';
        const metodoInicial = esPagoStripe ? 'Stripe PENDIENTE' : 'Pagar al recoger';

        try {
            // 1. Registrar el pedido en SQL Server (en estado PENDIENTE)
            const datosPedidoDTO = {
                usuarioId: parseInt(idUsuarioReal),
                metodoPago: metodoInicial,
                productos: carrito.map(item => ({
                    productoId: item.id,
                    cantidad: item.cantidad,
                    precioUnitario: item.precio
                }))
            };

            const respuestaAPI = await crearPedido(datosPedidoDTO);

            const idGenerado = respuestaAPI?.idPedido || respuestaAPI?.id_pedido || respuestaAPI?.id;
            const codigoReal = respuestaAPI?.codigo || (idGenerado ? `BC-${idGenerado}` : 'BC-PENDIENTE');

            const nuevoPedido = {
                idPedido: idGenerado,
                codigo: codigoReal,
                cliente: {
                    nombre: usuarioActivo?.nombre || cliNombre,
                    correo: usuarioActivo?.correo || cliCorreo,
                    telefono: usuarioActivo?.telefono || cliTelefono
                },
                items: carrito,
                total: respuestaAPI?.total || total,
                metodoPago: metodoInicial,
                estado: respuestaAPI?.estado || 'PENDIENTE'
            };

            localStorage.setItem('ultimoPedido', JSON.stringify(nuevoPedido));
            setUltimoPedido(nuevoPedido);

            // 2. Si eligió pago en línea, generar sesión de Stripe Checkout y redirigir
            if (esPagoStripe) {
                const resStripe = await fetch(`${API_PAGOS_URL}/crear-checkout/${idGenerado}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        urlBase: window.location.origin
                    })
                });

                const dataStripe = await resStripe.json();

                if (!resStripe.ok || !dataStripe.url) {
                    throw new Error(dataStripe.mensaje || dataStripe.error || 'No se pudo iniciar la pasarela de Stripe.');
                }

                // Redirigir al formulario oficial de Stripe Checkout
                window.location.href = dataStripe.url;
                return;
            }

            // 3. Si eligió pagar al recoger en sucursal, finalizar flujo directo
            const data = await getProductos(true);
            setProductos((data || []).map(p => ({
                id: p.idProducto || p.id,
                nombre: p.nombre,
                categoria: p.categoria || 'Vino Tinto',
                precio: p.precio,
                stock: p.stock,
                icono: p.icono || p.imagenUrl || p.imagen || '',
                desc: p.descripcion || 'Selección exclusiva de la casa.'
            })));

            setCarrito([]);
            localStorage.removeItem('carrito_buoncalice');
            setSeccion('sec-exito');
        } catch (err) {
            alert('Error al procesar el pedido: ' + err.message);
        } finally {
            setProcesandoPago(false);
        }
    };

    const handleCerrarSesion = () => {
        localStorage.removeItem('cliente_buoncalice');
        localStorage.removeItem('usuario_cliente');
        setUsuarioSesion(null);
        setHistorialPedidos([]);
        setPerfil({ nombre: 'No registrado', correo: 'No registrado', telefono: 'No registrado' });
        setCliNombre('');
        setCliCorreo('');
        setCliTelefono('');
        setErrorTelefono('');
        alert('Sesión de cliente cerrada correctamente.');
    };

    const categoriasUnicas = ['Todos', 'Whisky', 'Bourbon', 'Vino Tinto', 'Vino Blanco', 'Tequila', 'Ron'];

    const productosFiltrados = productos.filter((p) => {
        const coincideCat = filtroCat === 'Todos' || p.categoria === filtroCat;
        const coincideBusqueda =
            busqueda.trim() === '' ||
            p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.categoria.toLowerCase().includes(busqueda.toLowerCase());
        return coincideCat && coincideBusqueda;
    });

    // Cálculo de paginación (10 en 10)
    const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / PRODUCTOS_POR_PAGINA));
    const paginaSegura = Math.min(paginaCatalogo, totalPaginas);
    const indiceInicio = (paginaSegura - 1) * PRODUCTOS_POR_PAGINA;
    const productosPaginados = productosFiltrados.slice(indiceInicio, indiceInicio + PRODUCTOS_POR_PAGINA);

    // Agrupa por categoría únicamente los 10 productos de la página actual
    const categoriasAgrupadas = productosPaginados.reduce((acc, p) => {
        if (!acc[p.categoria]) acc[p.categoria] = [];
        acc[p.categoria].push(p);
        return acc;
    }, {});

    const cambiarPagina = (nuevaPagina) => {
        setPaginaCatalogo(nuevaPagina);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const totalCarrito = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
    const estadoActual = (ultimoPedido?.estado || '').toUpperCase();

    const obtenerEstiloEstado = (estadoRaw) => {
        const est = (estadoRaw || 'PENDIENTE').toUpperCase();
        if (est === 'ENTREGADO') {
            return { texto: 'Entregado', clase: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
        }
        if (est === 'LISTO') {
            return { texto: 'Listo para recoger', clase: 'text-sky-400 bg-sky-500/15 border-sky-500/30' };
        }
        if (est === 'EN PREPARACION' || est === 'EN_PREPARACION') {
            return { texto: 'En Preparación', clase: 'text-[#C5A059] bg-[#C5A059]/15 border-[#C5A059]/30' };
        }
        return { texto: 'Pendiente', clase: 'text-amber-400 bg-amber-500/15 border-amber-500/30' };
    };

    return (
        <div className="bg-[#050404] text-[#E2D9CC] min-h-screen pb-24 font-sans selection:bg-[#C5A059] selection:text-black">
            {splashVisible && (
                <div className="fixed inset-0 bg-[#050404] z-[100] flex flex-col items-center justify-center space-y-6 transition-opacity duration-500">
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-24 h-24 bg-[#C5A059]/10 rounded-full blur-xl animate-pulse"></div>
                        <div className="text-6xl animate-bounce">🍷</div>
                    </div>
                    <div className="text-center space-y-2">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-[#C5A059] block">Exclusividad & Calidad</span>
                        <h1 className="text-3xl font-serif text-[#F3ECE0] tracking-wide">ÉLITE VINATERÍA</h1>
                    </div>
                    <div className="w-6 h-6 border-2 border-[#26201B] border-t-[#C5A059] rounded-full animate-spin"></div>
                </div>
            )}

            <header className="bg-[#16120E] border-b border-[#26201B] p-4 sticky top-0 z-50 space-y-3">
                <div className="max-w-md mx-auto flex justify-between items-center">
                    <div>
                        <span className="text-[10px] uppercase tracking-widest text-[#C5A059]">Boutique</span>
                        <h1 className="text-xl font-serif text-[#F3ECE0]">🍷 ÉLITE VINATERÍA</h1>
                    </div>
                    <div className="flex gap-4 text-lg text-[#9E8E7E]">
                        <button onClick={() => setMostrarBuscador(!mostrarBuscador)} className="hover:text-[#C5A059] transition">🔍</button>
                        <button onClick={() => setSeccion('sec-perfil')} className="hover:text-[#C5A059] transition">👤</button>
                    </div>
                </div>

                {/* AVISO DE SIN CONEXIÓN A INTERNET */}
                {!isOnline && (
                    <div className="max-w-md mx-auto bg-rose-500/15 border border-rose-500/40 text-rose-300 px-4 py-2.5 rounded-xl text-xs text-center font-semibold">
                        📡 Para seguir comprando reconectate a internet
                        {carrito.length > 0 && (
                            <span className="block text-[11px] text-[#E2D9CC] font-normal mt-0.5">
                                Tus {carrito.reduce((acc, item) => acc + item.cantidad, 0)} artículo(s) del carrito están guardados de forma segura.
                            </span>
                        )}
                    </div>
                )}

                {mostrarBuscador && (
                    <div className="max-w-md mx-auto pt-1">
                        <div className="relative">
                            <input
                                type="text"
                                value={busqueda}
                                onChange={(e) => {
                                    setBusqueda(e.target.value);
                                    setPaginaCatalogo(1);
                                }}
                                placeholder="Buscar vino, tequila, whisky..."
                                className="w-full bg-[#0D0B0A] border border-[#C5A059]/60 text-white text-xs px-4 py-3 rounded-xl focus:outline-none focus:border-[#C5A059]"
                            />
                            <button
                                onClick={() => {
                                    setBusqueda('');
                                    setPaginaCatalogo(1);
                                    setMostrarBuscador(false);
                                }}
                                className="absolute right-3 top-3 text-xs text-[#9E8E7E]"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main className="max-w-md mx-auto p-4 space-y-6">
                {seccion === 'sec-catalogo' && (
                    <section className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-xs text-[#9E8E7E]">Selección Exclusiva</span>
                                <h2 className="text-lg font-serif text-[#F3ECE0]">Nuestra Cava y Licores</h2>
                            </div>
                            <span className="text-[11px] text-[#9E8E7E]">
                                {productosFiltrados.length} producto(s)
                            </span>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                            {categoriasUnicas.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        setFiltroCat(cat);
                                        setPaginaCatalogo(1);
                                    }}
                                    className={`px-4 py-2 rounded-xl whitespace-nowrap transition ${filtroCat === cat
                                        ? 'bg-[#C5A059] text-black font-semibold'
                                        : 'bg-[#16120E] border border-[#26201B] text-[#9E8E7E]'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-6">
                            {cargandoApi ? (
                                <div className="text-center text-[#9E8E7E] py-12 text-xs">Cargando catálogo desde SQL Server...</div>
                            ) : !isOnline && productos.length === 0 ? (
                                <div className="text-center text-rose-300 py-12 text-xs">
                                    Para seguir comprando reconectate a internet
                                </div>
                            ) : Object.keys(categoriasAgrupadas).length === 0 ? (
                                <div className="text-center text-[#9E8E7E] py-12 text-xs">No se encontraron productos disponibles.</div>
                            ) : (
                                <>
                                    {Object.keys(categoriasAgrupadas).map((catNombre) => (
                                        <div key={catNombre} className="space-y-3">
                                            <div className="flex items-center justify-between border-b border-[#26201B] pb-2">
                                                <h3 className="text-xs uppercase tracking-widest text-[#C5A059] font-bold">{catNombre}</h3>
                                                <span className="text-[10px] text-[#9E8E7E]">{categoriasAgrupadas[catNombre].length} en esta página</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {categoriasAgrupadas[catNombre].map((p) => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => verDetalle(p)}
                                                        className={`bg-[#16120E] border border-[#26201B] p-3 rounded-2xl space-y-2 transition flex flex-col justify-between ${isOnline ? 'cursor-pointer hover:border-[#C5A059]/50' : 'opacity-60 cursor-not-allowed'}`}
                                                    >
                                                        <div className="bg-[#0D0B0A] h-28 w-full rounded-xl flex items-center justify-center overflow-hidden p-2">
                                                            <RenderImagenBotella url={p.icono} alt={p.nombre} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-semibold text-[#F3ECE0] line-clamp-1">{p.nombre}</h4>
                                                            <p className="text-sm font-bold text-[#D4AF37]">${p.precio}.00</p>
                                                        </div>
                                                        <span
                                                            className={`text-[10px] ${p.stock > 0
                                                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                                : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                                                                } border px-2 py-0.5 rounded-full inline-block self-start`}
                                                        >
                                                            {p.stock > 0 ? `Disp: ${p.stock}` : 'Agotado'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {/* CONTROLES DE PAGINACIÓN (10 EN 10) */}
                                    {totalPaginas > 1 && (
                                        <div className="flex items-center justify-between pt-4 border-t border-[#26201B] text-xs">
                                            <button
                                                onClick={() => cambiarPagina(Math.max(1, paginaSegura - 1))}
                                                disabled={paginaSegura === 1}
                                                className={`px-4 py-2.5 rounded-xl border transition font-semibold ${paginaSegura === 1
                                                    ? 'bg-[#0D0B0A] border-[#1c1815] text-[#555] cursor-not-allowed'
                                                    : 'bg-[#16120E] border-[#382E26] text-[#C5A059] hover:border-[#C5A059]'
                                                    }`}
                                            >
                                                ← Anterior
                                            </button>

                                            <span className="text-[#9E8E7E]">
                                                Página <strong className="text-[#F3ECE0]">{paginaSegura}</strong> de <strong className="text-[#F3ECE0]">{totalPaginas}</strong>
                                            </span>

                                            <button
                                                onClick={() => cambiarPagina(Math.min(totalPaginas, paginaSegura + 1))}
                                                disabled={paginaSegura === totalPaginas}
                                                className={`px-4 py-2.5 rounded-xl border transition font-semibold ${paginaSegura === totalPaginas
                                                    ? 'bg-[#0D0B0A] border-[#1c1815] text-[#555] cursor-not-allowed'
                                                    : 'bg-[#16120E] border-[#382E26] text-[#C5A059] hover:border-[#C5A059]'
                                                    }`}
                                            >
                                                Siguiente →
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </section>
                )}

                {seccion === 'sec-detalle' && prodSeleccionado && (
                    <section className="space-y-5">
                        <button onClick={() => setSeccion('sec-catalogo')} className="text-xs text-[#C5A059] flex items-center gap-1">
                            ← Regresar al catálogo
                        </button>

                        <div className="bg-[#16120E] border border-[#26201B] p-6 rounded-2xl text-center space-y-4">
                            <div className="bg-[#0D0B0A] h-48 w-full rounded-2xl flex items-center justify-center overflow-hidden p-4">
                                <RenderImagenBotella url={prodSeleccionado.icono} alt={prodSeleccionado.nombre} />
                            </div>
                            <div>
                                <h2 className="text-xl font-serif text-[#F3ECE0]">{prodSeleccionado.nombre}</h2>
                                <p className="text-2xl font-bold text-[#D4AF37] mt-1">${prodSeleccionado.precio}.00</p>
                            </div>
                            <p className="text-xs text-emerald-400">Disponible: {prodSeleccionado.stock} unidades</p>
                            <p className="text-xs text-[#9E8E7E]">{prodSeleccionado.desc}</p>

                            <div className="flex justify-center items-center gap-4 py-2">
                                <button onClick={() => cambiarCant(-1)} disabled={!isOnline} className="w-8 h-8 rounded-lg bg-[#0D0B0A] border border-[#382E26] text-white font-bold disabled:opacity-40">-</button>
                                <span className="text-sm font-bold text-[#F3ECE0]">{cantSeleccionada}</span>
                                <button onClick={() => cambiarCant(1)} disabled={!isOnline} className="w-8 h-8 rounded-lg bg-[#0D0B0A] border border-[#382E26] text-white font-bold disabled:opacity-40">+</button>
                            </div>

                            <button
                                onClick={agregarCarrito}
                                disabled={!isOnline}
                                className={`w-full font-bold text-xs py-3 rounded-xl transition ${isOnline ? 'bg-[#C5A059] hover:bg-[#B38E47] text-black' : 'bg-[#26201B] text-[#777] cursor-not-allowed'}`}
                            >
                                {isOnline ? 'AGREGAR AL CARRITO' : 'PARA SEGUIR COMPRANDO RECONECTATE A INTERNET'}
                            </button>
                        </div>
                    </section>
                )}

                {seccion === 'sec-carrito' && (
                    <section className="space-y-4">
                        <h3 className="text-xs uppercase tracking-wider text-[#C5A059] font-medium">Tu Carrito de Compras</h3>
                        <div className="bg-[#16120E] border border-[#26201B] p-4 rounded-2xl space-y-3 text-xs">
                            {carrito.length === 0 ? (
                                <p className="text-center text-[#9E8E7E]">El carrito está vacío</p>
                            ) : (
                                <>
                                    {carrito.map((item) => (
                                        <div key={item.id} className="flex justify-between items-center border-b border-[#26201B] pb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-9 h-9 bg-[#0D0B0A] rounded overflow-hidden flex-shrink-0 p-0.5">
                                                    <RenderImagenBotella url={item.icono} alt={item.nombre} />
                                                </div>
                                                <span>{item.nombre} x {item.cantidad}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[#D4AF37] font-bold">${item.precio * item.cantidad}.00</span>
                                                <button
                                                    onClick={() => eliminarDelCarrito(item.id)}
                                                    disabled={!isOnline}
                                                    title="Quitar artículo"
                                                    className="text-rose-400 hover:text-rose-300 font-bold disabled:opacity-40"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold text-sm text-[#F3ECE0] pt-1">
                                        <span>Subtotal</span>
                                        <span className="text-[#D4AF37]">${totalCarrito}.00</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {carrito.length > 0 && (
                            <button
                                onClick={() => {
                                    if (!navigator.onLine) {
                                        alert('Para seguir comprando reconectate a internet');
                                        return;
                                    }
                                    setErrorTelefono('');
                                    setSeccion('sec-confirmacion');
                                }}
                                disabled={!isOnline}
                                className={`w-full font-bold text-xs py-3 rounded-xl transition ${isOnline ? 'bg-[#C5A059] hover:bg-[#B38E47] text-black' : 'bg-[#26201B] text-[#777] cursor-not-allowed'}`}
                            >
                                {isOnline ? 'CONTINUAR PEDIDO' : 'PARA SEGUIR COMPRANDO RECONECTATE A INTERNET'}
                            </button>
                        )}
                    </section>
                )}

                {seccion === 'sec-confirmacion' && (
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs uppercase tracking-wider text-[#C5A059] font-medium">Datos de Contacto y Pago</h3>
                            <button onClick={() => setSeccion('sec-carrito')} className="text-[11px] text-[#9E8E7E] hover:text-[#C5A059]">
                                ← Volver al carrito
                            </button>
                        </div>

                        <form onSubmit={confirmarYEnviarPedido} className="bg-[#16120E] border border-[#26201B] p-5 rounded-2xl space-y-4 text-xs">
                            <div className="space-y-3 border-b border-[#26201B] pb-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-[#F3ECE0] font-semibold">1. Datos del Cliente</h4>
                                    {usuarioSesion && (
                                        <span className="text-[10px] bg-[#C5A059]/20 text-[#C5A059] px-2 py-0.5 rounded-md font-bold">
                                            ✓ Sesión Activa
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    required
                                    disabled={!isOnline || procesandoPago}
                                    placeholder="Nombre completo"
                                    value={cliNombre}
                                    onChange={(e) => setCliNombre(e.target.value)}
                                    className="w-full bg-[#0D0B0A] border border-[#382E26] text-white p-3 rounded-xl focus:outline-none focus:border-[#C5A059] disabled:opacity-50"
                                />
                                <input
                                    type="email"
                                    required
                                    disabled={!isOnline || procesandoPago}
                                    placeholder="Correo electrónico"
                                    value={cliCorreo}
                                    onChange={(e) => setCliCorreo(e.target.value)}
                                    className="w-full bg-[#0D0B0A] border border-[#382E26] text-white p-3 rounded-xl focus:outline-none focus:border-[#C5A059] disabled:opacity-50"
                                />
                                <div className="space-y-1">
                                    <input
                                        type="tel"
                                        required
                                        disabled={!isOnline || procesandoPago}
                                        placeholder="Teléfono"
                                        value={cliTelefono}
                                        onChange={(e) => {
                                            const valor = e.target.value;
                                            setCliTelefono(valor);
                                            const telGuardado = (usuarioSesion?.telefono || '').toString().replace(/\D/g, '');
                                            const telActual = valor.replace(/\D/g, '');
                                            if (telGuardado && telActual !== telGuardado) {
                                                setErrorTelefono('Ingresa el numero anteriormente ingresado');
                                            } else {
                                                setErrorTelefono('');
                                            }
                                        }}
                                        className={`w-full bg-[#0D0B0A] border ${errorTelefono ? 'border-rose-500' : 'border-[#382E26]'} text-white p-3 rounded-xl focus:outline-none focus:border-[#C5A059] disabled:opacity-50`}
                                    />
                                    {errorTelefono && (
                                        <p className="text-[11px] text-rose-400 font-medium pl-1">
                                            {errorTelefono}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="border-b border-[#26201B] pb-4 space-y-3">
                                <h4 className="text-[#F3ECE0] font-semibold">2. Método de Pago</h4>
                                <label className="flex items-center gap-2 text-[#F3ECE0] cursor-pointer">
                                    <input
                                        type="radio"
                                        name="pago"
                                        disabled={!isOnline || procesandoPago}
                                        value="Pagar en línea"
                                        checked={metodoPago === 'Pagar en línea'}
                                        onChange={(e) => setMetodoPago(e.target.value)}
                                        className="accent-[#C5A059]"
                                    />
                                    <span>Pagar en línea con Stripe Checkout (Tarjeta)</span>
                                </label>
                                <label className="flex items-center gap-2 text-[#F3ECE0] cursor-pointer">
                                    <input
                                        type="radio"
                                        name="pago"
                                        disabled={!isOnline || procesandoPago}
                                        value="Pagar al recoger"
                                        checked={metodoPago === 'Pagar al recoger'}
                                        onChange={(e) => setMetodoPago(e.target.value)}
                                        className="accent-[#C5A059]"
                                    />
                                    <span>Pagar al recoger en sucursal</span>
                                </label>

                                {metodoPago === 'Pagar en línea' && (
                                    <div className="mt-2 bg-[#0D0B0A] border border-[#C5A059]/40 rounded-2xl p-4 space-y-2 text-[11px]">
                                        <div className="flex items-center justify-between text-[#C5A059] font-bold">
                                            <span>💳 Pasarela Oficial Stripe Checkout</span>
                                            <span>Modo Prueba</span>
                                        </div>
                                        <p className="text-[#9E8E7E] leading-relaxed">
                                            Al confirmar, tu pedido se registrará como <strong className="text-amber-400">PENDIENTE</strong> y serás redirigido de forma segura a <strong className="text-[#F3ECE0]">checkout.stripe.com</strong> para ingresar tu tarjeta.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <span className="text-[#9E8E7E]">Total a Pagar:</span>
                                <span className="text-base font-bold text-[#D4AF37]">${totalCarrito}.00</span>
                            </div>

                            <button
                                type="submit"
                                disabled={!isOnline || procesandoPago}
                                className={`w-full font-bold py-3.5 rounded-xl transition ${isOnline && !procesandoPago ? 'bg-[#C5A059] hover:bg-[#B38E47] text-black' : 'bg-[#26201B] text-[#777] cursor-not-allowed'}`}
                            >
                                {!isOnline
                                    ? 'PARA SEGUIR COMPRANDO RECONECTATE A INTERNET'
                                    : procesandoPago
                                        ? '⏳ CONECTANDO CON STRIPE CHECKOUT...'
                                        : metodoPago === 'Pagar en línea'
                                            ? `CONTINUAR A STRIPE ($${totalCarrito}.00)`
                                            : 'CONFIRMAR Y FINALIZAR PEDIDO'}
                            </button>
                        </form>
                    </section>
                )}

                {seccion === 'sec-exito' && (
                    <section className="text-center py-8 space-y-4">
                        <div className="bg-[#16120E] border border-[#C5A059]/40 p-6 rounded-2xl space-y-3">
                            <div className="text-4xl text-[#C5A059]">✓</div>
                            <h2 className="text-xl font-serif text-[#F3ECE0]">¡Pedido Registrado!</h2>
                            <span className="text-[10px] uppercase tracking-widest text-[#9E8E7E] block">Tu Código de Recolección</span>
                            <p className="text-3xl font-mono font-bold text-[#D4AF37]">#{ultimoPedido?.codigo || '------'}</p>
                            {ultimoPedido?.metodoPago && (
                                <p className="text-[11px] text-emerald-400 font-medium">
                                    Método: {ultimoPedido.metodoPago}
                                </p>
                            )}
                            <p className="text-xs text-[#9E8E7E]">Tu pedido ha sido enviado al panel de la sucursal.</p>
                            <button onClick={() => setSeccion('sec-estado')} className="w-full bg-[#C5A059] text-black font-bold text-xs py-3 rounded-xl transition mt-2">
                                VER ESTADO E HISTORIAL
                            </button>
                        </div>
                    </section>
                )}

                {/* SECCIÓN DE ESTADO ACTUAL + HISTORIAL DE MIS PEDIDOS ANTERIORES */}
                {seccion === 'sec-estado' && (
                    <section className="space-y-6">
                        {/* PEDIDO RECIENTE / EN CURSO */}
                        <div className="space-y-3">
                            <h3 className="text-xs uppercase tracking-wider text-[#C5A059] font-medium">Pedido Actual en Curso</h3>
                            <div className="bg-[#16120E] border border-[#26201B] p-5 rounded-2xl space-y-3 text-xs">
                                {!ultimoPedido ? (
                                    <p className="text-center text-[#9E8E7E]">No tienes ningún pedido reciente en curso.</p>
                                ) : (
                                    <>
                                        <div className="border-b border-[#26201B] pb-2 mb-2 space-y-1">
                                            <span className="text-[10px] text-[#9E8E7E] block">Código: #{ultimoPedido.codigo}</span>
                                            <span className="font-bold text-[#D4AF37] block">Total: ${ultimoPedido.total}.00</span>
                                            {ultimoPedido.metodoPago && (
                                                <span className={`text-[11px] block ${ultimoPedido.metodoPago.includes('PENDIENTE') ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {ultimoPedido.metodoPago}
                                                </span>
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-3 ${['PENDIENTE', 'EN PREPARACION', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'].includes(estadoActual) ? 'text-amber-400 font-medium' : 'text-[#9E8E7E]'}`}>
                                            ✓ Pedido recibido
                                        </div>
                                        <div className={`flex items-center gap-3 ${['EN PREPARACION', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'].includes(estadoActual) ? 'text-[#D4AF37] font-bold' : 'text-[#9E8E7E]'}`}>
                                            ● En Preparación
                                        </div>
                                        <div className={`flex items-center gap-3 ${['LISTO', 'ENTREGADO'].includes(estadoActual) ? 'text-emerald-400 font-bold' : 'text-[#9E8E7E]'}`}>
                                            ○ {estadoActual === 'ENTREGADO' ? 'Pedido entregado' : 'Listo para recoger'}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* HISTORIAL COMPLETO DESDE SQL SERVER */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs uppercase tracking-wider text-[#C5A059] font-medium">
                                    Mis Pedidos Anteriores ({historialPedidos.length})
                                </h3>
                                {isOnline && usuarioSesion && (
                                    <button
                                        onClick={cargarHistorialPedidos}
                                        className="text-[11px] text-[#C5A059] hover:underline"
                                    >
                                        🔄 Actualizar
                                    </button>
                                )}
                            </div>

                            {!usuarioSesion ? (
                                <div className="bg-[#16120E] border border-[#26201B] p-5 rounded-2xl text-center space-y-3 text-xs">
                                    <p className="text-[#9E8E7E]">Inicia sesión con tu cuenta de cliente para consultar todo tu historial de compras.</p>
                                    <button
                                        onClick={() => navigate('/perfil')}
                                        className="bg-[#C5A059] text-black font-bold px-4 py-2.5 rounded-xl"
                                    >
                                        INICIAR SESIÓN
                                    </button>
                                </div>
                            ) : !isOnline ? (
                                <div className="bg-[#16120E] border border-rose-500/30 p-4 rounded-2xl text-center text-xs text-rose-300">
                                    📡 Reconéctate a internet para cargar tu historial de pedidos.
                                </div>
                            ) : cargandoHistorial ? (
                                <div className="bg-[#16120E] border border-[#26201B] p-6 rounded-2xl text-center text-xs text-[#9E8E7E]">
                                    Consultando historial de compras...
                                </div>
                            ) : historialPedidos.length === 0 ? (
                                <div className="bg-[#16120E] border border-[#26201B] p-6 rounded-2xl text-center text-xs text-[#9E8E7E]">
                                    Aún no tienes pedidos registrados en tu cuenta.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {historialPedidos.map((ped) => {
                                        const idPed = ped.idPedido || ped.id_pedido || ped.id;
                                        const codigoPed = ped.codigo || `BC-${idPed}`;
                                        const badge = obtenerEstiloEstado(ped.estado);
                                        const detalles = ped.productos || ped.detalles || ped.items || [];
                                        const estaExpandido = pedidoExpandidoId === idPed;
                                        const fechaPed = ped.fechaPedido
                                            ? new Date(ped.fechaPedido).toLocaleDateString('es-MX', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            : 'Fecha registrada';

                                        return (
                                            <div
                                                key={idPed || codigoPed}
                                                className="bg-[#16120E] border border-[#26201B] rounded-2xl p-4 space-y-3 text-xs transition hover:border-[#382E26]"
                                            >
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <span className="font-mono font-bold text-sm text-[#D4AF37] block">
                                                            #{codigoPed}
                                                        </span>
                                                        <span className="text-[11px] text-[#9E8E7E]">{fechaPed}</span>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${badge.clase}`}>
                                                        {badge.texto}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between items-center border-t border-[#26201B] pt-2.5">
                                                    <span className="text-[11px] text-[#9E8E7E] truncate max-w-[180px]">
                                                        {ped.metodoPago || 'Pago en sucursal'}
                                                    </span>
                                                    <span className="text-sm font-bold text-[#F3ECE0]">
                                                        ${Number(ped.total || 0).toFixed(2)}
                                                    </span>
                                                </div>

                                                {/* Desglose desplegable de botellas */}
                                                {detalles.length > 0 && (
                                                    <div className="pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPedidoExpandidoId(estaExpandido ? null : idPed)}
                                                            className="text-[11px] text-[#C5A059] font-medium flex items-center gap-1"
                                                        >
                                                            {estaExpandido
                                                                ? '▲ Ocultar artículos'
                                                                : `▼ Ver artículos (${detalles.length})`}
                                                        </button>

                                                        {estaExpandido && (
                                                            <div className="mt-2 bg-[#0D0B0A] border border-[#26201B] rounded-xl p-3 space-y-2">
                                                                {detalles.map((d, idx) => (
                                                                    <div key={idx} className="flex justify-between text-[11px]">
                                                                        <span className="text-[#E2D9CC]">
                                                                            {d.cantidad}x {d.nombreProducto || d.nombre || `Producto #${d.productoId}`}
                                                                        </span>
                                                                        <span className="text-[#D4AF37] font-semibold">
                                                                            ${(Number(d.cantidad || 1) * Number(d.precioUnitario || 0)).toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {detalles.length > 0 && (
                                                    <button
                                                        type="button"
                                                        disabled={!isOnline}
                                                        onClick={() => volverAPedir(ped)}
                                                        className="w-full py-2 rounded-xl bg-[#0D0B0A] border border-[#382E26] hover:border-[#C5A059] text-[#C5A059] font-bold text-[11px] transition disabled:opacity-40"
                                                    >
                                                        ↻ Volver a pedir estos artículos
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {seccion === 'sec-perfil' && (
                    <section className="space-y-4">
                        <h3 className="text-xs uppercase tracking-wider text-[#C5A059] font-medium">Mi Cuenta</h3>
                        <div className="bg-[#16120E] border border-[#26201B] p-5 rounded-2xl space-y-3 text-xs">
                            <p className="text-[#9E8E7E]">Nombre: <span className="text-[#F3ECE0] font-medium">{perfil.nombre}</span></p>
                            <p className="text-[#9E8E7E]">Correo: <span className="text-[#F3ECE0] font-medium">{perfil.correo}</span></p>
                            <p className="text-[#9E8E7E]">Teléfono: <span className="text-[#F3ECE0] font-medium">{perfil.telefono}</span></p>

                            {usuarioSesion && (
                                <div className="pt-2 border-t border-[#26201B] flex justify-between items-center">
                                    <span className="text-[#9E8E7E]">Pedidos realizados:</span>
                                    <button
                                        onClick={() => setSeccion('sec-estado')}
                                        className="text-[#C5A059] font-bold hover:underline"
                                    >
                                        {historialPedidos.length} pedido(s) →
                                    </button>
                                </div>
                            )}

                            {usuarioSesion ? (
                                <button
                                    onClick={handleCerrarSesion}
                                    className="w-full mt-4 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition"
                                >
                                    CERRAR SESIÓN
                                </button>
                            ) : (
                                <button
                                    onClick={() => navigate('/perfil')}
                                    className="w-full mt-4 bg-[#C5A059] hover:bg-[#B38E47] text-black font-bold py-2.5 rounded-xl transition"
                                >
                                    INICIAR SESIÓN / REGISTRARSE
                                </button>
                            )}
                        </div>
                    </section>
                )}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-[#16120E] border-t border-[#26201B] py-3 px-6 flex justify-around items-center text-[10px] z-50">
                <button
                    onClick={() => setSeccion('sec-catalogo')}
                    className={`flex flex-col items-center gap-1 transition ${seccion === 'sec-catalogo' || seccion === 'sec-detalle' ? 'text-[#C5A059] font-bold' : 'text-[#9E8E7E]'}`}
                >
                    <span className="text-base">🍷</span>
                    <span>Catálogo</span>
                </button>
                <button
                    onClick={() => setSeccion('sec-carrito')}
                    className={`relative flex flex-col items-center gap-1 transition ${seccion === 'sec-carrito' || seccion === 'sec-confirmacion' ? 'text-[#C5A059] font-bold' : 'text-[#9E8E7E]'}`}
                >
                    <span className="text-base">🛒</span>
                    <span>Carrito</span>
                    {carrito.length > 0 && (
                        <span className="absolute -top-1 -right-2 bg-[#C5A059] text-black font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                            {carrito.reduce((acc, item) => acc + item.cantidad, 0)}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setSeccion('sec-estado')}
                    className={`flex flex-col items-center gap-1 transition ${seccion === 'sec-estado' || seccion === 'sec-exito' ? 'text-[#C5A059] font-bold' : 'text-[#9E8E7E]'}`}
                >
                    <span className="text-base">📦</span>
                    <span>Pedidos</span>
                </button>
            </nav>
        </div>
    );
}