import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

const asText = (value) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const cleanText = (value) => asText(value).replace(/\*\*/g, '').replace(/\s+/g, ' ');

export default function SimulationInfoCard({ isOpen, onClose, loading, data }) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (!panelRef.current?.contains(document.activeElement)) triggerRef.current = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    return undefined;
  }, [isOpen, data?.explicacion_id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    return () => { if (triggerRef.current?.isConnected) triggerRef.current.focus({preventScroll:true}); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const title = cleanText(data?.titulo || data?.nombre) || 'Detalle de la simulación';
  const value = typeof data?.valor === 'number' && Number.isFinite(data.valor) ? data.valor.toLocaleString('es-EC', { maximumFractionDigits: 3 }) : asText(data?.valor);
  const unit = asText(data?.unidad);
  const meaning = cleanText(data?.que_significa || data?.explicacion_breve || data?.descripcion_tecnica || data?.secciones?.[0]?.contenido);
  const nextStep = cleanText(data?.como_mejorarlo || data?.recomendacion || data?.secciones?.[2]?.contenido);
  const guide = data?.guia_lectura;
  const summary = cleanText(guide?.resumen);
  const reading = Array.isArray(guide?.lectura) ? guide.lectura.map(cleanText).filter(Boolean) : [];
  const limit = cleanText(guide?.limite);
  const context = cleanText(data?.por_que_pudo_pasar || data?.secciones?.[1]?.contenido);

  return createPortal(
    <div ref={panelRef} className="simulation-info-card" role="dialog" aria-modal="false" aria-label={`Información de ${title}`}>
      <div className="simulation-info-card-head">
        <span className="simulation-info-card-icon"><Info size={17} aria-hidden="true" /></span>
        <div className="simulation-info-card-heading">
          <span className="simulation-info-card-eyebrow">Entiende tus datos</span>
          <h3>{title}</h3>
        </div>
        <button ref={closeRef} type="button" className="simulation-info-card-close" onClick={onClose} aria-label="Cerrar información"><X size={18} /></button>
      </div>
      {value && <div className="simulation-info-card-value">{value}{unit && <span> {unit}</span>}</div>}
      <section className="simulation-info-section"><h4>Qué muestra</h4><p>{summary || meaning || (loading ? 'Preparando la lectura de este dato…' : 'No hay una explicación disponible para este dato.')}</p></section>
      {reading.length > 0 && <section className="simulation-info-section"><h4>Cómo leerlo</h4><ul>{reading.map((text, index) => <li key={index}>{text}</li>)}</ul></section>}
      {limit && <section className="simulation-info-section simulation-info-limit"><h4>Ten en cuenta</h4><p>{limit}</p></section>}
      {!summary && context && !loading && <section className="simulation-info-section"><h4>Contexto y límites</h4><p>{context}</p></section>}
      {!summary && nextStep && !loading && <div className="simulation-info-card-step"><strong>Qué revisar</strong><span>{nextStep}</span></div>}
      {summary && !loading && !data?.detalle_no_disponible && (meaning || nextStep || context) && <details className="simulation-info-extra"><summary>Ver detalle adicional</summary>{meaning && <p>{meaning}</p>}{context && <p>{context}</p>}{nextStep && <p>{nextStep}</p>}</details>}
      {data?.detalle_no_disponible && <p className="simulation-info-notice" role="status">{summary ? 'No se pudo cargar el detalle adicional. La explicación de los datos visibles sigue disponible.' : 'No se pudo cargar el detalle adicional. Cierra esta ventana y pulsa de nuevo la tarjeta para reintentar.'}</p>}
      {loading && <><p className="simulation-info-notice" role="status">Cargando detalle adicional…</p><span className="simulation-info-card-loading" aria-hidden="true" /></>}
    </div>,
    document.querySelector('.zeasys-workspace') || document.body
  );
}
