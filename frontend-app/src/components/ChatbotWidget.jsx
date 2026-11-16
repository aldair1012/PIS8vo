import ChatMessageContent from './ChatMessageContent';
import '../assets/chatbot-system.css';
import FuentesChat from './FuentesChat';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, ChevronRight, Copy, Database, Info, Loader2, MessageCircle,
  RotateCcw, Send, Sparkles, Star, ThumbsUp, Trash2, User, X, Sprout, Activity, CloudSun, Coins, CalendarDays, Map, Layers, History,
} from 'lucide-react';
import { chatService } from '../services/api';
import { normalizarTextoChat } from '../utils/chatText';

const VISTAS = {
  yield: { nombre: 'Rendimiento', icono: Activity },
  scenarios: { nombre: 'Siembra', icono: CalendarDays },
  climate: { nombre: 'Clima', icono: CloudSun },
  finance: { nombre: 'Finanzas', icono: Coins },
  simular: { nombre: 'Simulación', icono: Sprout },
  cultivos: { nombre: 'Parcelas', icono: Layers },
  history: { nombre: 'Historial', icono: History },
  map: { nombre: 'Mapa', icono: Map },
};

const SUGERENCIAS = {
  yield: ['¿Cuántas toneladas estima mi simulación para este lote?', '¿Cómo cambian los escenarios climáticos de mi simulación?'],
  scenarios: ['¿Qué meses de siembra están documentados para mi zona?', '¿Qué suelo necesita este maíz?', '¿Qué problemas se han reportado en mi provincia?'],
  climate: ['¿Qué debo revisar con el pronóstico de los próximos 7 días?', '¿Qué diferencia hay entre humedad del aire y del suelo?'],
  finance: ['¿Cómo afecta el precio del maíz a mi margen?', '¿Qué costo afecta más al margen?'],
  simular: ['¿Qué fertilizante y nutrientes necesita esta simulación?', '¿Cómo influyen pH, textura y clima en el rendimiento?', '¿Qué datos faltan antes de ejecutar?'],
};

const SUGERENCIAS_GENERICAS = ['¿Cómo está el clima hoy y cómo afecta mi parcela?', '¿Qué información tienes de mi parcela?', '¿Qué datos faltan para tomar una decisión?'];

const ALTURA_MAXIMO_COMPOSER = 120;

const resumirDashboard = (contextoDashboard, vistaActual, cultivoElegidoId, añoSeleccionado) => {
  if (!contextoDashboard?.datos || typeof contextoDashboard.datos !== 'object') return null;
  const mismaVista = String(contextoDashboard.vista ?? '') === String(vistaActual ?? '');
  const mismaParcela = String(contextoDashboard.cultivoId ?? '') === String(cultivoElegidoId ?? '');
  const mismoAño = String(contextoDashboard.año ?? '') === String(añoSeleccionado ?? '');
  if (!mismaVista || !mismaParcela || !mismoAño) return null;
  const datos = contextoDashboard.datos;
  const resumen = {
    vista: contextoDashboard.vista,
    kpis: datos.kpis || null,
    kpi_fuentes: datos.kpi_fuentes || null,
    datos_base_sistema: datos.datos_base_sistema || null,
    cultivo_activo: datos.cultivo_activo || null,
    percentiles: datos.percentiles || null,
    resumen_descriptivo: datos.resumen_descriptivo || null,
    calendario_visible: datos.calendario_visible || null,
    calendario_parcela: datos.calendario_parcela || null,
    guia_agricola: datos.guia_agricola || null,
    procedencia: datos.procedencia || null,
    simulaciones_count: datos.simulaciones_count ?? null,
    simulacion_seleccionada: datos.simulacion_seleccionada || null,
    referencia_sipa: datos.referencia_sipa || null,
    mediciones_campo: datos.mediciones_campo || null,
  };
  if (Array.isArray(datos.recomendaciones)) resumen.recomendaciones = datos.recomendaciones.slice(0, 5);
  if (Array.isArray(datos.ranking)) resumen.ranking = datos.ranking.slice(0, 5);
  if (Array.isArray(datos.viabilidad_siembra)) resumen.viabilidad_siembra = datos.viabilidad_siembra.slice(0, 24);
  if (datos.clima_actual) resumen.clima_actual = datos.clima_actual;
  if (datos.clima_promedio_30d) resumen.clima_promedio_30d = datos.clima_promedio_30d;
  if (datos.clima_hoy) resumen.clima_hoy = datos.clima_hoy;
  if (Array.isArray(datos.pronostico_7d)) resumen.pronostico_7d = datos.pronostico_7d.slice(0, 7);
  if (datos.precio_maiz_referencia) resumen.precio_maiz_referencia = datos.precio_maiz_referencia;
  if (datos.nutricion) resumen.nutricion = datos.nutricion;
  if (datos.api_source) resumen.api_source = datos.api_source;
  return resumen;
};

