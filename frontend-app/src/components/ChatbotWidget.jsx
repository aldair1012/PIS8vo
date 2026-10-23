import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, ChevronRight, Copy, Database, Info, Loader2, MessageCircle,
  RotateCcw, Send, Sparkles, Star, Trash2, User, X,
} from 'lucide-react';
import { chatService } from '../services/api';
import { normalizarTextoChat } from '../utils/chatText';

const VISTAS = {
  yield: { nombre: 'Productividad', icono: '↗' },
  scenarios: { nombre: 'Escenarios', icono: '◈' },
  climate: { nombre: 'Clima', icono: '☼' },
  finance: { nombre: 'Finanzas', icono: '$' },
  simular: { nombre: 'Simulación', icono: '◇' },
  cultivos: { nombre: 'Parcelas', icono: '⌖' },
  history: { nombre: 'Historial', icono: '◷' },
  map: { nombre: 'Mapa', icono: '⌖' },
};

const SUGERENCIAS = {
  yield: ['¿Qué nutrientes necesita mi parcela?', '¿Qué factor explica más la brecha productiva?'],
  scenarios: ['¿Qué fecha e híbrido presentan menor riesgo?', '¿Cómo cambia la probabilidad entre escenarios?'],
  climate: ['¿Cómo está el clima hoy y cómo afecta mi parcela?', '¿Qué riesgo trae el pronóstico de 7 días?'],
  finance: ['¿Cómo afecta el precio del maíz a mi margen?', '¿Qué costo afecta más al margen?'],
  simular: ['¿Qué fertilizante y nutrientes necesita esta simulación?', '¿Cómo influyen pH, textura y clima en el rendimiento?', '¿Qué datos faltan antes de ejecutar?'],
};

// El proveedor se configura en Flowise; la interfaz no debe prometer un
// proveedor concreto cuando el chatflow puede cambiarse sin tocar React.
const PROVEEDOR_IA = 'ZeaSys IA';

