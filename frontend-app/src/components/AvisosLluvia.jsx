import { useEffect, useState } from 'react';
import { dssService } from '../services/api';

export default function AvisosLluvia({ plotId }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [threshold, setThreshold] = useState('25');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    dssService.avisoLluvia(plotId).then(response => {
      if (active) { setSettings(response); setError(''); if (response.umbral_mm != null) setThreshold(String(response.umbral_mm)); }
    }).catch(() => { if (active) setError('No se pudo consultar la suscripción. Revisa tu conexión y vuelve a intentar.'); });
    return () => { active = false; };
  }, [plotId, open, revision]);
  async function update(method) {
    setBusy(true);
    setError('');
    try {
      const response = await dssService.avisoLluvia(plotId, method, method === 'post' ? { umbral_mm: Number(threshold), consiento: consent } : undefined);
      setSettings(previous => ({...previous, ...response, pendiente: !!response.confirmar_url, confirmar_url: response.confirmar_url}));
      setConsent(false);
    } catch {
      setError('No se pudo guardar el cambio. Revisa el estado de la suscripción antes de reintentar.');
    } finally { setBusy(false); }
  }
  return <details className="climate-water-details" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Avisos semanales de lluvia por WhatsApp</summary>
    {error && <p role="alert">{error}</p>}
    {!settings && !error && <p>Consultando la suscripción…</p>}
    {settings?.configurado === false && <p>El administrador aún debe conectar WhatsApp Business para habilitar este canal.</p>}
    {settings?.activa ? <p>Aviso activo si algún día de los próximos siete alcanza {settings.umbral_mm} mm de lluvia prevista. Confirmado el {settings.consentido_utc} UTC.</p> :
      settings?.configurado && <form onSubmit={event => { event.preventDefault(); update('post'); }}>
        <label>Lluvia prevista en un día (mm) <input type="number" min="1" max="500" step="0.1" required value={threshold} onChange={event => setThreshold(event.target.value)} /></label>
        <p>Recibirás como máximo un aviso por parcela y semana. Usamos tu número para enviarte la fecha y los milímetros previstos a través de Meta. Este umbral lo eliges tú.</p>
        <label><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /> Autorizo estos avisos para mi número de WhatsApp.</label>
        <button type="submit" className="climate-action" disabled={busy || !consent}>Preparar activación</button>
      </form>}
    {settings?.confirmar_url && <p><a href={settings.confirmar_url} target="_blank" rel="noopener noreferrer">Confirmar desde mi WhatsApp</a> · envía el mensaje preparado dentro de 15 minutos y actualiza el estado.</p>}
    {settings?.pendiente && !settings.confirmar_url && <p>Confirmación pendiente. Puedes generar otro enlace.</p>}
    {(settings?.activa || settings?.pendiente || settings?.configurado === false) && <button className="climate-action" type="button" disabled={busy} onClick={() => update('delete')}>Retirar permiso y eliminar mi número</button>}
    <button className="climate-action" type="button" disabled={busy} onClick={() => setRevision(n => n + 1)}>Actualizar estado</button>
    <p>También puedes escribir BAJA al número de ZeaSys para retirar todos tus avisos de ese teléfono.</p>
  </details>;
}
