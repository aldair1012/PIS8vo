import { useCallback, useState, useEffect, useRef } from 'react';
import { simulacionService } from '../services/api';
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

  if (loading && !data) return <div role="status" className="flex-center" style={{ height: '70vh' }}>Cargando historial...</div>;
  const { simulaciones, estadisticas } = data || { simulaciones: [], estadisticas: {} };
  const totalSimulaciones = toFiniteNumber(estadisticas.total_simulaciones);
  const rendimientoPromedio = toFiniteNumber(estadisticas.rendimiento_promedio);
  const rendimientoMaximo = toFiniteNumber(estadisticas.rendimiento_maximo);
  const produccionTotal = toFiniteNumber(estadisticas.produccion_total);

  return (
    <div style={{ width: '100%', paddingBottom: '2rem' }}>
      <div className="dashboard-title-row" style={{ width: '100%', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Historial de simulaciones</h1>
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
            progressColor="linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)"
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
            progressColor="linear-gradient(90deg, #16a34a 0%, #34d399 100%)"
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
            progressColor="linear-gradient(90deg, #863bff 0%, #a855f7 100%)"
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
            progressColor="linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)"
            progressLabelLeft="Total de lotes"
            delay={3}
          />
        </div>
      )}

      {/* Listings table */}
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
            <div className="table-responsive-container" style={{ width: '100%', overflowX: 'auto', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
              <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-elevated)' }}>
                  <tr style={{ background: 'var(--surface-elevated)', borderBottom: '1.5px solid var(--border-subtle)' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Simulación / Lote</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Modelo</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Variables agronómicas</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rendimiento</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {simulaciones.map(sim => (
                    <tr key={sim.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{sim.nombre || '-'}</span>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                          Lote: <strong style={{ color: 'var(--text-muted)' }}>{sim.nombre_parcela || 'Sin parcela indicada'}</strong> ({formatArea(sim.area_simulada)})
                        </div>
                      </td>
                      <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--zs-info)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.04em', textTransform: 'uppercase', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'inline-block' }}>
                          {sim.modelo_usado || 'dss'}
                        </span>
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.5rem', alignItems: 'center' }}>
                          <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.74rem' }}>
                            {formatCompact(sim.temperatura) ?? '-'}°C • {formatCompact(sim.humedad) ?? '-'}% Hum
                          </span>
                          <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.74rem' }}>
                            Lluvia: {formatCompact(sim.precipitacion) ?? '-'} {precipitationPeriod(sim)}
                          </span>
                          <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.74rem' }}>
                            {formatCompact(sim.fertilizante) ?? '-'} kg/ha Fert
                          </span>
                          <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-subtle)', fontSize: '0.74rem' }}>
                            Suelo {sim.tipo_suelo || '-'} (pH {formatCompact(sim.ph_suelo) ?? '-'})
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--zs-success)', fontSize: '0.92rem' }}>{formatDecimal(sim.rendimiento_estimado) === null ? 'Rendimiento no disponible' : `${formatDecimal(sim.rendimiento_estimado)} t/ha`}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Total: {formatCompact(sim.produccion_total) === null ? 'No disponible' : `${formatCompact(sim.produccion_total)} t`}</div>
                      </td>
                      <td style={{ padding: '0.7rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
                        {formatDate(sim.fecha)}
                      </td>
                      <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary text-danger" 
                          onClick={() => handleDelete(sim.id)} 
                          style={{ padding: '0.35rem', borderRadius: '8px', cursor: 'pointer' }}
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
