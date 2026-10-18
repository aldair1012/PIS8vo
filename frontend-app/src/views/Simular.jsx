import { useState, useEffect } from 'react';
import { simulacionService, cultivosService } from '../services/api';
import { Cpu, FileText, CheckCircle, AlertTriangle, TrendingUp, Zap, Award, CloudRain, Sun, Thermometer } from 'lucide-react';

// Funciones auxiliares para validar inputs numéricos
const limpiarTextoNumerico = (valor, permiteNegativo = false) => {
  if (!valor || typeof valor !== 'string') return valor;
  let limpio = valor.replace(/[/*+eE]/g, '');
  if (permiteNegativo) {
    return limpio.replace(/[^0-9.,-]/g, '');
  }
  return limpio.replace(/[-]/g, '').replace(/[^0-9.,]/g, '');
};

const evitarOperadores = (e, permiteNegativo = false) => {
  const teclas = ['/', '*', '+', 'e', 'E'];
  if (!permiteNegativo) {
    teclas.push('-');
  }
  if (teclas.includes(e.key)) {
    e.preventDefault();
  }
};

export default function Simular({ cultivos, onSimulationCompleted, onboardingStep, onNextOnboardingStep }) {
  const [cultivoId, setCultivoId] = useState('');
  const [modelo, setModelo] = useState('xgboost');
  const [temp, setTemp] = useState('');
  const [hum, setHum] = useState('');
  const [prec, setPrec] = useState('');
  const [fert, setFert] = useState('');
  const [ph, setPh] = useState('');
  const [suelo, setSuelo] = useState('franco');
  const [area, setArea] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Sincronizar variables con el cultivo seleccionado usando APIs de ubicación (Open-Meteo y SoilGrids)
  useEffect(() => {
    if (cultivoId) {
      const fetchLocationMetrics = async (id) => {
        setFetchingLocation(true);
        setError(null);
        try {
          const res = await cultivosService.obtenerValoresUbicacion(id);
          if (res.success) {
            if (res.temperatura !== undefined && res.temperatura !== null) setTemp(res.temperatura.toString());
            if (res.humedad !== undefined && res.humedad !== null) setHum(res.humedad.toString());
            if (res.precipitacion !== undefined && res.precipitacion !== null) setPrec(res.precipitacion.toString());
            if (res.ph_suelo !== undefined && res.ph_suelo !== null) setPh(res.ph_suelo.toString());
            if (res.tipo_suelo) setSuelo(res.tipo_suelo);
            if (res.area_simulada !== undefined && res.area_simulada !== null) setArea(res.area_simulada.toString());
          }
        } catch (err) {
          console.error('Error fetching location metrics:', err);
          // Fallback a propiedades simples de la base de datos
          const selected = cultivos.find(c => c.id === Number(id));
          if (selected) {
            if (selected.ph) setPh(selected.ph.toString());
            if (selected.area) setArea(selected.area.toString());
          }
        } finally {
          setFetchingLocation(false);
        }
      };
      fetchLocationMetrics(cultivoId);
    }
  }, [cultivoId, cultivos]);

  const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const clean = String(val).replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const handleSimulate = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const areaVal = parseNum(area);
    const tempVal = parseNum(temp);
    const humVal = parseNum(hum);
    const precVal = parseNum(prec);
    const fertVal = parseNum(fert);
    const phVal = parseNum(ph);

    // Validación 1: El área debe ser mayor a 0 ha
    if (areaVal <= 0) {
      setError('El área a simular debe ser mayor a 0 ha.');
      return;
    }

    // Validación 2: El área no puede superar el área total de la parcela seleccionada
    const selectedCrop = cultivos.find(c => c.id === Number(cultivoId));
    if (selectedCrop && selectedCrop.area) {
      const maxArea = parseNum(selectedCrop.area);
      if (maxArea > 0 && areaVal > maxArea) {
        setError(`El área a simular (${areaVal} ha) no puede superar el tamaño total de la parcela seleccionada (${maxArea} ha).`);
        return;
      }
    }

    setLoading(true);

    const payload = {
      cultivo_id: Number(cultivoId),
      modelo_usado: modelo,
      temperatura: tempVal,
      humedad: humVal,
      precipitacion: precVal,
      fertilizante: fertVal,
      ph_suelo: phVal,
      tipo_suelo: suelo,
      area_simulada: areaVal
    };

    try {
      const res = await simulacionService.simular(payload);
      setResult(res.resultado);
      onSimulationCompleted();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar la simulación.');
    } finally {
      setLoading(false);
    }
  };

  const parseRecommendation = (rec) => {
    let rawStr = typeof rec === 'string' ? rec : (rec?.texto || String(rec || ''));

    // Limpiar citas internas como 【12†L43-L51】
    let cleanText = rawStr
      .replace(/【[^】]*】/g, '')
      .replace(/^[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    let type = 'info';
    let iconColor = '#3b82f6';
    const lower = cleanText.toLowerCase();

    if (lower.includes('óptim') || lower.includes('adecuad') || lower.includes('alinead') || rawStr.includes('✅')) {
      type = 'success';
      iconColor = '#10b981';
    } else if (lower.includes('excesiv') || lower.includes('baja') || lower.includes('bajo') || lower.includes('alcalin') || lower.includes('ácid') || lower.includes('vigilar') || rawStr.includes('⚠️')) {
      type = 'warning';
      iconColor = '#f59e0b';
    } else if (lower.includes('crític') || lower.includes('sever') || lower.includes('alto') || lower.includes('riesgo') || rawStr.includes('🔴') || rawStr.includes('❌')) {
      type = 'danger';
      iconColor = '#ef4444';
    }

    let tag = 'Recomendación Agronómica';
    let accion = cleanText;
    let justificacion = null;
    let fuente = null;

    // Detectar "Consejo de precisión local (X):"
    const consejoMatch = cleanText.match(/^(Consejo de precisión local\s*\((.*?)\)|Recomendación\s*\((.*?)\)):\s*(.*)/i);
    if (consejoMatch) {
      const zonaStr = consejoMatch[2] || consejoMatch[3] || 'Local';
      tag = `Consejo de Precisión Local • ${zonaStr}`;
      accion = consejoMatch[4];
    } else if (cleanText.toLowerCase().includes('ph')) {
      tag = 'Manejo de Suelo & pH';
    } else if (cleanText.toLowerCase().includes('fertiliz') || cleanText.toLowerCase().includes('nitrógeno') || cleanText.toLowerCase().includes('dosis')) {
      tag = 'Nutrición & Fertilización';
    } else if (cleanText.toLowerCase().includes('temperatura') || cleanText.toLowerCase().includes('precipitaci') || cleanText.toLowerCase().includes('humedad') || cleanText.toLowerCase().includes('riego')) {
      tag = 'Clima & Riego';
    }

    // Separar | Justificación:
    if (accion.includes('| Justificación:')) {
      const parts = accion.split('| Justificación:');
      accion = parts[0].trim();
      let justText = parts[1].trim();

      const fuenteMatch = justText.match(/(.*?)\s*\(([^()]+)\)$/);
      if (fuenteMatch && (fuenteMatch[2].toLowerCase().includes('iniap') || fuenteMatch[2].toLowerCase().includes('magap') || fuenteMatch[2].toLowerCase().includes('revista') || fuenteMatch[2].match(/\d{4}/))) {
        justificacion = fuenteMatch[1].trim();
        fuente = fuenteMatch[2].trim();
      } else {
        justificacion = justText;
      }
    }

    return { type, tag, accion, justificacion, fuente, iconColor };
  };

  return (
    <div className="simular-container fade-in">
      <div className="simular-header">
        <div>
          <h2 className="simular-title">Nueva Simulación de Lote</h2>
          <p className="simular-subtitle">Prueba distintas configuraciones para tu siembra y mira qué resultados predice el motor de simulación.</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Banner Destacado de Onboarding Paso 2 */}
      {onboardingStep === 2 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '12px',
          padding: '0.95rem 1.15rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          boxShadow: '0 4px 16px rgba(59, 130, 246, 0.12)'
        }}>
          <div style={{
            background: '#3b82f6',
            color: '#fff',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem',
            flexShrink: 0
          }}>
            2
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.2rem 0', color: 'var(--text-primary)' }}>
              Paso 2 de 3: Ejecuta tu Primera Simulación Agronómica
            </h4>
            <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text-muted)', lineHeight: '1.45' }}>
              Selecciona tu parcela registrada, revisa las métricas de clima y suelo y presiona "Ejecutar Simulación" para predecir tu rendimiento de cosecha.
            </p>
          </div>
        </div>
      )}

      <div className="simulacion-layout" style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: '2rem' }}>
        {/* Left Column: Form & Validation HUD */}
        <div className="simulacion-form-column">
          <div className="glass-panel">
            <div className="glass-card-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Parámetros de Entrada</h3>
            </div>
            <div className="glass-card-body">
              <form noValidate onSubmit={handleSimulate}>
                <div className="form-group">
                  <label className="form-label">Parcela de Referencia *</label>
                  <select className="form-select" value={cultivoId} onChange={e => setCultivoId(e.target.value)} required>
                    <option value="">Seleccione una parcela...</option>
                    {cultivos.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre_parcela} ({c.area} ha)</option>
                    ))}
                  </select>
                  {fetchingLocation && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="spinner-border spinner-border-sm text-success" style={{ width: '12px', height: '12px' }}></span>
                      <span>Consultando clima (Open-Meteo) y suelo (SoilGrids) en tiempo real para esta ubicación...</span>
                    </div>
                  )}
                </div>

                <div className="simulacion-grid-2">
                  <div className="form-group">
                    <label className="form-label">Motor de Simulación *</label>
                    <select className="form-select" value={modelo} onChange={e => setModelo(e.target.value)}>
                      <option value="xgboost">XGBoost</option>
                      <option value="random_forest">Random Forest</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Área a Simular (ha) *</label>
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      className="form-input" 
                      value={area} 
                      onChange={e => setArea(limpiarTextoNumerico(e.target.value))} 
                      onKeyDown={evitarOperadores}
                      required 
                    />
                  </div>
                </div>

                <div className="simulacion-grid-2">
                  <div className="form-group">
                    <label className="form-label">Temperatura Media (°C) *</label>
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      className="form-input" 
                      value={temp} 
                      onChange={e => setTemp(limpiarTextoNumerico(e.target.value, true))} 
                      onKeyDown={e => evitarOperadores(e, true)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Humedad Relativa (%) *</label>
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      className="form-input" 
                      value={hum} 
                      onChange={e => setHum(limpiarTextoNumerico(e.target.value))} 
                      onKeyDown={evitarOperadores}
                      required 
                    />
                  </div>
                </div>

                <div className="simulacion-grid-2">
                  <div className="form-group">
                    <label className="form-label">Precipitación (mm/año) *</label>
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      className="form-input" 
                      value={prec} 
                      onChange={e => setPrec(limpiarTextoNumerico(e.target.value))} 
                      onKeyDown={evitarOperadores}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nitrógeno / Fertilizante (kg/ha) *</label>
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      className="form-input" 
                      value={fert} 
                      onChange={e => setFert(limpiarTextoNumerico(e.target.value))} 
                      onKeyDown={evitarOperadores}
                      required 
                    />
                  </div>
                </div>

                <div className="simulacion-grid-2">
                  <div className="form-group">
                    <label className="form-label">pH del Suelo *</label>
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      className="form-input" 
                      value={ph} 
                      onChange={e => setPh(limpiarTextoNumerico(e.target.value))} 
                      onKeyDown={evitarOperadores}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Textura del Suelo *</label>
                    <select className="form-select" value={suelo} onChange={e => setSuelo(e.target.value)}>
                      <option value="franco">Franco Limoso</option>
                      <option value="arcilloso">Franco Arcilloso</option>
                      <option value="arenoso">Franco Arenoso</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '0.85rem' }} disabled={loading}>
                  {loading ? 'Procesando simulación biofísica...' : 'Ejecutar Simulación'}
                </button>
              </form>
            </div>
          </div>

          {/* Validation HUD under the Form to fill bottom-left empty space */}
          {result && (
            <div className="glass-panel" style={{ marginTop: '2rem', animation: 'fadeIn 0.5s ease' }}>
              <div className="glass-card-header">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Cpu size={18} className="text-secondary" />
                  <span>Validación de Parámetros de Entrada</span>
                </h3>
              </div>
              <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                  Análisis automático de tus datos de simulación frente a los óptimos de cultivo para maíz:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.5rem' }}>
                  {/* Temperature */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Temperatura</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Simulado: {temp}°C (Óptimo: 21–27°C)</div>
                    </div>
                    {Number(temp) >= 21 && Number(temp) <= 27 ? (
                      <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>Óptimo</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.2)' }}>Riesgo Térmico</span>
                    )}
                  </div>

                  {/* Precipitation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Precipitación</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Simulado: {prec} mm (Óptimo: 600–800 mm)</div>
                    </div>
                    {Number(prec) >= 600 && Number(prec) <= 800 ? (
                      <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>Óptimo</span>
                    ) : Number(prec) < 600 ? (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>Déficit</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.2)' }}>Exceso</span>
                    )}
                  </div>

                  {/* Soil pH */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>pH del Suelo</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Simulado: {ph} (Óptimo: 6.0–6.5)</div>
                    </div>
                    {Number(ph) >= 6.0 && Number(ph) <= 6.5 ? (
                      <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>Óptimo</span>
                    ) : Number(ph) < 6.0 ? (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>Ácido</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.2)' }}>Alcalino</span>
                    )}
                  </div>

                  {/* Nitrogen */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Nitrógeno (Fertilizante)</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Simulado: {fert} kg/ha (Óptimo: 180–200 kg/ha)</div>
                    </div>
                    {Number(fert) >= 180 && Number(fert) <= 200 ? (
                      <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>Óptimo</span>
                    ) : Number(fert) < 180 ? (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>Bajo</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.2)' }}>Excesivo</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Result Display */}
        {result && (
          <div className="glass-panel simulacion-result-panel" style={{ animation: 'fadeIn 0.5s ease', height: 'fit-content' }}>
            <div className="glass-card-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle className="text-success" size={20} />
                <span>Resultados de Inferencia</span>
              </h3>
            </div>
            <div className="glass-card-body">
              {/* Core metrics */}
              <div className="simulacion-metric-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '2rem' }}>
                <div style={{ 
                  padding: '1.25rem', 
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.02) 100%)', 
                  border: '1px solid rgba(34, 197, 94, 0.2)', 
                  borderRadius: '14px', 
                  textAlign: 'center',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.03)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem', color: '#22c55e', opacity: 0.8 }}>
                    <TrendingUp size={18} />
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rendimiento Estimado</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#22c55e', margin: '0.35rem 0', fontFamily: 'var(--font-sans)', letterSpacing: '-0.5px' }}>
                    {result.rendimiento_estimado.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 500 }}>toneladas / hectárea</div>
                </div>

                <div style={{ 
                  padding: '1.25rem', 
                  background: 'linear-gradient(135deg, rgba(134, 59, 255, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%)', 
                  border: '1px solid rgba(134, 59, 255, 0.2)', 
                  borderRadius: '14px', 
                  textAlign: 'center',
                  boxShadow: '0 4px 15px rgba(134, 59, 255, 0.03)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem', color: '#a78bfa', opacity: 0.8 }}>
                    <Zap size={18} />
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Producción Total</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a78bfa', margin: '0.35rem 0', fontFamily: 'var(--font-sans)', letterSpacing: '-0.5px' }}>
                    {result.produccion_total.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 500 }}>toneladas en {result.area} ha</div>
                </div>
              </div>

              {/* Confidence and Harvest Category */}
              <div className="simulacion-summary-grid" style={{ 
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                padding: '1.25rem', 
                background: 'rgba(255, 255, 255, 0.015)', 
                borderRadius: '12px', 
                marginBottom: '2rem', 
                border: '1px solid var(--border-subtle)',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>Categoría de Cosecha:</span>
                  <div style={{ fontWeight: 700, fontSize: '1.15rem', marginTop: '0.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Award size={18} className="text-secondary" />
                    <span>{result.categoria_cosecha}</span>
                  </div>
                </div>
                <div style={{ paddingLeft: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>Fiabilidad del Algoritmo:</span>
                  <div style={{ fontWeight: 700, fontSize: '1.15rem', marginTop: '0.25rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle size={18} />
                    <span>{result.confianza}%</span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Recomendaciones de Precisión Agronómica
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.65rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                    {result.recomendaciones.length} sugerencias
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {result.recomendaciones.map((rec, i) => {
                    const { type, tag, accion, justificacion, fuente, iconColor } = parseRecommendation(rec);
                    
                    const badgeBg = type === 'success' ? 'rgba(34, 197, 94, 0.12)' : type === 'warning' ? 'rgba(234, 179, 8, 0.12)' : type === 'danger' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)';
                    const badgeBorder = type === 'success' ? 'rgba(34, 197, 94, 0.25)' : type === 'warning' ? 'rgba(234, 179, 8, 0.25)' : type === 'danger' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)';

                    return (
                      <div key={i} style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-subtle)',
                        padding: '1rem 1.15rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        transition: 'all 0.2s ease'
                      }}>
                        {/* Header Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}>
                          <div style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            color: iconColor,
                            background: badgeBg,
                            border: `1px solid ${badgeBorder}`,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}>
                            <span>{tag}</span>
                          </div>
                        </div>

                        {/* Action Item */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div style={{ 
                            color: iconColor, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0,
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: badgeBg,
                            border: `1px solid ${badgeBorder}`,
                            marginTop: '2px'
                          }}>
                            {type === 'success' && <CheckCircle size={14} />}
                            {type === 'warning' && <AlertTriangle size={14} />}
                            {type === 'danger' && <AlertTriangle size={14} style={{ transform: 'rotate(180deg)' }} />}
                            {type === 'info' && <CheckCircle size={14} />}
                          </div>

                          <div style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.45', fontWeight: 600 }}>
                            {accion}
                          </div>
                        </div>

                        {/* Technical Justification Section */}
                        {justificacion && (
                          <div style={{ 
                            marginTop: '0.75rem',
                            padding: '0.75rem 0.9rem', 
                            background: 'rgba(0, 0, 0, 0.25)', 
                            borderRadius: '8px', 
                            borderLeft: `3px solid ${iconColor}`,
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            lineHeight: '1.5'
                          }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>Justificación Técnica</span>
                            </div>
                            <p style={{ margin: 0 }}>{justificacion}</p>

                            {fuente && (
                              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                                <FileText size={12} color={iconColor} />
                                <span><strong>Fuente:</strong> {fuente}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Alternative Scenarios */}
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>Escenarios Climáticos Alternativos</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div className="alternative-scenario-card" style={{ 
                    background: 'linear-gradient(185deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                    padding: '0.85rem', 
                    borderRadius: '12px', 
                    textAlign: 'center',
                    boxShadow: '0 4px 10px rgba(239, 68, 68, 0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', color: '#ef4444', marginBottom: '0.35rem' }}>
                      <Sun size={16} />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Sequía</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>{result.escenarios.sequia.rendimiento} t/ha</div>
                  </div>
                  <div className="alternative-scenario-card" style={{ 
                    background: 'linear-gradient(185deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%)', 
                    border: '1px solid rgba(59, 130, 246, 0.2)', 
                    padding: '0.85rem', 
                    borderRadius: '12px', 
                    textAlign: 'center',
                    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', color: '#3b82f6', marginBottom: '0.35rem' }}>
                      <Thermometer size={16} />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Estándar</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>{result.escenarios.verano.rendimiento} t/ha</div>
                  </div>
                  <div className="alternative-scenario-card" style={{ 
                    background: 'linear-gradient(185deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.02) 100%)', 
                    border: '1px solid rgba(34, 197, 94, 0.2)', 
                    padding: '0.85rem', 
                    borderRadius: '12px', 
                    textAlign: 'center',
                    boxShadow: '0 4px 10px rgba(34, 197, 94, 0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', color: '#16a34a', marginBottom: '0.35rem' }}>
                      <CloudRain size={16} />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Lluvioso</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>{result.escenarios.lluvioso.rendimiento} t/ha</div>
                  </div>
                </div>
              </div>

              {/* Banner de Redirección Final a DSS 1 en Onboarding */}
              {onboardingStep === 2 && (
                <div style={{
                  marginTop: '1.5rem',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.18) 0%, rgba(59, 130, 246, 0.15) 100%)',
                  border: '1.5px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: '0 4px 16px rgba(34, 197, 94, 0.15)'
                }}>
                  <div>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      ¡Simulación Completada! Ir al Análisis DSS 1
                    </h4>
                    <p style={{ fontSize: '0.78rem', margin: 0, color: 'var(--text-muted)', lineHeight: '1.45' }}>
                      Has registrado tu parcela y creado tu simulación. Presiona el botón para ir a tu panel principal de Rendimiento y Brechas Productivas.
                    </p>
                  </div>
                  <button
                    onClick={() => onNextOnboardingStep && onNextOnboardingStep()}
                    className="btn btn-primary"
                    style={{
                      padding: '0.65rem 1.15rem',
                      fontSize: '0.82rem',
                      borderRadius: '10px',
                      fontWeight: 700,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>Ir a DSS 1</span>
                    <TrendingUp size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
