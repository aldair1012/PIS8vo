import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { dssService } from '../services/api';
import { diasCultivo } from '../utils/fieldInputs';
import { campaignBands } from '../utils/campaignBands';
import { seguimientoNdvi } from '../utils/seguimientoNdvi';
import { DashboardPanel } from '../templates/Common/DashboardPrimitives';
import '../assets/campanas.css';

const fmt = value => new Intl.NumberFormat('es-EC', { maximumFractionDigits: 3 }).format(value);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function Bandas({ cosechas, simulacion }) {
  if (!simulacion) return null;
  const { n, median, bands } = campaignBands(cosechas, simulacion);
  const max = Math.max(1, median ?? 0, ...bands.map(band => band.high));
  return <section className="campanas-bandas">
    <h3>Bandas para la simulación #{simulacion.id}</h3>
    <p>{n} campañas comparables de la misma versión registradas antes de esta predicción. El cálculo suma los residuos históricos a la predicción guardada.</p>
    {n >= 3 && <p>Mediana ajustada <strong>{fmt(median)} t/ha</strong></p>}
    {bands.map(({ level, low, high }) => <div key={level} className="campanas-banda">
      <span>{level} % · {fmt(low)}–{fmt(high)} t/ha</span>
      <div aria-hidden="true"><i style={{ left: `${100 * low / max}%`, width: `${100 * (high - low) / max}%` }} /></div>
    </div>)}
    {n < 19 && <p>{n < 3 ? 'La banda del 50 % requiere 3 campañas. ' : ''}La del 90 % requiere 19 campañas.</p>}
    {bands.length > 0 && <small>Los porcentajes son niveles nominales. La cobertura futura depende de que las campañas sean comparables.</small>}
  </section>;
}

function Seguimiento({ historial, simulacion }) {
  const r = seguimientoNdvi(historial.cosechas, historial.observaciones, simulacion, today());
  return <details className="campanas-registro"><summary>Seguimiento del rendimiento con NDVI</summary>
    <p>Revisión a los 45 días desde la siembra con observaciones de la misma parcela. La estimación inicial permanece guardada.</p>
    {r.motivo && <p>{r.motivo}</p>}
    {r.n != null && <p>Al {r.corte} · NDVI del {r.lectura} · {r.n} campañas comparables · {r.pruebas} pruebas en orden temporal.</p>}
    {r.maePlan != null && <p>Error absoluto medio en las mismas campañas, en t/ha. Plan inicial {fmt(r.maePlan)}, corrección media de parcela {fmt(r.maeSimple)}, corrección con NDVI {fmt(r.maeNdvi)}.</p>}
    {r.rendimiento != null && <p>Estimación experimental de seguimiento <strong>{fmt(r.rendimiento)} t/ha</strong>. El resultado depende de la comparabilidad de las mediciones entre campañas.</p>}
  </details>;
}

