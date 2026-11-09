import { Sprout, BarChart2, ArrowRight, FlaskConical, Leaf } from 'lucide-react';

// Componente para cuando la base de datos está en blanco (ej. usuarios nuevos).
// Le pedí a la IA que me generara este diseño con íconos bonitos y colores degradados
// dependiendo del tipo de dashboard para que no se vea vacío o con errores feos.
// Recibe "tipo" ('yield', 'climate', etc.) y "onGoToSimulation" para mandar al usuario a simular.


const CONFIG = {
  yield: {
    icon: <BarChart2 size={52} color="#8b5cf6" />,
    titulo: 'Sin predicciones de rendimiento',
    subtitulo: 'Cuando ejecutes tu primera simulación, aquí verás el rendimiento estimado por cosecha, tendencias históricas y referencias disponibles para tu parcela.',
    pasos: [
      { num: '01', text: 'Registra tu parcela con datos de suelo y ubicación GPS' },
      { num: '02', text: 'Ejecuta una simulación con variables climáticas e insumos' },
      { num: '03', text: 'XGBoost generará la predicción de rendimiento' },
    ],
    accentColor: '#8b5cf6',
    bgGlow: 'rgba(34,197,94,0.06)',
  },
  climate: {
    icon: <Leaf size={52} color="#38bdf8" />,
    titulo: 'Sin análisis climático disponible',
    subtitulo: 'Para ver el análisis de riesgo estacional ENSO, temperatura del suelo y estrés hídrico, primero debes registrar una parcela con coordenadas GPS para obtener datos meteorológicos disponibles para esa ubicación.',
    pasos: [
      { num: '01', text: 'Registra una parcela con latitud y longitud exactas' },
      { num: '02', text: 'El sistema consultará Open-Meteo y SoilGrids automáticamente' },
      { num: '03', text: 'Consulta las condiciones y alertas disponibles para tu parcela' },
    ],
    accentColor: '#38bdf8',
    bgGlow: 'rgba(56,189,248,0.06)',
  },
  finance: {
    icon: <FlaskConical size={52} color="#a78bfa" />,
    titulo: 'Sin análisis financiero todavía',
    subtitulo: 'Cuando ejecutes simulaciones, aquí verás el ROI proyectado, punto de equilibrio, costos de producción y rentabilidad estimada con los precios y costos disponibles.',
    pasos: [
      { num: '01', text: 'Registra tus cultivos con área sembrada y tipo de suelo' },
      { num: '02', text: 'Ejecuta simulaciones con datos de fertilizante y clima' },
      { num: '03', text: 'El sistema calculará rentabilidad, ROI y punto de equilibrio' },
    ],
    accentColor: '#a78bfa',
    bgGlow: 'rgba(167,139,250,0.06)',
  },
  scenario: {
    icon: <BarChart2 size={52} color="#f59e0b" />,
    titulo: 'Sin escenarios comparativos',
    subtitulo: 'Este panel te permitirá consultar y comparar los escenarios disponibles para tu simulación.',
    pasos: [
      { num: '01', text: 'Ejecuta al menos una simulación para generar el escenario base' },
      { num: '02', text: 'El sistema mostrará los escenarios calculados y sus condiciones' },
      { num: '03', text: 'Compara escenarios y ajusta tus variables antes de sembrar' },
    ],
    accentColor: '#f59e0b',
    bgGlow: 'rgba(245,158,11,0.06)',
  },
  confidence: {
    icon: <Sprout size={52} color="#34d399" />,
    titulo: 'Sin métricas de confianza disponibles',
    subtitulo: 'Las métricas de precisión requieren comparar predicciones anteriores con cosechas observadas. Una simulación por sí sola no permite calcularlas.',
    pasos: [
      { num: '01', text: 'Registra parcelas y ejecuta simulaciones de cosecha' },
      { num: '02', text: 'Registra las cosechas observadas y su procedencia para evaluar las predicciones' },
      { num: '03', text: 'Consulta las métricas solo cuando exista una evaluación válida de las cosechas' },
    ],
    accentColor: '#34d399',
    bgGlow: 'rgba(52,211,153,0.06)',
  },
};

export default function EmptyDashboard({ tipo = 'yield', onGoToSimulation }) {
  const cfg = CONFIG[tipo] || CONFIG.yield;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '65vh',
      padding: '2rem 1rem',
      textAlign: 'center',
    }}>
      {/* Icono con halo */}
      <div style={{
        position: 'relative',
        marginBottom: '1.75rem',
      }}>
        <div style={{
          position: 'absolute',
          inset: '-20px',
          background: `radial-gradient(circle, ${cfg.bgGlow} 0%, transparent 70%)`,
          borderRadius: '50%',
          filter: 'blur(12px)',
        }} />
        <div style={{
          position: 'relative',
          width: '96px',
          height: '96px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `var(--surface-elevated)`,
          border: `1px solid ${cfg.accentColor}22`,
          borderRadius: '50%',
        }}>
          {cfg.icon}
        </div>
      </div>

      {/* Texto principal */}
      <h2 style={{
        fontSize: '1.35rem',
        fontWeight: 800,
        color: 'var(--text-primary)',
        marginBottom: '0.65rem',
        maxWidth: '480px',
        lineHeight: 1.25,
      }}>
        {cfg.titulo}
      </h2>
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '0.82rem',
        maxWidth: '480px',
        lineHeight: 1.65,
        marginBottom: '2rem',
      }}>
        {cfg.subtitulo}
      </p>

      {/* Pasos */}
      <div style={{
        display: 'flex',
        gap: '0.85rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: '2rem',
        maxWidth: '680px',
      }}>
        {cfg.pasos.map((paso, i) => (
          <div key={i} style={{
            flex: '1 1 180px',
            maxWidth: '200px',
            padding: '1rem',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            textAlign: 'left',
          }}>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 900,
              color: cfg.accentColor,
              opacity: 0.4,
              lineHeight: 1,
              marginBottom: '0.5rem',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {paso.num}
            </div>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              margin: 0,
            }}>
              {paso.text}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      {onGoToSimulation && (
        <button
          onClick={onGoToSimulation}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.7rem 1.5rem',
            background: `linear-gradient(135deg, ${cfg.accentColor}, ${cfg.accentColor}cc)`,
            border: 'none',
            borderRadius: '10px',
            color: '#0f172a',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'opacity 0.2s, transform 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
        >
          Ir a Nueva Simulación <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