const resumirDashboard = (contextoDashboard, vistaActual, cultivoElegidoId, anioSeleccionado) => {
  if (!contextoDashboard?.datos || typeof contextoDashboard.datos !== 'object') return null;
  const mismaVista = String(contextoDashboard.vista ?? '') === String(vistaActual ?? '');
  const mismaParcela = String(contextoDashboard.cultivoId ?? '') === String(cultivoElegidoId ?? '');
  const mismoAnio = String(contextoDashboard.anio ?? '') === String(anioSeleccionado ?? '');
  if (!mismaVista || !mismaParcela || !mismoAnio) return null;
  const datos = contextoDashboard.datos;
  const resumen = {
    vista: contextoDashboard.vista,
    kpis: datos.kpis || null,
    kpi_fuentes: datos.kpi_fuentes || null,
    datos_base_sistema: datos.datos_base_sistema || null,
    cultivo_activo: datos.cultivo_activo || null,
    percentiles: datos.percentiles || null,
    simulaciones_count: datos.simulaciones_count ?? null,
  };
  if (Array.isArray(datos.recomendaciones)) resumen.recomendaciones = datos.recomendaciones.slice(0, 5);
  if (Array.isArray(datos.ranking)) resumen.ranking = datos.ranking.slice(0, 5);
  if (Array.isArray(datos.viabilidad_siembra)) resumen.viabilidad_siembra = datos.viabilidad_siembra.slice(0, 8);
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

const renderInline = (line, lineIndex) => String(line).split(/(\*\*[^*]+\*\*)/g).map((segment, segmentIndex) => (
  segment.startsWith('**') && segment.endsWith('**')
    ? <strong key={`${lineIndex}-${segmentIndex}`}>{segment.slice(2, -2)}</strong>
    : segment
));

const renderMarkdown = (text) => normalizarTextoChat(text).split('\n').map((line, index) => {
  const limpio = line.trim();
  if (!limpio) return <div className="zeasys-chat-empty-line" key={index} />;
  const esLista = /^[-•]\s/.test(limpio);
  return (
    <div className={esLista ? 'zeasys-chat-list-item' : 'zeasys-chat-line'} key={index}>
      {renderInline(esLista ? limpio.replace(/^[-•]\s/, '') : limpio, index)}
    </div>
  );
});

const ChatbotWidget = ({
  vistaActual,
  usuarioId,
  cultivoElegidoId,
  anioSeleccionado,
  contextoDashboard,
  cultivoActivo,
  simulacion,
}) => {
  const [abierto, setAbierto] = useState(false);
  // La conversación se comparte entre los paneles del dashboard (una sola
  // memoria por parcela y año) y se mantiene aparte para el borrador de Nueva
  // Simulación. Así el usuario no pierde el hilo al cambiar de pestaña.
  const ambito = vistaActual === 'simular' ? 'simulacion' : 'dashboard';
  const storageKey = `zeasys_chat_gemini_v4_${usuarioId || 'sesion'}_${ambito}_${cultivoElegidoId || 'sin-parcela'}_${anioSeleccionado || 'sin-anio'}`;
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const vista = VISTAS[vistaActual] || { nombre: 'ZeaSys', icono: '✦' };
  const dashboard = useMemo(() => resumirDashboard(contextoDashboard, vistaActual, cultivoElegidoId, anioSeleccionado), [contextoDashboard, vistaActual, cultivoElegidoId, anioSeleccionado]);
  const nombreParcela = cultivoActivo?.nombre_parcela
    || (vistaActual === 'simular' ? 'Sin parcela seleccionada' : 'Parcela seleccionada');
  const esSimulacion = vistaActual === 'simular' && Boolean(simulacion);
  const etiquetaParcela = vistaActual === 'simular' ? 'Parcela de la simulación' : 'Parcela';
  const etiquetaFuente = esSimulacion
    ? `Borrador de la simulación enviado a ${PROVEEDOR_IA}`
    : dashboard
      ? `Contexto del panel enviado a ${PROVEEDOR_IA}`
      : `Pregunta enviada a ${PROVEEDOR_IA}`;
  const detalleFuente = esSimulacion
    ? `${PROVEEDOR_IA} recibe la pregunta, la parcela del formulario, los valores visibles de Nueva Simulación (clima de entrada, pH, textura, área y fertilizante), el clima actual, el precio de referencia y la simulación guardada si existe. El borrador no es una simulación ejecutada.`
    : dashboard
      ? `${PROVEEDOR_IA} recibe la pregunta, la parcela, el clima actual, el precio de referencia, la simulación más reciente y las cifras visibles del dashboard. Si falta una medición, debe indicarlo sin inventarla.`
      : `${PROVEEDOR_IA} recibe la pregunta y los datos autorizados de clima, precio, simulación y parcela. Si falta una medición, debe indicarlo sin inventarla.`;
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
    try {
      if (!favorito.conversacionId && !favorito.guardado) {
        window.sessionStorage.removeItem(favoritoKey);
        return;
      }
      window.sessionStorage.setItem(favoritoKey, JSON.stringify(favorito));
    } catch { /* noop */ }
  }, [favorito, favoritoKey]);

  useEffect(() => {
    if (abierto) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [abierto, mensajes, escribiendo]);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
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

  const enviarPregunta = async (pregunta) => {
    const preguntaTexto = normalizarTextoChat(pregunta).trim();
    if (!preguntaTexto || escribiendo) return;
    setMensajes((prev) => [...prev, { rol: 'usuario', texto: preguntaTexto }]);
    setInput('');
    setEscribiendo(true);
    setEstadoServicio('consultando');
    try {
      await new Promise((resolve) => setTimeout(resolve, 220));
      const data = await chatService.preguntar(
        preguntaTexto,
        vistaActual,
        cultivoElegidoId,
        anioSeleccionado,
        dashboard,
        vistaActual === 'simular' ? simulacion : null,
      );
      const texto = normalizarTextoChat(data?.texto ?? data?.respuesta ?? data?.answer);
      setMensajes((prev) => [...prev, {
        rol: 'asistente',
        texto: texto || 'No pude generar una respuesta con los datos disponibles.',
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
      const codigo = error?.response?.status;
      const sesionExpirada = codigo === 401;
      setMensajes((prev) => [...prev, {
        rol: 'asistente',
        texto: sesionExpirada
          ? 'Tu sesión expiró. Vuelve a iniciar sesión para continuar usando el asistente.'
          : codigo === 502
            ? `${PROVEEDOR_IA} no está disponible en este momento. Verifica que Flowise esté iniciado y que la credencial del proveedor tenga cuota disponible; no se mostrará una respuesta predeterminada.`
            : `No pude conectar con el flujo de ${PROVEEDOR_IA}. Revisa el estado de Flowise e inténtalo de nuevo.`,
        error: true,
        pregunta: preguntaTexto,
      }]);
      setEstadoServicio(sesionExpirada ? 'sesion' : 'error');
    } finally {
      setEscribiendo(false);
    }
  };

  const copiarUltimaRespuesta = async () => {
    const ultima = [...mensajes].reverse().find((mensaje) => mensaje.rol === 'asistente' && !mensaje.error);
    if (!ultima?.texto) return;
    try {
      await navigator.clipboard.writeText(ultima.texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1600);
    } catch { setCopiado(false); }
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
          anio: anioSeleccionado,
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
    setMensajes([]);
    setEstadoServicio('listo');
    setFavorito({ conversacionId: null, guardado: false });
    setErrorFavorito(false);
    try { window.sessionStorage.removeItem(storageKey); } catch { /* noop */ }
    try { window.sessionStorage.removeItem(favoritoKey); } catch { /* noop */ }
    chatService.limpiar().catch(() => { /* El historial local ya quedó limpio. */ });
  };

  const estadoTexto = {
    listo: `${PROVEEDOR_IA} listo para analizar`,
    consultando: 'Analizando tu pregunta…',
    conectado: `Respuesta directa de ${PROVEEDOR_IA}`,
    error: `Flujo ${PROVEEDOR_IA} no disponible`,
    sesion: 'Sesión expirada',
  }[estadoServicio] || 'Listo para analizar';

  return (
    <>
      {abierto && <button type="button" className="zeasys-chat-backdrop" aria-label="Cerrar asistente" onClick={() => setAbierto(false)} />}
      <button
        type="button"
        className={`zeasys-chat-tab ${abierto ? 'is-open' : ''}`}
        onClick={() => setAbierto((estado) => !estado)}
        aria-expanded={abierto}
        aria-controls="zeasys-chat-panel"
        aria-label={abierto ? 'Cerrar asistente ZeaSys' : 'Abrir asistente ZeaSys'}
      >
        {abierto ? <X size={18} /> : <MessageCircle size={18} />}<span>Asistente</span>
      </button>

      <aside id="zeasys-chat-panel" className={`zeasys-chat-panel ${abierto ? 'is-open' : ''}`} role="dialog" aria-label="Asistente de ZeaSys" aria-hidden={!abierto}>
        <header className="zeasys-chat-header">
          <div className="zeasys-chat-brand">
            <div className="zeasys-chat-avatar"><Bot size={20} /></div>
            <div><div className="zeasys-chat-title">Asistente ZeaSys</div><div className={`zeasys-chat-status is-${estadoServicio}`}><span className="zeasys-chat-status-dot" /> {estadoTexto}</div></div>
          </div>
          <div className="zeasys-chat-header-actions">
            <button type="button" onClick={alternarFavorito} disabled={!favorito.conversacionId || guardandoFavorito || !mensajes.length} className={`${favorito.guardado ? 'is-favorite' : ''} ${guardandoFavorito ? 'is-saving' : ''}`.trim()} aria-label={favorito.guardado ? 'Quitar conversación de favoritos' : 'Guardar conversación en favoritos'} title={favorito.guardado ? 'Conversación guardada en tu cuenta' : 'Guardar conversación en tu cuenta'}>{guardandoFavorito ? <Loader2 size={16} /> : <Star size={16} fill={favorito.guardado ? 'currentColor' : 'none'} />}</button>
            <button type="button" onClick={copiarUltimaRespuesta} disabled={!mensajes.length} aria-label="Copiar última respuesta" title="Copiar última respuesta">{copiado ? <Check size={16} /> : <Copy size={16} />}</button>
            <button type="button" onClick={limpiarChat} disabled={!mensajes.length} aria-label="Limpiar conversación" title="Limpiar conversación"><Trash2 size={16} /></button>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar asistente"><X size={18} /></button>
          </div>
        </header>

        <div className="zeasys-chat-context">
          <div className="zeasys-chat-context-row">
            <span className="zeasys-chat-context-icon">{vista.icono}</span>
            <div><span className="zeasys-chat-context-label">Panel actual</span><strong>{vista.nombre}</strong></div>
            <ChevronRight size={15} className="zeasys-chat-context-arrow" />
            <div><span className="zeasys-chat-context-label">{etiquetaParcela}</span><strong>{nombreParcela}</strong></div>
          </div>
          <button type="button" className="zeasys-chat-source-toggle" onClick={() => setMostrarFuente((estado) => !estado)}><Database size={13} /> {etiquetaFuente} <Info size={13} /></button>
          {mostrarFuente && <div className="zeasys-chat-source-detail"><strong>Contexto enviado al flujo</strong><span>{detalleFuente}</span></div>}
          {favorito.guardado && !errorFavorito && <div className="zeasys-chat-favorite-note"><Star size={12} fill="currentColor" aria-hidden="true" /> Conversación guardada en tu cuenta</div>}
          {errorFavorito && <div className="zeasys-chat-favorite-note is-error">No se pudo guardar la conversación. Inténtalo de nuevo.</div>}
        </div>

        <div className="zeasys-chat-messages" role="log" aria-live="polite" aria-label="Conversación con el asistente">
          {mensajes.length === 0 && <div className="zeasys-chat-welcome"><div className="zeasys-chat-welcome-icon"><Sparkles size={21} /></div><h2>¿Qué quieres analizar?</h2><p>{esSimulacion ? 'Puedo analizar los valores de esta simulación antes de ejecutarla: clima de entrada, pH, textura, área, fertilizante y la referencia de precio.' : dashboard ? 'Puedes cruzar clima actual, precio de referencia, rendimiento, margen y las cifras de este panel.' : 'Puedes preguntar por clima, precio del maíz, nutrientes, rendimiento o margen de tu parcela.'}</p><div className="zeasys-chat-chips">{(SUGERENCIAS[vistaActual] || ['¿Cómo está el clima hoy y cómo afecta mi parcela?', '¿Qué información tienes de mi parcela?', '¿Qué datos faltan para tomar una decisión?']).map((sugerencia) => <button type="button" key={sugerencia} onClick={() => enviarPregunta(sugerencia)} disabled={escribiendo}>{sugerencia}<ChevronRight size={14} aria-hidden="true" /></button>)}</div></div>}

          {mensajes.map((mensaje, index) => <div className={`zeasys-chat-message ${mensaje.rol === 'usuario' ? 'from-user' : 'from-assistant'}`} key={`${mensaje.rol}-${index}`}><div className="zeasys-chat-message-avatar">{mensaje.rol === 'usuario' ? <User size={14} /> : <Bot size={14} />}</div><div className="zeasys-chat-message-content"><div className="zeasys-chat-message-role">{mensaje.rol === 'usuario' ? 'Tú' : `${PROVEEDOR_IA} · ZeaSys`}</div><div className="zeasys-chat-bubble">{renderMarkdown(mensaje.texto)}</div>{mensaje.error && <button type="button" className="zeasys-chat-retry" onClick={() => enviarPregunta(mensaje.pregunta)}><RotateCcw size={13} /> Reintentar</button>}{index === ultimoAsistente && !mensaje.error && <div className="zeasys-chat-followups"><button type="button" onClick={() => enviarPregunta('Amplía tu respuesta anterior con más detalle, el razonamiento y las cifras concretas.')} disabled={escribiendo}>¿Quieres más detalle?<ChevronRight size={12} aria-hidden="true" /></button><button type="button" onClick={() => enviarPregunta('¿Cuál es la fuente y la fecha de los datos que usaste?')} disabled={escribiendo}>Ver fuente<ChevronRight size={12} aria-hidden="true" /></button></div>}</div></div>)}

          {escribiendo && <div className="zeasys-chat-message from-assistant"><div className="zeasys-chat-message-avatar"><Bot size={14} /></div><div className="zeasys-chat-message-content"><div className="zeasys-chat-message-role">{`${PROVEEDOR_IA} · ZeaSys`}</div><div className="zeasys-chat-bubble zeasys-chat-typing"><Loader2 size={15} /><span>Analizando tus datos…</span></div></div></div>}
          <div ref={messagesEndRef} />
        </div>

        <form className="zeasys-chat-composer" onSubmit={(evento) => { evento.preventDefault(); enviarPregunta(input); }}>
          <textarea ref={inputRef} aria-label="Escribe tu pregunta al asistente" value={input} onChange={(evento) => setInput(evento.target.value)} onKeyDown={(evento) => { if (evento.key === 'Enter' && !evento.shiftKey) { evento.preventDefault(); enviarPregunta(input); } }} placeholder="Escribe una pregunta sobre tu parcela…" rows={1} disabled={escribiendo} />
          <button type="submit" className="zeasys-chat-send" disabled={escribiendo || !input.trim()} aria-label="Enviar pregunta">{escribiendo ? <Loader2 size={17} /> : <Send size={17} />}</button>
          <div className="zeasys-chat-composer-hint">Enter para enviar · Shift + Enter para una nueva línea</div>
        </form>
      </aside>
    </>
  );
};

export default ChatbotWidget;