function Registro({ observacion, parcela, simulaciones, simulacion, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [siembra, setSiembra] = useState((observacion ? parcela.fecha_siembra : simulacion?.parcela_ejecucion?.fecha_siembra ?? parcela.fecha_siembra)?.slice(0, 10) ?? '');
  const [fecha, setFecha] = useState('');
  const [peso, setPeso] = useState('');
  const [superficie, setSuperficie] = useState('');
  const dias = diasCultivo(siembra, fecha);
  const rendimiento = peso !== '' && Number(superficie) > 0 ? Number(peso) / 1000 / Number(superficie) : null;
  const elegibles = simulaciones.filter(s => s.version_modelo && s.parcela_ejecucion?.fecha_siembra === siembra && s.fecha?.slice(0, 10) < fecha);
  const save = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const datos = new FormData(form);
    datos.set('parcela_id', parcela.id);
    setMessage(null);
    setSaving(true);
    try {
      if (observacion) {
        const file = datos.get('adjunto');
        if (file?.size > 2 * 1024 * 1024) throw new Error('El adjunto debe pesar como máximo 2 MiB.');
        if (!file?.size) datos.delete('adjunto');
        await dssService.registrarObservacion(datos);
      } else {
        await dssService.registrarCosecha({ ...Object.fromEntries(datos), base_comparable: datos.has('base_comparable') });
      }
      form.reset();
      setFecha(''); setPeso(''); setSuperficie('');
      setMessage({ text: observacion ? 'Observación guardada.' : 'Cosecha guardada.' });
      onSaved();
    } catch (error) {
      const detail = error.response?.data?.error;
      setMessage({ error: true, text: typeof detail === 'string' ? detail : error.response ? 'Revisa los datos y vuelve a intentarlo.' : error.message });
    } finally {
      setSaving(false);
    }
  };
  return <details className="campanas-registro"><summary>{observacion ? 'Agregar observación de campo' : 'Registrar cosecha de la campaña'}</summary>
    <form onSubmit={save}><fieldset disabled={saving}>
      <label>Siembra de la campaña<input type="date" name="fecha_siembra" value={siembra} onChange={e => setSiembra(e.target.value)} max={today()} required /></label>
      <label>{observacion ? 'Fecha de observación' : 'Fecha de cosecha'}<input type="date" name={observacion ? 'fecha' : 'fecha_cosecha'} value={fecha} onChange={e => setFecha(e.target.value)} min={siembra} max={today()} required /></label>
      {dias !== null && <p>La {observacion ? 'observación' : 'cosecha'} corresponde al día {dias} desde la siembra.</p>}
      {observacion ? <>
        <label>Observación<textarea name="nota" maxLength={500} rows={2} /></label>
        <label>NDVI medido (opcional)<input type="number" min="-1" max="1" step="0.00001" name="ndvi" /></label>
        <label>Foto o audio (opcional, hasta 2 MiB)<input type="file" name="adjunto" accept="image/jpeg,image/png,audio/mpeg,audio/ogg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a" /></label>
      </> : <>
        <label>Grano total pesado (kg)<input type="number" min="0" max="1000000000" step="0.0001" name="produccion_seca_kg" value={peso} onChange={e => setPeso(e.target.value)} required /></label>
        <label>Superficie cosechada (ha)<input type="number" min="0.000001" max="10000000" step="0.000001" name="area_cosechada_ha" value={superficie} onChange={e => setSuperficie(e.target.value)} required /></label>
        {Number(parcela.area) > 0 && <button type="button" className="sowing-secondary" onClick={() => setSuperficie(String(parcela.area))}>Usar toda la parcela ({fmt(parcela.area)} ha)</button>}
        {Number.isFinite(rendimiento) && rendimiento >= 0 && <p>Rendimiento según el pesaje: <strong>{fmt(rendimiento)} t/ha</strong>.</p>}
        <label>Humedad a la que se expresa el peso (%)<input type="number" min="0" max="99.99" step="0.01" name="humedad_grano_pct" required /></label>
        <label>Simulación previa<select name="simulacion_id" key={siembra + fecha} defaultValue={elegibles.find(s => s.id === simulacion?.id)?.id ?? ''}><option value="">Guardar sólo la cosecha</option>
          {elegibles.map(s => <option key={s.id} value={s.id}>#{s.id} · {s.fecha.slice(0, 10)} · {s.version_modelo} · {fmt(s.area_simulada_ha)} ha</option>)}</select></label>
        <label className="campanas-check"><input type="checkbox" name="base_comparable" />Confirmo la misma superficie y base de humedad para incluir el par en las métricas.</label>
      </>}
      <label>{observacion ? 'Fuente de la observación o escena NDVI' : 'Fuente del pesaje y del área'}<input type="text" name="fuente" maxLength={255} required placeholder={observacion ? 'Cuaderno, fecha de escena o informe' : 'Referencia del comprobante o cuaderno de campo'} /></label>
      <button type="submit" className="ydp-primary-action">{saving ? 'Guardando…' : observacion ? 'Guardar observación' : 'Guardar cosecha'}</button>
    </fieldset></form>
    {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </details>;
}

export default function CampanasParcela({ parcela, simulaciones, simulacion }) {
  const [historial, setHistorial] = useState(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = () => { setFailed(false); setRevision(v => v + 1); };
  useEffect(() => {
    let active = true;
    dssService.getCampanas(parcela.id).then(data => {
      if (!Array.isArray(data?.cosechas) || !Array.isArray(data.observaciones) || !Array.isArray(data.metricas)) throw new Error();
      if (active) setHistorial(data);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [parcela.id, revision]);
  const campanas = [...new Set([...(historial?.cosechas ?? []), ...(historial?.observaciones ?? [])].map(r => r.fecha_siembra))].sort().reverse();
  return <DashboardPanel title="Memoria de campañas" icon={CalendarDays} subtitle="Cosechas y observaciones de esta parcela, agrupadas por fecha de siembra." className="campanas-panel">
    {failed && <p role="alert">No se pudo actualizar el historial. <button type="button" onClick={reload}>Reintentar</button></p>}
    {!historial && !failed && <p role="status">Cargando campañas…</p>}
    {historial && <>
      {!campanas.length && <p>Todavía no hay cosechas ni observaciones de campaña registradas.</p>}
      <Registro key={simulacion?.parcela_ejecucion?.fecha_siembra ?? parcela.fecha_siembra ?? 'sin-fecha'} parcela={parcela} simulaciones={simulaciones} simulacion={simulacion} onSaved={reload} />
      <Registro observacion parcela={parcela} simulaciones={simulaciones} simulacion={simulacion} onSaved={reload} />
      <h3>Predicción frente a cosecha</h3>
      <p>Se incluyen cosechas con fuente declarada, superficie y base de humedad confirmadas. El sesgo positivo indica sobreestimación.</p>
      {!historial.metricas.length && <p>0 pares comparables. Aún no se puede medir el error ni la cobertura.</p>}
      {historial.metricas.map(m => <p key={m.version_modelo}><strong>{m.version_modelo} · {m.n} {m.n === 1 ? 'par' : 'pares'}</strong><br />
        MAE {fmt(m.mae)} t/ha · RMSE {fmt(m.rmse)} t/ha · Sesgo {fmt(m.sesgo)} t/ha<br />
        {m.rangos ? `Cobertura observada: ${m.dentro}/${m.rangos} cosechas dentro del rango guardado (${fmt(100 * m.dentro / m.rangos)} %).` : 'Sin intervalos guardados para medir la cobertura.'}</p>)}
      <Bandas cosechas={historial.cosechas} simulacion={simulacion} />
      <Seguimiento historial={historial} simulacion={simulacion} />
      {campanas.map(siembra => {
        const cosecha = historial.cosechas.find(c => c.fecha_siembra === siembra);
        return <details className="campanas-registro" key={siembra}><summary>Campaña sembrada el {siembra}{cosecha && ` · ${fmt(cosecha.observado_t_ha)} t/ha`}</summary>
          {cosecha && <p><strong>Cosecha del {cosecha.fecha_cosecha}</strong><br />{fmt(cosecha.produccion_seca_kg)} kg en {fmt(cosecha.area_cosechada_ha)} ha · Humedad {fmt(cosecha.humedad_grano_pct)} % · Fuente: {cosecha.fuente}<br />
            {cosecha.prediccion ? `Simulación #${cosecha.prediccion.id} del ${cosecha.prediccion.fecha} · ${cosecha.prediccion.version_modelo} · ${fmt(cosecha.prediccion.rendimiento_t_ha)} t/ha. ${cosecha.base_comparable ? 'Incluida en las métricas.' : 'Comparabilidad pendiente.'}` : 'Sin predicción emparejada.'}</p>}
          {historial.observaciones.filter(obs => obs.fecha_siembra === siembra).map(obs => <p key={obs.id}><strong>{obs.fecha}</strong>{obs.ndvi != null && ` · NDVI ${fmt(obs.ndvi)}`}{obs.nota && ` · ${obs.nota}`}<br />Fuente: {obs.fuente} · Registrada el {obs.registrado_en}
            {obs.adjunto_tipo && <> · <a href={dssService.adjuntoCampana(obs.id)} download>Descargar {obs.adjunto_tipo.startsWith('image/') ? 'foto' : 'audio'}</a></>}</p>)}
        </details>;
      })}
    </>}
  </DashboardPanel>;
}
