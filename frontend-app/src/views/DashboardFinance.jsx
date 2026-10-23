import { useCallback, useRef, useState, useEffect } from 'react';
import { dssService } from '../services/api';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import FinancialROI from '../templates/Charts/FinancialROI';
import InteractiveKPI from '../templates/Common/InteractiveKPI';
import AIExplainModal from '../templates/Common/AIExplainModal';
import EmptyDashboard from '../templates/Common/EmptyDashboard';
import DashboardIntro, { DashboardSectionHeading } from '../templates/Common/DashboardIntro';
import useExplicacionIA from '../hooks/usarExplicacionIA';

ChartJS.register(...registerables);
import { 
  DollarSign, 
  Percent, 
  Scale, 
  Sparkles,
  Info
} from 'lucide-react';

const parseVal = (val, fallback) => {
  if (val === '' || val === null || val === undefined || isNaN(val)) return fallback;
  const num = Number(val);
  return num < 0 ? 0 : num;
};

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatCurrency = (value) => value === null
  ? 'No disponible'
  : `$${value.toLocaleString('es-EC', { maximumFractionDigits: 2 })}`;

export default function DashboardFinance({ cultivoElegidoId, anioSeleccionado, onNavigate, onDashboardData }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    pedirExplicacionIa
  } = useExplicacionIA(cultivoElegidoId, anioSeleccionado);

  const [precioMaizQq, setPrecioMaizQq] = useState('');
  const [rendimientoQq, setRendimientoQq] = useState('');
  const [costoSemilla, setCostoSemilla] = useState('');
  const [costoFert, setCostoFert] = useState('');
  const [costoRiego, setCostoRiego] = useState('');
  const [costoProteccion, setCostoProteccion] = useState('');
  const [otrosVar, setOtrosVar] = useState('');
  const [costosFijos, setCostosFijos] = useState('');

  const handleInput = (setter) => (e) => {
    setActivePreset(null);
    let raw = e.target.value;
    if (raw === '' || raw === null) {
      setter('');
      return;
    }
    // Eliminar signos negativos si los escribe el usuario
    if (raw.includes('-')) {
      raw = raw.replace(/-/g, '');
    }
    const clean = (raw.length > 1 && raw.startsWith('0') && !raw.startsWith('0.'))
      ? raw.replace(/^0+/, '')
      : raw;
    setter(clean);
  };

  const preventNegativeKeys = (e) => {
    if (e.key === '-' || e.key === 'e') {
      e.preventDefault();
    }
  };

  const loadDataWithParams = useCallback(async (overrideParams = {}) => {
    setLoading(true);
    setError(null);
    try {
      const pQq = Object.hasOwn(overrideParams, 'precioMaizQq') ? overrideParams.precioMaizQq : precioMaizQq;
      const rQq = Object.hasOwn(overrideParams, 'rendimientoQq') ? overrideParams.rendimientoQq : rendimientoQq;
      const cSem = Object.hasOwn(overrideParams, 'costoSemilla') ? overrideParams.costoSemilla : costoSemilla;
      const cFert = Object.hasOwn(overrideParams, 'costoFert') ? overrideParams.costoFert : costoFert;
      const cRiego = Object.hasOwn(overrideParams, 'costoRiego') ? overrideParams.costoRiego : costoRiego;
      const cProt = Object.hasOwn(overrideParams, 'costoProteccion') ? overrideParams.costoProteccion : costoProteccion;
      const cOtros = Object.hasOwn(overrideParams, 'otrosVar') ? overrideParams.otrosVar : otrosVar;
      const cFijos = Object.hasOwn(overrideParams, 'costosFijos') ? overrideParams.costosFijos : costosFijos;

      const res = await dssService.getFinancialData({
        cultivoId: cultivoElegidoId,
        anio: anioSeleccionado,
        precioMaizQq: parseVal(pQq, null),
        rendimientoQq: parseVal(rQq, null),
        costoSemilla: parseVal(cSem, null),
        costoFert: parseVal(cFert, null),
        costoRiego: parseVal(cRiego, null),
        costoProteccion: parseVal(cProt, null),
        otrosVar: parseVal(cOtros, null),
        costosFijos: parseVal(cFijos, null)
      });
      setData(res);

      // Autorrellenar casillas automáticamente con los datos calculados del sistema si están vacías
      if (res && res.datos_base_sistema) {
        const base = res.datos_base_sistema;
        if (!pQq && pQq !== 0) setPrecioMaizQq(String(base.precio_maiz_qq || 16.50));
        if (!rQq && rQq !== 0) setRendimientoQq(String(base.rendimiento_qq || 110));
        if (!cSem && cSem !== 0) setCostoSemilla(String(base.costo_semilla || 85));
        if (!cFert && cFert !== 0) setCostoFert(String(base.costo_fert || 120));
        if (!cRiego && cRiego !== 0) setCostoRiego(String(base.costo_riego || 60));
        if (!cProt && cProt !== 0) setCostoProteccion(String(base.costo_proteccion || 45));
        if (!cOtros && cOtros !== 0) setOtrosVar(String(base.otros_var || 80));
        if (!cFijos && cFijos !== 0) setCostosFijos(String(base.costos_fijos || 120));
      }
    } catch {
      setError('Error al cargar análisis financiero.');
    } finally {
      setLoading(false);
    }
  }, [
    anioSeleccionado,
    costoFert,
    costoProteccion,
    costoRiego,
    costoSemilla,
    costosFijos,
    cultivoElegidoId,
    otrosVar,
    precioMaizQq,
    rendimientoQq,
  ]);

  const loadDataRef = useRef(loadDataWithParams);

  useEffect(() => {
    loadDataRef.current = loadDataWithParams;
  }, [loadDataWithParams]);

  useEffect(() => {
    const refresh = setTimeout(() => {
      setPrecioMaizQq('');
      setRendimientoQq('');
      setCostoSemilla('');
      setCostoFert('');
      setCostoRiego('');
      setCostoProteccion('');
      setOtrosVar('');
      setCostosFijos('');
      loadDataRef.current({
        precioMaizQq: '',
        rendimientoQq: '',
        costoSemilla: '',
        costoFert: '',
        costoRiego: '',
        costoProteccion: '',
        otrosVar: '',
        costosFijos: '',
      });
    }, 0);
    return () => clearTimeout(refresh);
  }, [cultivoElegidoId, anioSeleccionado]);

  useEffect(() => {
    if (data && !data.sin_datos && onDashboardData) onDashboardData(data);
  }, [data, onDashboardData]);

  const handleRecalculate = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    loadDataWithParams({});
  };

  const handleAutoFillAll = () => {
    setActivePreset(null);
    if (data && data.datos_base_sistema) {
      const base = data.datos_base_sistema;
      const p = String(base.precio_maiz_qq || 16.50);
      const r = String(base.rendimiento_qq || 110);
      const s = String(base.costo_semilla || 85);
      const f = String(base.costo_fert || 120);
      const rg = String(base.costo_riego || 60);
      const pr = String(base.costo_proteccion || 45);
      const ot = String(base.otros_var || 80);
      const fj = String(base.costos_fijos || 120);

      setPrecioMaizQq(p);
      setRendimientoQq(r);
      setCostoSemilla(s);
      setCostoFert(f);
      setCostoRiego(rg);
      setCostoProteccion(pr);
      setOtrosVar(ot);
      setCostosFijos(fj);

      loadDataWithParams({
        precioMaizQq: p,
        rendimientoQq: r,
        costoSemilla: s,
        costoFert: f,
        costoRiego: rg,
        costoProteccion: pr,
        otrosVar: ot,
        costosFijos: fj
      });
    }
  };

  const areaParcela = data?.kpis?.area_parcela || data?.datos_base_sistema?.area_parcela || 1.0;
  const nombreParcela = data?.kpis?.nombre_parcela || data?.datos_base_sistema?.nombre_parcela || 'Lote Principal';
  const rendQqNum = parseVal(rendimientoQq, data?.datos_base_sistema?.rendimiento_qq || 110);
  const precQqNum = parseVal(precioMaizQq, data?.datos_base_sistema?.precio_maiz_qq || 16.5);
  const produccionTotalParcela = (rendQqNum * areaParcela).toFixed(1);
  const ingresoBrutoTotalParcela = (rendQqNum * precQqNum * areaParcela).toFixed(2);
  const costoTotalPorHa = parseVal(costoSemilla, 85) + parseVal(costoFert, 120) + parseVal(costoRiego, 60) + parseVal(costoProteccion, 45) + parseVal(otrosVar, 80) + parseVal(costosFijos, 120);
  const costoTotalParcelaCalc = (costoTotalPorHa * areaParcela).toFixed(2);
  const margenNetoParcelaCalc = ((rendQqNum * precQqNum - costoTotalPorHa) * areaParcela).toFixed(2);

  const [activePreset, setActivePreset] = useState(null);

  const applyPreset = (presetType) => {
    setActivePreset(presetType);
    let p = {
      precio: '16.50',
      rend: '110',
      semilla: '85',
      fert: '120',
      riego: '60',
      proteccion: '45',
      otros: '80',
      fijos: '120'
    };
    if (presetType === 'tradicional') {
      p = { precio: '16.50', rend: '50', semilla: '60', fert: '90', riego: '0', proteccion: '35', otros: '50', fijos: '80' };
    } else if (presetType === 'semitecnificado') {
      p = { precio: '16.50', rend: '85', semilla: '95', fert: '150', riego: '40', proteccion: '55', otros: '80', fijos: '110' };
    } else if (presetType === 'tecnificado') {
      p = { precio: '16.50', rend: '130', semilla: '120', fert: '210', riego: '80', proteccion: '75', otros: '110', fijos: '150' };
    }

    setPrecioMaizQq(p.precio);
    setRendimientoQq(p.rend);
    setCostoSemilla(p.semilla);
    setCostoFert(p.fert);
    setCostoRiego(p.riego);
    setCostoProteccion(p.proteccion);
    setOtrosVar(p.otros);
    setCostosFijos(p.fijos);

    loadDataWithParams({
      precioMaizQq: p.precio,
      rendimientoQq: p.rend,
      costoSemilla: p.semilla,
      costoFert: p.fert,
      costoRiego: p.riego,
      costoProteccion: p.proteccion,
      otrosVar: p.otros,
      costosFijos: p.fijos
    });
  };

  if (loading && !data) {
    return <div className="flex-center" style={{ height: '70vh', color: 'var(--text-muted)' }}>Cargando DSS Financiero...</div>;
  }

  if (!data || data.sin_datos || !data.kpis || data.sin_simulaciones) {
    return <EmptyDashboard tipo="finance" onGoToSimulation={() => onNavigate?.('simular')} />;
  }

  const { kpis, costo_total, sensibilidad, precios_rango, rendimientos_rango, roi_estrategias, waterfall_costos } = data || {};

  const ingresoBruto = toFiniteNumber(
    (waterfall_costos && waterfall_costos.find(c => c.label === 'Ingreso Bruto'))?.amount
      ?? kpis.ingreso_bruto
      ?? kpis.ingreso_bruto_parcela
  );
  const margenNeto = toFiniteNumber(kpis.margen_neto);
  const margenBruto = toFiniteNumber(kpis.margen_bruto);
  const beneficioCosto = toFiniteNumber(kpis.ganancia_por_dolar);
  const costoTotal = toFiniteNumber(costo_total);
  const costosFijosKpi = toFiniteNumber(kpis.costos_fijos ?? kpis.costo_fijo ?? data?.datos_base_sistema?.costos_fijos);
  const puntoEquilibrio = toFiniteNumber(kpis.punto_equilibrio);
  const precioPiso = toFiniteNumber(kpis.precio_piso_qq);
  const margenSeguridad = toFiniteNumber(kpis.margen_seguridad ?? kpis.margen_seguridad_pct);
  const probSuperarBreakEven = toFiniteNumber(kpis.prob_superar_break_even);
  const confianzaMonteCarlo = toFiniteNumber(kpis.confianza_monte_carlo ?? kpis.confianza_simulacion);
  const retornoInversion = toFiniteNumber(kpis.roi);
  const gananciaPorDolar = beneficioCosto;
  const tirEstimada = toFiniteNumber(kpis.tir ?? kpis.tir_estimada);
  const riesgoFinanciero = String(kpis.riesgo_financiero?.nivel ?? kpis.riesgo_financiero ?? '').trim();

  const getSensibilidadCardStyle = (marginVal) => {
    const isLight = typeof document !== 'undefined' && document.body.classList.contains('light-theme');
    if (marginVal < 0) {
      return {
        background: isLight 
          ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.95) 0%, rgba(254, 202, 202, 0.65) 100%)' 
          : 'linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, rgba(239, 68, 68, 0.12) 100%)',
        border: isLight ? '1.5px solid #f87171' : '1.5px solid rgba(239, 68, 68, 0.55)',
        color: isLight ? '#991b1b' : '#fca5a5',
        boxShadow: isLight ? '0 2px 8px rgba(239, 68, 68, 0.12)' : '0 4px 12px rgba(239, 68, 68, 0.18)'
      };
    }
    if (marginVal <= 250) {
      return {
        background: isLight 
          ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.95) 0%, rgba(253, 230, 138, 0.65) 100%)' 
          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.28) 0%, rgba(245, 158, 11, 0.12) 100%)',
        border: isLight ? '1.5px solid #f59e0b' : '1.5px solid rgba(245, 158, 11, 0.55)',
        color: isLight ? '#78350f' : '#fde047',
        boxShadow: isLight ? '0 2px 8px rgba(245, 158, 11, 0.12)' : '0 4px 12px rgba(245, 158, 11, 0.18)'
      };
    }
    return {
      background: isLight 
        ? 'linear-gradient(135deg, rgba(220, 252, 231, 0.95) 0%, rgba(187, 247, 208, 0.65) 100%)' 
        : 'linear-gradient(135deg, rgba(16, 185, 129, 0.28) 0%, rgba(16, 185, 129, 0.12) 100%)',
      border: isLight ? '1.5px solid #4ade80' : '1.5px solid rgba(16, 185, 129, 0.55)',
      color: isLight ? '#14532d' : '#6ee7b7',
      boxShadow: isLight ? '0 2px 8px rgba(16, 185, 129, 0.12)' : '0 4px 12px rgba(16, 185, 129, 0.18)'
    };
  };

  return (
    <div className="dashboard-view dashboard-view--finance">
      <DashboardIntro
        step="04 / Economía"
        title="La decisión también debe cerrar en números"
        description="Ajusta precio, producción y costos para estimar el margen y comparar estrategias antes de invertir."
        interpretation="Las cifras dependen de los supuestos que ingreses. Compara el margen neto con el punto de equilibrio y luego explora sensibilidad y ROI."
        source="Modelo financiero · USD por hectárea salvo indicación contraria"
      />

      <DashboardSectionHeading label="01 · Supuestos" title="Configura tu escenario económico" description="Elige un perfil como punto de partida o introduce tus propios valores y pulsa Calcular." />

      {/* Form Container: Parámetros de Mercado, Producción y Costos */}
      <div className="glass-panel" style={{ marginBottom: '1.25rem' }}>
        <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Parámetros de Mercado, Producción y Costos</h3>

          {/* Plantillas Rápidas de Mercado con Estilo del Sistema y Botón de Información */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-subtle)', marginRight: '0.2rem' }}>
              Plantillas de Mercado:
            </span>

            <button
              type="button"
              onClick={() => applyPreset('tradicional')}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: activePreset === 'tradicional' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-strong)',
                background: activePreset === 'tradicional' ? 'rgba(59, 130, 246, 0.18)' : 'var(--bg-glass)',
                color: activePreset === 'tradicional' ? 'var(--accent-primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              Perfil Tradicional
            </button>

            <button
              type="button"
              onClick={() => applyPreset('semitecnificado')}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: activePreset === 'semitecnificado' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-strong)',
                background: activePreset === 'semitecnificado' ? 'rgba(59, 130, 246, 0.18)' : 'var(--bg-glass)',
                color: activePreset === 'semitecnificado' ? 'var(--accent-primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              Perfil Semitecnificado
            </button>

            <button
              type="button"
              onClick={() => applyPreset('tecnificado')}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: activePreset === 'tecnificado' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-strong)',
                background: activePreset === 'tecnificado' ? 'rgba(59, 130, 246, 0.18)' : 'var(--bg-glass)',
                color: activePreset === 'tecnificado' ? 'var(--accent-primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              Perfil Tecnificado Alto
            </button>

            {/* Botón de Auto-cálculo por Simulación */}
            <button
              type="button"
              onClick={handleAutoFillAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '0.3rem 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                borderRadius: '8px',
                border: '1.5px solid #10b981',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginLeft: '0.4rem'
              }}
              title="Calcular valores óptimos automáticamente según la simulación biofísica y superficie de la parcela"
            >
              <Sparkles size={13} /> Auto-calcular por Simulación
            </button>

            {/* Botón de Información / Explicación del Modelo */}
            <button
              type="button"
              title="¿Qué significan estos perfiles de mercado?"
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Perfiles Financieros y Modelos de Producción",
                cultivo: "maiz",
                valor: "Tradicional (50 qq/ha), Semitecnificado (85 qq/ha), Tecnificado Alto (130 qq/ha)",
                unidad: "",
                estado: "informativo",
                descripcion_tecnica: "Modelos financieros preajustados según la intensidad tecnológica en Ecuador: 1) Perfil Tradicional: Siembra manual en secano (dependiente de lluvias) con baja inversión en insumos. 2) Perfil Semitecnificado: Mecanización parcial, riego suplementario y fertilización balanceada. 3) Perfil Tecnificado Alto: Riego tecnificado (goteo/aspersión), híbridos certificados de alta densidad y fertilización de precisión.",
                impacto_base: "Permite comparar en un solo clic cómo cambia tu margen neto y rentabilidad si mejoras el nivel tecnológico de tu terreno.",
                recomendacion_base: "Usa el perfil que coincida con la disponibilidad de agua de tu terreno. Si cuentas con riego constante, el Perfil Tecnificado Alto optimiza el retorno del capital."
              })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justify: 'center',
                gap: '4px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1.5px solid var(--accent-primary)',
                background: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginLeft: '0.2rem'
              }}
            >
              <Info size={14} /> Explicación
            </button>
          </div>
        </div>

        <div className="glass-card-body" style={{ padding: '0.85rem 1.25rem' }}>
          <form onSubmit={handleRecalculate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                PRECIO MAÍZ ($/qq)
                <span title="Precio de venta estimado en finca por quintal (45.36 kg / 100 lb) de grano seco." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="number" min="0" step="any" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={precioMaizQq} onChange={handleInput(setPrecioMaizQq)} placeholder="16.50" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                RENDIMIENTO (qq/ha)
                <span title="Volumen total de cosecha estimado por hectárea expresado en quintales (Auto-calculado desde la simulación)." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="number" min="0" step="any" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={rendimientoQq} onChange={handleInput(setRendimientoQq)} placeholder="110" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                SEMILLAS ($/ha)
                <span title="Costo de adquisición del híbrido de maíz seleccionado y curado de semilla por hectárea." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="number" min="0" step="any" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costoSemilla} onChange={handleInput(setCostoSemilla)} placeholder="85" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                FERTILIZACIÓN ($/ha)
                <span title="Inversión en fertilizantes edáficos y foliares (Urea, DAP, KCl, micronutrientes) por hectárea." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="number" min="0" step="any" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costoFert} onChange={handleInput(setCostoFert)} placeholder="120" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                RIEGO ($/ha)
                <span title="Costo operativo del agua: energía de bombeo, mantenimiento de tuberías o canon de riego por hectárea." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="number" min="0" step="any" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costoRiego} onChange={handleInput(setCostoRiego)} placeholder="60" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                FITOSANITARIOS ($/ha)
                <span title="Inversión en plaguicidas, herbicidas pre y post-emergentes, fungicidas e insecticidas por hectárea." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="number" min="0" step="any" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costoProteccion} onChange={handleInput(setCostoProteccion)} placeholder="45" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                OTROS C. VAR. ($/ha)
                <span title="Costos variables operativos: mano de obra, alquiler de tractor o cosechadora combinada, flete del grano." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="number" min="0" step="any" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={otrosVar} onChange={handleInput(setOtrosVar)} placeholder="80" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                C. FIJOS ($/ha)
                <span title="Gastos fijos obligatorios: arriendo de tierra, administración y supervisión del lote." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="number" min="0" step="any" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costosFijos} onChange={handleInput(setCostosFijos)} placeholder="120" />
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '0.48rem 0.75rem', fontSize: '0.82rem', fontWeight: 700 }}>Calcular</button>
          </form>

          {/* Franja Resumen Calculada Automáticamente para Toda la Parcela */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.65rem',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '0.65rem 0.85rem',
            marginTop: '0.85rem',
            fontSize: '0.74rem'
          }}>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Superficie Parcela</span>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{nombreParcela} ({areaParcela} ha)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cosecha Total Parcela</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{produccionTotalParcela} qq <small style={{ color: 'var(--text-subtle)', fontWeight: 500 }}>({rendQqNum} qq/ha)</small></span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ingreso Bruto Total</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-secondary)' }}>${Number(ingresoBrutoTotalParcela).toLocaleString()} USD</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Costo Total Parcela</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-warning)' }}>${Number(costoTotalParcelaCalc).toLocaleString()} USD</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Margen Neto Parcela</span>
              <span style={{ fontWeight: 900, color: Number(margenNetoParcelaCalc) >= 0 ? 'var(--accent-primary)' : 'var(--accent-warning)' }}>
                ${Number(margenNetoParcelaCalc).toLocaleString()} USD
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-danger-alpha text-danger" style={{ padding: '0.75rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>{error}</div>
      )}

      {data && (
        <>
          <DashboardSectionHeading label="02 · Resultado" title="Rentabilidad de la parcela" description="Primero comprueba el margen neto; después revisa costos, equilibrio y retorno para entender el riesgo." />
          {/* KPI Cards */}
          <div className="kpi-row">
            <InteractiveKPI
              icon={<DollarSign size={22} />}
              iconClass="text-success"
              slides={[
                {
                  title: "Margen Neto Estimado",
                  value: margenNeto === null ? 'No disponible' : <>{formatCurrency(margenNeto)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: margenNeto === null,
                  trend: margenNeto === null ? "Sin dato" : (margenNeto >= 300 ? "Favorable" : "Bajo"),
                  progress: margenNeto === null ? null : Math.min(100, Math.max(0, (margenNeto / 600) * 100)),
                  progressColor: margenNeto !== null && margenNeto >= 300 ? "linear-gradient(90deg, #16a34a 0%, #34d399 100%)" : "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
                  progressLabelLeft: "Retorno Neto",
                  progressLabelRight: margenNeto === null ? "Sin dato" : (margenNeto >= 0 ? "Ganancia" : "Pérdida"),
                  // No se inventa una serie histórica: la API sólo entrega el valor actual.
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Margen Neto Estimado",
                    cultivo: "maiz",
                    valor: margenNeto === null ? null : `${formatCurrency(margenNeto)} USD`,
                    unidad: "/ha",
                    estado: margenNeto === null ? "sin_datos" : (margenNeto > 300 ? "favorable" : (margenNeto >= 0 ? "regular" : "riesgoso")),
                    rango_ideal: "Mayor a 300 USD/ha",
                    descripcion_tecnica: "La ganancia neta líquida real que le queda al productor por cada hectárea cultivada de maíz, calculada restando los costos fijos y variables del ingreso total por ventas.",
                    impacto_base: "Un margen neto positivo asegura la sostenibilidad económica del agricultor y la rentabilidad del lote. Si es negativo, indica pérdidas directas.",
                    recomendacion_base: "Si el margen es bajo, evaluar la reducción de costos de fertilizantes químicos aplicando biofertilizantes, o buscar mejores canales de venta para aumentar el precio."
                  }
                },
                {
                  title: "Ingreso Bruto Total",
                  value: ingresoBruto === null ? 'No disponible' : <>{formatCurrency(ingresoBruto)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: ingresoBruto === null,
                  trend: ingresoBruto === null ? "Sin dato" : "Ventas",
                  progress: null,
                  progressColor: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
                  progressLabelLeft: "",
                  progressLabelRight: "",
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Ingreso Bruto Total",
                    cultivo: "maiz",
                    valor: ingresoBruto === null ? null : `${formatCurrency(ingresoBruto)} USD`,
                    estado: ingresoBruto === null ? "sin_datos" : "favorable",
                    unidad: "/ha",
                    rango_ideal: "Mayor a 1,500 USD/ha",
                    descripcion_tecnica: "Monto total acumulado recibido por la comercialización del maíz cosechado en la parcela antes de descontar ningún gasto ni costo operativo.",
                    impacto_base: "Refleja la escala económica total de las ventas de la cosecha.",
                    recomendacion_base: "Para elevar el ingreso bruto se puede buscar mejor precio por quintal ($/qq) o incrementar los quintales cosechados por hectárea (qq/ha)."
                  }
                },
                {
                  title: "Beneficio / Costo (B/C)",
                  value: beneficioCosto === null ? 'No disponible' : <>{beneficioCosto.toLocaleString('es-EC', { maximumFractionDigits: 2 })} <span className="kpi-value-unit">B/C</span></>,
                  isMissing: beneficioCosto === null,
                  trend: beneficioCosto === null ? "Sin dato" : "Eficiente",
                  progress: beneficioCosto === null ? null : Math.min(100, Math.max(0, (beneficioCosto / 2.5) * 100)),
                  progressColor: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                  progressLabelLeft: "Rentabilidad Usd",
                  progressLabelRight: beneficioCosto === null ? "Sin dato" : beneficioCosto.toLocaleString('es-EC', { maximumFractionDigits: 2 }),
                  miniChart: beneficioCosto === null ? null : { type: 'ring', percent: Math.min(100, Math.max(0, (beneficioCosto / 2.5) * 100)), color: '#34d399' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Relación Beneficio / Costo (B/C)",
                    cultivo: "maiz",
                    valor: beneficioCosto === null ? null : `${beneficioCosto} B/C`,
                    unidad: "",
                    estado: beneficioCosto === null ? "sin_datos" : (beneficioCosto > 1.5 ? "favorable" : "regular"),
                    rango_ideal: "Mayor a 1.5 B/C",
                    descripcion_tecnica: "Índice financiero que resulta de dividir los ingresos brutos totales entre los costos totales. Muestra cuántos dólares en ventas brutas genera cada dólar invertido.",
                    impacto_base: "Permite evaluar la eficiencia económica global del cultivo.",
                    recomendacion_base: "Mantener la relación B/C por encima de 1.3 para garantizar que la inversión agrícola sea rentable frente a imprevistos."
                  }
                }
              ]}
              tooltip="Ganancia neta por hectárea después de descontar todos los costos de producción del ingreso bruto."
              delay={0}
              onClick={(payload) => pedirExplicacionIa(payload)}
            />
            <InteractiveKPI
              icon={<DollarSign size={22} />}
              iconClass="text-secondary"
              slides={[
                {
                  title: "Margen Bruto Operativo",
                  value: margenBruto === null ? 'No disponible' : <>{formatCurrency(margenBruto)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: margenBruto === null,
                  trend: margenBruto === null ? "Sin dato" : (margenBruto >= 500 ? "Favorable" : "Regular"),
                  progress: margenBruto === null ? null : Math.min(100, (margenBruto / 1000) * 100),
                  progressColor: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
                  progressLabelLeft: "Operativo",
                  progressLabelRight: "Bruto",
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Margen Bruto Operativo",
                    cultivo: "maiz",
                    valor: margenBruto === null ? null : `${formatCurrency(margenBruto)} USD`,
                    unidad: "/ha",
                    estado: margenBruto === null ? "sin_datos" : (margenBruto > 500 ? "favorable" : (margenBruto >= 200 ? "regular" : "riesgoso")),
                    rango_ideal: "Mayor a 600 USD/ha",
                    descripcion_tecnica: "Diferencia directa entre el dinero recibido por la venta del maíz y los costos operativos de campo (semillas, fertilizante, combustible, jornaleros), excluyendo costos fijos de administración o arriendo.",
                    impacto_base: "Muestra la rentabilidad strictly productiva y operativa del cultivo en el lote.",
                    recomendacion_base: "Optimizar las dosis de nitrógeno y potasio para no encarecer los costos operativos directos por encima del incremento en rendimiento."
                  }
                },
                {
                  title: "Costo Total Insumos",
                  value: costoTotal === null ? 'No disponible' : <>{formatCurrency(costoTotal)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: costoTotal === null,
                  trend: costoTotal === null ? "Sin dato" : "Presupuesto",
                  progress: costoTotal === null ? null : Math.min(100, (costoTotal / 1500) * 100),
                  progressColor: "linear-gradient(90deg, #f87171 0%, #ef4444 100%)",
                  progressLabelLeft: "Gastos Lote",
                  progressLabelRight: costoTotal === null ? "Sin dato" : formatCurrency(costoTotal),
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Costo Total Insumos y Producción",
                    cultivo: "maiz",
                    valor: costoTotal === null ? null : `${formatCurrency(costoTotal)} USD`,
                    unidad: "/ha",
                    estado: costoTotal === null ? "sin_datos" : "presupuesto",
                    rango_ideal: "800 a 1,200 USD/ha",
                    descripcion_tecnica: "Suma consolidada de todos los egresos financieros: semillas, fertilización, riego, agrotóxicos fitosanitarios, costos variables operativos y costos fijos de la parcela.",
                    impacto_base: "Define la necesidad total de capital de trabajo que el agricultor debe financiar o desembolsar para el ciclo del cultivo.",
                    recomendacion_base: "Revisar los rubros con mayor peso en el gráfico de cascada para cotizar insumos al por mayor o sustituir parte de la urea por fertilizantes biológicos."
                  }
                },
                {
                  title: "Estructura de Fijos",
                  value: costosFijosKpi === null ? 'No disponible' : <>{formatCurrency(costosFijosKpi)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: costosFijosKpi === null,
                  trend: costosFijosKpi === null ? "Sin dato" : "Administración",
                  progress: costosFijosKpi === null ? null : Math.min(100, (costosFijosKpi / 300) * 100),
                  progressColor: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)",
                  progressLabelLeft: "Proporción Fija",
                  progressLabelRight: costosFijosKpi === null ? "Sin dato" : `${Math.min(100, Math.round((costosFijosKpi / 300) * 100))}%`,
                  miniChart: costosFijosKpi === null ? null : { type: 'ring', percent: Math.min(100, (costosFijosKpi / 300) * 100), color: '#fbbf24' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Estructura de Costos Fijos",
                    cultivo: "maiz",
                    valor: costosFijosKpi === null ? null : `${formatCurrency(costosFijosKpi)} USD`,
                    unidad: "/ha",
                    estado: costosFijosKpi === null ? "sin_datos" : "fijo",
                    rango_ideal: "100 a 150 USD/ha",
                    descripcion_tecnica: "Representa la proporción de gastos fijos ineludibles como arriendo del suelo, administración y amortización de herramientas que no varían con el volumen cosechado.",
                    impacto_base: "Un porcentaje muy alto de costos fijos eleva el punto de equilibrio y la vulnerabilidad en años de bajo precio.",
                    recomendacion_base: "Distribuir los costos fijos sobre una mayor superficie cultivada para reducir su peso por hectárea."
                  }
                }
              ]}
              tooltip="Ingreso total por venta del maíz menos los costos directos de producción (sin costos fijos)."
              delay={1}
              onClick={(payload) => pedirExplicacionIa(payload)}
            />
            <InteractiveKPI
              icon={<Scale size={22} />}
              iconClass="text-warning"
              slides={[
                {
                  title: "Punto de Equilibrio",
                  value: puntoEquilibrio === null ? 'No disponible' : <>{puntoEquilibrio} <span className="kpi-value-unit">t/ha</span></>,
                  isMissing: puntoEquilibrio === null,
                  trend: puntoEquilibrio === null ? "Sin dato" : "Moderado",
                  progress: puntoEquilibrio === null ? null : Math.min(100, (puntoEquilibrio / 10) * 100),
                  progressColor: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
                  progressLabelLeft: "Umbral Mínimo",
                  progressLabelRight: puntoEquilibrio === null ? "Sin dato" : `${puntoEquilibrio} t/ha`,
                  miniChart: puntoEquilibrio === null ? null : { type: 'ring', percent: Math.round((puntoEquilibrio / 8.5) * 100), color: '#fbbf24' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Punto de Equilibrio (Break-Even Yield)",
                    cultivo: "maiz",
                    valor: puntoEquilibrio,
                    unidad: "t/ha",
                    estado: puntoEquilibrio === null ? "sin_datos" : (puntoEquilibrio < 5.0 ? "favorable" : "riesgoso"),
                    rango_ideal: "Menor a 4.5 t/ha",
                    descripcion_tecnica: "La cantidad mínima de toneladas de maíz que se deben producir y vender por hectárea para empatar financieramente (ingresos igual a egresos totales).",
                    impacto_base: "Si tu rendimiento real o predicho está por debajo de este punto de equilibrio, la parcela operará con pérdidas económicas.",
                    recomendacion_base: "Monitorear que las proyecciones de rendimiento superen holgadamente este valor. Si el punto de equilibrio es muy alto, se deben recortar costos de insumos."
                  }
                },
                {
                  title: "Precio Mínimo Venta",
                  value: precioPiso === null ? 'No disponible' : <>{formatCurrency(precioPiso)} <span className="kpi-value-unit">/qq</span></>,
                  isMissing: precioPiso === null,
                  trend: precioPiso === null ? "Sin dato" : "Break-Even",
                  progress: precioPiso === null ? null : 60,
                  progressColor: "linear-gradient(90deg, #60a5fa 0%, #93c5fd 100%)",
                  progressLabelLeft: "Precio Piso",
                  progressLabelRight: precioPiso === null ? "Sin dato" : `${formatCurrency(precioPiso)}/qq`,
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Precio Mínimo de Venta (Precio Piso)",
                    cultivo: "maiz",
                    valor: precioPiso === null ? null : `${formatCurrency(precioPiso)} USD`,
                    unidad: "/qq",
                    estado: precioPiso === null ? "sin_datos" : "break-even",
                    rango_ideal: "Menor a $12.00 USD/qq",
                    descripcion_tecnica: "Precio de mercado por quintal de maíz por debajo del cual el cultivo entra en pérdidas netas considerando la producción esperada de la parcela.",
                    impacto_base: "Permite al agricultor fijar su precio límite para negociar con compradores e industrias balanceadoras.",
                    recomendacion_base: "Si el precio de mercado local cae cerca de este piso, buscar almacenamiento o venta directa a molinos para evitar intermediarios."
                  }
                },
                {
                  title: "Margen de Seguridad",
                  value: margenSeguridad === null ? 'No disponible' : <>{margenSeguridad} <span className="kpi-value-unit">% Vol</span></>,
                  isMissing: margenSeguridad === null,
                  trend: margenSeguridad === null ? "Sin dato" : "Protección",
                  progress: margenSeguridad === null ? null : margenSeguridad,
                  progressColor: "linear-gradient(90deg, #34d399 0%, #10b981 100%)",
                  progressLabelLeft: "Holgura Lluvia/Rend",
                  progressLabelRight: margenSeguridad === null ? "Sin dato" : `${margenSeguridad}%`,
                  miniChart: margenSeguridad === null ? null : { type: 'ring', percent: margenSeguridad, color: '#34d399' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Margen de Seguridad Productivo",
                    cultivo: "maiz",
                    valor: margenSeguridad === null ? null : `${margenSeguridad} %`,
                    unidad: "Volumen",
                    estado: margenSeguridad === null ? "sin_datos" : "favorable",
                    rango_ideal: "Mayor al 25%",
                    descripcion_tecnica: "Holgura en porcentaje que puede caer la cosecha o el precio antes de que la parcela comience a registrar pérdidas netas.",
                    impacto_base: "Cuanto mayor sea este porcentaje, más protegido está el productor contra sequías imprevistas o caídas de precio.",
                    recomendacion_base: "Mantener medidas de prevención de plagas para no recortar esta holgura de seguridad."
                  }
                }
              ]}
              tooltip="Rendimiento mínimo necesario para cubrir todos los costos. Por debajo de este valor, hay pérdida."
              delay={2}
              onClick={(payload) => pedirExplicacionIa(payload)}
            />
            <InteractiveKPI
              icon={<Percent size={22} />}
              iconClass="text-success"
              slides={[
                {
                  title: "Escenarios sobre equilibrio",
                  value: probSuperarBreakEven === null ? 'No disponible' : <>{probSuperarBreakEven} <span className="kpi-value-unit">%</span></>,
                  isMissing: probSuperarBreakEven === null,
                  trend: probSuperarBreakEven === null ? "Mín. 5 simulaciones" : "Frecuencia simulada",
                  progress: probSuperarBreakEven,
                  progressColor: "linear-gradient(90deg, #16a34a 0%, #34d399 100%)",
                  progressLabelLeft: "Simulaciones rentables",
                  progressLabelRight: probSuperarBreakEven === null ? "Sin dato" : `${probSuperarBreakEven}%`,
                  miniChart: probSuperarBreakEven === null ? null : { type: 'ring', percent: probSuperarBreakEven, color: '#34d399' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Frecuencia de Simulaciones Sobre el Punto de Equilibrio",
                    cultivo: "maiz",
                    valor: probSuperarBreakEven,
                    unidad: "%",
                    estado: probSuperarBreakEven === null ? "sin_datos" : (probSuperarBreakEven > 80 ? "favorable" : (probSuperarBreakEven > 50 ? "regular" : "riesgoso")),
                    rango_ideal: "Mayor porcentaje de escenarios rentables",
                    descripcion_tecnica: "Porcentaje de al menos cinco simulaciones guardadas cuya cosecha estimada cubre los costos y el precio configurados. No es una probabilidad calibrada ni una garantía de resultado.",
                    impacto_base: "Permite ver con qué frecuencia la cosecha simulada alcanzó el punto de equilibrio bajo estos supuestos financieros.",
                    recomendacion_base: "Contrasta este porcentaje con el margen neto y la sensibilidad al precio antes de invertir."
                  }
                },
                {
                  title: "Confianza Monte Carlo",
                  value: confianzaMonteCarlo === null ? 'No disponible' : <>{confianzaMonteCarlo} <span className="kpi-value-unit">%</span></>,
                  isMissing: confianzaMonteCarlo === null,
                  trend: confianzaMonteCarlo === null ? "Sin dato" : "Simulación",
                  progress: confianzaMonteCarlo,
                  progressColor: "linear-gradient(90deg, #818cf8 0%, #c084fc 100%)",
                  progressLabelLeft: "30 Corridas",
                  progressLabelRight: confianzaMonteCarlo === null ? "Sin dato" : (confianzaMonteCarlo >= 80 ? "Alta" : "Revisar"),
                  miniChart: confianzaMonteCarlo === null ? null : { type: 'ring', percent: confianzaMonteCarlo, color: '#9ed1ff' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Nivel de Confianza de Simulación Monte Carlo",
                    cultivo: "maiz",
                    valor: confianzaMonteCarlo === null ? null : `${confianzaMonteCarlo} %`,
                    unidad: "Confianza",
                    estado: confianzaMonteCarlo === null ? "sin_datos" : "favorable",
                    rango_ideal: "Mayor al 80%",
                    descripcion_tecnica: "Grado de fiabilidad estadística obtenido tras correr 30 simulaciones biofísicas combinando variaciones climáticas e insumos históricos del lote.",
                    impacto_base: "Asegura que los resultados financieros no son producto del azar sino de un modelo agronómico robusto.",
                    recomendacion_base: "Utilizar este nivel de confianza para tomar decisiones de crédito o inversión en semillas híbridas."
                  }
                },
                {
                  title: "Riesgo Financiero",
                  value: riesgoFinanciero || 'No disponible',
                  isMissing: !riesgoFinanciero,
                  trend: riesgoFinanciero ? "Protegido" : "Sin dato",
                  progress: null,
                  progressColor: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                  progressLabelLeft: "Riesgo Pérdida",
                  progressLabelRight: riesgoFinanciero ? "Nivel reportado" : "Sin dato",
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Nivel de Riesgo Financiero de Pérdida",
                    cultivo: "maiz",
                    valor: riesgoFinanciero || null,
                    unidad: "",
                    estado: riesgoFinanciero ? "favorable" : "sin_datos",
                    rango_ideal: "Bajo (menor al 20%)",
                    descripcion_tecnica: "Probabilidad porcentual de que los ingresos por cosecha sean inferiores a la inversión total realizada en la campaña.",
                    impacto_base: "Evalúa la exposición al riesgo del capital invertido en la parcela.",
                    recomendacion_base: "Un nivel bajo de riesgo permite planificar la expansión del cultivo a nuevas hectáreas."
                  }
                }
              ]}
              tooltip="Frecuencia de simulaciones que cubren los costos; requiere al menos cinco resultados del lote."
              delay={3}
              onClick={(payload) => pedirExplicacionIa(payload)}
            />
            <InteractiveKPI
              icon={<Percent size={22} />}
              iconClass="text-secondary"
              slides={[
                {
                  title: "Retorno (ROI)",
                  value: retornoInversion === null ? 'No disponible' : <>{retornoInversion} <span className="kpi-value-unit">%</span></>,
                  isMissing: retornoInversion === null,
                  trend: retornoInversion === null ? "Sin dato" : (retornoInversion >= 0 ? "Favorable" : "Riesgoso"),
                  progress: retornoInversion === null ? null : Math.min(100, Math.max(0, retornoInversion)),
                  progressColor: retornoInversion !== null && retornoInversion >= 0 ? "linear-gradient(90deg, #16a34a 0%, #34d399 100%)" : "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
                  progressLabelLeft: "Inversión",
                  progressLabelRight: retornoInversion === null ? "Sin dato" : `${retornoInversion}%`,
                  miniChart: retornoInversion === null ? null : { type: 'ring', percent: Math.min(100, Math.max(0, retornoInversion)), color: retornoInversion >= 0 ? '#34d399' : '#f87171' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Retorno de Inversión (ROI)",
                    cultivo: "maiz",
                    valor: retornoInversion,
                    unidad: "",
                    estado: retornoInversion === null ? "sin_datos" : (retornoInversion > 20 ? "favorable" : (retornoInversion >= 0 ? "regular" : "riesgoso")),
                    rango_ideal: "Mayor al 25%",
                    descripcion_tecnica: "Mide el rendimiento del dinero invertido en el cultivo de maíz. Por ejemplo, un ROI del 20% significa que por cada dólar que inviertes, recuperas tu dólar y ganas 20 centavos adicionales.",
                    impacto_base: "Determina si el capital invertido en el maíz rinde más que guardarlo en el banco o invertirlo en otra actividad.",
                    recomendacion_base: "Si el ROI es negativo o menor al 5%, reevaluar toda la estrategia de costos e insumos de la parcela."
                  }
                },
                {
                  title: "Ganancia por Dólar",
                  value: gananciaPorDolar === null ? 'No disponible' : <>{formatCurrency(gananciaPorDolar)} <span className="kpi-value-unit">/$</span></>,
                  isMissing: gananciaPorDolar === null,
                  trend: gananciaPorDolar === null ? "Sin dato" : "Utilidad",
                  progress: gananciaPorDolar === null ? null : Math.min(100, (gananciaPorDolar / 3) * 100),
                  progressColor: "linear-gradient(90deg, #c084fc 0%, #e879f9 100%)",
                  progressLabelLeft: "Retorno Capital",
                  progressLabelRight: gananciaPorDolar === null ? "Sin dato" : formatCurrency(gananciaPorDolar),
                  miniChart: gananciaPorDolar === null ? null : { type: 'ring', percent: Math.min(100, Math.max(0, (gananciaPorDolar / 3) * 100)), color: '#9fc862' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Ganancia por Dólar Invertido",
                    cultivo: "maiz",
                    valor: gananciaPorDolar === null ? null : `${formatCurrency(gananciaPorDolar)} USD`,
                    unidad: "/$",
                    estado: gananciaPorDolar === null ? "sin_datos" : "favorable",
                    rango_ideal: "Mayor a $1.20 USD/$",
                    descripcion_tecnica: "Indica cuántos dólares regresa la cosecha por cada dólar desembolsado en semillas, fertilización, riego y mano de obra.",
                    impacto_base: "Muestra la rentabilidad unitaria directa del capital de trabajo.",
                    recomendacion_base: "Multiplicar este factor por el presupuesto disponible para estimar la ganancia total en dólares."
                  }
                },
                {
                  title: "TIR Estimada",
                  value: tirEstimada === null ? 'No disponible' : <>{tirEstimada} <span className="kpi-value-unit">% TIR</span></>,
                  isMissing: tirEstimada === null,
                  trend: tirEstimada === null ? "Sin dato" : "Interna",
                  progress: tirEstimada === null ? null : Math.min(100, tirEstimada),
                  progressColor: "linear-gradient(90deg, #a855f7 0%, #c084fc 100%)",
                  progressLabelLeft: "Tasa Interna",
                  progressLabelRight: tirEstimada === null ? "Sin dato" : `${tirEstimada}%`,
                  miniChart: tirEstimada === null ? null : { type: 'ring', percent: Math.min(100, tirEstimada), color: '#d8a83f' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Tasa Interna de Retorno (TIR) Estimada",
                    cultivo: "maiz",
                    valor: tirEstimada === null ? null : `${tirEstimada} %`,
                    unidad: "TIR",
                    estado: tirEstimada === null ? "sin_datos" : "favorable",
                    rango_ideal: "Mayor al 30%",
                    descripcion_tecnica: "Tasa de rendimiento financiero anualizada que genera el proyecto agrícola durante los 4 meses del ciclo del cultivo de maíz.",
                    impacto_base: "Demuestra la rentabilidad financiera del cultivo en comparación con otras alternativas de inversión.",
                    recomendacion_base: "Una TIR del 42% supera ampliamente la tasa de interés bancaria, validando el atractivo del cultivo."
                  }
                }
              ]}
              tooltip="Retorno sobre la inversión total. Valores positivos indican ganancia sobre cada dólar invertido."
              delay={4}
              onClick={(payload) => pedirExplicacionIa(payload)}
            />
          </div>

          {/* Charts */}
          <DashboardSectionHeading label="03 · Sensibilidad" title="Qué cambia el resultado" description="Compara variaciones de precio y rendimiento, distribución de costos y retorno por estrategia." />
          <div className="chart-grid">
            {/* Sensitivity */}
            <div 
              className="glass-panel chart-panel-interactive"
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "grafico",
                nombre: "Sensibilidad Precio vs Rendimiento",
                cultivo: "maiz",
                valor: "Simulación de márgenes en USD",
                unidad: "",
                estado: "financiero",
                descripcion_tecnica: "Tabla de doble entrada que modela el margen neto final estimado para la parcela al cruzar diferentes precios de mercado del maíz por tonelada con diferentes rendimientos cosechados.",
                impacto_base: "Permite ver el umbral donde el negocio pasa a pérdidas (valores negativos en rojo) y dónde es rentable (valores positivos).",
                recomendacion_base: "Verificar en la matriz si con rendimientos realistas de su zona el negocio resiste caídas en el precio de venta.",
                datos_grafico: sensibilidad
              })}
            >
              <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Sensibilidad Precio vs Rendimiento (USD)</h3>
              </div>
              <div className="glass-card-body" style={{ padding: '0.6rem 0.85rem 1rem 0.85rem' }}>
                <div className="table-responsive-container">
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px 7px', textAlign: 'center' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.45rem 0.35rem', color: 'var(--text-subtle)', fontSize: '0.72rem', fontWeight: 700, textAlign: 'left' }}>Rend. ↓ | Precio →</th>
                        {precios_rango.map(p => (
                          <th key={p} style={{ padding: '0.45rem 0.35rem', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 800 }}>${p}/qq</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rendimientos_rango.map(r => (
                        <tr key={r}>
                          <td style={{ padding: '0.5rem 0.35rem', fontWeight: 700, textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r} qq/ha</td>
                          {precios_rango.map(p => {
                            const item = sensibilidad.find(s => s.precio === p && s.rendimiento === r);
                            const marginVal = item ? item.margen : 0;
                            const cardSt = getSensibilidadCardStyle(marginVal);
                            return (
                              <td 
                                key={p} 
                                style={{ 
                                  padding: '0.65rem 0.35rem', 
                                  background: cardSt.background,
                                  border: cardSt.border,
                                  borderRadius: '10px',
                                  boxShadow: cardSt.boxShadow,
                                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'inline-flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: cardSt.color }}>
                                    {marginVal < 0 ? `$-${Math.abs(marginVal).toLocaleString()}` : `$${marginVal.toLocaleString()}`}
                                  </span>
                                  <span style={{ fontSize: '0.62rem', fontWeight: 600, color: cardSt.color, opacity: 0.85 }}>/ha</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Waterfall costs */}
            <div 
              className="glass-panel chart-panel-interactive"
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "grafico",
                nombre: "Composición de Costos de Producción",
                cultivo: "maiz",
                valor: "Participación de cada costo en el costo total",
                unidad: "USD",
                estado: "presupuesto",
                descripcion_tecnica: "Gráfico de anillo que muestra exclusivamente cómo se distribuye el costo de producción entre semillas, fertilización, riego, protección, otros costos y costos fijos.",
                impacto_base: "Muestra cuál es la partida de costos con más peso dentro del presupuesto. El margen neto se presenta por separado para no mezclar ingresos con gastos.",
                recomendacion_base: "Priorizar el control de las partidas de gasto que representan el mayor porcentaje de egresos.",
                datos_grafico: waterfall_costos
              })}
            >
              <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Composición de costos de producción</h3>
              </div>
              <div className="glass-card-body" style={{ padding: '0.85rem 1.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minHeight: '260px' }}>
                {(() => {
                  const expenseItems = (waterfall_costos || []).filter(item => !item.is_total && Number(item.amount) < 0);
                  const totalExpenses = expenseItems.reduce((total, item) => total + Math.abs(Number(item.amount) || 0), 0);
                  const netMargin = (waterfall_costos || []).find(item => item.label === 'Margen Neto')?.amount || 0;

                  const colorPalette = [
                    '#d8a83f', '#9fc862', '#9ed1ff', '#70a984', '#d7c176', '#699887'
                  ];

                  const chartData = {
                    labels: expenseItems.map(item => item.label),
                    datasets: [{
                      data: expenseItems.map(item => Math.abs(item.amount)),
                      backgroundColor: expenseItems.map((_, idx) => colorPalette[idx % colorPalette.length]),
                      borderColor: 'transparent',
                      borderWidth: 2,
                      hoverOffset: 8
                    }]
                  };

                  const chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const label = context.label || '';
                            const val = context.raw || 0;
                            const pct = totalExpenses > 0 ? ((val / totalExpenses) * 100).toFixed(1) : '0.0';
                            return ` ${label}: $${val.toLocaleString()} (${pct}%)`;
                          }
                        }
                      }
                    }
                  };

                  if (totalExpenses <= 0) return <div className="chart-empty-state">No hay costos registrados para mostrar su distribución.</div>;

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'center', minHeight: '240px' }}>
                      {/* Doughnut Chart Canvas with Center Text Overlay */}
                      <div style={{ position: 'relative', width: '100%', height: '220px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Doughnut data={chartData} options={chartOptions} />
                        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                          <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 700, letterSpacing: '0.05em', display: 'block' }}>
                            Costo total
                          </span>
                          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                            ${totalExpenses.toLocaleString('es-EC')}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                            Margen: ${Number(netMargin).toLocaleString('es-EC')}/ha
                          </span>
                        </div>
                      </div>

                      {/* Side Breakdown Legend */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', width: '100%' }}>
                        {expenseItems.map((item, idx) => {
                          const itemColor = colorPalette[idx % colorPalette.length];
                          const absVal = Math.abs(item.amount);
                          const pct = ((absVal / totalExpenses) * 100).toFixed(1);

                          return (
                            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: itemColor, display: 'inline-block', boxShadow: `0 0 6px ${itemColor}80` }} />
                                  {item.label}
                                </div>
                                <div style={{ fontWeight: 700, color: itemColor, fontSize: '0.78rem' }}>
                                  ${absVal.toLocaleString()} <span style={{ fontSize: '0.65rem', opacity: 0.8, color: 'var(--text-muted)' }}>({pct}%)</span>
                                </div>
                              </div>
                              <div style={{ width: '100%', height: '5px', background: 'var(--border-subtle)', borderRadius: '99px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, (absVal / totalExpenses) * 100)}%`, height: '100%', background: itemColor, borderRadius: '99px' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ROI Strategies */}
          <div 
            className="glass-panel" 
            style={{ marginBottom: '1.25rem' }}
          >
            <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>ROI bajo supuestos comparables</h3>
            </div>
            <div className="glass-card-body roi-panel-grid">
              <div 
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '280px' }}
                onClick={() => pedirExplicacionIa({
                  tipo_elemento: "grafico",
                  nombre: "Gráfico Comparativo de ROI",
                  cultivo: "maiz",
                  valor: "Retorno sobre inversión global",
                  unidad: "%",
                  estado: "estrategias",
                  descripcion_tecnica: "Comparación de ROI calculado con el escenario base y tres cambios hipotéticos explícitos en costos o producción.",
                  impacto_base: "Permite ver la sensibilidad del retorno a esos supuestos; no es evidencia de que una práctica específica produzca ese cambio.",
                  recomendacion_base: "Contrasta los costos, márgenes y rendimiento supuestos con datos reales antes de decidir.",
                  datos_grafico: roi_estrategias
                })}
              >
                <FinancialROI strategies={roi_estrategias} />
              </div>

              <div className="roi-strategy-list">
                {(() => {
                  const colors = [
                    { border: 'rgba(158, 209, 255, .22)', bg: 'rgba(158, 209, 255, .05)', active: '#9ed1ff' },
                    { border: 'rgba(216, 168, 63, .22)', bg: 'rgba(216, 168, 63, .05)', active: '#d8a83f' },
                    { border: 'rgba(159, 200, 98, .22)', bg: 'rgba(159, 200, 98, .05)', active: '#9fc862' },
                    { border: 'rgba(112, 169, 132, .22)', bg: 'rgba(112, 169, 132, .05)', active: '#70a984' }
                  ];

                  return roi_estrategias.map((est, i) => {
                    const theme = colors[i] || colors[0];
                    return (
                      <div 
                        key={i} 
                        className="roi-strategy-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          pedirExplicacionIa({
                            tipo_elemento: "tarjeta",
                            nombre: `Estrategia: ${est.nombre}`,
                            cultivo: "maiz",
                            valor: est.roi === null ? 'ROI no calculable' : `${est.roi}% ROI`,
                            unidad: `Margen del supuesto: $${est.margen}/ha`,
                            estado: est.margen > 0 ? 'favorable' : 'riesgoso',
                            descripcion_tecnica: `${est.nombre}. Costo supuesto: $${est.costo}/ha; rendimiento supuesto: ${est.rendimiento} t/ha.`,
                            impacto_base: `Con los valores configurados, el margen calculado es $${est.margen}/ha. Es una comparación hipotética, no un resultado observado.`,
                            recomendacion_base: 'Verifica el costo y el posible cambio productivo con datos locales antes de considerar esta opción.'
                          });
                        }}
                        style={{
                          borderLeft: `3.5px solid ${theme.active}`,
                          borderColor: theme.border,
                          background: theme.bg,
                          padding: '0.6rem 0.85rem',
                          borderRadius: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{est.nombre}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '2px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span>Costo: <strong style={{ color: 'var(--text-muted)' }}>${est.costo}</strong>/ha</span>
                            <span style={{ opacity: 0.5 }}>•</span>
                            <span>Rend: <strong style={{ color: 'var(--text-muted)' }}>{est.rendimiento} t/ha</strong></span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: theme.active, fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                            {est.roi === null ? '—' : `${est.roi}%`} <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-subtle)' }}>ROI</span>
                          </div>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '5px',
                            background: 'var(--zs-inset-surface)',
                            color: est.margen >= 0 ? 'var(--zs-accent)' : 'var(--zi-maize-400)',
                            fontFamily: 'var(--font-mono)',
                            display: 'inline-block'
                          }}>
                            NETO: ${est.margen}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      <AIExplainModal
        isOpen={mostrarModalIa}
        onClose={() => setMostrarModalIa(false)}
        loading={cargandoIa}
        data={datosIa}
      />
    </div>
  );
}
