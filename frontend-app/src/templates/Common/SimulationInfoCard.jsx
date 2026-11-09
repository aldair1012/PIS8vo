import { useEffect, useRef } from 'react';
import { Info, X } from 'lucide-react';

const asText = (value) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const cleanText = (value) => asText(value).replace(/\*\*/g, '').replace(/\s+/g, ' ');

export default function SimulationInfoCard({ isOpen, onClose, loading, data }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    closeRef.current?.focus({ preventScroll: true });
    const onEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const title = cleanText(data?.titulo || data?.nombre) || 'Detalle de la simulación';
  const value = asText(data?.valor);
  const unit = asText(data?.unidad);
  const meaning = cleanText(data?.que_significa || data?.explicacion_breve || data?.descripcion_tecnica || data?.secciones?.[0]?.contenido);
  const nextStep = cleanText(data?.como_mejorarlo || data?.recomendacion || data?.secciones?.[2]?.contenido);

  return (
    <aside className="simulation-info-card" role="status" aria-live="polite" aria-label={`Información de ${title}`}>
      <div className="simulation-info-card-head">
        <span className="simulation-info-card-icon"><Info size={17} aria-hidden="true" /></span>
        <div className="simulation-info-card-heading">
          <span className="simulation-info-card-eyebrow">Dato de la simulación</span>
          <h3>{title}</h3>
        </div>
        <button ref={closeRef} type="button" className="simulation-info-card-close" onClick={onClose} aria-label="Cerrar información"><X size={18} /></button>
      </div>
      {value && <div className="simulation-info-card-value">{value}{unit && <span> {unit}</span>}</div>}
      {meaning && <p>{meaning}</p>}
      {!meaning && loading && <p>Consultando la explicación del indicador…</p>}
      {nextStep && !loading && <div className="simulation-info-card-step"><strong>Para revisar</strong><span>{nextStep}</span></div>}
      {!meaning && !loading && !nextStep && <p>No hay una explicación disponible para este dato.</p>}
      {loading && <span className="simulation-info-card-loading" aria-label="Cargando explicación" />}
    </aside>
  );
}
