import { useCallback, useRef, useState, useEffect } from 'react';
import { dssService } from '../services/api';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import FinancialROI from '../templates/Charts/FinancialROI';
import InteractiveKPI from '../templates/Common/InteractiveKPI';
import SimulationInfoCard from '../templates/Common/SimulationInfoCard';
import { DashboardSectionHeading } from '../templates/Common/DashboardSectionHeading';
import useExplicacionIA from '../hooks/usarExplicacionIA';
import useTema from '../hooks/useTema';
import { financeNumber as toFiniteNumber, financeInputNumber, financeInputText, financeBudgetPreview, financeSourceLabel } from '../utils/financeBudget';

ChartJS.register(...registerables);
import { 
  DollarSign, 
  Percent, 
  Scale, 
  Sparkles,
  Info
} from 'lucide-react';

const formatCurrency = (value) => toFiniteNumber(value) === null
  ? 'No disponible'
  : `$${Number(value).toLocaleString('es-EC', { maximumFractionDigits: 2 })}`;
const formatNumber = (value, digits = 2) => toFiniteNumber(value) === null ? 'No disponible' : Number(value).toLocaleString('es-EC', { maximumFractionDigits: digits });

export default function DashboardFinance({ cultivoElegidoId, añoSeleccionado, onNavigate, onDashboardData }) {
  const temaClaro = useTema();
  const [snapshot, setSnapshot] = useState(null);
  const selectionKey = JSON.stringify([cultivoElegidoId ?? null, añoSeleccionado ?? null]);
  const data = snapshot?.key === selectionKey ? snapshot.data : null;
  const currentRequest = useRef(0);
  const inputVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    pedirExplicacionIa
  } = useExplicacionIA(cultivoElegidoId, añoSeleccionado);

  const [precioMaizQq, setPrecioMaizQq] = useState('');
  const [rendimientoQq, setRendimientoQq] = useState('');
  const [costoSemilla, setCostoSemilla] = useState('');
  const [costoFert, setCostoFert] = useState('');
  const [costoRiego, setCostoRiego] = useState('');
  const [costoProteccion, setCostoProteccion] = useState('');
  const [otrosVar, setOtrosVar] = useState('');
  const [costosFijos, setCostosFijos] = useState('');

  const handleInput = (setter) => (e) => {
    ++inputVersion.current;
    setActivePreset(null);
    let raw = e.target.value;
    if (raw === '' || raw === null) {
      setter('');
      return;
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
    const request = ++currentRequest.current;
    const editsAtRequest = inputVersion.current;
    const requestKey = JSON.stringify([cultivoElegidoId ?? null, añoSeleccionado ?? null]);
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

      const res = await dssService.getFinancieroData({
        parcelaId: cultivoElegidoId,
        año: añoSeleccionado,
        precioMaizQq: financeInputNumber(pQq),
        rendimientoQq: financeInputNumber(rQq),
        costoSemilla: financeInputNumber(cSem),
        costoFert: financeInputNumber(cFert),
        costoRiego: financeInputNumber(cRiego),
        costoProteccion: financeInputNumber(cProt),
        otrosVar: financeInputNumber(cOtros),
        costosFijos: financeInputNumber(cFijos)
      });
      if (request !== currentRequest.current) return;
      setSnapshot({ key: requestKey, data: res });

      // Autorrellenar casillas automáticamente con los datos calculados del sistema si están vacías
      if (res?.datos_base_sistema && inputVersion.current === editsAtRequest) {
        const base = res.datos_base_sistema;
        if (pQq === '' || pQq === null) setPrecioMaizQq(financeInputText(base.precio_maiz_qq));
        if (rQq === '' || rQq === null) setRendimientoQq(financeInputText(base.rendimiento_qq));
        if (cSem === '' || cSem === null) setCostoSemilla(financeInputText(base.costo_semilla));
        if (cFert === '' || cFert === null) setCostoFert(financeInputText(base.costo_fert));
        if (cRiego === '' || cRiego === null) setCostoRiego(financeInputText(base.costo_riego));
        if (cProt === '' || cProt === null) setCostoProteccion(financeInputText(base.costo_proteccion));
        if (cOtros === '' || cOtros === null) setOtrosVar(financeInputText(base.otros_var));
        if (cFijos === '' || cFijos === null) setCostosFijos(financeInputText(base.costos_fijos));
      }
    } catch {
      if (request === currentRequest.current) setError('Error al cargar análisis financiero.');
    } finally {
      if (request === currentRequest.current) setLoading(false);
    }
  }, [
    añoSeleccionado,
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
    ++currentRequest.current;
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
    const requestRef = currentRequest;
    return () => { clearTimeout(refresh); ++requestRef.current; };
  }, [cultivoElegidoId, añoSeleccionado]);

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
      const p = financeInputText(base.precio_maiz_qq);
      const r = financeInputText(base.rendimiento_qq);
      const s = financeInputText(base.costo_semilla);
      const f = financeInputText(base.costo_fert);
      const rg = financeInputText(base.costo_riego);
      const pr = financeInputText(base.costo_proteccion);
      const ot = financeInputText(base.otros_var);
      const fj = financeInputText(base.costos_fijos);

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

  const preview = financeBudgetPreview({ precioMaizQq, rendimientoQq, costoSemilla, costoFert, costoRiego, costoProteccion, otrosVar, costosFijos }, data?.kpis?.area_parcela ?? data?.datos_base_sistema?.area_parcela);
  const areaParcela = preview.area;
  const nombreParcela = data?.kpis?.nombre_parcela ?? data?.datos_base_sistema?.nombre_parcela ?? 'Sin parcela seleccionada';
  const rendQqNum = preview.yieldQq;
  const produccionTotalParcela = preview.production;
  const ingresoBrutoTotalParcela = preview.revenue;
  const costoTotalParcelaCalc = preview.cost;
  const margenNetoParcelaCalc = preview.margin;

  const [activePreset, setActivePreset] = useState(null);

  const applyPreset = (presetType) => {
    setActivePreset(presetType);
    let p;
    if (presetType === 'tradicional') {
      p = { rend: '50', semilla: '60', fert: '90', riego: '0', proteccion: '35', otros: '50', fijos: '80' };
    } else if (presetType === 'semitecnificado') {
      p = { rend: '85', semilla: '95', fert: '150', riego: '40', proteccion: '55', otros: '80', fijos: '110' };
    } else if (presetType === 'tecnificado') {
      p = { rend: '130', semilla: '120', fert: '210', riego: '80', proteccion: '75', otros: '110', fijos: '150' };
    }
    if (!p) return;
    p.precio = financeInputText(precioMaizQq) || financeInputText(data?.datos_base_sistema?.precio_maiz_qq);

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

  const { kpis = {}, costo_total } = data ?? {};
  const sensibilidad = Array.isArray(data?.sensibilidad) ? data.sensibilidad : [];
  const precios_rango = Array.isArray(data?.precios_rango) ? data.precios_rango : [];
  const rendimientos_rango = Array.isArray(data?.rendimientos_rango) ? data.rendimientos_rango : [];
  const roi_estrategias = Array.isArray(data?.roi_estrategias) ? data.roi_estrategias : [];
  const waterfall_costos = Array.isArray(data?.waterfall_costos) ? data.waterfall_costos : [];

  const ingresoBruto = toFiniteNumber(
    (waterfall_costos && waterfall_costos.find(c => c.label === 'Ingreso Bruto'))?.amount
      ?? kpis.ingreso_bruto
      ?? kpis.ingreso_bruto_parcela
  );
  const margenNeto = toFiniteNumber(kpis.margen_neto);
  const margenBruto = toFiniteNumber(kpis.margen_bruto);
  const costoTotal = toFiniteNumber(costo_total);
  const beneficioCosto = ingresoBruto !== null && costoTotal !== null && costoTotal > 0
    ? Number((ingresoBruto / costoTotal).toFixed(2))
    : null;
  const costosFijosKpi = toFiniteNumber(kpis.costos_fijos ?? kpis.costo_fijo ?? data?.datos_base_sistema?.costos_fijos);
  const puntoEquilibrio = toFiniteNumber(kpis.punto_equilibrio);
  const precioPiso = toFiniteNumber(kpis.precio_piso_qq);
  const margenSeguridad = toFiniteNumber(kpis.margen_seguridad ?? kpis.margen_seguridad_pct);
  const fraccionCubreCostos = toFiniteNumber(data?.resumen_descriptivo?.fraccion_cubre_costos_pct);
  const muestraDescriptiva = toFiniteNumber(data?.resumen_descriptivo?.muestra);
  const probabilidadCalibrada = toFiniteNumber(kpis.prob_superar_break_even);
  const retornoInversion = toFiniteNumber(kpis.roi);
  const gananciaPorDolar = toFiniteNumber(kpis.ganancia_por_dolar);
  const tirEstimada = toFiniteNumber(kpis.tir ?? kpis.tir_estimada);
  const riesgoFinanciero = String(kpis.riesgo_financiero?.nivel ?? kpis.riesgo_financiero ?? '').trim();
  const riesgoEstado = /alto|elevado|critico|crítico/i.test(riesgoFinanciero) ? 'riesgoso' : (/bajo/i.test(riesgoFinanciero) ? 'favorable' : 'regular');

  const getSensibilidadCardStyle = (marginVal) => {
    const isLight = temaClaro;
    if (marginVal === null) return { background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', boxShadow: 'none' };
    if (marginVal < 0) {
      return {
        background: isLight 
          ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.95) 0%, rgba(254, 202, 202, 0.65) 100%)' 
          : 'linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, rgba(239, 68, 68, 0.12) 100%)',
        border: isLight ? '1.5px solid #e5a379' : '1.5px solid rgba(239, 68, 68, 0.55)',
        color: isLight ? '#991b1b' : '#fca5a5',
        boxShadow: isLight ? '0 2px 8px rgba(239, 68, 68, 0.12)' : '0 4px 12px rgba(239, 68, 68, 0.18)'
      };
    }
    if (marginVal <= 250) {
      return {
        background: isLight 
          ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.95) 0%, rgba(253, 230, 138, 0.65) 100%)' 
          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.28) 0%, rgba(245, 158, 11, 0.12) 100%)',
        border: isLight ? '1.5px solid #b78425' : '1.5px solid rgba(245, 158, 11, 0.55)',
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
      <DashboardSectionHeading level={1} label="01 · Supuestos" title="Configura tu escenario económico" description="Introduce un presupuesto hipotético o selecciona un ejemplo ilustrativo y pulsa Calcular. Los valores no acreditan costos ni cosechas observadas." />
      {data?.sin_datos && <p>{data.mensaje ?? 'No hay simulaciones para este periodo. Puedes introducir un rendimiento y un presupuesto hipotéticos.'} {onNavigate && <button type="button" className="btn btn-secondary" onClick={() => onNavigate('simular')}>Ir a simulación</button>}</p>}
      {!cultivoElegidoId && <p>Sin parcela seleccionada: puedes calcular por hectárea; los totales de parcela requieren una superficie registrada.</p>}

      {/* Form Container: Parámetros de Mercado, Producción y Costos */}
      <div className="glass-panel" style={{ marginBottom: '1.25rem' }}>
        <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Parámetros de mercado, producción y costos</h2>

          {/* Plantillas Rápidas de Mercado con Estilo del Sistema y Botón de Información */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-subtle)', marginRight: '0.2rem' }}>
              Ejemplos hipotéticos:
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
              Supuesto tradicional
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
              Supuesto semitecnificado
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
              Supuesto tecnificado
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
                border: '1.5px solid #70a984',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--zs-success)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginLeft: '0.4rem'
              }}
              title="Copiar los valores disponibles en la última respuesta, conservando sus fuentes y campos ausentes"
            >
              <Sparkles size={13} /> Usar valores del análisis
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
                descripcion_tecnica: "Ejemplos hipotéticos de rendimiento y costos para explorar el formulario. No son datos de mercado, rendimientos observados ni recomendaciones de manejo.",
                impacto_base: "Permiten comparar resultados condicionados a los supuestos ingresados.",
                recomendacion_base: "Sustituye los ejemplos por tus costos y un rendimiento documentado antes de usar el presupuesto."
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
          {data?.supuestos && <details><summary>Origen de los valores del escenario</summary><p>{data.supuestos.nota}</p><ul>{Object.entries(data.supuestos.fuentes ?? {}).map(([field, source]) => <li key={field}>{({ precio_maiz_qq: 'Precio', rendimiento_qq: 'Rendimiento', costo_semilla: 'Semillas', costo_fert: 'Fertilización', costo_riego: 'Riego', costo_proteccion: 'Fitosanitarios', otros_var: 'Otros variables', costos_fijos: 'Costos fijos' })[field] ?? field}: {financeSourceLabel(source)}</li>)}</ul></details>}
          <form onSubmit={handleRecalculate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                PRECIO MAÍZ ($/qq)
                <span title="Precio de venta estimado en finca por quintal (45.36 kg / 100 lb) de grano seco." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="text" inputMode="decimal" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={precioMaizQq} onChange={handleInput(setPrecioMaizQq)} placeholder="Sin dato" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                RENDIMIENTO (qq/ha)
                <span title="Rendimiento supuesto por hectárea en quintales; puede provenir de simulaciones guardadas o de tu entrada manual." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="text" inputMode="decimal" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={rendimientoQq} onChange={handleInput(setRendimientoQq)} placeholder="Sin dato" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                SEMILLAS ($/ha)
                <span title="Costo de adquisición del híbrido de maíz seleccionado y curado de semilla por hectárea." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="text" inputMode="decimal" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costoSemilla} onChange={handleInput(setCostoSemilla)} placeholder="Sin dato" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                FERTILIZACIÓN ($/ha)
                <span title="Inversión en fertilizantes edáficos y foliares (Urea, DAP, KCl, micronutrientes) por hectárea." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="text" inputMode="decimal" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costoFert} onChange={handleInput(setCostoFert)} placeholder="Sin dato" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                RIEGO ($/ha)
                <span title="Costo operativo del agua: energía de bombeo, mantenimiento de tuberías o canon de riego por hectárea." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="text" inputMode="decimal" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costoRiego} onChange={handleInput(setCostoRiego)} placeholder="Sin dato" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                FITOSANITARIOS ($/ha)
                <span title="Inversión en plaguicidas, herbicidas pre y post-emergentes, fungicidas e insecticidas por hectárea." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="text" inputMode="decimal" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costoProteccion} onChange={handleInput(setCostoProteccion)} placeholder="Sin dato" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                OTROS C. VAR. ($/ha)
                <span title="Costos variables operativos: mano de obra, alquiler de tractor o cosechadora combinada, flete del grano." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="text" inputMode="decimal" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={otrosVar} onChange={handleInput(setOtrosVar)} placeholder="Sin dato" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.67rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                C. FIJOS ($/ha)
                <span title="Gastos fijos obligatorios: arriendo de tierra, administración y supervisión del lote." style={{ cursor: 'help', color: 'var(--text-subtle)', fontWeight: 'bold' }}>ⓘ</span>
              </label>
              <input type="text" inputMode="decimal" onKeyDown={preventNegativeKeys} className="form-input" style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }} value={costosFijos} onChange={handleInput(setCostosFijos)} placeholder="Sin dato" />
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
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Superficie de la parcela</span>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{nombreParcela} ({formatNumber(areaParcela)} ha)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cosecha total de la parcela</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{formatNumber(produccionTotalParcela, 1)} qq <small style={{ color: 'var(--text-subtle)', fontWeight: 500 }}>({formatNumber(rendQqNum)} qq/ha)</small></span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ingreso bruto total</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-secondary)' }}>{formatCurrency(ingresoBrutoTotalParcela)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Costo total de la parcela</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-warning)' }}>{formatCurrency(costoTotalParcelaCalc)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Margen neto de la parcela</span>
              <span style={{ fontWeight: 900, color: margenNetoParcelaCalc === null ? 'var(--text-muted)' : (margenNetoParcelaCalc >= 0 ? 'var(--accent-primary)' : 'var(--accent-warning)') }}>
                {formatCurrency(margenNetoParcelaCalc)}
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
                  title: "Margen neto estimado",
                  value: margenNeto === null ? 'No disponible' : <>{formatCurrency(margenNeto)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: margenNeto === null,
                  trend: margenNeto === null ? "Sin dato" : (margenNeto >= 0 ? "Margen positivo" : "Pérdida estimada"),
                  severity: margenNeto !== null && margenNeto < 0 ? { level: "danger", label: "Pérdida estimada" } : null,
                  progress: null,
                  progressColor: margenNeto !== null && margenNeto >= 300 ? "linear-gradient(90deg, #176441 0%, #88bd98 100%)" : "linear-gradient(90deg, #b78425 0%, #d8a83f 100%)",
                  progressLabelLeft: "Retorno Neto",
                  progressLabelRight: margenNeto === null ? "Sin dato" : (margenNeto >= 0 ? "Ganancia" : "Pérdida"),
                  // No se inventa una serie histórica: la API sólo entrega el valor actual.
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Margen neto estimado",
                    cultivo: "maiz",
                    valor: margenNeto === null ? null : `${formatCurrency(margenNeto)} USD`,
                    unidad: "/ha",
                    estado: margenNeto === null ? "sin_datos" : (margenNeto > 300 ? "favorable" : (margenNeto >= 0 ? "regular" : "riesgoso")),
                    descripcion_tecnica: "Ingreso estimado menos costos fijos y variables configurados, expresado por hectárea. No es una utilidad observada.",
                    impacto_base: "Un margen positivo indica que este escenario cubriría los costos ingresados; no garantiza la rentabilidad real de la campaña.",
                    recomendacion_base: "Revisa primero el precio, el rendimiento y los rubros de costo que más afectan el margen."
                  }
                },
                {
                  title: "Ingreso Bruto Total",
                  value: ingresoBruto === null ? 'No disponible' : <>{formatCurrency(ingresoBruto)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: ingresoBruto === null,
                  trend: ingresoBruto === null ? "Sin dato" : "Ventas",
                  progress: null,
                  progressColor: "linear-gradient(90deg, #286f9b 0%, #9ed1ff 100%)",
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
                    descripcion_tecnica: "Valor de ventas proyectado por hectárea: rendimiento del escenario multiplicado por precio configurado, antes de descontar costos.",
                    impacto_base: "Permite comparar ingresos potenciales entre escenarios; todavía no representa ventas realizadas.",
                    recomendacion_base: "Para elevar el ingreso bruto se puede buscar mejor precio por quintal ($/qq) o incrementar los quintales cosechados por hectárea (qq/ha)."
                  }
                },
                {
                  title: "Beneficio / Costo (B/C)",
                  value: beneficioCosto === null ? 'No disponible' : <>{beneficioCosto.toLocaleString('es-EC', { maximumFractionDigits: 2 })} <span className="kpi-value-unit">B/C</span></>,
                  isMissing: beneficioCosto === null,
                  trend: beneficioCosto === null ? "Sin dato" : (beneficioCosto >= 1 ? "Cubre costos" : "Bajo equilibrio"),
                  severity: beneficioCosto !== null && beneficioCosto < 1 ? { level: "warning", label: "No cubre costos" } : null,
                  progress: null,
                  progressColor: "linear-gradient(90deg, #70a984 0%, #88bd98 100%)",
                  progressLabelLeft: "Rentabilidad Usd",
                  progressLabelRight: beneficioCosto === null ? "Sin dato" : beneficioCosto.toLocaleString('es-EC', { maximumFractionDigits: 2 }),
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Relación Beneficio / Costo (B/C)",
                    cultivo: "maiz",
                    valor: beneficioCosto === null ? null : `${beneficioCosto} B/C`,
                    unidad: "",
                    estado: beneficioCosto === null ? "sin_datos" : (beneficioCosto >= 1 ? "favorable" : "riesgoso"),
                    descripcion_tecnica: "Índice financiero que resulta de dividir los ingresos brutos totales entre los costos totales. Muestra cuántos dólares en ventas brutas genera cada dólar invertido.",
                    impacto_base: "Un valor superior a 1 cubre los costos del escenario; no incorpora incertidumbre de precio ni de cosecha.",
                    recomendacion_base: "Contrasta la relación B/C con el margen neto y la sensibilidad antes de decidir."
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
                  title: "Margen bruto operativo",
                  value: margenBruto === null ? 'No disponible' : <>{formatCurrency(margenBruto)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: margenBruto === null,
                  trend: margenBruto === null ? "Sin dato" : (margenBruto >= 500 ? "Favorable" : "Regular"),
                  progress: null,
                  progressColor: "linear-gradient(90deg, #286f9b 0%, #9ed1ff 100%)",
                  progressLabelLeft: "Operativo",
                  progressLabelRight: "Bruto",
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Margen bruto operativo",
                    cultivo: "maiz",
                    valor: margenBruto === null ? null : `${formatCurrency(margenBruto)} USD`,
                    unidad: "/ha",
                    estado: margenBruto === null ? "sin_datos" : (margenBruto > 500 ? "favorable" : (margenBruto >= 200 ? "regular" : "riesgoso")),
                    descripcion_tecnica: "Ingreso proyectado menos costos variables configurados, antes de descontar los costos fijos.",
                    impacto_base: "Permite ver cuánto contribuye la operación del cultivo a cubrir los costos fijos del escenario.",
                    recomendacion_base: "Contrasta los costos operativos con cotizaciones y gastos propios del lote."
                  }
                },
                {
                  title: "Costo Total Insumos",
                  value: costoTotal === null ? 'No disponible' : <>{formatCurrency(costoTotal)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: costoTotal === null,
                  trend: costoTotal === null ? "Sin dato" : "Presupuesto",
                  progress: null,
                  progressColor: "linear-gradient(90deg, #e5a379 0%, #af5437 100%)",
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
                    descripcion_tecnica: "Suma de semilla, fertilización, riego, protección, otros costos variables y costos fijos configurados por hectárea.",
                    impacto_base: "Define la necesidad total de capital de trabajo que el agricultor debe financiar o desembolsar para el ciclo del cultivo.",
                    recomendacion_base: "Revisar los rubros con mayor peso en el gráfico de cascada para cotizar insumos al por mayor o sustituir parte de la urea por fertilizantes biológicos."
                  }
                },
                {
                  title: "Estructura de Fijos",
                  value: costosFijosKpi === null ? 'No disponible' : <>{formatCurrency(costosFijosKpi)} <span className="kpi-value-unit">/ha</span></>,
                  isMissing: costosFijosKpi === null,
                  trend: costosFijosKpi === null ? "Sin dato" : "Administración",
                  progress: costosFijosKpi === null || !costoTotal ? null : Math.min(100, (costosFijosKpi / costoTotal) * 100),
                  progressColor: "linear-gradient(90deg, #d8a83f 0%, #b78425 100%)",
                  progressLabelLeft: "Proporción Fija",
                  progressLabelRight: costosFijosKpi === null || !costoTotal ? "Sin dato" : `${Math.min(100, Math.round((costosFijosKpi / costoTotal) * 100))}% del costo`,
                  miniChart: costosFijosKpi === null || !costoTotal ? null : { type: 'ring', percent: Math.min(100, (costosFijosKpi / costoTotal) * 100), color: '#d8a83f' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Estructura de Costos Fijos",
                    cultivo: "maiz",
                    valor: costosFijosKpi === null ? null : `${formatCurrency(costosFijosKpi)} USD`,
                    unidad: "/ha",
                    estado: costosFijosKpi === null ? "sin_datos" : "fijo",
                    descripcion_tecnica: "Costo fijo por hectárea configurado para este escenario. El anillo muestra su proporción respecto al costo total.",
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
                  title: "Punto de equilibrio",
                  value: puntoEquilibrio === null ? 'No disponible' : <>{formatNumber(puntoEquilibrio, 3)} <span className="kpi-value-unit">t/ha</span></>,
                  isMissing: puntoEquilibrio === null,
                  trend: puntoEquilibrio === null ? "Sin dato" : "Moderado",
                  progress: null,
                  progressColor: "linear-gradient(90deg, #b78425 0%, #d8a83f 100%)",
                  progressLabelLeft: "Umbral Mínimo",
                  progressLabelRight: puntoEquilibrio === null ? "Sin dato" : `${formatNumber(puntoEquilibrio, 3)} t/ha`,
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Punto de equilibrio",
                    cultivo: "maiz",
                    valor: puntoEquilibrio,
                    unidad: "t/ha",
                    estado: puntoEquilibrio === null ? "sin_datos" : (puntoEquilibrio < 5.0 ? "favorable" : "riesgoso"),
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
                  progress: null,
                  progressColor: "linear-gradient(90deg, #9ed1ff 0%, #b8dbec 100%)",
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
                  progressColor: "linear-gradient(90deg, #88bd98 0%, #70a984 100%)",
                  progressLabelLeft: "Holgura Lluvia/Rend",
                  progressLabelRight: margenSeguridad === null ? "Sin dato" : `${margenSeguridad}%`,
                  miniChart: margenSeguridad === null ? null : { type: 'ring', percent: margenSeguridad, color: 'var(--zs-success)' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Margen de Seguridad Productivo",
                    cultivo: "maiz",
                    valor: margenSeguridad === null ? null : `${margenSeguridad} %`,
                    unidad: "Volumen",
                    estado: margenSeguridad === null ? "sin_datos" : "favorable",
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
                  title: "Fracción descriptiva que cubre costos",
                  value: fraccionCubreCostos === null ? 'No disponible' : <>{fraccionCubreCostos} <span className="kpi-value-unit">%</span></>,
                  isMissing: fraccionCubreCostos === null,
                  trend: muestraDescriptiva === null ? 'Muestra no disponible' : `${muestraDescriptiva} simulaciones guardadas`,
                  progress: fraccionCubreCostos,
                  progressColor: "linear-gradient(90deg, #176441 0%, #88bd98 100%)",
                  progressLabelLeft: "Fracción de la muestra",
                  progressLabelRight: fraccionCubreCostos === null ? "Sin dato" : `${fraccionCubreCostos}%`,
                  miniChart: fraccionCubreCostos === null ? null : { type: 'ring', percent: fraccionCubreCostos, color: 'var(--zs-success)' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Frecuencia de simulaciones sobre el punto de equilibrio",
                    cultivo: "maiz",
                    valor: fraccionCubreCostos,
                    unidad: "%",
                    estado: fraccionCubreCostos === null ? "sin_datos" : "informativo",
                    descripcion_tecnica: data?.resumen_descriptivo?.nota ?? "Fracción descriptiva de simulaciones que cubren los costos con los supuestos ingresados; no es una probabilidad calibrada.",
                    impacto_base: "Permite ver con qué frecuencia la cosecha simulada alcanzó el punto de equilibrio bajo estos supuestos financieros.",
                    recomendacion_base: "Contrasta este porcentaje con el margen neto y la sensibilidad al precio antes de invertir."
                  }
                },
                {
                  title: "Probabilidad calibrada de rentabilidad",
                  value: probabilidadCalibrada === null ? 'No disponible' : <>{probabilidadCalibrada} <span className="kpi-value-unit">%</span></>,
                  isMissing: probabilidadCalibrada === null,
                  trend: probabilidadCalibrada === null ? "Sin modelo calibrado" : "Dato del modelo",
                  progress: probabilidadCalibrada,
                  progressColor: "linear-gradient(90deg, #286f9b 0%, #9ed1ff 100%)",
                  progressLabelLeft: "Probabilidad calibrada",
                  progressLabelRight: probabilidadCalibrada === null ? "No disponible" : `${probabilidadCalibrada}%`,
                  miniChart: probabilidadCalibrada === null ? null : { type: 'ring', percent: probabilidadCalibrada, color: '#9ed1ff' },
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Probabilidad de superar el punto de equilibrio",
                    cultivo: "maiz",
                    valor: probabilidadCalibrada === null ? null : `${probabilidadCalibrada} %`,
                    unidad: "%",
                    estado: probabilidadCalibrada === null ? "sin_datos" : "informativo",
                    descripcion_tecnica: "No se dispone de una probabilidad calibrada de rentabilidad. La fracción descriptiva de simulaciones no la sustituye.",
                    impacto_base: "La muestra guardada permite una descripción de escenarios; no acredita probabilidades futuras.",
                    recomendacion_base: "Revisa presupuesto y sensibilidad sin interpretar una frecuencia de simulaciones como garantía de cosecha."
                  }
                },
                {
                  title: "Riesgo Financiero",
                  value: riesgoFinanciero || 'No disponible',
                  isMissing: !riesgoFinanciero,
                  trend: riesgoFinanciero ? "Clasificación aportada" : "Sin dato",
                  progress: null,
                  progressColor: "linear-gradient(90deg, #70a984 0%, #88bd98 100%)",
                  progressLabelLeft: "Riesgo Pérdida",
                  progressLabelRight: riesgoFinanciero ? "Nivel reportado" : "Sin dato",
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Nivel de Riesgo Financiero de Pérdida",
                    cultivo: "maiz",
                    valor: riesgoFinanciero || null,
                    unidad: "",
                    estado: riesgoFinanciero ? riesgoEstado : "sin_datos",
                    descripcion_tecnica: "Clasificación de riesgo aportada por su fuente; no equivale automáticamente a una probabilidad de pérdida.",
                    impacto_base: "Evalúa la exposición al riesgo del capital invertido en la parcela.",
                    recomendacion_base: "Contrasta el método de clasificación con los supuestos de ingreso y costo."
                  }
                }
              ]}
              tooltip={data?.resumen_descriptivo?.nota ?? 'Descripción de escenarios guardados; requiere al menos cinco resultados y no es una probabilidad de cosecha.'}
              delay={3}
              onClick={(payload) => pedirExplicacionIa(payload)}
            />
            <InteractiveKPI
              icon={<Percent size={22} />}
              iconClass="text-secondary"
              slides={[
                {
                  title: "Retorno (ROI)",
                  value: retornoInversion === null ? 'No disponible' : <>{formatNumber(retornoInversion, 1)} <span className="kpi-value-unit">%</span></>,
                  isMissing: retornoInversion === null,
                  trend: retornoInversion === null ? "Sin dato" : (retornoInversion >= 0 ? "Favorable" : "Riesgoso"),
                  severity: retornoInversion !== null && retornoInversion < 0 ? { level: "danger", label: "Retorno negativo" } : null,
                  progress: null,
                  progressColor: retornoInversion !== null && retornoInversion >= 0 ? "linear-gradient(90deg, #176441 0%, #88bd98 100%)" : "linear-gradient(90deg, #af5437 0%, #e5a379 100%)",
                  progressLabelLeft: "Inversión",
                  progressLabelRight: retornoInversion === null ? "Sin dato" : `${formatNumber(retornoInversion, 1)} %`,
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Retorno de Inversión (ROI)",
                    cultivo: "maiz",
                    valor: retornoInversion,
                    unidad: "",
                    estado: retornoInversion === null ? "sin_datos" : (retornoInversion > 20 ? "favorable" : (retornoInversion >= 0 ? "regular" : "riesgoso")),
                    descripcion_tecnica: "Mide el rendimiento del dinero invertido en el cultivo de maíz. Por ejemplo, un ROI del 20% significa que por cada dólar que inviertes, recuperas tu dólar y ganas 20 centavos adicionales.",
                    impacto_base: "Ayuda a comparar el margen relativo al costo bajo los supuestos actuales; no incorpora el valor del dinero en el tiempo.",
                    recomendacion_base: "Revisa el costo total y el margen estimado antes de comparar este retorno con otras alternativas."
                  }
                },
                {
                  title: "Ganancia por Dólar",
                  value: gananciaPorDolar === null ? 'No disponible' : <>{formatCurrency(gananciaPorDolar)} <span className="kpi-value-unit">/$</span></>,
                  isMissing: gananciaPorDolar === null,
                  trend: gananciaPorDolar === null ? "Sin dato" : (gananciaPorDolar >= 0 ? "Margen positivo" : "Margen negativo"),
                  severity: gananciaPorDolar !== null && gananciaPorDolar < 0 ? { level: "danger", label: "Margen negativo" } : null,
                  progress: null,
                  progressColor: "linear-gradient(90deg, #9ed1ff 0%, #b8dbec 100%)",
                  progressLabelLeft: "Retorno Capital",
                  progressLabelRight: gananciaPorDolar === null ? "Sin dato" : formatCurrency(gananciaPorDolar),
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Ganancia por Dólar Invertido",
                    cultivo: "maiz",
                    valor: gananciaPorDolar === null ? null : `${formatCurrency(gananciaPorDolar)} USD`,
                    unidad: "/$",
                    estado: gananciaPorDolar === null ? "sin_datos" : (gananciaPorDolar >= 0 ? "favorable" : "riesgoso"),
                    descripcion_tecnica: "Margen neto dividido por costo total. Indica la ganancia o pérdida estimada por cada dólar de costo; no incluye la recuperación del dólar invertido.",
                    impacto_base: "Complementa la relación B/C: esta cifra muestra sólo el excedente sobre el costo.",
                    recomendacion_base: "Verifica el costo base antes de extrapolar esta relación al presupuesto de la parcela."
                  }
                },
                {
                  title: "TIR Estimada",
                  value: tirEstimada === null ? 'No disponible' : <>{tirEstimada} <span className="kpi-value-unit">% TIR</span></>,
                  isMissing: tirEstimada === null,
                  trend: tirEstimada === null ? "Sin dato" : "Interna",
                  progress: null,
                  progressColor: "linear-gradient(90deg, #286f9b 0%, #9ed1ff 100%)",
                  progressLabelLeft: "Tasa Interna",
                  progressLabelRight: tirEstimada === null ? "Sin dato" : `${tirEstimada}%`,
                  miniChart: null,
                  explanation: {
                    tipo_elemento: "tarjeta",
                    nombre: "Tasa Interna de Retorno (TIR) Estimada",
                    cultivo: "maiz",
                    valor: tirEstimada === null ? null : `${tirEstimada} %`,
                    unidad: "TIR",
                    estado: tirEstimada === null ? "sin_datos" : "favorable",
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
                descripcion_tecnica: "Tabla de escenarios de margen por hectárea al cruzar precios supuestos por quintal y rendimientos supuestos en qq/ha. No son cotizaciones ni cosechas observadas.",
                impacto_base: "Permite ver el umbral donde el negocio pasa a pérdidas (valores negativos en rojo) y dónde es rentable (valores positivos).",
                recomendacion_base: "Verificar en la matriz si con rendimientos realistas de su zona el negocio resiste caídas en el precio de venta.",
                datos_grafico: sensibilidad
              })}
            >
              <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Sensibilidad Precio vs Rendimiento (USD)</h3>
              </div>
              <div className="glass-card-body" style={{ padding: '0.6rem 0.85rem 1rem 0.85rem' }}>
                <div className="table-responsive-container" tabIndex={0} role="region" aria-label="Tabla de sensibilidad económica, desplazable">
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px 4px', textAlign: 'center' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.4rem 0.15rem', color: 'var(--text-subtle)', fontSize: '0.68rem', fontWeight: 700, textAlign: 'left' }}>Rend. ↓ | Precio →</th>
                        {precios_rango.map(p => (
                          <th key={p} style={{ padding: '0.4rem 0.15rem', color: 'var(--text-primary)', fontSize: '0.76rem', fontWeight: 800, whiteSpace: 'nowrap' }}>${p}/qq</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rendimientos_rango.map(r => (
                        <tr key={r}>
                          <td style={{ padding: '0.4rem 0.15rem', fontWeight: 700, textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{r} qq/ha</td>
                          {precios_rango.map(p => {
                            const item = sensibilidad.find(s => s.precio === p && s.rendimiento === r);
                            const marginVal = toFiniteNumber(item?.margen);
                            const cardSt = getSensibilidadCardStyle(marginVal);
                            return (
                              <td 
                                key={p} 
                                style={{
                                  padding: '0.5rem 0.15rem',
                                  background: cardSt.background,
                                  border: cardSt.border,
                                  borderRadius: '10px',
                                  boxShadow: cardSt.boxShadow,
                                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'inline-flex', alignItems: 'baseline', justifyContent: 'center', gap: '1px' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.8rem', color: cardSt.color, whiteSpace: 'nowrap' }}>
                                    {formatCurrency(marginVal)}
                                  </span>
                                  <span style={{ fontSize: '0.58rem', fontWeight: 600, color: cardSt.color, opacity: 0.85 }}>/ha</span>
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
              <div className="glass-card-body" style={{ padding: '0.85rem 1.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const expenseItems = (waterfall_costos || []).filter(item => !item.is_total && Number(item.amount) < 0);
                  const totalExpenses = expenseItems.reduce((total, item) => total + Math.abs(Number(item.amount) || 0), 0);
                  const netMargin = toFiniteNumber(waterfall_costos.find(item => item.label === 'Margen Neto')?.amount);

                  const colorPalette = [
                    '#d8a83f', '#9fc862', '#9ed1ff', '#70a984', '#d7c176', '#699887'
                  ];

                  const chartData = {
                    labels: expenseItems.map(item => item.label),
                    datasets: [{
                      data: expenseItems.map(item => Math.abs(item.amount)),
                      backgroundColor: expenseItems.map((_, idx) => colorPalette[idx % colorPalette.length]),
                      borderColor: temaClaro ? '#f6f9f4' : '#0b2417',
                      borderWidth: 3,
                      spacing: 3,
                      hoverOffset: 14,
                      hoverBorderWidth: 3,
                    }]
                  };

                  const chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '72%',
                    animation: { duration: 650, easing: 'easeOutQuart' },
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        backgroundColor: temaClaro ? '#FBFCFA' : '#141F17',
                        borderColor: temaClaro ? 'rgba(31, 92, 56, .22)' : 'rgba(160, 185, 170, .30)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        boxPadding: 6,
                        usePointStyle: true,
                        titleColor: temaClaro ? '#14231A' : '#E8EDE8',
                        bodyColor: temaClaro ? '#3A4A41' : '#9DB09F',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 12, weight: 'bold' },
                        callbacks: {
                          label: (context) => {
                            const label = context.label || '';
                            const val = context.raw || 0;
                            const pct = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0;
                            return ` $${val.toLocaleString('es-EC')} (${formatNumber(pct, 1)} %) · ${label}`;
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
                        <Doughnut role="img" aria-label="Distribución de los costos del presupuesto calculado; desglose en la leyenda contigua" data={chartData} options={chartOptions} />
                        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                          <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 700, letterSpacing: '0.05em', display: 'block' }}>
                            Costo total
                          </span>
                          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                            ${totalExpenses.toLocaleString('es-EC')}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                            Margen: {formatCurrency(netMargin)}/ha
                          </span>
                        </div>
                      </div>

                      {/* Side Breakdown Legend */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', width: '100%' }}>
                        {expenseItems.map((item, idx) => {
                          const itemColor = colorPalette[idx % colorPalette.length];
                          const absVal = Math.abs(item.amount);
                          const pct = formatNumber((absVal / totalExpenses) * 100, 1);

                          return (
                            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: itemColor, display: 'inline-block', boxShadow: `0 0 6px ${itemColor}80` }} />
                                  {item.label}
                                </div>
                                <div style={{ fontWeight: 700, color: 'var(--zs-text)', fontSize: '0.78rem' }}>
                                  ${absVal.toLocaleString('es-EC')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({pct}%)</span>
                                </div>
                              </div>
                              <div style={{ width: '100%', height: '5px', background: 'var(--border-subtle)', borderRadius: '99px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, (absVal / totalExpenses) * 100)}%`, height: '100%', background: itemColor, borderRadius: '99px', transition: 'width .65s cubic-bezier(.22,.61,.36,1)' }} />
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
                <FinancialROI strategies={roi_estrategias.filter((item) => ['roi', 'margen', 'rendimiento', 'costo'].every((field) => toFiniteNumber(item[field]) !== null))} />
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
                        className="roi-strategy-item" role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                        onClick={(e) => {
                          e.stopPropagation();
                          pedirExplicacionIa({
                            tipo_elemento: "tarjeta",
                            nombre: `Estrategia: ${est.nombre}`,
                            cultivo: "maiz",
                            valor: est.roi === null ? 'ROI no calculable' : `${est.roi}% ROI`,
                            unidad: '%',
                            estado: toFiniteNumber(est.margen) === null ? 'sin_datos' : (est.margen > 0 ? 'favorable' : 'riesgoso'),
                            descripcion_tecnica: `${est.nombre}. Costo supuesto: ${formatCurrency(est.costo)}/ha; rendimiento supuesto: ${formatNumber(est.rendimiento)} t/ha.`,
                            impacto_base: `Margen del supuesto: ${formatCurrency(est.margen)}/ha. Es una comparación hipotética, no un resultado observado.`,
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
                            <span>Costo: <strong style={{ color: 'var(--text-muted)' }}>{formatCurrency(est.costo)}</strong>/ha</span>
                            <span style={{ opacity: 0.5 }}>•</span>
                            <span>Rend: <strong style={{ color: 'var(--text-muted)' }}>{formatNumber(est.rendimiento)} t/ha</strong></span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--zs-text)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                            {est.roi === null ? '—' : `${est.roi}%`} <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-subtle)' }}>ROI</span>
                          </div>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '5px',
                            background: 'var(--zs-inset-surface)',
                            color: toFiniteNumber(est.margen) === null ? 'var(--text-muted)' : (est.margen >= 0 ? 'var(--zs-accent)' : 'var(--zi-maize-400)'),
                            fontFamily: 'var(--font-mono)',
                            display: 'inline-block'
                          }}>
                            NETO: {formatCurrency(est.margen)}
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

      <SimulationInfoCard
        isOpen={mostrarModalIa}
        onClose={() => setMostrarModalIa(false)}
        loading={cargandoIa}
        data={datosIa}
      />
    </div>
  );
}
