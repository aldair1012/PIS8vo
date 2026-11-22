import { useEffect, useRef, useState } from 'react';
import { acompanamientoService } from '../services/api';
import '../assets/panel-tecnico.css';

export default function PanelTecnico({ parcelas, onClose }) {
  const dialog = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const el = dialog.current;
    el.showModal();
    return () => el.close();
  }, []);
  useEffect(() => {
    let active = true;
    acompanamientoService.panel().then(result => {
      if (!Array.isArray(result?.accesos) || !Array.isArray(result.triaje)) throw new Error();
      if (active) setData(result);
    }).catch(() => { if (active) setError('No se pudo consultar el acompañamiento.'); });
    return () => { active = false; };
  }, [revision]);
  const refresh = () => { setData(null); setError(''); setRevision(r => r + 1); };
  const update = async (change, text) => {
    setError(''); setBusy(true); setStatus('');
    try {
      await change();
      setStatus(text);
      refresh();
    } catch (e) {
      setError(typeof e.response?.data?.error === 'string' ? e.response.data.error : 'No se pudo actualizar el permiso.');
    } finally { setBusy(false); }
  };
  const grant = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update(() => acompanamientoService.conceder(form.get('parcela_id'), form.get('correo')), 'Acceso de lectura concedido.');
  };
  return <dialog ref={dialog} className="tecnico-dialog" aria-labelledby="tecnico-titulo" onCancel={onClose}>
    <header><h2 id="tecnico-titulo">Acompañamiento técnico</h2><button type="button" onClick={onClose} className="btn btn-secondary">Cerrar</button></header>
    {error && <p role="alert">{error} <button type="button" onClick={refresh}>Volver a consultar</button></p>}
    {status && <p role="status">{status}</p>}
    {!data && !error && <p role="status">Consultando permisos y parcelas…</p>}
    {data && <>
      <section><h3>Parcelas que puedes acompañar</h3>
        {data.triaje.length ? <>
          <p>Ordenadas por motivo de seguimiento en su campaña actual.</p>
          <ul>{data.triaje.map(f => <li key={f.id}><strong>{f.nombre_parcela} · {f.estado}</strong><p>{f.motivo}</p>
            <small>{f.fecha_siembra ? `Siembra ${f.fecha_siembra}` : 'Siembra sin registrar'}{f.ultima_observacion && ` · Última observación ${f.ultima_observacion}`}
              {f.rendimiento_observado_t_ha != null && ` · Cosecha ${Number(f.rendimiento_observado_t_ha).toLocaleString('es-EC', { maximumFractionDigits: 3 })} t/ha`}</small></li>)}</ul>
          <a className="btn btn-secondary" href={acompanamientoService.csv()} download>Descargar seguimiento en CSV</a>
        </> : <p>Ningún titular te ha dado acceso a una parcela.</p>}
      </section>
      <section><h3>Acceso a tus parcelas</h3>
        {parcelas.length ? <form onSubmit={grant}>
          <p>La cuenta elegida podrá consultar y exportar el nombre y área de esta parcela, las fechas de campaña, el rendimiento cosechado y el motivo de seguimiento.</p>
          <label>Parcela a compartir<select name="parcela_id" required defaultValue=""><option value="" disabled>Seleccionar parcela</option>{parcelas.map(p => <option key={p.id} value={p.id}>{p.nombre_parcela}</option>)}</select></label>
          <label>Correo de la cuenta técnica<input name="correo" type="email" maxLength={150} required /></label>
          <button className="btn btn-primary" type="submit" disabled={busy}>Conceder acceso de lectura</button>
        </form> : <p>Registra una parcela para compartir su seguimiento.</p>}
        {data.accesos.length > 0 && <ul aria-label="Permisos concedidos">{data.accesos.map(a => <li key={a.parcela_id + '-' + a.tecnico_id}>
          <strong>{a.nombre_parcela}</strong> · {a.correo}{' '}
          <button className="btn btn-secondary" disabled={busy} type="button" onClick={() => update(() => acompanamientoService.revocar(a.parcela_id, a.tecnico_id), 'Acceso revocado.')}>Revocar acceso</button>
        </li>)}</ul>}
      </section>
    </>}
  </dialog>;
}
