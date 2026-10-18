import { useCallback, useState, useEffect } from 'react';
import { simulacionService } from '../services/api';
import { Trash2, TrendingUp, Award, Activity, Database, Clock } from 'lucide-react';
import InteractiveKPI from '../templates/Common/InteractiveKPI';

export default function History({ recargarDatos }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [anioSeleccionado, setAnioSeleccionado] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await simulacionService.historial(anioSeleccionado);
      setData(res);
    } catch {
      setError('Error al cargar el historial de simulaciones.');
    } finally {
      setLoading(false);
    }
  }, [anioSeleccionado]);

  useEffect(() => {
    const refresh = setTimeout(loadHistory, 0);
    return () => clearTimeout(refresh);
  }, [loadHistory, recargarDatos]);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta simulación del historial?')) return;
    setError(null);
    try {
      await simulacionService.eliminar(id);
      loadHistory();
    } catch {
      setError('Error al eliminar la simulación.');
    }
  };

  if (loading && !data) return <div className="flex-center" style={{ height: '70vh' }}>Cargando historial...</div>;  const { simulaciones, estadisticas } = data || { simulaciones: [], estadisticas: {} };

  return (
    <div style={{ width: '100%', paddingBottom: '2rem' }}>
      <div className="dashboard-title-row" style={{ width: '100%', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Historial de Simulaciones</h1>
          <p className="dashboard-title-desc" style={{ marginTop: '4px', fontSize: '0.84rem' }}>Revisa y compara tus simulaciones anteriores para monitorear la evolución agronómica de tus lotes.</p>
        </div>
        
        {/* Year Filter */}
        <div>
          <select 
            className="form-select" 
            value={anioSeleccionado} 
            onChange={(e) => setAnioSeleccionado(e.target.value)}
            style={{ width: '165px', padding: '0.45rem 0.75rem', borderRadius: '10px' }}
          >
            <option value="">Todos los años</option>
            {(() => {
              const currentYear = new Date().getFullYear();
              const yearSet = new Set([currentYear]);
              if (data?.simulaciones) {
                data.simulaciones.forEach(s => {
                  if (s.fecha_creacion) {
                    const y = new Date(s.fecha_creacion).getFullYear();
                    if (!isNaN(y)) yearSet.add(y);
                  }
                });
              }
              return Array.from(yearSet).sort((a, b) => a - b).map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ));
            })()}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-danger-alpha text-danger" style={{ padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* Stats cards */}
      {data && (
        <div className="kpi-row" style={{ width: '100%', marginBottom: '1rem' }}>
          <InteractiveKPI
            icon={<Database size={20} />}
            iconClass="text-secondary"
            title="Total Simulaciones"
            value={estadisticas.total_simulaciones}
            trend="Registradas"
            progress={Math.min(100, (estadisticas.total_simulaciones || 1) * 10)}
            progressColor="linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)"
            progressLabelLeft="Activas"
            delay={0}
          />
          <InteractiveKPI
            icon={<TrendingUp size={20} />}
            iconClass="text-success"
            title="Rendimiento Medio"
            value={<>{Number(estadisticas.rendimiento_promedio || 0).toFixed(2)} <span className="kpi-value-unit">t/ha</span></>}
            trend="Promedio"
            progress={Math.min(100, ((Number(estadisticas.rendimiento_promedio || 0) / 10) * 100))}
            progressColor="linear-gradient(90deg, #16a34a 0%, #34d399 100%)"
            progressLabelLeft="General"
            sparklineData={[
              Number(estadisticas.rendimiento_promedio || 0) * 0.85,
              Number(estadisticas.rendimiento_promedio || 0) * 0.95,
              Number(estadisticas.rendimiento_promedio || 0)
            ]}
            delay={1}
          />
          <InteractiveKPI
            icon={<Award size={20} />}
            iconClass="text-success"
            title="Rendimiento Máximo"
            value={<>{Number(estadisticas.rendimiento_maximo || 0).toFixed(2)} <span className="kpi-value-unit">t/ha</span></>}
            trend="Récord"
            progress={100}
            progressColor="linear-gradient(90deg, #863bff 0%, #a855f7 100%)"
            progressLabelLeft="Límite"
            sparklineData={[
              Number(estadisticas.rendimiento_maximo || 0) * 0.9,
              Number(estadisticas.rendimiento_maximo || 0) * 0.95,
              Number(estadisticas.rendimiento_maximo || 0)
            ]}
            delay={2}
          />
          <InteractiveKPI
            icon={<Activity size={20} />}
            iconClass="text-secondary"
            title="Producción Acumulada"
            value={<>{Number(estadisticas.produccion_total || 0).toLocaleString()} <span className="kpi-value-unit">t</span></>}
            trend="Acumulada"
            progress={80}
            progressColor="linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)"
            progressLabelLeft="Total Lotes"
            delay={3}
          />
        </div>
      )}

      {/* Listings table */}
      <div className="glass-panel" style={{ width: '100%', boxSizing: 'border-box' }}>
        <div className="glass-card-header" style={{ padding: '0.85rem 1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Simulaciones Registradas</h3>
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
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Variables Agronómicas</th>
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
                          Lote: <strong style={{ color: 'var(--text-muted)' }}>{sim.nombre_parcela || 'General'}</strong> ({sim.area_simulada ?? 0} ha)
                        </div>
                      </td>
                      <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.04em', textTransform: 'uppercase', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'inline-block' }}>
                          {sim.modelo_usado || 'dss'}
                        </span>
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.5rem', alignItems: 'center' }}>
                          <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.74rem' }}>
                            {sim.temperatura ?? '-'}°C • {sim.humedad ?? '-'}% Hum
                          </span>
                          <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.74rem' }}>
                            {sim.precipitacion ?? '-'} mm Lluvia
                          </span>
                          <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.74rem' }}>
                            {sim.fertilizante ?? '-'} kg/ha Fert
                          </span>
                          <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.45rem', borderRadius: '6px', color: 'var(--text-subtle)', fontSize: '0.74rem' }}>
                            Suelo {sim.tipo_suelo || '-'} (pH {sim.ph_suelo ?? '-'})
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ fontWeight: 800, color: '#34d399', fontSize: '0.92rem' }}>{Number(sim.rendimiento_estimado || 0).toFixed(2)} t/ha</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Total: {Number(sim.produccion_total || 0).toLocaleString()} t</div>
                      </td>
                      <td style={{ padding: '0.7rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
                        {sim.fecha ? new Date(sim.fecha).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary text-danger" 
                          onClick={() => handleDelete(sim.id)} 
                          style={{ padding: '0.35rem', borderRadius: '8px', cursor: 'pointer' }}
                          title="Eliminar simulación"
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
      </div>
    </div>
  );
}
