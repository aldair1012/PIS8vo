import { useEffect, useRef, useState } from 'react';
import { dssService } from '../services/api';
import MedicionesRendimiento from './MedicionesRendimiento';
import '../assets/registro-campo.css';

export default function RegistroCampo({ cultivos, initialId, onClose, onUpdated }) {
  const dialogRef = useRef(null);
  const [selectedId, setSelectedId] = useState(() => String(initialId ?? cultivos[0]?.id ?? ''));
  const [result, setResult] = useState(null);
  const lote = cultivos.find((item) => String(item.id) === selectedId);
  const current = result?.id === selectedId ? result : null;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    dssService.getRendimientoData(selectedId, null)
      .then((data) => { if (active) setResult({ id: selectedId, registro: data.mediciones_campo ?? { datos: {}, indicadores: {} } }); })
      .catch(() => { if (active) setResult({ id: selectedId, error: true }); });
    return () => { active = false; };
  }, [selectedId]);

  return <dialog ref={dialogRef} className="registro-campo" aria-labelledby="registro-campo-titulo" onClose={onClose}>
    <div className="registro-campo-header"><div><h2 id="registro-campo-titulo">Registro de campo</h2><p>Guarda tus mediciones y observaciones para cada parcela.</p></div><button type="button" onClick={() => dialogRef.current?.close()} aria-label="Cerrar registro de campo">Cerrar</button></div>
    {cultivos.length === 0 ? <p>No tienes parcelas registradas. Primero crea una parcela para registrar sus datos.</p> : <>
      <label className="registro-campo-selector">Parcela<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="" disabled>Selecciona una parcela</option>{cultivos.map((item) => <option value={item.id} key={item.id}>{item.nombre_parcela}</option>)}</select></label>
      {!current ? <p role="status">Cargando mediciones de la parcela…</p> : current.error ? <p role="alert">No se pudieron cargar las mediciones. Cierra esta ventana e inténtalo de nuevo.</p> : lote && <MedicionesRendimiento key={selectedId} lote={lote} registro={current.registro} defaultOpen onSaved={(registro) => { setResult((previous) => previous?.id === selectedId ? { ...previous, registro } : previous); onUpdated?.(Number(selectedId)); }} />}
    </>}
  </dialog>;
}