const leerMensajes = (clave) => {
  try {
    const guardado = window.sessionStorage.getItem(clave);
    const mensajes = guardado ? JSON.parse(guardado) : [];
    return Array.isArray(mensajes) ? mensajes.filter((mensaje) => mensaje && typeof mensaje.texto === 'string') : [];
  } catch {
    return [];
  }
};

// Estado del favorito: identificador de la conversación e indicador de si ya
// quedó guardada en la cuenta del usuario.
const leerFavorito = (clave) => {
  try {
    const guardado = JSON.parse(window.sessionStorage.getItem(clave));
    if (!guardado || typeof guardado !== 'object') return { conversacionId: null, guardado: false };
    return {
      conversacionId: typeof guardado.conversacionId === 'string' ? guardado.conversacionId : null,
      guardado: guardado.guardado === true,
    };
  } catch {
    return { conversacionId: null, guardado: false };
  }
};

const crearId = () => (
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

const claveMensaje = (mensaje, index) => `${mensaje.rol}-${mensaje.id ?? index}`;

const ChatbotWidget = ({
  vistaActual,
  usuarioId,
  cultivoElegidoId,
  añoSeleccionado,
  contextoDashboard,
  cultivoActivo,
  simulacion,
}) => {
  const [abierto, setAbierto] = useState(false);
  // La conversación se comparte entre los paneles del dashboard (una sola
  // memoria por parcela y año) y se mantiene aparte para el borrador de Nueva
  // Simulación. Así el usuario no pierde el hilo al cambiar de pestaña.
  const ambito = vistaActual === 'simular' ? 'simulacion' : 'dashboard';
  const storageKey = `zeasys_chat_gemini_v4_${usuarioId || 'sesion'}_${ambito}_${cultivoElegidoId || 'sin-parcela'}_${añoSeleccionado || 'sin-año'}`;
  const favoritoKey = `${storageKey}_favorito`;
  const [mensajes, setMensajes] = useState(() => leerMensajes(storageKey));
  const [favorito, setFavorito] = useState(() => leerFavorito(favoritoKey));
  const [guardandoFavorito, setGuardandoFavorito] = useState(false);
  const [errorFavorito, setErrorFavorito] = useState(false);
  const [input, setInput] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [estadoServicio, setEstadoServicio] = useState('listo');
  const [mostrarFuente, setMostrarFuente] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [feedback, setFeedback] = useState(() => {
    try { return JSON.parse(window.sessionStorage.getItem(`${storageKey}_util`)) || {}; } catch { return {}; }
  });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const contenedorMensajesRef = useRef(null);
  const alFondoRef = useRef(true);
  const peticionRef = useRef({ numero: 0, controller: null });
  useEffect(() => () => {
    peticionRef.current.numero += 1;
    peticionRef.current.controller?.abort();
  }, []);
  const vista = VISTAS[vistaActual] || { nombre: 'ZeaSys', icono: Sprout };
  const ViewIcon = vista.icono;
  const panelRef = useRef(null);
  const wasOpenRef = useRef(false);
  const sugerenciasSiguientes = SUGERENCIAS[vistaActual] || SUGERENCIAS_GENERICAS;
  const dashboard = useMemo(() => resumirDashboard(contextoDashboard, vistaActual, cultivoElegidoId, añoSeleccionado), [contextoDashboard, vistaActual, cultivoElegidoId, añoSeleccionado]);
  const nombreParcela = cultivoActivo?.nombre_parcela
    || (vistaActual === 'simular' ? 'Sin parcela seleccionada' : 'Parcela seleccionada');
  const esSimulacion = vistaActual === 'simular' && Boolean(simulacion);
  const etiquetaParcela = vistaActual === 'simular' ? 'Parcela de la simulación' : 'Parcela';
  const etiquetaFuente = 'Qué información estoy usando';
  const detalleFuente = esSimulacion
    ? 'Puedo leer los valores que has escrito en el formulario. Son datos para planificar: todavía no representan una simulación ejecutada. También puedo explicar conceptos y consultar información pública.'
    : 'Puedo utilizar la parcela seleccionada, los datos de esta pantalla y las referencias disponibles de clima y cultivo. Para resolver otras dudas también puedo usar conocimiento general y consultar fuentes públicas. Las mediciones que faltan no se sustituyen por datos inventados.';
  const ultimoAsistente = useMemo(() => {
    for (let indice = mensajes.length - 1; indice >= 0; indice -= 1) {
      if (mensajes[indice].rol === 'asistente') return indice;
    }
    return -1;
  }, [mensajes]);

  useEffect(() => {
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(mensajes.slice(-40))); } catch { /* noop */ }
  }, [mensajes, storageKey]);

  useEffect(() => {
    try { window.sessionStorage.setItem(`${storageKey}_util`, JSON.stringify(feedback)); } catch { /* Marca local opcional. */ }
  }, [feedback, storageKey]);

  useEffect(() => {
    try {
      if (!favorito.conversacionId && !favorito.guardado) {
        window.sessionStorage.removeItem(favoritoKey);
        return;
      }
      window.sessionStorage.setItem(favoritoKey, JSON.stringify(favorito));
    } catch { /* noop */ }
  }, [favorito, favoritoKey]);

  const manejarScrollMensajes = () => {
    const contenedor = contenedorMensajesRef.current;
    if (!contenedor) return;
    const distanciaAlFinal = contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight;
    alFondoRef.current = distanciaAlFinal < 90;
  };

  useEffect(() => {
    if (abierto && alFondoRef.current) messagesEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }, [abierto, mensajes, escribiendo]);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  useEffect(() => {
    if (!abierto && wasOpenRef.current) launcherRef.current?.focus();
    wasOpenRef.current = abierto;
  }, [abierto]);

  useEffect(() => {
    const abrir = () => setAbierto(true);
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('zeasys:open-chat', abrir);
    window.addEventListener('keydown', cerrarConEscape);
    return () => {
      window.removeEventListener('zeasys:open-chat', abrir);
      window.removeEventListener('keydown', cerrarConEscape);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const trap = event => {
      if (event.key !== 'Tab') return;
      const controls = [...(panelRef.current?.querySelectorAll('button:not([disabled]),a[href],textarea,summary,iframe') || [])].filter(element => element.getClientRects().length > 0);
      const first=controls[0];const last=controls[controls.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault();last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault();first?.focus(); }
    };
    const panel=panelRef.current;panel?.addEventListener('keydown',trap);
    return ()=>panel?.removeEventListener('keydown',trap);
  },[abierto]);

  const autoDimensionar = (elemento) => {
    if (!elemento) return;
    elemento.style.height = 'auto';
    elemento.style.height = `${Math.min(elemento.scrollHeight, ALTURA_MAXIMO_COMPOSER)}px`;
  };

  const enviarPregunta = async (pregunta, reintento = false) => {
    const preguntaTexto = normalizarTextoChat(pregunta).trim();
    if (!preguntaTexto || escribiendo) return;
    const numero = ++peticionRef.current.numero;
    const controller = new AbortController();
    peticionRef.current.controller = controller;
    setMensajes((prev) => reintento ? prev.filter(message=>!(message.error && message.pregunta===preguntaTexto)) : [...prev, { id: crearId(), rol: 'usuario', texto: preguntaTexto }]);
    setInput('');
    const elementoInput = inputRef.current;
    if (elementoInput) elementoInput.style.height = 'auto';
    setEscribiendo(true);
    setEstadoServicio('consultando');
    try {
      const data = await chatService.preguntar(
        preguntaTexto,
        vistaActual,
        cultivoElegidoId,
        añoSeleccionado,
        dashboard,
        vistaActual === 'simular' ? simulacion : null,
        controller.signal,
      );
      if (controller.signal.aborted || numero !== peticionRef.current.numero) return;
      const texto = normalizarTextoChat(data?.texto ?? data?.respuesta ?? data?.answer);
      if (!texto.trim()) { const incomplete = new Error('Respuesta incompleta'); incomplete.incomplete = true; throw incomplete; }
      setMensajes((prev) => [...prev, {
        id: crearId(),
        rol: 'asistente',
        texto,
        investigacion: data?.fuente_datos,
        referencias: data?.fuente_datos?.referencias_consultadas,
      }]);
      // La conversación puede renovarse (p. ej. tras limpiar o cambiar de
      // ámbito); si el identificador cambia, el favorito anterior ya no
      // corresponde a este hilo.
      const idConversacion = typeof data?.fuente_datos?.conversacion_id === 'string'
        ? data.fuente_datos.conversacion_id
        : '';
      if (idConversacion) {
        setFavorito((prev) => (
          prev.conversacionId === idConversacion ? prev : { conversacionId: idConversacion, guardado: false }
        ));
      }
      setEstadoServicio('conectado');
    } catch (error) {
      if (controller.signal.aborted || numero !== peticionRef.current.numero) return;
      const codigo = error?.response?.status;
      const sesionExpirada = codigo === 401;
      setMensajes((prev) => [...prev, {
        id: crearId(),
        rol: 'asistente',
        texto: sesionExpirada
          ? 'Tu sesión expiró. Vuelve a iniciar sesión para continuar usando el asistente.'
          : codigo === 502
            ? 'Se interrumpió la respuesta. Tu pregunta sigue guardada; pulsa Reintentar.'
            : error.incomplete ? 'La respuesta llegó incompleta. Tu pregunta sigue guardada; pulsa Reintentar.' : 'No pudimos completar la consulta por un problema de conexión. Tu pregunta sigue guardada; pulsa Reintentar.',
        error: true,
        pregunta: preguntaTexto,
      }]);
      setEstadoServicio(sesionExpirada ? 'sesion' : 'error');
    } finally {
      if (numero === peticionRef.current.numero) setEscribiendo(false);
    }
  };

  useEffect(() => {
    const consultar = event => {
      const question = event.detail?.pregunta;
      if (typeof question !== 'string' || !question.trim() || String(event.detail?.cultivo_id) !== String(cultivoElegidoId)) return;
      setAbierto(true);
      if (escribiendo) setInput(question.slice(0, 2000));
      else enviarPregunta(question.slice(0, 2000));
    };
    window.addEventListener('zeasys:ask-chat', consultar);
    return () => window.removeEventListener('zeasys:ask-chat', consultar);
  });

  const copiarUltimaRespuesta = async () => {
    const ultima = [...mensajes].reverse().find((mensaje) => mensaje.rol === 'asistente' && !mensaje.error);
    if (!ultima?.texto) return;
    try {
      await navigator.clipboard.writeText(ultima.texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1600);
    } catch { setCopiado(false); }
  };

  const marcarUtil = (mensaje, index) => {
    const clave = claveMensaje(mensaje, index);
    setFeedback((prev) => ({ ...prev, [clave]: !prev[clave] }));
  };

  const alternarFavorito = async () => {
    if (!favorito.conversacionId || guardandoFavorito || !mensajes.length) return;
    setGuardandoFavorito(true);
    setErrorFavorito(false);
    try {
      if (favorito.guardado) {
        await chatService.eliminarFavorito(favorito.conversacionId);
        setFavorito((prev) => ({ ...prev, guardado: false }));
      } else {
        const guardables = mensajes
          .filter((mensaje) => !mensaje.error && typeof mensaje.texto === 'string' && mensaje.texto.trim() !== '')
          .slice(-30)
          .map((mensaje) => ({ rol: mensaje.rol, texto: mensaje.texto }));
        await chatService.guardarFavorito({
          conversacion_id: favorito.conversacionId,
          vista: vistaActual,
          cultivo_id: cultivoElegidoId,
          año: añoSeleccionado,
          mensajes: guardables,
        });
        setFavorito((prev) => ({ ...prev, guardado: true }));
      }
    } catch {
      setErrorFavorito(true);
    } finally {
      setGuardandoFavorito(false);
    }
  };

  const limpiarChat = () => {
    peticionRef.current.numero += 1;
    peticionRef.current.controller?.abort();
    setEscribiendo(false);
    setMensajes([]);
    setFeedback({});
    setEstadoServicio('listo');
    setFavorito({ conversacionId: null, guardado: false });
    setErrorFavorito(false);
    try { window.sessionStorage.removeItem(storageKey); } catch { /* noop */ }
    try { window.sessionStorage.removeItem(favoritoKey); } catch { /* noop */ }
    chatService.limpiar().catch(() => { /* El historial local ya quedó limpio. */ });
  };

  const estadoTexto = {
    listo: 'Pregúntame sobre tu cultivo',
    consultando: 'Analizando tu pregunta…',
    conectado: 'Respuesta lista',
    error: 'Consulta interrumpida',
    sesion: 'Sesión expirada',
  }[estadoServicio] || 'Listo para analizar';

  return (
    <>
      {abierto && <button type="button" className="zeasys-chat-backdrop" aria-label="Cerrar asistente al pulsar fuera" onClick={() => setAbierto(false)} />}
      <button
        type="button"
        ref={launcherRef}
        className={`zeasys-chat-tab ${abierto ? 'is-open' : ''}`}
        onClick={() => setAbierto((estado) => !estado)}
        aria-expanded={abierto}
        aria-controls="zeasys-chat-panel"
        aria-label={abierto ? 'Cerrar asistente ZeaSys' : 'Abrir asistente ZeaSys'}
      >
        {abierto ? <X size={18} /> : <MessageCircle size={18} />}<span>Asistente</span>
      </button>

      <div ref={panelRef} inert={!abierto} aria-modal={abierto ? true : undefined} id="zeasys-chat-panel" className={`zeasys-chat-panel ${abierto ? 'is-open' : ''}`} role="dialog" aria-label="Asistente de ZeaSys" aria-hidden={!abierto}>
        <header className="zeasys-chat-header">
          <div className="zeasys-chat-brand">
            <div className="zeasys-chat-avatar"><Sprout size={24} aria-hidden="true" /></div>
            <div><h2 className="zeasys-chat-title">Asistente agrícola</h2><div className={`zeasys-chat-status is-${estadoServicio}`}><span className="zeasys-chat-status-dot" /> {estadoTexto}</div></div>
          </div>
          <div className="zeasys-chat-header-actions">
            <button type="button" onClick={alternarFavorito} disabled={!favorito.conversacionId || guardandoFavorito || !mensajes.length} className={`${favorito.guardado ? 'is-favorite' : ''} ${guardandoFavorito ? 'is-saving' : ''}`.trim()} aria-label={favorito.guardado ? 'Quitar conversación de favoritos' : 'Guardar conversación en favoritos'} title={favorito.guardado ? 'Conversación guardada en tu cuenta' : 'Guardar conversación en tu cuenta'}>{guardandoFavorito ? <Loader2 size={16} /> : <Star size={16} fill={favorito.guardado ? 'currentColor' : 'none'} />}</button>
            <button type="button" onClick={copiarUltimaRespuesta} disabled={!mensajes.length} aria-label="Copiar última respuesta" title="Copiar última respuesta">{copiado ? <Check size={16} /> : <Copy size={16} />}</button>
            <button type="button" onClick={limpiarChat} disabled={!mensajes.length} aria-label="Limpiar conversación" title="Limpiar conversación"><Trash2 size={16} /></button>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar asistente ZeaSys"><X size={18} /></button>
          </div>
        </header>

        <div className="zeasys-chat-context">
          <div className="zeasys-chat-context-row">
            <span className="zeasys-chat-context-icon"><ViewIcon size={20} aria-hidden="true"/></span>
            <div><span className="zeasys-chat-context-label">Panel actual</span><strong>{vista.nombre}</strong></div>
            <ChevronRight size={15} className="zeasys-chat-context-arrow" />
            <div><span className="zeasys-chat-context-label">{etiquetaParcela}</span><strong>{nombreParcela}</strong></div>
          </div>
          <button type="button" className="zeasys-chat-source-toggle" aria-expanded={mostrarFuente} aria-controls="chat-context-details" onClick={() => setMostrarFuente((estado) => !estado)}><Database size={13} /> {etiquetaFuente} <Info size={13} /></button>
          {mostrarFuente && <div id="chat-context-details" className="zeasys-chat-source-detail"><strong>Información para esta consulta</strong><span>{detalleFuente}</span></div>}
          {favorito.guardado && !errorFavorito && <div className="zeasys-chat-favorite-note"><Star size={12} fill="currentColor" aria-hidden="true" /> Conversación guardada en tu cuenta</div>}
          {errorFavorito && <div className="zeasys-chat-favorite-note is-error">No se pudo guardar la conversación. Inténtalo de nuevo.</div>}
        </div>

        <div ref={contenedorMensajesRef} onScroll={manejarScrollMensajes} className="zeasys-chat-messages" role="log" aria-live="polite" aria-label="Conversación con el asistente">
          {mensajes.length === 0 && <div className="zeasys-chat-welcome"><div className="zeasys-chat-welcome-icon"><Sparkles size={21} /></div><h3>Entiende tu cultivo, paso a paso</h3><p>{esSimulacion ? 'Puedo analizar los valores de esta simulación antes de ejecutarla: clima de entrada, pH, textura, área, fertilizante y la referencia de precio.' : dashboard ? 'Te ayudo a entender los datos de tu parcela, preparar una decisión o resolver una duda sobre el cultivo. Puedo consultar información pública cuando haga falta.' : 'Pregúntame qué significa un dato, cómo preparar la siembra o qué revisar en el cultivo. No necesitas usar términos técnicos.'}</p><div className="zeasys-chat-chips">{(SUGERENCIAS[vistaActual] || ['¿Cómo está el clima hoy y cómo afecta mi parcela?', '¿Qué información tienes de mi parcela?', '¿Qué datos faltan para tomar una decisión?']).map((sugerencia) => <button type="button" key={sugerencia} onClick={() => enviarPregunta(sugerencia)} disabled={escribiendo}>{sugerencia}<ChevronRight size={14} aria-hidden="true" /></button>)}</div></div>}

          {mensajes.map((mensaje, index) => <div className={`zeasys-chat-message ${mensaje.rol === 'usuario' ? 'from-user' : 'from-assistant'}`} key={mensaje.id ?? `${mensaje.rol}-${index}`}><div className="zeasys-chat-message-avatar">{mensaje.rol === 'usuario' ? <User size={14} /> : <Bot size={14} />}</div><div className="zeasys-chat-message-content"><div className="zeasys-chat-message-role">{mensaje.rol === 'usuario' ? 'Tú' : 'ZeaSys · Asistente'}{mensaje.investigacion?.busqueda_realizada&&<span className="zeasys-chat-research-badge">Información web consultada</span>}{mensaje.investigacion?.busqueda_no_disponible&&!mensaje.investigacion?.busqueda_realizada&&<span className="zeasys-chat-research-badge">Orientación sin comprobación web</span>}</div><div className="zeasys-chat-bubble"><ChatMessageContent text={mensaje.texto}/></div><FuentesChat referencias={mensaje.referencias} fuentesWeb={mensaje.investigacion?.fuentes_web} sugerenciasBusqueda={mensaje.investigacion?.sugerencias_busqueda_html} />{mensaje.rol === 'asistente' && !mensaje.error && !escribiendo && <button type="button" className={`zeasys-chat-useful ${feedback[claveMensaje(mensaje, index)] ? 'is-marked' : ''}`} aria-pressed={Boolean(feedback[claveMensaje(mensaje, index)])} onClick={() => marcarUtil(mensaje, index)}>{feedback[claveMensaje(mensaje, index)] ? <Check size={13} aria-hidden="true" /> : <ThumbsUp size={13} aria-hidden="true" />}<span>{feedback[claveMensaje(mensaje, index)] ? 'Útil' : 'Marcar útil'}</span></button>}{mensaje.error && <button type="button" className="zeasys-chat-retry" onClick={() => enviarPregunta(mensaje.pregunta, true)}><RotateCcw size={13} /> Reintentar</button>}{index === ultimoAsistente && !mensaje.error && <div className="zeasys-chat-followups">{sugerenciasSiguientes.slice(0, 2).map((sugerencia) => <button key={sugerencia} type="button" onClick={() => enviarPregunta(sugerencia)} disabled={escribiendo}>{sugerencia}<ChevronRight size={12} aria-hidden="true" /></button>)}<button type="button" onClick={() => enviarPregunta('¿Cuál es la fuente y la fecha de los datos que usaste?')} disabled={escribiendo}>Ver fuente<ChevronRight size={12} aria-hidden="true" /></button></div>}</div></div>)}

          {escribiendo && <div className="zeasys-chat-message from-assistant"><div className="zeasys-chat-message-avatar"><Bot size={14} /></div><div className="zeasys-chat-message-content"><div className="zeasys-chat-message-role">ZeaSys · Asistente</div><div className="zeasys-chat-bubble zeasys-chat-typing" role="status" aria-live="polite"><span className="zeasys-chat-typing-dot" aria-hidden="true" /><span className="zeasys-chat-typing-dot" aria-hidden="true" /><span className="zeasys-chat-typing-dot" aria-hidden="true" /><span className="zeasys-chat-typing-text">Preparando una respuesta para ti…</span></div></div></div>}
          <div ref={messagesEndRef} />
        </div>

        <form className="zeasys-chat-composer" onSubmit={(evento) => { evento.preventDefault(); enviarPregunta(input); }}>
          <textarea ref={inputRef} aria-label="Escribe tu pregunta al asistente" value={input} maxLength={2000} onChange={(evento) => { setInput(evento.target.value); autoDimensionar(evento.target); }} onKeyDown={(evento) => { if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) { evento.preventDefault(); enviarPregunta(input); } }} placeholder="Pregunta sobre tu cultivo o un dato que quieras entender…" rows={2} />
          <button type="submit" className="zeasys-chat-send" disabled={escribiendo || !input.trim()} aria-label="Enviar pregunta">{escribiendo ? <Loader2 size={17} /> : <Send size={17} />}</button>
          <div className="zeasys-chat-composer-hint">Enter para enviar · Shift + Enter para una nueva línea</div>
        </form>
      </div>
    </>
  );
};

export default ChatbotWidget;
