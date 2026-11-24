import { useCallback, useState, useEffect, useRef } from 'react';
import { simulacionService } from '../services/api';
import PantallaCarga from '../components/PantallaCarga';
import { Trash2, TrendingUp, Award, Activity, Database, Clock } from 'lucide-react';
import InteractiveKPI from '../templates/Common/InteractiveKPI';
import { historyYears } from '../utils/historyYears';
import { precipitationPeriod } from '../utils/simulationInput';

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && value.trim() === '')) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const decimalFormat = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatDecimal = (value) => {
  const number = toFiniteNumber(value);
  return number === null ? null : decimalFormat.format(number);
};
const formatCompact = (value) => {
  const number = toFiniteNumber(value);
  return number === null ? null : compactFormat.format(number);
};
const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : dateFormat.format(date);
};
const formatArea = (value) => {
  const area = formatCompact(value);
  return area === null ? 'Área no disponible' : `${area} ha`;
};

export default function History({ recargarDatos }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [añoSeleccionado, setAnioSeleccionado] = useState('');
  const [añosDisponibles, setAniosDisponibles] = useState(() => historyYears());
  const [pagina, setPagina] = useState(1);
  const [eliminando, setEliminando] = useState(null);
  const ultimaSolicitud = useRef(0);
  const invalidarSolicitud = useCallback(() => {
    ultimaSolicitud.current++;
  }, []);

  const loadHistory = useCallback(async () => {
    const solicitud = ++ultimaSolicitud.current;
    setLoading(true);
    setError(null);
    try {
      const res = await simulacionService.historial(añoSeleccionado, pagina);
      if (solicitud !== ultimaSolicitud.current) return;
      setData(res);
      if (Array.isArray(res.años_disponibles)) {
        setAniosDisponibles([...new Set([...res.años_disponibles, new Date().getFullYear()])].sort((a, b) => a - b));
      } else if (!añoSeleccionado) setAniosDisponibles(historyYears(res.simulaciones));
    } catch {
      if (solicitud !== ultimaSolicitud.current) return;
      setData(null);
      setError('Error al cargar el historial de simulaciones.');
    } finally {
      if (solicitud === ultimaSolicitud.current) setLoading(false);
    }
  }, [añoSeleccionado, pagina]);

  useEffect(() => {
    const refresh = setTimeout(loadHistory, 0);
    return () => {
      clearTimeout(refresh);
      invalidarSolicitud();
    };
  }, [loadHistory, recargarDatos, invalidarSolicitud]);

  const handleDelete = async (id) => {
    if (eliminando !== null) return;
    if (!window.confirm('¿Está seguro de eliminar esta simulación del historial?')) return;
    setError(null);
    setEliminando(id);
    try {
      await simulacionService.eliminar(id);
      // Si se cambió de página durante el borrado, recargar la selección vigente.
      await recargarHistorial.current();
    } catch {
      setError('Error al eliminar la simulación.');
    } finally {
      setEliminando(null);
    }
  };

  const recargarHistorial = useRef(loadHistory);
  useEffect(() => { recargarHistorial.current = loadHistory; }, [loadHistory]);

  if (loading && !data) return <div className="flex-center" style={{ height: '70vh' }}><PantallaCarga mensaje="Cargando historial..." pantalla /></div>;
  const { simulaciones, estadisticas } = data || { simulaciones: [], estadisticas: {} };
  const totalSimulaciones = toFiniteNumber(estadisticas.total_simulaciones);
  const rendimientoPromedio = toFiniteNumber(estadisticas.rendimiento_promedio);
  const rendimientoMaximo = toFiniteNumber(estadisticas.rendimiento_maximo);
  const produccionTotal = toFiniteNumber(estadisticas.produccion_total);

  return (
    <div className="history-page">
      <div className="dashboard-title-row" style={{ width: '100%', marginBottom: '1rem' }}>
        <div>
          <h1>Historial de simulaciones</h1>
          <p className="dashboard-title-desc" style={{ marginTop: '4px', fontSize: '0.84rem' }}>Revisa y compara tus simulaciones anteriores para monitorear la evolución agronómica de tus lotes.</p>
        </div>
        
        {/* Year Filter */}
        <div>
          <select 
            className="form-select" 
            aria-label="Filtrar simulaciones por año"
            value={añoSeleccionado} 
            onChange={(e) => { setAnioSeleccionado(e.target.value); setPagina(1); }}
            style={{ width: '165px', padding: '0.45rem 0.75rem', borderRadius: '10px' }}
          >
            <option value="">Todos los años</option>
            {añosDisponibles.map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-danger-alpha text-danger" style={{ padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
          {!data && <button type="button" className="btn btn-secondary" onClick={loadHistory} style={{ marginLeft: '1rem' }}>Reintentar carga</button>}
        </div>
      )}

      {/* Stats cards */}
      {data && (
        <div className="kpi-row history-kpi-row" style={{ width: '100%', marginBottom: '1rem' }}>
          <InteractiveKPI
            icon={<Database size={20} />}
            iconClass="text-secondary"
            title="Simulaciones"
            value={totalSimulaciones === null ? 'No disponible' : totalSimulaciones}
            isMissing={totalSimulaciones === null}
            trend={totalSimulaciones === null ? 'Sin dato' : 'Registradas'}
            progress={null}
            progressColor="linear-gradient(90deg, var(--zs-primary) 0%, var(--zs-secondary) 100%)"
            progressLabelLeft="Activas"
            delay={0}
          />
          <InteractiveKPI
            icon={<TrendingUp size={20} />}
            iconClass="text-success"
            title="Rendimiento medio"
            value={rendimientoPromedio === null ? 'No disponible' : <>{formatDecimal(rendimientoPromedio)} <span className="kpi-value-unit">t/ha</span></>}
            isMissing={rendimientoPromedio === null}
            trend={rendimientoPromedio === null ? 'Sin dato' : 'Promedio'}
            progress={null}
            progressColor="linear-gradient(90deg, var(--zs-success) 0%, var(--zs-secondary) 100%)"
            progressLabelLeft="General"
            delay={1}
          />
          <InteractiveKPI
            icon={<Award size={20} />}
            iconClass="text-success"
            title="Rendimiento máximo"
            value={rendimientoMaximo === null ? 'No disponible' : <>{formatDecimal(rendimientoMaximo)} <span className="kpi-value-unit">t/ha</span></>}
            isMissing={rendimientoMaximo === null}
            trend={rendimientoMaximo === null ? 'Sin dato' : 'Récord'}
            progress={null}
            progressColor="linear-gradient(90deg, var(--zs-warning) 0%, var(--zs-accent) 100%)"
            progressLabelLeft="Límite"
            delay={2}
          />
          <InteractiveKPI
            icon={<Activity size={20} />}
            iconClass="text-secondary"
            title="Producción acumulada"
            value={produccionTotal === null ? 'No disponible' : <>{formatCompact(produccionTotal)} <span className="kpi-value-unit">t</span></>}
            isMissing={produccionTotal === null}
            trend={produccionTotal === null ? 'Sin dato' : 'Acumulada'}
            progress={null}
            progressColor="linear-gradient(90deg, var(--zs-primary) 0%, var(--zs-secondary) 100%)"
            progressLabelLeft="Total de lotes"
            delay={3}
          />
        </div>
      )}

      {/* Listings table */}
      {simulaciones.length > 1 && <details className="field-evidence"><summary>Comparar rendimientos de esta página</summary>
        {simulaciones.filter(s => toFiniteNumber(s.rendimiento_estimado) !== null).map(s => <div key={s.id}>
          <strong>{s.nombre || 'Ejecución'} · {s.nombre_parcela} · {formatDate(s.fecha)}</strong>
          <div><meter aria-label="Rendimiento simulado en toneladas por hectárea" min={0} max={Math.max(12,...simulaciones.map(x=>toFiniteNumber(x.rendimiento_estimado) ?? 0))} value={s.rendimiento_estimado} /> {formatDecimal(s.rendimiento_estimado)} t/ha</div>
        </div>)}</details>}
      {data && <div className="glass-panel" style={{ width: '100%', boxSizing: 'border-box' }}>
        <div className="glass-card-header" style={{ padding: '0.85rem 1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Simulaciones registradas</h2>
        </div>
        <div className="glass-card-body" style={{ padding: 0, width: '100%', overflow: 'hidden' }}>
          {simulaciones.length === 0 ? (
            <div className="empty-state-container" style={{ padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <Clock size={40} className="empty-state-icon" />
              <h4 className="empty-state-title">No hay simulaciones en el historial</h4>
              <p className="empty-state-subtitle">Ejecuta una simulación en los modelos DSS para guardar el registro agronómico y compararlo en esta sección.</p>
            </div>
          ) : (
            <div className="table-responsive-container history-table-scroll" role="region" aria-label="Historial de simulaciones, tabla desplazable" tabIndex={0}>
              <table aria-label="Simulaciones guardadas" className="custom-table history-table">
                <thead>
                  <tr>
                    <th scope="col">Simulación / Lote</th>
                    <th scope="col" className="is-center">Modelo</th>
                    <th scope="col">Variables agronómicas</th>
                    <th scope="col">Rendimiento</th>
                    <th scope="col" className="is-center">Fecha</th>
                    <th scope="col" className="is-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {simulaciones.map(sim => (
                    <tr key={sim.id}>
                      <td>
                        <span className="history-sim-name">{sim.nombre || '-'}</span>
                        <span className="history-sim-sub">Lote: <strong>{sim.nombre_parcela || 'Sin parcela indicada'}</strong> ({formatArea(sim.area_simulada)})</span>
                      </td>
                      <td className="is-center">
                        <span className="history-model-badge">{sim.modelo_usado || 'dss'}</span>
                      </td>
                      <td>
                        <div className="history-tags">
                          <span>{formatCompact(sim.temperatura) ?? '-'}°C • {formatCompact(sim.humedad) ?? '-'}% Hum</span>
                          <span>Lluvia: {formatCompact(sim.precipitacion) ?? '-'} {precipitationPeriod(sim)}</span>
                          <span>{formatCompact(sim.fertilizante) ?? '-'} kg/ha Fert</span>
                          <span>Suelo {sim.tipo_suelo || '-'} (pH {formatCompact(sim.ph_suelo) ?? '-'})</span>
                        </div>
                      </td>
                      <td>
                        <div className="history-yield">{formatDecimal(sim.rendimiento_estimado) === null ? 'Rendimiento no disponible' : `${formatDecimal(sim.rendimiento_estimado)} t/ha`}</div>
                        <div className="history-sim-sub">Total: {formatCompact(sim.produccion_total) === null ? 'No disponible' : `${formatCompact(sim.produccion_total)} t`}</div>
                      </td>
                      <td className="is-center history-date">{formatDate(sim.fecha)}</td>
                      <td className="is-center">
                        <button
                          className="btn btn-secondary text-danger history-delete"
                          onClick={() => handleDelete(sim.id)}
                          title="Eliminar simulación"
                          disabled={eliminando !== null}
                          aria-label={`Eliminar ${sim.nombre || 'simulación'}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {data?.paginacion && <nav aria-label="Paginación del historial" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem', flexWrap: 'wrap' }}>
          <span role="status">Página {data.paginacion.pagina} de {data.paginacion.paginas} · {data.paginacion.total} simulaciones</span>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button type="button" className="btn btn-secondary" disabled={loading || data.paginacion.pagina <= 1} onClick={() => setPagina(data.paginacion.pagina - 1)}>Anterior</button>
            <button type="button" className="btn btn-secondary" disabled={loading || data.paginacion.pagina >= data.paginacion.paginas} onClick={() => setPagina(data.paginacion.pagina + 1)}>Siguiente</button>
          </div>
        </nav>}
      </div>}
    </div>
  );
}
