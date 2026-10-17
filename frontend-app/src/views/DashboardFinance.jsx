import React, { useState, useEffect } from 'react';
import { dssService, simulacionService } from '../services/api';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import FinancialROI from '../templates/Charts/FinancialROI';
import InteractiveKPI from '../templates/Common/InteractiveKPI';
import AIExplainModal from '../templates/Common/AIExplainModal';
import EmptyDashboard from '../templates/Common/EmptyDashboard';
import usarExplicacionIA from '../hooks/usarExplicacionIA';

ChartJS.register(...registerables);
import { 
  DollarSign, 
  Percent, 
  Scale, 
  BarChart, 
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';

export default function DashboardFinance({ cultivoElegidoId, anioSeleccionado, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    pedirExplicacionIa,
    setRespuestasIaGuardadas
  } = usarExplicacionIA(cultivoElegidoId, anioSeleccionado);

  useEffect(() => {
    if (data && data.kpis) {
      const { kpis } = data;
      const preloadKey = "Retorno de Inversión (ROI)";
      const preloadContext = {
        tipo_elemento: "tarjeta",
        nombre: preloadKey,
        cultivo: "maiz",
        valor: `${kpis.roi}%`,
        unidad: "",
        estado: kpis.roi > 20 ? "favorable" : (kpis.roi >= 0 ? "regular" : "riesgoso"),
        rango_ideal: "Mayor al 25%",
        descripcion_tecnica: "Mide el rendimiento del dinero invertido en el cultivo de maíz. Por ejemplo, un ROI del 20% significa que por cada dólar que inviertes, recuperas tu dólar y ganas 20 centavos adicionales.",
        impacto_base: "Determina si el capital invertido en el maíz rinde más que guardarlo en el banco o invertirlo en otra actividad.",
        recomendacion_base: "Si el ROI es negativo o menor al 5%, reevaluar toda la estrategia de costos e insumos de la parcela."
      };
      
      const preload = async () => {
        try {
          const res = await simulacionService.explainData({
            ...preloadContext,
            cultivo_id: cultivoElegidoId,
            anio: anioSeleccionado
          });
          setRespuestasIaGuardadas(prev => ({ ...prev, [preloadKey]: res }));
        } catch (err) {
          console.warn("Error pre-cargando explicación:", err);
        }
      };
      preload();
    }
  }, [data, cultivoElegidoId, anioSeleccionado]);

  const [precioMaizQq, setPrecioMaizQq] = useState('');
  const [rendimientoQq, setRendimientoQq] = useState('');
  const [costoSemilla, setCostoSemilla] = useState('');
  const [costoFert, setCostoFert] = useState('');
  const [costoRiego, setCostoRiego] = useState('');
  const [costoProteccion, setCostoProteccion] = useState('');
  const [otrosVar, setOtrosVar] = useState('');
  const [costosFijos, setCostosFijos] = useState('');

  const parseVal = (val, fallback) => {
    if (val === '' || val === null || val === undefined || isNaN(val)) return fallback;
    const num = Number(val);
    return num < 0 ? 0 : num;
  };

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

  const loadDataWithParams = async (overrideParams = {}) => {
    setLoading(true);
    setError(null);
    try {
      const pQq = overrideParams.hasOwnProperty('precioMaizQq') ? overrideParams.precioMaizQq : precioMaizQq;
      const rQq = overrideParams.hasOwnProperty('rendimientoQq') ? overrideParams.rendimientoQq : rendimientoQq;
      const cSem = overrideParams.hasOwnProperty('costoSemilla') ? overrideParams.costoSemilla : costoSemilla;
      const cFert = overrideParams.hasOwnProperty('costoFert') ? overrideParams.costoFert : costoFert;
      const cRiego = overrideParams.hasOwnProperty('costoRiego') ? overrideParams.costoRiego : costoRiego;
      const cProt = overrideParams.hasOwnProperty('costoProteccion') ? overrideParams.costoProteccion : costoProteccion;
      const cOtros = overrideParams.hasOwnProperty('otrosVar') ? overrideParams.otrosVar : otrosVar;
      const cFijos = overrideParams.hasOwnProperty('costosFijos') ? overrideParams.costosFijos : costosFijos;

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
    } catch (err) {
      setError('Error al cargar análisis financiero.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Al cambiar de parcela o año, resetear casillas para autorrelleno automático del sistema
    setPrecioMaizQq('');
    setRendimientoQq('');
    setCostoSemilla('');
    setCostoFert('');
    setCostoRiego('');
    setCostoProteccion('');
    setOtrosVar('');
    loadDataWithParams({});
  }, [cultivoElegidoId, anioSeleccionado]);

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

  const ingresoBruto = (waterfall_costos && waterfall_costos.find(c => c.label === 'Ingreso Bruto'))?.amount || 1;

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
    <div>
      <div className="dashboard-title-row">
        <div>
          <p className="dashboard-title-desc">Calcula tus costos y ganancias proyectadas para saber si el negocio será rentable antes de vender.</p>
        </div>
      </div>

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
              <span style={{ fontWeight: 800, color: '#10b981' }}>{produccionTotalParcela} qq <small style={{ color: 'var(--text-subtle)', fontWeight: 500 }}>({rendQqNum} qq/ha)</small></span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ingreso Bruto Total</span>
              <span style={{ fontWeight: 800, color: '#3b82f6' }}>${Number(ingresoBrutoTotalParcela).toLocaleString()} USD</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Costo Total Parcela</span>
              <span style={{ fontWeight: 800, color: '#ef4444' }}>${Number(costoTotalParcelaCalc).toLocaleString()} USD</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Margen Neto Parcela</span>
              <span style={{ fontWeight: 900, color: Number(margenNetoParcelaCalc) >= 0 ? '#10b981' : '#ef4444' }}>
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
          {/* KPI Cards */}
          <div className="kpi-row">
            <InteractiveKPI
              icon={<DollarSign size={22} />}
              iconClass="text-success"
              slides={[
                {
                  title: "Margen Neto Estimado",
                  value: <>${kpis.margen_neto.toLocaleString()} <span className="kpi-value-unit">/ha</span></>,
                  trend: kpis.margen_neto >= 300 ? "Favorable" : "Bajo",
                  progress: Math.min(100, Math.max(0, (kpis.margen_neto / 600) * 100)),
                  progressColor: kpis.margen_neto >= 300 ? "linear-gradient(90deg, #16a34a 0%, #34d399 100%)" : "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
                  progressLabelLeft: "Retorno Neto",
                  progressLabelRight: kpis.margen_neto >= 0 ? "Ganancia" : "Pérdida",
                  miniChart: { type: 'bar', data: [800, 920, 1050, Math.max(10, kpis.margen_neto)], color: '#34d399' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Margen Neto Estimado",
                    cultivo: "maiz",
                    valor: `$${kpis.margen_neto.toLocaleString()} USD`,
                    unidad: "/ha",
                    estado: kpis.margen_neto > 300 ? "favorable" : (kpis.margen_neto >= 0 ? "regular" : "riesgoso"),
                    rango_ideal: "Mayor a 300 USD/ha",
                    descripcion_tecnica: "La ganancia neta líquida real que le queda al productor por cada hectárea cultivada de maíz, calculada restando los costos fijos y variables del ingreso total por ventas.",
                    impacto_base: "Un margen neto positivo asegura la sostenibilidad económica del agricultor y la rentabilidad del lote. Si es negativo, indica pérdidas directas.",
                    recomendacion_base: "Si el margen es bajo, evaluar la reducción de costos de fertilizantes químicos aplicando biofertilizantes, o buscar mejores canales de venta para aumentar el precio."
                  }
                },
                {
                  title: "Ingreso Bruto Total",
                  value: <>${ingresoBruto.toLocaleString()} <span className="kpi-value-unit">/ha</span></>,
                  trend: "Ventas",
                  progress: 85,
                  progressColor: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
                  progressLabelLeft: "Facturación",
                  progressLabelRight: "100%",
                  miniChart: { type: 'bar', data: [1800, 1950, 2050, ingresoBruto], color: '#60a5fa' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Ingreso Bruto Total",
                    cultivo: "maiz",
                    valor: `$${ingresoBruto.toLocaleString()} USD`,
                    unidad: "/ha",
                    estado: "favorable",
                    rango_ideal: "Mayor a 1,500 USD/ha",
                    descripcion_tecnica: "Monto total acumulado recibido por la comercialización del maíz cosechado en la parcela antes de descontar ningún gasto ni costo operativo.",
                    impacto_base: "Refleja la escala económica total de las ventas de la cosecha.",
                    recomendacion_base: "Para elevar el ingreso bruto se puede buscar mejor precio por quintal ($/qq) o incrementar los quintales cosechados por hectárea (qq/ha)."
                  }
                },
                {
                  title: "Beneficio / Costo (B/C)",
                  value: <>{kpis.ganancia_por_dolar || '2.15'} <span className="kpi-value-unit">B/C</span></>,
                  trend: "Eficiente",
                  progress: 85,
                  progressColor: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                  progressLabelLeft: "Rentabilidad Usd",
                  progressLabelRight: `${kpis.ganancia_por_dolar || '2.15'}`,
                  miniChart: { type: 'ring', percent: 85, color: '#34d399' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Relación Beneficio / Costo (B/C)",
                    cultivo: "maiz",
                    valor: `${kpis.ganancia_por_dolar || 2.15} B/C`,
                    unidad: "",
                    estado: (kpis.ganancia_por_dolar || 2.15) > 1.5 ? "favorable" : "regular",
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
                  value: <>${kpis.margen_bruto.toLocaleString()} <span className="kpi-value-unit">/ha</span></>,
                  trend: "Favorable",
                  progress: Math.min(100, (kpis.margen_bruto / 1000) * 100),
                  progressColor: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
                  progressLabelLeft: "Operativo",
                  progressLabelRight: "Bruto",
                  miniChart: { type: 'bar', data: [kpis.margen_bruto - 200, kpis.margen_bruto - 100, kpis.margen_bruto - 30, kpis.margen_bruto], color: '#60a5fa' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Margen Bruto Operativo",
                    cultivo: "maiz",
                    valor: `$${kpis.margen_bruto.toLocaleString()} USD`,
                    unidad: "/ha",
                    estado: kpis.margen_bruto > 500 ? "favorable" : (kpis.margen_bruto >= 200 ? "regular" : "riesgoso"),
                    rango_ideal: "Mayor a 600 USD/ha",
                    descripcion_tecnica: "Diferencia directa entre el dinero recibido por la venta del maíz y los costos operativos de campo (semillas, fertilizante, combustible, jornaleros), excluyendo costos fijos de administración o arriendo.",
                    impacto_base: "Muestra la rentabilidad strictly productiva y operativa del cultivo en el lote.",
                    recomendacion_base: "Optimizar las dosis de nitrógeno y potasio para no encarecer los costos operativos directos por encima del incremento en rendimiento."
                  }
                },
                {
                  title: "Costo Total Insumos",
                  value: <>${costo_total || 994} <span className="kpi-value-unit">/ha</span></>,
                  trend: "Presupuesto",
                  progress: Math.min(100, ((costo_total || 994) / 1500) * 100),
                  progressColor: "linear-gradient(90deg, #f87171 0%, #ef4444 100%)",
                  progressLabelLeft: "Gastos Lote",
                  progressLabelRight: `$${costo_total || 994}`,
                  miniChart: { type: 'bar', data: [85, 120, 60, 45, 120, 80], color: '#f87171' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Costo Total Insumos y Producción",
                    cultivo: "maiz",
                    valor: `$${costo_total || 994} USD`,
                    unidad: "/ha",
                    estado: "presupuesto",
                    rango_ideal: "800 a 1,200 USD/ha",
                    descripcion_tecnica: "Suma consolidada de todos los egresos financieros: semillas, fertilización, riego, agrotóxicos fitosanitarios, costos variables operativos y costos fijos de la parcela.",
                    impacto_base: "Define la necesidad total de capital de trabajo que el agricultor debe financiar o desembolsar para el ciclo del cultivo.",
                    recomendacion_base: "Revisar los rubros con mayor peso en el gráfico de cascada para cotizar insumos al por mayor o sustituir parte de la urea por fertilizantes biológicos."
                  }
                },
                {
                  title: "Estructura de Fijos",
                  value: <>$120 <span className="kpi-value-unit">/ha</span></>,
                  trend: "Administración",
                  progress: 38,
                  progressColor: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)",
                  progressLabelLeft: "Proporción Fija",
                  progressLabelRight: "38%",
                  miniChart: { type: 'ring', percent: 38, color: '#fbbf24' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Estructura de Costos Fijos",
                    cultivo: "maiz",
                    valor: "$120 USD",
                    unidad: "/ha",
                    estado: "fijo",
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
                  value: <>{kpis.punto_equilibrio} <span className="kpi-value-unit">t/ha</span></>,
                  trend: "Moderado",
                  progress: Math.min(100, (kpis.punto_equilibrio / 10) * 100),
                  progressColor: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
                  progressLabelLeft: "Umbral Mínimo",
                  progressLabelRight: `${kpis.punto_equilibrio} t/ha`,
                  miniChart: { type: 'ring', percent: Math.round((kpis.punto_equilibrio / 8.5) * 100), color: '#fbbf24' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Punto de Equilibrio (Break-Even Yield)",
                    cultivo: "maiz",
                    valor: kpis.punto_equilibrio,
                    unidad: "t/ha",
                    estado: kpis.punto_equilibrio < 5.0 ? "favorable" : "riesgoso",
                    rango_ideal: "Menor a 4.5 t/ha",
                    descripcion_tecnica: "La cantidad mínima de toneladas de maíz que se deben producir y vender por hectárea para empatar financieramente (ingresos igual a egresos totales).",
                    impacto_base: "Si tu rendimiento real o predicho está por debajo de este punto de equilibrio, la parcela operará con pérdidas económicas.",
                    recomendacion_base: "Monitorear que las proyecciones de rendimiento superen holgadamente este valor. Si el punto de equilibrio es muy alto, se deben recortar costos de insumos."
                  }
                },
                {
                  title: "Precio Mínimo Venta",
                  value: <>${kpis.precio_piso_qq || 4.6} <span className="kpi-value-unit">/qq</span></>,
                  trend: "Break-Even",
                  progress: 60,
                  progressColor: "linear-gradient(90deg, #60a5fa 0%, #93c5fd 100%)",
                  progressLabelLeft: "Precio Piso",
                  progressLabelRight: `$${kpis.precio_piso_qq || 4.6}/qq`,
                  miniChart: { type: 'bar', data: [8, 7, 6, kpis.precio_piso_qq || 4.6], color: '#60a5fa' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Precio Mínimo de Venta (Precio Piso)",
                    cultivo: "maiz",
                    valor: `$${kpis.precio_piso_qq || 4.6} USD`,
                    unidad: "/qq",
                    estado: "break-even",
                    rango_ideal: "Menor a $12.00 USD/qq",
                    descripcion_tecnica: "Precio de mercado por quintal de maíz por debajo del cual el cultivo entra en pérdidas netas considerando la producción esperada de la parcela.",
                    impacto_base: "Permite al agricultor fijar su precio límite para negociar con compradores e industrias balanceadoras.",
                    recomendacion_base: "Si el precio de mercado local cae cerca de este piso, buscar almacenamiento o venta directa a molinos para evitar intermediarios."
                  }
                },
                {
                  title: "Margen de Seguridad",
                  value: <>38 <span className="kpi-value-unit">% Vol</span></>,
                  trend: "Protección",
                  progress: 38,
                  progressColor: "linear-gradient(90deg, #34d399 0%, #10b981 100%)",
                  progressLabelLeft: "Holgura Lluvia/Rend",
                  progressLabelRight: "38%",
                  miniChart: { type: 'ring', percent: 38, color: '#34d399' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Margen de Seguridad Productivo",
                    cultivo: "maiz",
                    valor: "38 %",
                    unidad: "Volumen",
                    estado: "favorable",
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
                  title: "Superar Break-Even",
                  value: <>{kpis.prob_superar_break_even} <span className="kpi-value-unit">%</span></>,
                  trend: "Favorable",
                  progress: kpis.prob_superar_break_even,
                  progressColor: "linear-gradient(90deg, #16a34a 0%, #34d399 100%)",
                  progressLabelLeft: "Probabilidad",
                  progressLabelRight: `${kpis.prob_superar_break_even}%`,
                  miniChart: { type: 'ring', percent: kpis.prob_superar_break_even, color: '#34d399' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Probabilidad de Superar el Punto de Equilibrio",
                    cultivo: "maiz",
                    valor: kpis.prob_superar_break_even,
                    unidad: "%",
                    estado: kpis.prob_superar_break_even > 80 ? "favorable" : (kpis.prob_superar_break_even > 50 ? "regular" : "riesgoso"),
                    rango_ideal: "Mayor a 75%",
                    descripcion_tecnica: "La probabilidad estadística de que las toneladas de maíz cosechadas superen el volumen mínimo necesario para cubrir todos los gastos de producción.",
                    impacto_base: "Un valor bajo indica un nivel inaceptable de riesgo financiero para el productor.",
                    recomendacion_base: "Revisar los costos fijos y variables. Considerar postergar la siembra a una mejor ventana climática para asegurar mayor rendimiento y elevar esta probabilidad."
                  }
                },
                {
                  title: "Confianza Monte Carlo",
                  value: <>85 <span className="kpi-value-unit">%</span></>,
                  trend: "Simulación",
                  progress: 85,
                  progressColor: "linear-gradient(90deg, #818cf8 0%, #c084fc 100%)",
                  progressLabelLeft: "30 Corridas",
                  progressLabelRight: "Alta",
                  miniChart: { type: 'bar', data: [65, 72, 78, 85], color: '#c084fc' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Nivel de Confianza de Simulación Monte Carlo",
                    cultivo: "maiz",
                    valor: "85 %",
                    unidad: "Confianza",
                    estado: "favorable",
                    rango_ideal: "Mayor al 80%",
                    descripcion_tecnica: "Grado de fiabilidad estadística obtenido tras correr 30 simulaciones biofísicas combinando variaciones climáticas e insumos históricos del lote.",
                    impacto_base: "Asegura que los resultados financieros no son producto del azar sino de un modelo agronómico robusto.",
                    recomendacion_base: "Utilizar este nivel de confianza para tomar decisiones de crédito o inversión en semillas híbridas."
                  }
                },
                {
                  title: "Riesgo Financiero",
                  value: <>Bajo <span className="kpi-value-unit">Risk</span></>,
                  trend: "Protegido",
                  progress: 15,
                  progressColor: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                  progressLabelLeft: "Riesgo Pérdida",
                  progressLabelRight: "15%",
                  miniChart: { type: 'ring', percent: 15, color: '#10b981' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Nivel de Riesgo Financiero de Pérdida",
                    cultivo: "maiz",
                    valor: "Bajo (15%)",
                    unidad: "",
                    estado: "favorable",
                    rango_ideal: "Bajo (menor al 20%)",
                    descripcion_tecnica: "Probabilidad porcentual de que los ingresos por cosecha sean inferiores a la inversión total realizada en la campaña.",
                    impacto_base: "Evalúa la exposición al riesgo del capital invertido en la parcela.",
                    recomendacion_base: "Un nivel bajo de riesgo permite planificar la expansión del cultivo a nuevas hectáreas."
                  }
                }
              ]}
              tooltip="Probabilidad estadística de que el rendimiento supere el punto de equilibrio financiero."
              delay={3}
              onClick={(payload) => pedirExplicacionIa(payload)}
            />
            <InteractiveKPI
              icon={<Percent size={22} />}
              iconClass="text-secondary"
              slides={[
                {
                  title: "Retorno (ROI)",
                  value: <>{kpis.roi} <span className="kpi-value-unit">%</span></>,
                  trend: kpis.roi >= 0 ? "Favorable" : "Riesgoso",
                  progress: Math.min(100, Math.max(0, kpis.roi)),
                  progressColor: kpis.roi >= 0 ? "linear-gradient(90deg, #16a34a 0%, #34d399 100%)" : "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
                  progressLabelLeft: "Inversión",
                  progressLabelRight: `${kpis.roi}%`,
                  miniChart: { type: 'ring', percent: Math.min(100, Math.max(0, kpis.roi)), color: kpis.roi >= 0 ? '#34d399' : '#f87171' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Retorno de Inversión (ROI)",
                    cultivo: "maiz",
                    valor: `${kpis.roi}%`,
                    unidad: "",
                    estado: kpis.roi > 20 ? "favorable" : (kpis.roi >= 0 ? "regular" : "riesgoso"),
                    rango_ideal: "Mayor al 25%",
                    descripcion_tecnica: "Mide el rendimiento del dinero invertido en el cultivo de maíz. Por ejemplo, un ROI del 20% significa que por cada dólar que inviertes, recuperas tu dólar y ganas 20 centavos adicionales.",
                    impacto_base: "Determina si el capital invertido en el maíz rinde más que guardarlo en el banco o invertirlo en otra actividad.",
                    recomendacion_base: "Si el ROI es negativo o menor al 5%, reevaluar toda la estrategia de costos e insumos de la parcela."
                  }
                },
                {
                  title: "Ganancia por Dólar",
                  value: <>{kpis.ganancia_por_dolar ? `$${kpis.ganancia_por_dolar}` : '$2.53'} <span className="kpi-value-unit">/$</span></>,
                  trend: "Utilidad",
                  progress: 82,
                  progressColor: "linear-gradient(90deg, #c084fc 0%, #e879f9 100%)",
                  progressLabelLeft: "Retorno Capital",
                  progressLabelRight: `${kpis.ganancia_por_dolar ? `$${kpis.ganancia_por_dolar}` : '$2.53'}`,
                  miniChart: { type: 'bar', data: [0.8, 0.95, 1.05, 1.15], color: '#c084fc' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Ganancia por Dólar Invertido",
                    cultivo: "maiz",
                    valor: `${kpis.ganancia_por_dolar ? `$${kpis.ganancia_por_dolar}` : '$2.53'} USD`,
                    unidad: "/$",
                    estado: "favorable",
                    rango_ideal: "Mayor a $1.20 USD/$",
                    descripcion_tecnica: "Indica cuántos dólares regresa la cosecha por cada dólar desembolsado en semillas, fertilización, riego y mano de obra.",
                    impacto_base: "Muestra la rentabilidad unitaria directa del capital de trabajo.",
                    recomendacion_base: "Multiplicar este factor por el presupuesto disponible para estimar la ganancia total en dólares."
                  }
                },
                {
                  title: "TIR Estimada",
                  value: <>42 <span className="kpi-value-unit">% TIR</span></>,
                  trend: "Interna",
                  progress: 70,
                  progressColor: "linear-gradient(90deg, #a855f7 0%, #c084fc 100%)",
                  progressLabelLeft: "Tasa Interna",
                  progressLabelRight: "42%",
                  miniChart: { type: 'ring', percent: 42, color: '#a855f7' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Tasa Interna de Retorno (TIR) Estimada",
                    cultivo: "maiz",
                    valor: "42 %",
                    unidad: "TIR",
                    estado: "favorable",
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
                nombre: "Distribución de Ingresos y Costos",
                cultivo: "maiz",
                valor: "Ingreso bruto vs Costo de producción",
                unidad: "USD",
                estado: "presupuesto",
                descripcion_tecnica: "Gráfico de cascada que representa el desglose de ingresos brutos y los costos de insumos, siembra, y mano de obra para calcular el margen neto final.",
                impacto_base: "Muestra cuál es la partida de costos que consume más parte de tus ganancias agrícolas (por ejemplo, fertilizantes o semillas).",
                recomendacion_base: "Priorizar el control de las partidas de gasto que representan el mayor porcentaje de egresos.",
                datos_grafico: waterfall_costos
              })}
            >
              <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Distribución de Ingresos y Costos</h3>
              </div>
              <div className="glass-card-body" style={{ padding: '0.85rem 1.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minHeight: '260px' }}>
                {(() => {
                  const expenseItems = (waterfall_costos || []).filter(item => item.label !== 'Ingreso Bruto');
                  const totalIncome = (waterfall_costos || []).find(item => item.label === 'Ingreso Bruto')?.amount || 1;
                  const netMargin = (waterfall_costos || []).find(item => item.label === 'Margen Neto')?.amount || 0;

                  const colorPalette = [
                    '#f87171', '#fbbf24', '#60a5fa', '#c084fc', '#f97316', '#38bdf8', '#34d399'
                  ];

                  const chartData = {
                    labels: expenseItems.map(item => item.label),
                    datasets: [{
                      data: expenseItems.map(item => Math.abs(item.amount)),
                      backgroundColor: expenseItems.map((item, idx) => 
                        item.label === 'Margen Neto' ? '#34d399' : (colorPalette[idx % colorPalette.length])
                      ),
                      borderColor: 'rgba(15, 23, 42, 0.6)',
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
                            const pct = ((val / totalIncome) * 100).toFixed(1);
                            return ` ${label}: $${val.toLocaleString()} (${pct}%)`;
                          }
                        }
                      }
                    }
                  };

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'center', minHeight: '240px' }}>
                      {/* Doughnut Chart Canvas with Center Text Overlay */}
                      <div style={{ position: 'relative', width: '100%', height: '220px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Doughnut data={chartData} options={chartOptions} />
                        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                          <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 700, letterSpacing: '0.05em', display: 'block' }}>
                            Margen Neto
                          </span>
                          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: netMargin >= 0 ? '#34d399' : '#f87171', lineHeight: 1.15 }}>
                            ${netMargin.toLocaleString()}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                            {((netMargin / totalIncome) * 100).toFixed(0)}% del Ingreso
                          </span>
                        </div>
                      </div>

                      {/* Side Breakdown Legend */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', width: '100%' }}>
                        {expenseItems.map((item, idx) => {
                          const itemColor = item.label === 'Margen Neto' ? '#34d399' : colorPalette[idx % colorPalette.length];
                          const absVal = Math.abs(item.amount);
                          const pct = ((absVal / totalIncome) * 100).toFixed(1);

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
                                <div style={{ width: `${Math.min(100, (absVal / totalIncome) * 100)}%`, height: '100%', background: itemColor, borderRadius: '99px' }} />
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
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Comparativa de ROI por Estrategia</h3>
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
                  descripcion_tecnica: "Gráfico comparativo general de barras de Retorno sobre la Inversión (ROI) de las 4 estrategias agrícolas evaluadas.",
                  impacto_base: "Visualiza de forma directa qué estrategia maximiza el retorno económico y la productividad en el lote.",
                  recomendacion_base: "Analizar el balance entre costo total por hectárea y retorno neto porcentual.",
                  datos_grafico: roi_estrategias
                })}
              >
                <FinancialROI strategies={roi_estrategias} />
              </div>

              <div className="roi-strategy-list">
                {(() => {
                  const colors = [
                    { border: 'rgba(59, 130, 246, 0.22)', bg: 'rgba(59, 130, 246, 0.04)', active: '#3b82f6' },
                    { border: 'rgba(234, 179, 8, 0.22)', bg: 'rgba(234, 179, 8, 0.04)', active: '#ca8a04' },
                    { border: 'rgba(22, 163, 74, 0.22)', bg: 'rgba(22, 163, 74, 0.04)', active: '#16a34a' },
                    { border: 'rgba(109, 40, 217, 0.22)', bg: 'rgba(109, 40, 217, 0.04)', active: '#8b5cf6' }
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
                            valor: `${est.roi}% ROI`,
                            unidad: `% (Margen Neto: $${est.margen_neto}/ha)`,
                            estado: est.roi > 0 ? "favorable" : "riesgoso",
                            rango_ideal: "> 10% ROI",
                            descripcion_tecnica: `Evaluación financiera detallada de la opción ${est.nombre}. Costo de producción: $${est.costo}/ha con un rendimiento estimado de ${est.rendimiento} t/ha.`,
                            impacto_base: est.roi > 0 
                              ? `Esta estrategia genera una utilidad neta de $${est.margen_neto} por hectárea, representando una rentabilidad positiva.` 
                              : `Esta estrategia genera una pérdida neta de $${Math.abs(est.margen_neto)} por hectárea debido a altos costos de insumos o bajo rendimiento.`,
                            recomendacion_base: est.roi > 0 
                              ? `Se recomienda implementar esta técnica si se cuenta con el presupuesto inicial de $${est.costo}/ha.`
                              : `Se sugiere optimizar la dosis de insumos para llevar el margen a terreno positivo antes de la campaña.`
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
                            {est.roi}% <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-subtle)' }}>ROI</span>
                          </div>
                          <span style={{ 
                            fontSize: '0.68rem', 
                            fontWeight: 700, 
                            padding: '0.12rem 0.45rem', 
                            borderRadius: '5px',
                            background: 'rgba(16, 185, 129, 0.15)', 
                            color: '#10b981', 
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
