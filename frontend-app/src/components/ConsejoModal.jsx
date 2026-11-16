import { useEffect, useRef } from 'react';
import { Sparkles, MousePointerClick, X } from 'lucide-react';
import '../assets/consejo-modal.css';

/**
 * Consejo de bienvenida (una vez por navegador) recomendo el chatbot
 * y explica que cualquier grafico o metrica abre el asistente de analisis IA.
 * Patron dialog/showModal (igual que RegistroCampo) para el cierre desde el sistema.
 */
export default function ConsejoModal({ onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const cerrar = () => {
    try { localStorage.setItem('zeasys-consejo-mostrado', '1'); } catch { /* espacio privado: se muestra de nuevo */ }
    onClose?.();
    dialogRef.current?.close();
  };

  return (
    <dialog ref={dialogRef} className="consejo-modal" aria-labelledby="consejo-modal-titulo" onClose={() => onClose?.()}>
      <button type="button" className="consejo-modal-close" onClick={cerrar} aria-label="Cerrar consejo"><X size={18} /></button>
      <div className="consejo-modal-icon" aria-hidden="true"><Sparkles size={30} /></div>
      <span className="consejo-modal-eyebrow">ZeaSys · Consejo</span>
      <h2 id="consejo-modal-titulo" className="consejo-modal-titulo">Pregúntale a ZeaSys, no busques la respuesta</h2>
      <p className="consejo-modal-texto">
        Cualquier <strong>gráfico</strong> o <strong>métrica</strong> de ZeaSys se puede tocar para que el asistente te explique 
        qué significa, qué tan confiable es el dato y qué hacer con él. También puedes conversar sobre tu parcela, tu cultivo, 
        tu clima y tu economía en el botón <strong>«Asistente»</strong> (costado derecho) en cualquier momento.
      </p>
      <div className="consejo-modal-demo">
        <MousePointerClick size={17} aria-hidden="true" />
        <span>Consejo rápido: toca el KPI «ENSO de referencia» o la tarjeta «Humedad del suelo hoy» para ver un análisis directo.</span>
      </div>
      <div className="consejo-modal-actions">
        <button type="button" className="consejo-modal-primary" onClick={cerrar}>Entendido, continuar</button>
        <button type="button" className="consejo-modal-ghost" onClick={cerrar}>No volver a mostrar este mensaje</button>
      </div>
    </dialog>
  );
}
