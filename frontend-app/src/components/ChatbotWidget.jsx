import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, ChevronRight, Copy, Database, Info, Loader2, MessageCircle,
  RotateCcw, Send, Sparkles, Trash2, User, X,
} from 'lucide-react';
import { chatService } from '../services/chatService';
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
    datos_base_sistema: datos.datos_base_sistema || null,
    cultivo_activo: datos.cultivo_activo || null,
    percentiles: datos.percentiles || null,
    simulaciones_count: datos.simulaciones_count ?? null,
  };
  if (Array.isArray(datos.recomendaciones)) resumen.recomendaciones = datos.recomendaciones.slice(0, 5);
  if (Array.isArray(datos.ranking)) resumen.ranking = datos.ranking.slice(0, 5);
  if (Array.isArray(datos.viabilidad_siembra)) resumen.viabilidad_siembra = datos.viabilidad_siembra.slice(0, 8);
  if (datos.clima_actual) resumen.clima_actual = datos.clima_actual;
  if (datos.api_source) resumen.api_source = datos.api_source;
  return resumen;
};

const leerMensajes = (clave) => {
  try {
    const guardado = window.sessionStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : [];
  } catch {
    return [];
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
}) => {
  const [abierto, setAbierto] = useState(false);
  const storageKey = `zeasys_chat_gemini_v2_${usuarioId || 'sesion'}_${cultivoElegidoId || 'sin-parcela'}_${anioSeleccionado || 'sin-anio'}`;
  const [mensajes, setMensajes] = useState(() => leerMensajes(storageKey));
  const [input, setInput] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [estadoServicio, setEstadoServicio] = useState('listo');
  const [mostrarFuente, setMostrarFuente] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const vista = VISTAS[vistaActual] || { nombre: 'ZeaSys', icono: '✦' };
  const dashboard = useMemo(() => resumirDashboard(contextoDashboard, vistaActual, cultivoElegidoId, anioSeleccionado), [contextoDashboard, vistaActual, cultivoElegidoId, anioSeleccionado]);
  const nombreParcela = cultivoActivo?.nombre_parcela || 'Parcela seleccionada';

  useEffect(() => {
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(mensajes.slice(-40))); } catch { /* noop */ }
  }, [mensajes, storageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [mensajes, escribiendo]);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  const enviarPregunta = async (pregunta) => {
    const preguntaTexto = normalizarTextoChat(pregunta).trim();
    if (!preguntaTexto || escribiendo) return;
    setMensajes((prev) => [...prev, { rol: 'usuario', texto: preguntaTexto }]);
    setInput('');
    setEscribiendo(true);
    setEstadoServicio('consultando');
    try {
      await new Promise((resolve) => setTimeout(resolve, 220));
      const data = await chatService.preguntar(preguntaTexto, vistaActual, cultivoElegidoId, anioSeleccionado, dashboard);
      const texto = normalizarTextoChat(data?.texto ?? data?.respuesta ?? data?.answer);
      setMensajes((prev) => [...prev, {
        rol: 'asistente',
        texto: texto || 'No pude generar una respuesta con los datos disponibles.',
        fuente: data?.fuente_datos || null,
      }]);
      setEstadoServicio('conectado');
    } catch (error) {
      const codigo = error?.response?.status;
      const sesionExpirada = codigo === 401;
      setMensajes((prev) => [...prev, {
        rol: 'asistente',
        texto: sesionExpirada
          ? 'Tu sesión expiró. Vuelve a iniciar sesión para continuar usando el asistente.'
          : codigo === 502
            ? 'Gemini no está disponible en este momento. Verifica que Flowise esté iniciado y que la credencial de Gemini tenga cuota; no se mostrará una respuesta predeterminada.'
            : 'No pude conectar con el flujo de Gemini. Revisa el estado de Flowise e inténtalo de nuevo.',
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

  const limpiarChat = () => {
    setMensajes([]);
    setEstadoServicio('listo');
    try { window.sessionStorage.removeItem(storageKey); } catch { /* noop */ }
    chatService.limpiar().catch(() => { /* El historial local ya quedó limpio. */ });
  };

  const estadoTexto = {
    listo: 'Gemini listo para analizar',
    consultando: 'Analizando tu pregunta…',
    conectado: 'Respuesta directa de Gemini',
    error: 'Flujo Gemini no disponible',
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
            <div><span className="zeasys-chat-context-label">Parcela</span><strong>{nombreParcela}</strong></div>
          </div>
          <button type="button" className="zeasys-chat-source-toggle" onClick={() => setMostrarFuente((estado) => !estado)}><Database size={13} /> {dashboard ? 'Dashboard enviado a Gemini' : 'Pregunta enviada a Gemini'} <Info size={13} /></button>
          {mostrarFuente && <div className="zeasys-chat-source-detail"><strong>Contexto enviado al flujo</strong><span>{dashboard ? 'Gemini recibe la pregunta, la parcela, el año y las cifras visibles del dashboard para responder directamente con ese contexto.' : 'Gemini recibe la pregunta y los datos autorizados disponibles. Si falta una medición, debe indicarlo sin inventarla.'}</span></div>}
        </div>

        <div className="zeasys-chat-messages" role="log" aria-live="polite" aria-label="Conversación con el asistente">
          {mensajes.length === 0 && <div className="zeasys-chat-welcome"><div className="zeasys-chat-welcome-icon"><Sparkles size={21} /></div><h2>¿Qué quieres analizar?</h2><p>Escribe cualquier pregunta con lenguaje natural. Gemini responderá usando la parcela, el panel y las cifras que tienes seleccionadas.</p></div>}

          {mensajes.map((mensaje, index) => <div className={`zeasys-chat-message ${mensaje.rol === 'usuario' ? 'from-user' : 'from-assistant'}`} key={`${mensaje.rol}-${index}`}><div className="zeasys-chat-message-avatar">{mensaje.rol === 'usuario' ? <User size={14} /> : <Bot size={14} />}</div><div className="zeasys-chat-message-content"><div className="zeasys-chat-message-role">{mensaje.rol === 'usuario' ? 'Tú' : 'Gemini · ZeaSys'}</div><div className="zeasys-chat-bubble">{renderMarkdown(mensaje.texto)}</div>{mensaje.error && <button type="button" className="zeasys-chat-retry" onClick={() => enviarPregunta(mensaje.pregunta)}><RotateCcw size={13} /> Reintentar</button>}{mensaje.fuente && <div className="zeasys-chat-message-source"><Database size={12} /> Respuesta directa del flujo Gemini</div>}</div></div>)}

          {escribiendo && <div className="zeasys-chat-message from-assistant"><div className="zeasys-chat-message-avatar"><Bot size={14} /></div><div className="zeasys-chat-message-content"><div className="zeasys-chat-message-role">Gemini · ZeaSys</div><div className="zeasys-chat-bubble zeasys-chat-typing"><Loader2 size={15} /><span>Analizando tus datos…</span></div></div></div>}
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
