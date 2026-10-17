import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { chatService } from '../services/chatService';

const CHIPS_POR_VISTA = {
  yield: ['¿Qué significa mi ROI?', '¿Cómo mejoro el rendimiento?', '¿Cuál es el yield gap?'],
  scenarios: ['¿Cuándo sembrar?', '¿Qué variedad elegir?', '¿Qué riesgo climático hay?'],
  climate: ['¿Qué clima hace?', '¿Qué plaga afecta mi cultivo?', '¿Cuál es el ENSO?'],
  finance: ['¿Cuál es mi margen?', '¿Cuánto gano por hectárea?', '¿Cuál es mi punto de equilibrio?'],
  simular: ['¿Qué variables necesito?', '¿Qué modelo usar?', '¿Cómo interpretar el resultado?'],
  cultivos: ['¿Dónde está mi parcela?', '¿Qué variedad usar?', '¿Cómo registrar un lote?'],
  history: ['¿Qué simulaciones tengo?', '¿Cuál fue mi mejor rendimiento?'],
  map: ['¿Dónde está mi parcela?', '¿Qué zona es mejor?'],
  default: ['¿Qué significa mi ROI?', '¿Cómo mejoro el rendimiento?', '¿Qué clima hace?'],
};

const renderMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
};

const ChatbotWidget = ({ vistaActual }) => {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const chips = CHIPS_POR_VISTA[vistaActual] || CHIPS_POR_VISTA.default;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, escribiendo]);

  useEffect(() => {
    if (abierto && inputRef.current) {
      inputRef.current.focus();
    }
  }, [abierto]);

  const enviarPregunta = async (pregunta) => {
    if (!pregunta.trim() || escribiendo) return;

    const nuevoMsg = { rol: 'usuario', texto: pregunta, ts: Date.now() };
    setMensajes(prev => [...prev, nuevoMsg]);
    setInput('');
    setEscribiendo(true);

    try {
      // Delay simulado para naturalidad
      await new Promise(r => setTimeout(r, 300));
      const data = await chatService.preguntar(pregunta, vistaActual);
      setMensajes(prev => [...prev, {
        rol: 'asistente',
        texto: data.texto || 'No pude generar una respuesta.',
        secciones: data.secciones || [],
        accion: data.accion,
        ts: Date.now(),
      }]);
    } catch (err) {
      setMensajes(prev => [...prev, {
        rol: 'asistente',
        texto: 'Ocurrió un error al procesar tu pregunta. Intenta de nuevo.',
        ts: Date.now(),
      }]);
    } finally {
      setEscribiendo(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarPregunta(input);
    }
  };

  const limpiarChat = () => {
    setMensajes([]);
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto(!abierto)}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: abierto
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : 'linear-gradient(135deg, #22c55e, #16a34a)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 9999,
          transition: 'all 0.3s ease',
          transform: abierto ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
        aria-label={abierto ? 'Cerrar chat' : 'Abrir asistente'}
      >
        {abierto ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Panel de chat */}
      {abierto && (
        <div
          style={{
            position: 'fixed',
            bottom: '5.5rem',
            right: '1.5rem',
            width: '380px',
            maxWidth: 'calc(100vw - 3rem)',
            height: '520px',
            maxHeight: 'calc(100vh - 8rem)',
            background: 'var(--card-bg, #1e293b)',
            borderRadius: '16px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9998,
            overflow: 'hidden',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '0.875rem 1rem',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={20} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Asistente ZeaSys</span>
            </div>
            <button
              onClick={limpiarChat}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.7rem',
              }}
            >
              Limpiar
            </button>
          </div>

          {/* Mensajes */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            {mensajes.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted, #94a3b8)', padding: '2rem 1rem', fontSize: '0.85rem' }}>
                <Bot size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>Hola, soy el asistente de ZeaSys</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', opacity: 0.8 }}>
                  Pregúntame sobre indicadores, clima, costos, plagas o tu parcela.
                </p>
              </div>
            )}

            {mensajes.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                  flexDirection: msg.rol === 'usuario' ? 'row-reverse' : 'row',
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: msg.rol === 'usuario' ? '#3b82f6' : '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {msg.rol === 'usuario' ? <User size={14} color="white" /> : <Bot size={14} color="white" />}
                </div>
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '12px',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    background: msg.rol === 'usuario'
                      ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                      : 'var(--card-bg-secondary, rgba(255,255,255,0.06))',
                    color: msg.rol === 'usuario' ? 'white' : 'var(--text-primary, #e2e8f0)',
                    borderBottomRightRadius: msg.rol === 'usuario' ? '4px' : '12px',
                    borderBottomLeftRadius: msg.rol === 'usuario' ? '12px' : '4px',
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.texto) }}
                />
              </div>
            ))}

            {escribiendo && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Bot size={14} color="white" />
                </div>
                <div style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: '12px',
                  background: 'var(--card-bg-secondary, rgba(255,255,255,0.06))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#22c55e' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>Escribiendo...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chips contextuales */}
          {mensajes.length === 0 && (
            <div style={{
              padding: '0 1rem 0.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.375rem',
              flexShrink: 0,
            }}>
              {chips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => enviarPregunta(chip)}
                  disabled={escribiendo}
                  style={{
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#22c55e',
                    borderRadius: '16px',
                    padding: '0.3rem 0.625rem',
                    fontSize: '0.72rem',
                    cursor: escribiendo ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: escribiendo ? 0.5 : 1,
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border, rgba(255,255,255,0.1))',
            display: 'flex',
            gap: '0.5rem',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              disabled={escribiendo}
              style={{
                flex: 1,
                padding: '0.625rem 0.875rem',
                borderRadius: '10px',
                border: '1px solid var(--border, rgba(255,255,255,0.15))',
                background: 'var(--input-bg, rgba(255,255,255,0.05))',
                color: 'var(--text-primary, #e2e8f0)',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
            <button
              onClick={() => enviarPregunta(input)}
              disabled={escribiendo || !input.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: escribiendo || !input.trim()
                  ? 'rgba(34, 197, 94, 0.3)'
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: 'white',
                border: 'none',
                cursor: escribiendo || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {escribiendo ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;