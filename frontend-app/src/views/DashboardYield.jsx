import { useState, useEffect } from 'react';
import { dssService, simulacionService } from '../services/api';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import InfoModal from '../templates/Common/InfoModal';
import InteractiveKPI from '../templates/Common/InteractiveKPI';
import AIExplainModal from '../templates/Common/AIExplainModal';
import EmptyDashboard from '../templates/Common/EmptyDashboard';
import useExplicacionIA from '../hooks/usarExplicacionIA';

ChartJS.register(...registerables);

import { 
  BarChart2, 
  MinusCircle, 
  TrendingUp, 
  CheckCircle,
  HelpCircle,
  Leaf,
  Droplets,
  Thermometer,
  Calendar,
  Gauge
} from 'lucide-react';

export default function DashboardYield({ cultivoElegidoId, anioSeleccionado, onNavigate, onDashboardData }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalData, setModalData] = useState(null);
  
  const {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    pedirExplicacionIa,
    setRespuestasIaGuardadas
  } = useExplicacionIA(cultivoElegidoId, anioSeleccionado);

  useEffect(() => {
    if (data && data.kpis && typeof data.kpis.rendimiento_predicho === 'number') {
      const { kpis } = data;
      const preloadKey = "Rendimiento Predicho Final";
      const rendimientoPredicho = Number(kpis.rendimiento_predicho);
      const rendimientoAlcanzable = Number(kpis.rendimiento_alcanzable);
      const proporcionPotencial = rendimientoAlcanzable > 0
        ? rendimientoPredicho / rendimientoAlcanzable
        : null;
      const preloadContext = {
        tipo_elemento: "tarjeta",
        nombre: preloadKey,
        cultivo: "maiz",
        valor: parseFloat(Number(kpis.rendimiento_predicho).toFixed(2)),
        unidad: "t/ha",
        color: proporcionPotencial === null ? "neutral" : (proporcionPotencial >= 0.8 ? "success" : (proporcionPotencial >= 0.6 ? "warning" : "danger")),
        rango_ideal: rendimientoAlcanzable > 0 ? `Comparar contra el alcanzable del escenario (${rendimientoAlcanzable.toFixed(2)} t/ha)` : "Depende del escenario",
        descripcion_tecnica: "El rendimiento de cosecha que la simulación estima que se obtendrá al final del ciclo basándose en las variables climáticas e insumos ingresados.",
        impacto_base: "Determina directamente la viabilidad del cultivo y el volumen total de toneladas que se podrán vender.",
        recomendacion_base: "Si el valor es inferior al rango óptimo, se sugiere revisar el balance de fertilizantes y el manejo de agua antes de iniciar la campaña."
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
  }, [data, cultivoElegidoId, anioSeleccionado, setRespuestasIaGuardadas]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await dssService.getYieldData(cultivoElegidoId, anioSeleccionado);
        setData(res);
      } catch {
        setError('Error al cargar la brecha productiva.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [cultivoElegidoId, anioSeleccionado]);

  useEffect(() => {
    if (data && !data.sin_datos && onDashboardData) onDashboardData(data);
  }, [data, onDashboardData]);

  if (loading) {
    return <div className="flex-center" style={{ height: '70vh', color: 'var(--text-muted)' }}>Cargando DSS Productividad...</div>;
  }

  if (error) {
    return <div className="bg-danger-alpha text-danger" style={{ padding: '1rem', borderRadius: '12px' }}>{error}</div>;
  }

  if (data?.sin_datos) {
    return <EmptyDashboard tipo="yield" onGoToSimulation={() => onNavigate?.('simular')} />;
  }

  const { waterfall_losses = [], fenologia_comparativa = {}, factores_contribucion = [], cultivo_activo = null } = data || {};
  const kpis = data?.kpis || {};
  const kpiFuentes = data?.kpi_fuentes || {};
  const numeroOpcional = (valor) => (valor !== null && valor !== undefined && valor !== '' && Number.isFinite(Number(valor)) ? Number(valor) : null);
  const fuenteCorta = (clave, fallback = 'Estimado') => {
    const fuente = String(kpiFuentes[clave] || fallback);
    const lower = fuente.toLowerCase();
    if (lower.includes('open-meteo') || lower.includes('soilgrids') || lower.includes('api')) return 'Fuente API';
    if (lower.includes('simulac')) return 'Simulaciones';
    if (lower.includes('catálogo') || lower.includes('catalogo')) return 'Catálogo';
    if (lower.includes('teórico') || lower.includes('teorico')) return 'Teórico';
    if (lower.includes('modelo') || lower.includes('clasificador') || lower.includes('ml')) return 'Modelo';
    if (lower.includes('estim')) return 'Estimado';
    return fallback;
  };
  const radiacionPar = numeroOpcional(kpis.radiacion_par) ?? numeroOpcional(kpis.radiacion);
  const tipoSueloRaw = cultivo_activo?.tipo_suelo || kpis.tipo_suelo || null;
  const tipoSuelo = tipoSueloRaw
    ? String(tipoSueloRaw).toLowerCase().replace(/\b\w/g, (letra) => letra.toUpperCase())
    : null;
  const aguaUtil = numeroOpcional(kpis.agua_util);
  const faseVulnerable = kpis.fase_vulnerable || null;
  const riesgoFaseVulnerable = numeroOpcional(kpis.fase_vulnerable_riesgo);

  const kpisEsenciales = ['rendimiento_potencial', 'rendimiento_alcanzable', 'rendimiento_predicho', 'yield_gap_total'];
  const datosKpiCompletos = kpisEsenciales.every((clave) => Number.isFinite(Number(kpis[clave])));
  if (!datosKpiCompletos) {
    return (
      <div className="bg-danger-alpha text-danger" style={{ padding: '1rem', borderRadius: '12px' }}>
        El Dashboard Productividad recibió datos incompletos y no mostrará cifras estimadas. Ejecuta una simulación válida y vuelve a cargar el panel.
      </div>
    );
  }

  const isLightTheme = document.body.classList.contains('light-theme');
  const textColor = isLightTheme ? '#020617' : '#ffffff';
  const tickColor = isLightTheme ? '#0f172a' : '#ffffff';
  const gridColor = isLightTheme ? 'rgba(51, 65, 85, 0.35)' : 'rgba(255, 255, 255, 0.28)';
  const borderColor = isLightTheme ? '#1e293b' : 'rgba(255, 255, 255, 0.6)';
  const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.95)';
  const tooltipBorder = isLightTheme ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.1)';
  const tooltipTitle = isLightTheme ? '#0f172a' : '#f8fafc';
  const tooltipBody = isLightTheme ? '#334155' : 'rgba(255, 255, 255, 0.8)';

  // Calcular estado de crecimiento actual si la fecha de siembra está disponible
  const getGrowthStatus = () => {
    if (!cultivo_activo?.fecha_siembra) return null;
    const sowing = new Date(cultivo_activo.fecha_siembra);
    const today = new Date();
    const diffTime = today - sowing;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { week: 0, days: 0, percentage: 0, stage: 'Siembra programada', fecha_siembra: sowing.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }), fecha_cosecha: new Date(sowing.getTime() + 120 * 24 * 60 * 60 * 1000).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }) };
    }
    const week = Math.min(14, Math.max(1, Math.ceil(diffDays / 7)));
    const percentage = Math.min(100, Math.round((week / 14) * 100));
    
    let stage = 'Emergencia / Crecimiento Inicial';
    if (week >= 12) stage = 'Madurez Fisiológica';
    else if (week >= 8) stage = 'Floración y Llenado de Grano';
    else if (week >= 5) stage = 'Crecimiento Vegetativo Rápido';
    
    return {
      week,
      days: diffDays,
      percentage,
      stage,
      fecha_siembra: sowing.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }),
      fecha_cosecha: new Date(sowing.getTime() + 120 * 24 * 60 * 60 * 1000).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })
    };
  };

  const growthStatus = getGrowthStatus();

  // Plugin personalizado de Chart.js para dibujar una línea vertical en la semana de crecimiento actual
  const currentWeekPlugin = {
    id: 'currentWeekLine',
    afterDatasetsDraw: (chart) => {
      if (growthStatus && growthStatus.week >= 2 && growthStatus.week <= 14) {
        const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
        const index = (growthStatus.week - 2) / 2;
        const xPos = x.getPixelForValue(index);
        
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.stroke();
        
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`SEMANA ${growthStatus.week} (HOY)`, xPos, top - 6);
        ctx.restore();
      }
    }
  };

  const rawLabels = fenologia_comparativa?.labels || [
    "V2 (Emergencia)", "V6 (Vegetativo)", "V10 (Crecimiento)", "VT (Floración)",
    "R1 (Polinización)", "R3 (Llenado)", "R6 (Madurez)"
  ];

  const lineChartData = {
    labels: rawLabels.map(lbl => {
      if (typeof lbl === 'string' && lbl.includes(' (')) {
        return [lbl.split(' (')[0], '(' + lbl.split(' (')[1]];
      }
      return lbl;
    }),
    datasets: [
      {
        label: 'Campaña Actual Proyectada',
        data: fenologia_comparativa?.proyeccion_actual || [0, 0, 0, 0, 0, 0, 0],
        borderColor: '#16a34a',
        backgroundColor: isLightTheme ? 'rgba(22, 163, 74, 0.28)' : 'rgba(22, 163, 74, 0.1)',
        fill: false,
        tension: 0.3,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#16a34a',
        pointHoverBorderColor: isLightTheme ? '#0f172a' : '#fff',
        pointHoverBorderWidth: 2
      },
      {
        label: 'Mejor escenario registrado',
        data: fenologia_comparativa?.mejor_ano || [0, 0, 0, 0, 0, 0, 0],
        borderColor: '#1d4ed8',
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: isLightTheme ? '#1f2937' : '#fff',
        pointHoverBorderColor: isLightTheme ? '#0f172a' : '#fff'
      },
      {
        label: 'Peor escenario registrado',
        data: fenologia_comparativa?.peor_ano || [0, 0, 0, 0, 0, 0, 0],
        borderColor: '#dc2626',
        borderDash: [5, 5],
        fill: 1, // Rellenar hasta el índice 1 del conjunto de datos ("Mejor escenario registrado")
        backgroundColor: isLightTheme ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.03)',
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: isLightTheme ? '#0f172a' : '#fff',
        pointHoverBorderColor: isLightTheme ? '#0f172a' : '#fff'
      }
    ]
  };

  const maxYieldVal = Math.max(...(fenologia_comparativa?.mejor_ano || [0]), Number(kpis?.rendimiento_predicho) || 0, 1);
  const perdidaPorFactor = (termino) => {
    const fila = waterfall_losses.find((item) => String(item?.name || '').toLowerCase().includes(termino));
    const valor = fila?.value;
    return valor !== null && valor !== undefined && Number.isFinite(Number(valor)) ? Math.abs(Number(valor)) : null;
  };
  const perdidaAgua = perdidaPorFactor('agua');
  const perdidaNitrogeno = perdidaPorFactor('nitrógeno') ?? perdidaPorFactor('nitrogeno');
  const perdidaTemperatura = perdidaPorFactor('temperatura');
  const perdidaFecha = perdidaPorFactor('fecha');
  const perdidaSuelo = perdidaPorFactor('suelo');
  const probabilidadCosecha = numeroOpcional(kpis.probabilidad_cosecha);
  const indiceCosecha = numeroOpcional(kpis.indice_cosecha);
  const factorMayor = factores_contribucion
    .filter((item) => item && item.factor && Number.isFinite(Number(item.porcentaje)))
    .reduce((mayor, item) => Number(item.porcentaje) > Number(mayor?.porcentaje ?? -Infinity) ? item : mayor, null);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    font: {
      family: 'Plus Jakarta Sans, sans-serif'
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    layout: {
      padding: { top: 12, bottom: 6, left: 6, right: 6 }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: textColor,
          font: { size: 14, weight: '800' },
          boxWidth: 18,
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1.5,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        titleFont: { size: 14, weight: '800' },
        bodyFont: { size: 13, weight: '600' },
        cornerRadius: 8,
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { color: gridColor, lineWidth: 1.5 },
        border: { display: true, color: borderColor, width: 2 },
        ticks: { 
          color: tickColor,
          maxRotation: 0,
          font: { size: 13, weight: '800' }
        }
      },
      y: {
        suggestedMax: Math.ceil(maxYieldVal * 1.1),
        title: {
          display: true,
          text: 'Rendimiento (t/ha)',
          color: textColor,
          font: { size: 14, weight: '800' }
        },
        grid: { color: gridColor, lineWidth: 1.5 },
        border: { display: true, color: borderColor, width: 2 },
        ticks: { color: tickColor, font: { size: 14, weight: '800' } }
      }
    }
  };

  // Ayudantes de progreso. La escala se calcula con los valores entregados por
  // el backend; nunca se usa un máximo fijo que pueda falsear el porcentaje.
  const potencialMax = Math.max(
    Number(kpis.rendimiento_potencial) || 0,
    Number(kpis.rendimiento_alcanzable) || 0,
    Number(kpis.rendimiento_predicho) || 0,
    1,
  );
  const predichoProgress = Math.min(100, (kpis.rendimiento_predicho / potencialMax) * 100);
  const alcanzableProgress = Math.min(100, (kpis.rendimiento_alcanzable / potencialMax) * 100);
  const proporcionPredichoAlcanzable = Number(kpis.rendimiento_alcanzable) > 0
    ? Number(kpis.rendimiento_predicho) / Number(kpis.rendimiento_alcanzable)
    : null;
  const estadoPredicho = proporcionPredichoAlcanzable === null
    ? { corto: "Sin referencia", largo: "Sin dato", color: "neutral" }
    : proporcionPredichoAlcanzable >= 0.8
      ? { corto: "Cercano al alcanzable", largo: "Cobertura alta", color: "success" }
      : proporcionPredichoAlcanzable >= 0.6
        ? { corto: "Intermedio", largo: "Cobertura media", color: "warning" }
        : { corto: "Por debajo del alcanzable", largo: "Cobertura baja", color: "danger" };
  
  const potencialSlides = [
    {
      title: "Rendimiento Potencial",
      value: <>{kpis.rendimiento_potencial} <span className="kpi-value-unit">t/ha</span></>,
      trend: "Máximo Genético",
      progress: 100,
      progressColor: "linear-gradient(90deg, #863bff 0%, #a855f7 100%)",
      progressLabelLeft: "Estabilidad",
      progressLabelRight: "100%",
      miniChart: null,
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Rendimiento Potencial Teórico",
        cultivo: "maiz",
        valor: `${kpis.rendimiento_potencial} t/ha`,
        unidad: "t/ha",
        estado: "optimo",
        rango_ideal: "Depende de la variedad y el escenario",
        descripcion_tecnica: "Rendimiento máximo genético de este híbrido de maíz en condiciones ideales de laboratorio o parcelas experimentales sin plagas ni deficiencias hídricas.",
        impacto_base: "Sirve como meta teórica para medir la brecha productiva total y planificar el potencial de la semilla.",
        recomendacion_base: "Es útil para calcular qué porcentaje del potencial genético real se está alcanzando en el lote."
      }
    },
    {
      title: "Radiación Fotosintética",
      value: radiacionPar === null ? <>No disponible</> : <>{radiacionPar} <span className="kpi-value-unit">mol/m²/d</span></>,
      trend: radiacionPar === null ? "Sin medición" : fuenteCorta('radiacion_par'),
      progress: null,
      progressColor: "linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)",
      progressLabelLeft: "Captura Luz",
      progressLabelRight: radiacionPar === null ? "—" : "Dato disponible",
      miniChart: null,
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Radiación Fotosintéticamente Activa (PAR)",
        cultivo: "maiz",
        valor: radiacionPar === null ? "No disponible" : `${radiacionPar} mol/m²/d`,
        unidad: "",
        estado: radiacionPar === null ? "sin_datos" : "disponible",
        rango_ideal: "Requiere medición local",
        descripcion_tecnica: "La radiación PAR representa la luz fotosintéticamente activa disponible, expresada como mol/m²/día. Puede proceder de una API climática o de una estimación zonal.",
        impacto_base: "La radiación condiciona la fotosíntesis y la acumulación de biomasa; el valor estimado no sustituye un sensor instalado en el lote.",
        recomendacion_base: "Instalar o registrar un sensor PAR para sustituir la estimación por una medición local.",
        fuente: kpiFuentes.radiacion_par
      }
    },
    {
      title: "Límite Genético Híbrido",
      value: kpis.rendimiento_potencial == null ? <>No disponible</> : <>{kpis.rendimiento_potencial} <span className="kpi-value-unit">t/ha</span></>,
      trend: kpis.rendimiento_potencial == null ? "Sin dato" : "Teórico",
      progress: 100,
      progressColor: "linear-gradient(90deg, #c084fc 0%, #e879f9 100%)",
      progressLabelLeft: "Teórico Absoluto",
      progressLabelRight: "Max",
      miniChart: { type: 'ring', percent: kpis.rendimiento_potencial == null ? 0 : 100, color: '#c084fc' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Límite Genético del Híbrido de Maíz",
        cultivo: "maiz",
        valor: kpis.rendimiento_potencial == null ? "No disponible" : `${kpis.rendimiento_potencial} t/ha`,
        unidad: "t/ha",
        estado: "optimo",
        rango_ideal: "Depende de la variedad y el escenario",
        descripcion_tecnica: "Potencial productivo calculado para la variedad y el escenario seleccionado; no representa una garantía de cosecha.",
        impacto_base: "Sirve como referencia para medir la brecha productiva del escenario, no como un límite universal de la semilla.",
        recomendacion_base: "Comparar el potencial con el rendimiento predicho y revisar las limitantes identificadas por el modelo."
      }
    }
  ];

  const alcanzableSlides = [
    {
      title: "Rendimiento Alcanzable",
      value: <>{kpis.rendimiento_alcanzable} <span className="kpi-value-unit">t/ha</span></>,
      trend: "Favorable",
      progress: alcanzableProgress,
      progressColor: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
      progressLabelLeft: "Potencial Real",
      progressLabelRight: `${alcanzableProgress.toFixed(0)}%`,
      miniChart: null,
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Rendimiento Alcanzable",
        cultivo: "maiz",
        valor: `${kpis.rendimiento_alcanzable} t/ha`,
        unidad: "t/ha",
        estado: "favorable",
        rango_ideal: "Depende de la variedad y del escenario",
        descripcion_tecnica: "Rendimiento límite que se puede lograr en el lote con el clima y tipo de suelo reales, asumiendo un manejo perfecto de nutrientes sin pérdidas.",
        impacto_base: "Define la meta productiva realista del cultivo considerando las restricciones naturales e inamovibles del suelo.",
        recomendacion_base: "Ajustar la nutrición y riego para evitar pérdidas que reduzcan el rendimiento real por debajo de este límite alcanzable."
      }
    },
    {
      title: "Capacidad de Suelo",
      value: tipoSuelo || "No disponible",
      trend: tipoSuelo ? fuenteCorta('tipo_suelo', 'Registrado') : "Sin dato",
      progress: null,
      progressColor: "linear-gradient(90deg, #60a5fa 0%, #93c5fd 100%)",
      progressLabelLeft: "Retención Hídrica",
      progressLabelRight: tipoSuelo ? "Dato disponible" : "—",
      miniChart: null,
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Capacidad de Almacenamiento del Suelo",
        cultivo: "maiz",
        valor: tipoSuelo || "No disponible",
        unidad: "",
        estado: "favorable",
        rango_ideal: "Requiere análisis de textura",
        descripcion_tecnica: "La textura del suelo determina la retención de humedad y nutrientes disponibles para las raíces. ZeaSys sólo debe mostrarla si existe en los datos de la parcela.",
        impacto_base: tipoSuelo ? "La textura registrada ayuda a interpretar el balance hídrico, pero no reemplaza un análisis de suelo." : "No hay una textura registrada para esta parcela.",
        recomendacion_base: "Completar el análisis de suelo antes de ajustar riego o fertilización.",
        fuente: kpiFuentes.tipo_suelo
      }
    },
    {
      title: "Agua Útil Ciclo",
      value: aguaUtil === null ? <>No disponible</> : <>{aguaUtil} <span className="kpi-value-unit">mm</span></>,
      trend: aguaUtil === null ? "Sin dato" : fuenteCorta('agua_util', 'Calculada'),
      progress: null,
      progressColor: "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)",
      progressLabelLeft: "Balance Hídrico",
      progressLabelRight: aguaUtil === null ? "—" : "Dato disponible",
      miniChart: null,
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Balance de Agua Útil Requerido en Ciclo",
        cultivo: "maiz",
        valor: aguaUtil === null ? "No disponible" : `${aguaUtil} mm`,
        unidad: "mm",
        estado: "favorable",
        rango_ideal: "Depende del suelo, clima y etapa",
        descripcion_tecnica: "El agua útil debe calcularse con humedad del suelo, demanda atmosférica, textura y lluvia; no se debe sustituir por una cifra fija.",
        impacto_base: aguaUtil === null ? "El dashboard no tiene agua útil calculada para este escenario." : "La cifra describe el escenario seleccionado y debe interpretarse junto con la humedad del suelo.",
        recomendacion_base: "Monitorear la humedad del suelo y comparar escenarios de riego antes de modificar la lámina.",
        fuente: kpiFuentes.agua_util
      }
    }
  ];

  const predichoSlides = [
    {
      title: "Predicho Final",
      value: <>{kpis.rendimiento_predicho.toFixed(2)} <span className="kpi-value-unit">t/ha</span></>,
      trend: estadoPredicho.corto,
      progress: predichoProgress,
      progressColor: kpis.rendimiento_predicho > 6.0 
        ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)" 
        : "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
      progressLabelLeft: estadoPredicho.largo,
      progressLabelRight: `${predichoProgress.toFixed(0)}%`,
      miniChart: null,
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Rendimiento Predicho Final",
        cultivo: "maiz",
        valor: `${parseFloat(kpis.rendimiento_predicho.toFixed(2))} t/ha`,
        unidad: "t/ha",
        estado: estadoPredicho.color,
        rango_ideal: kpis.rendimiento_alcanzable > 0 ? `Comparar contra el alcanzable del escenario (${Number(kpis.rendimiento_alcanzable).toFixed(2)} t/ha)` : "Depende del escenario",
        descripcion_tecnica: "El rendimiento de cosecha que la simulación estima que se obtendrá al final del ciclo basándose en las variables climáticas e insumos ingresados.",
        impacto_base: "Determina directamente la viabilidad del cultivo y el volumen total de toneladas que se podrán vender.",
        recomendacion_base: "Si el valor es inferior al rango óptimo, se sugiere revisar el balance de fertilizantes y el manejo de agua antes de iniciar la campaña."
      }
    },
    {
      title: "Probabilidad Cosecha",
      value: probabilidadCosecha === null ? <>No disponible</> : <>{probabilidadCosecha} <span className="kpi-value-unit">%</span></>,
      trend: probabilidadCosecha === null ? "Sin dato" : fuenteCorta('probabilidad_cosecha', 'Calculada'),
      progress: probabilidadCosecha === null ? 0 : probabilidadCosecha,
      progressColor: "linear-gradient(90deg, #10b981 0%, #6ee7b7 100%)",
      progressLabelLeft: "Modelo ML",
      progressLabelRight: probabilidadCosecha === null ? "—" : `${probabilidadCosecha}%`,
      miniChart: { type: 'ring', percent: probabilidadCosecha || 0, color: '#34d399' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Probabilidad de Éxito en Cosecha",
        cultivo: "maiz",
        valor: probabilidadCosecha === null ? "No disponible" : `${probabilidadCosecha} %`,
        unidad: "%",
        estado: probabilidadCosecha === null ? "sin_datos" : "disponible",
        rango_ideal: "Se interpreta junto con el rendimiento predicho y sus limitantes",
        descripcion_tecnica: "Probabilidad de cosecha comercial calculada por el clasificador ML a partir de la distribución Alta, Media, Baja y Muy Baja. En simulaciones antiguas puede mostrarse el puntaje de su categoría porque no guardaban probabilidades.",
        impacto_base: probabilidadCosecha === null ? "El backend no entrega una probabilidad de cosecha para este escenario." : "Es una estimación de escenario, no una garantía de producción.",
        recomendacion_base: "Validar el valor con monitoreo de campo y actualizar la simulación cuando cambien clima, suelo o manejo.",
        fuente: kpiFuentes.probabilidad_cosecha
      }
    },
    {
      title: "Índice de Cosecha",
      value: indiceCosecha === null ? <>No disponible</> : <>{indiceCosecha} <span className="kpi-value-unit">HI</span></>,
      trend: indiceCosecha === null ? "Sin dato" : fuenteCorta('indice_cosecha', 'Calculado'),
      progress: indiceCosecha === null ? 0 : Math.min(100, indiceCosecha * 100),
      progressColor: "linear-gradient(90deg, #059669 0%, #10b981 100%)",
      progressLabelLeft: "Biomasa a Grano",
      progressLabelRight: indiceCosecha === null ? "—" : indiceCosecha.toFixed(2),
      miniChart: { type: 'ring', percent: indiceCosecha === null ? 0 : Math.min(100, indiceCosecha * 100), color: '#059669' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Índice de Cosecha (Harvest Index - HI)",
        cultivo: "maiz",
        valor: indiceCosecha === null ? "No disponible" : `${indiceCosecha} HI`,
        unidad: "HI",
        estado: indiceCosecha === null ? "sin_datos" : "disponible",
        rango_ideal: "Depende de la variedad y del modelo",
        descripcion_tecnica: "El índice de cosecha expresa la proporción de biomasa que termina como grano. Mientras no exista biomasa medida, ZeaSys entrega una estimación agronómica basada en la cobertura del rendimiento.",
        impacto_base: indiceCosecha === null ? "El backend no entrega un índice de cosecha para este escenario." : "Ayuda a interpretar la eficiencia de conversión a grano, pero no sustituye mediciones de biomasa.",
        recomendacion_base: "Registrar biomasa y producción de grano para reemplazar esta estimación por un índice observado.",
        fuente: kpiFuentes.indice_cosecha
      }
    }
  ];

  const gapSlides = [
    {
      title: "Yield Gap Total",
      value: <>{kpis.yield_gap_total.toFixed(1)} <span className="kpi-value-unit">t/ha</span></>,
      trend: `-${((kpis.yield_gap_total / kpis.rendimiento_potencial) * 100).toFixed(0)}%`,
      progress: Math.min(100, (kpis.yield_gap_total / kpis.rendimiento_potencial) * 100),
      progressColor: "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
      progressLabelLeft: "Brecha Pérdida",
      progressLabelRight: `${((kpis.yield_gap_total / kpis.rendimiento_potencial) * 100).toFixed(0)}%`,
      miniChart: { type: 'bar', data: [kpis.yield_gap_total], color: '#f87171' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Yield Gap Total (Brecha de Rendimiento)",
        cultivo: "maiz",
        valor: `${parseFloat(kpis.yield_gap_total.toFixed(1))} t/ha`,
        unidad: "t/ha",
        estado: kpis.yield_gap_total > 3.5 ? "riesgoso" : "favorable",
        rango_ideal: "Menos de 2.0 t/ha",
        descripcion_tecnica: "Diferencia de rendimiento causada por limitaciones en los insumos, estrés por agua o clima desfavorable en comparación con el potencial.",
        impacto_base: "Un gap alto indica ineficiencia y pérdida económica por no alcanzar el rendimiento genético de la semilla.",
        recomendacion_base: "Identificar los factores limitantes individuales para cerrar esta brecha en las próximas simulaciones."
      }
    },
    {
      title: "Pérdida por Agua",
      value: perdidaAgua === null ? <>No disponible</> : <>-{perdidaAgua.toFixed(2)} <span className="kpi-value-unit">t/ha</span></>,
      trend: perdidaAgua === null ? "Sin dato" : "Escenario actual",
      progress: perdidaAgua === null ? 0 : Math.min(100, (perdidaAgua / Math.max(0.1, Number(kpis.yield_gap_total))) * 100),
      progressColor: "linear-gradient(90deg, #f87171 0%, #fca5a5 100%)",
      progressLabelLeft: "Estrés Hídrico",
      progressLabelRight: perdidaAgua === null ? "—" : `${Math.min(100, (perdidaAgua / Math.max(0.1, Number(kpis.yield_gap_total))) * 100).toFixed(0)}%`,
      miniChart: perdidaAgua === null ? null : { type: 'bar', data: [perdidaAgua], color: '#f87171' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Pérdida de Rendimiento por Estrés Hídrico",
        cultivo: "maiz",
        valor: perdidaAgua === null ? "No disponible" : `-${perdidaAgua.toFixed(2)} t/ha`,
        unidad: "t/ha",
        estado: perdidaAgua === null ? "sin_datos" : "riesgoso",
        rango_ideal: "Comparar contra el escenario sin estrés",
        descripcion_tecnica: "Pérdida estimada por agua según la cascada calculada por el backend para la simulación seleccionada.",
        impacto_base: perdidaAgua === null ? "El backend no entregó una pérdida hídrica para esta simulación." : "La cifra pertenece al escenario calculado y no demuestra causalidad fuera de sus entradas.",
        recomendacion_base: "Comparar una nueva simulación cambiando sólo la variable de agua."
      }
    },
    {
      title: "Pérdida por Nitrógeno",
      value: perdidaNitrogeno === null ? <>No disponible</> : <>-{perdidaNitrogeno.toFixed(2)} <span className="kpi-value-unit">t/ha</span></>,
      trend: perdidaNitrogeno === null ? "Sin dato" : "Escenario actual",
      progress: perdidaNitrogeno === null ? 0 : Math.min(100, (perdidaNitrogeno / Math.max(0.1, Number(kpis.yield_gap_total))) * 100),
      progressColor: "linear-gradient(90deg, #dc2626 0%, #ef4444 100%)",
      progressLabelLeft: "Déficit N",
      progressLabelRight: perdidaNitrogeno === null ? "—" : `${Math.min(100, (perdidaNitrogeno / Math.max(0.1, Number(kpis.yield_gap_total))) * 100).toFixed(0)}%`,
      miniChart: perdidaNitrogeno === null ? null : { type: 'bar', data: [perdidaNitrogeno], color: '#dc2626' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Pérdida de Rendimiento por Déficit de Nitrógeno",
        cultivo: "maiz",
        valor: perdidaNitrogeno === null ? "No disponible" : `-${perdidaNitrogeno.toFixed(2)} t/ha`,
        unidad: "t/ha",
        estado: perdidaNitrogeno === null ? "sin_datos" : "riesgoso",
        rango_ideal: "Comparar contra el escenario con nutrición ajustada",
        descripcion_tecnica: "Pérdida estimada por nitrógeno según la cascada calculada por el backend para la simulación seleccionada.",
        impacto_base: perdidaNitrogeno === null ? "El backend no entregó una pérdida de nitrógeno para esta simulación." : "La cifra pertenece al escenario calculado y no sustituye un análisis de suelo o tejido.",
        recomendacion_base: "Confirmar el diagnóstico con análisis y comparar una simulación modificando sólo la fertilización."
      }
    }
  ];

  const limitanteSlides = [
    {
      title: "Limitante Principal",
      value: kpis.principal_limitante || "No disponible",
      trend: kpis.principal_limitante ? (kpis.yield_gap_total > 3.0 ? "Crítico" : "Moderado") : "Sin dato",
      progress: null,
      progressColor: kpis.yield_gap_total > 3.0 
        ? "linear-gradient(90deg, #f97316 0%, #ef4444 100%)" 
        : "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)",
      progressLabelLeft: "Severidad",
      progressLabelRight: kpis.principal_limitante ? "Requiere comparación" : "—",
      miniChart: null,
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Limitante Principal del Cultivo",
        cultivo: "maiz",
        valor: kpis.principal_limitante || "No disponible",
        unidad: "",
        estado: kpis.principal_limitante ? "regular" : "sin_datos",
        rango_ideal: "Ninguno",
        descripcion_tecnica: "El insumo o factor agroclimático que causa la mayor caída en la curva de acumulación de rendimiento simulado.",
        impacto_base: "Actúa como cuello de botella del rendimiento. Si este factor no se corrige, otros esfuerzos agrícolas tendrán un impacto muy limitado.",
        recomendacion_base: "Priorizar la inversión de insumos o la corrección de prácticas agrícolas específicamente en este factor limitante."
      }
    },
    {
      title: "Acción Prioritaria",
      value: kpis.principal_limitante || "No disponible",
      trend: kpis.principal_limitante ? "Revisar" : "Sin dato",
      progress: null,
      progressColor: "linear-gradient(90deg, #f97316 0%, #fbbf24 100%)",
      progressLabelLeft: "Recuperación",
      progressLabelRight: kpis.principal_limitante ? "Comparar" : "—",
      miniChart: null,
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Acción Correctora Prioritaria Recomenda por DSS",
        cultivo: "maiz",
        valor: kpis.principal_limitante || "No disponible",
        unidad: "",
        estado: kpis.principal_limitante ? "regular" : "sin_datos",
        rango_ideal: "Cambiar una variable por simulación",
        descripcion_tecnica: "La acción prioritaria debe derivarse de la limitante principal y validarse con una simulación comparativa.",
        impacto_base: kpis.principal_limitante ? `La limitante indicada es ${kpis.principal_limitante}; no implica por sí sola una recuperación cuantificada.` : "No hay una limitante calculada para proponer una acción.",
        recomendacion_base: "Atender la limitante identificada y volver a simular cambiando una variable a la vez."
      }
    },
    {
      title: "Fase Vulnerable",
      value: faseVulnerable || "Floración y polinización (VT–R1)",
      trend: faseVulnerable ? fuenteCorta('fase_vulnerable', 'Teórico') : "Teórico",
      progress: riesgoFaseVulnerable ?? 65,
      progressColor: "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
      progressLabelLeft: "Riesgo Aborto",
      progressLabelRight: `${riesgoFaseVulnerable ?? 65}%`,
      miniChart: { type: 'ring', percent: riesgoFaseVulnerable ?? 65, color: '#ef4444' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Fase Fenológica Más Vulnerable",
        cultivo: "maiz",
        valor: faseVulnerable || "Floración y polinización (VT–R1)",
        unidad: "",
        estado: "teorico",
        rango_ideal: "La fase crítica depende de la limitante principal",
        descripcion_tecnica: "Ventana fenológica teórica donde la limitante calculada puede producir el mayor impacto sobre el rendimiento.",
        impacto_base: `Riesgo teórico de aborto o pérdida de rendimiento: ${riesgoFaseVulnerable ?? 65}%. Validar con la fecha de siembra y monitoreo de campo.`,
        recomendacion_base: "Registrar la fecha de siembra y verificar humedad, temperatura y estado reproductivo durante esta ventana.",
        fuente: kpiFuentes.fase_vulnerable
      }
    }
  ];

  return (
    <div>
      <div className="dashboard-title-row">
        <div>
          <p className="dashboard-title-desc">Mira cómo va tu cultivo comparado con su máximo genético e identifica qué le está frenando.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-row">
        <InteractiveKPI
          icon={<HelpCircle size={22} />}
          iconClass="text-secondary"
          slides={potencialSlides}
          tooltip="Máximo rendimiento genético del híbrido sin limitaciones de suelo, agua ni plagas."
          delay={0}
          onClick={(payload) => pedirExplicacionIa(payload)}
        />
        <InteractiveKPI
          icon={<TrendingUp size={22} />}
          iconClass="text-secondary"
          slides={alcanzableSlides}
          tooltip="Rendimiento esperado considerando las condiciones reales de suelo y manejo agronómico del lote."
          delay={1}
          onClick={(payload) => pedirExplicacionIa(payload)}
        />
        <InteractiveKPI
          icon={<CheckCircle size={22} />}
          iconClass="text-success"
          slides={predichoSlides}
          tooltip="Rendimiento final estimado por el modelo ML para las condiciones actuales de la campaña."
          delay={2}
          onClick={(payload) => pedirExplicacionIa(payload)}
        />
        <InteractiveKPI
          icon={<MinusCircle size={22} />}
          iconClass="text-danger"
          slides={gapSlides}
          tooltip="Diferencia entre el potencial teórico y el rendimiento predicho. Representa la brecha de producción a cerrar."
          delay={3}
          onClick={(payload) => pedirExplicacionIa(payload)}
        />
        <InteractiveKPI
          icon={<BarChart2 size={22} />}
          iconClass="text-warning"
          slides={limitanteSlides}
          tooltip="Factor que más contribuye a la brecha de rendimiento. Acción correctiva prioritaria."
          delay={4}
          onClick={(payload) => pedirExplicacionIa(payload)}
        />
      </div>

      {/* Charts */}
      <div className="chart-grid">
        {/* Waterfall */}
        <div 
          className="glass-panel chart-panel-interactive"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Cascada de Brecha Productiva (Yield Gap)",
            cultivo: "maiz",
            valor: "Pérdidas acumuladas en la brecha",
            unidad: "t/ha",
            estado: "análisis de brechas",
            descripcion_tecnica: "Gráfico de cascada que representa el rendimiento potencial de maíz y las pérdidas sucesivas por factores hídricos, de nitrógeno y temperatura hasta llegar al rendimiento predicho real.",
            impacto_base: "Permite ver exactamente qué factor (agua, nutrientes o clima) es responsable de las mayores mermas en el rendimiento teórico del maíz.",
            recomendacion_base: "Identificar el escalón de pérdida más grande y enfocar los recursos de manejo (riego o fertilización) prioritariamente en él.",
            datos_grafico: waterfall_losses
          })}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Cascada de Brecha Productiva (Yield Gap)</h3>
          </div>
          <div className="glass-card-body" style={{ padding: '0.85rem 1.25rem 1.25rem 1.25rem' }}>
            {(() => {
              const potVal = Number(kpis.rendimiento_potencial);
              const predVal = Number(kpis.rendimiento_predicho);

              // Posiciones flotantes escalonadas de la cascada
              const pNitrogeno = perdidaNitrogeno ?? 0;
              const pAgua = perdidaAgua ?? 0;
              const pTemp = perdidaTemperatura ?? 0;
              const aSiembra = perdidaFecha ?? 0;
              const aSuelo = perdidaSuelo ?? 0;

              const step1 = potVal;
              const step2 = step1 - pNitrogeno;
              const step3 = step2 - pAgua;
              const step4 = step3 - pTemp;
              const step5 = step4 - aSiembra;
              const step6 = step5 - aSuelo;

              const chartData = {
                labels: [
                  'Potencial Teórico',
                  'Déficit Nitrógeno',
                  'Estrés Hídrico (Agua)',
                  'Estrés Térmico (Temp)',
                  'Fecha de Siembra',
                  'Suelo (pH)',
                  'Rendimiento Predicho'
                ],
                datasets: [{
                  label: 'Rendimiento (t/ha)',
                  data: [
                    [0, potVal],
                    [step2, step1],
                    [step3, step2],
                    [step4, step3],
                    [step4, step5],
                    [step5, step6],
                    [0, predVal]
                  ],
                  backgroundColor: [
                    '#3b82f6',
                    '#ef4444',
                    '#ef4444',
                    '#ef4444',
                    '#10b981',
                    '#38bdf8',
                    '#10b981'
                  ],
                  borderRadius: 5,
                  borderSkipped: false,
                  barPercentage: 0.78,
                  categoryPercentage: 0.85
                }]
              };

              const chartOptions = {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const raw = context.raw;
                        const idx = context.dataIndex;
                        const label = context.label;
                        if (idx === 0) return ` ${label}: ${raw[1].toFixed(2)} t/ha`;
                        if (idx === 6) return ` ${label}: ${raw[1].toFixed(2)} t/ha`;
                        const diff = raw[1] - raw[0];
                        const sign = diff > 0 ? '+' : '';
                        return ` ${label}: ${sign}${diff.toFixed(2)} t/ha`;
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    grid: {
                      color: isLightTheme ? 'rgba(51, 65, 85, 0.35)' : 'rgba(255, 255, 255, 0.28)',
                      lineWidth: 1.5,
                      drawBorder: true
                    },
                    border: {
                      display: true,
                      color: isLightTheme ? '#1e293b' : 'rgba(255, 255, 255, 0.6)',
                      width: 2
                    },
                    ticks: {
                      color: isLightTheme ? '#0f172a' : '#ffffff',
                      font: { family: 'var(--font-sans)', size: 13, weight: '800' },
                      callback: (value) => `${value} t/ha`
                    }
                  },
                  y: {
                    grid: {
                      display: true,
                      color: isLightTheme ? 'rgba(51, 65, 85, 0.25)' : 'rgba(255, 255, 255, 0.18)',
                      lineWidth: 1.5,
                      drawBorder: true
                    },
                    border: {
                      display: true,
                      color: isLightTheme ? '#1e293b' : 'rgba(255, 255, 255, 0.6)',
                      width: 2
                    },
                    ticks: {
                      color: isLightTheme ? '#0f172a' : '#ffffff',
                      font: { family: 'var(--font-sans)', size: 14, weight: '800' }
                    }
                  }
                }
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ width: '100%', height: '410px', position: 'relative' }}>
                    <Bar data={chartData} options={chartOptions} />
                  </div>

                  {/* Agronomic Insight Bar (Elimina espacio negativo y añade métricas clave) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '0.65rem',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.74rem'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Brecha Total Acumulada</span>
                      <span style={{ fontWeight: 800, color: '#ef4444' }}>-{Number(kpis.yield_gap_total).toFixed(2)} t/ha</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mayor Factor Limítrofe</span>
                      <span style={{ fontWeight: 800, color: '#3b82f6' }}>{factorMayor ? `${factorMayor.factor} (${Number(factorMayor.porcentaje).toFixed(1)}%)` : 'No disponible'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Acción Correctiva DSS</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>{kpis.principal_limitante ? `Revisar ${kpis.principal_limitante}` : 'No disponible'}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Yield Projections */}
        <div 
          className="glass-panel chart-panel-interactive"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Curva Temporal de Rendimiento (Proyección)",
            cultivo: "maiz",
            valor: `${kpis.rendimiento_predicho.toFixed(2)} t/ha predicho`,
            unidad: "t/ha",
            estado: "proyección temporal",
            descripcion_tecnica: "Gráfico de líneas que modela el rendimiento proyectado del maíz día tras día a lo largo del ciclo de vida, comparado con el peor y mejor año histórico.",
            impacto_base: "Permite ver en qué momentos del ciclo fenológico el cultivo acelera su crecimiento y acumulación de grano, y comparar contra el comportamiento histórico óptimo y crítico.",
            recomendacion_base: "Verificar si la curva de la simulación actual se aproxima más a la curva óptima o a la crítica para anticipar la calidad de la cosecha.",
            datos_grafico: fenologia_comparativa
          })}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Curva Temporal de Rendimiento</h3>
          </div>
          <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {growthStatus && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.5rem',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.6rem 0.85rem',
                marginBottom: '0.5rem',
                fontSize: '0.72rem'
              }}>
                <div>
                  <div style={{ color: 'var(--text-subtle)', marginBottom: '0.15rem' }}>Fecha de Siembra</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{growthStatus.fecha_siembra}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-subtle)', marginBottom: '0.15rem' }}>Progreso de Ciclo</div>
                  <div style={{ fontWeight: 700, color: '#f59e0b' }}>Semana {growthStatus.week} / 14</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-subtle)', marginBottom: '0.15rem' }}>Etapa Fenológica</div>
                  <div style={{ fontWeight: 600, color: '#10b981' }}>{growthStatus.stage}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-subtle)', marginBottom: '0.15rem' }}>Cosecha Estimada</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{growthStatus.fecha_cosecha}</div>
                </div>
              </div>
            )}
            <div style={{ height: '280px', position: 'relative' }}>
              <Line data={lineChartData} options={lineOptions} plugins={[currentWeekPlugin]} />
            </div>

            <div style={{ padding: '0.45rem 0.75rem', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.15)', fontSize: '0.72rem', marginTop: '0.35rem' }}>
              <span style={{ fontWeight: 700, color: '#10b981', marginRight: '0.4rem' }}>Resumen Fenológico:</span>
              <span style={{ color: 'var(--text-muted)', lineHeight: '1.3' }}>
                La curva proyectada (verde) estima alcanzar <strong>{kpis.rendimiento_predicho.toFixed(2)} t/ha</strong> al final del ciclo (semana 14), comparada con los escenarios mejor y peor registrados en tus simulaciones.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Limiting factors */}
      <div 
        className="glass-panel chart-panel-interactive"
        style={{ marginBottom: '1.25rem' }}
        onClick={() => pedirExplicacionIa({
          tipo_elemento: "grafico",
          nombre: "Contribución de Factores Limitantes al Gap",
          cultivo: "maiz",
          valor: "Porcentaje de pérdida por factor",
          unidad: "%",
          indigo: "factores limitantes",
          descripcion_tecnica: "Gráfico de barras que representa la proporción en la que el déficit de nitrógeno, agua o temperaturas inadecuadas contribuyen al Yield Gap (brecha de rendimiento).",
          impacto_base: "Ayuda a discriminar si las pérdidas de rendimiento del maíz se deben principalmente a desnutrición (nitrógeno) o sequía (déficit hídrico).",
          recomendacion_base: "Aumentar la fertilización si el factor Nitrógeno es el mayor limitante, o instalar sistemas de riego eficientes si el agua domina la brecha.",
          datos_grafico: factores_contribucion
        })}
      >
        <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Contribución de Factores Limitantes</h3>
        </div>
        <div className="glass-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.65rem' }}>
            {factores_contribucion.map((fc) => {
              const handleClick = (e) => {
                e.stopPropagation();
                
                // Mapear nombres para activar las reglas correctas del DSS
                let explainName = fc.factor;
                if (fc.factor === 'Agua') {
                  explainName = 'Precipitación (Agua)';
                } else if (fc.factor === 'Suelo (pH)') {
                  explainName = 'pH del Suelo';
                }
                
                pedirExplicacionIa({
                  tipo_elemento: "tarjeta",
                  nombre: explainName,
                  cultivo: "maiz",
                  valor: fc.porcentaje,
                  unidad: "% de contribución al Yield Gap",
                  estado: fc.porcentaje > 25 ? "crítico" : "regular",
                  descripcion_tecnica: `Representa el impacto relativo del factor ${fc.factor} sobre el Yield Gap (brecha de rendimiento). Determina en qué porcentaje este limitante reduce el rendimiento potencial del maíz en esta campaña.`,
                  impacto_base: `El factor ${fc.factor} contribuye con un ${fc.porcentaje}% al Yield Gap total.`,
                  recomendacion_base: fc.porcentaje > 25 
                    ? `Este factor es el limitante principal o de alto impacto. Se sugeriría prioritariamente ajustar su manejo agronómico (riego, fertilización, enmiendas o fecha de siembra).`
                    : `Este factor tiene un impacto bajo o moderado en la campaña actual.`
                });
              };

              return (
                <div 
                  key={fc.factor} 
                  style={{ 
                    background: 'var(--surface-elevated)', 
                    padding: '0.8rem 0.5rem', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-subtle)', 
                    textAlign: 'center',
                    transition: 'transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  onMouseEnter={e => { 
                    e.currentTarget.style.transform = 'translateY(-2px)'; 
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'; 
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.08)'; 
                  }}
                  onMouseLeave={e => { 
                    e.currentTarget.style.transform = 'translateY(0)'; 
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'; 
                    e.currentTarget.style.boxShadow = 'none'; 
                  }}
                  onClick={handleClick}
                >
                  {/* Circular SVG Gauge (Compact 64x64px) */}
                  {(() => {
                    const pct = Math.min(100, Math.max(0, fc.porcentaje));
                    const radius = 26;
                    const circ = 2 * Math.PI * radius; // 163.36
                    const strokeOffset = circ - (pct / 100) * circ;
                    
                    let strokeColor = '#10b981'; // Green
                    let severityText = 'Estable';
                    let severityClass = 'up';
                    
                    if (fc.porcentaje > 25) {
                      strokeColor = '#ef4444'; // Red
                      severityText = 'Crítico';
                      severityClass = 'down';
                    } else if (fc.porcentaje >= 15) {
                      strokeColor = '#fb923c'; // Orange
                      severityText = 'Moderado';
                      severityClass = 'down';
                    }

                    // Map factor to icon
                    let IconComponent = Gauge;
                    if (fc.factor === 'Agua') IconComponent = Droplets;
                    else if (fc.factor === 'Nitrógeno') IconComponent = Leaf;
                    else if (fc.factor === 'Temperatura') IconComponent = Thermometer;
                    else if (fc.factor === 'Fecha de Siembra') IconComponent = Calendar;

                    return (
                      <>
                        <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="32" cy="32" r={radius}
                              fill="none"
                              stroke={isLightTheme ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}
                              strokeWidth="4.5"
                            />
                            <circle
                              cx="32" cy="32" r={radius}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth="5.5"
                              strokeDasharray={circ}
                              strokeDashoffset={strokeOffset}
                              strokeLinecap="round"
                              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                            />
                          </svg>
                          <div style={{ position: 'absolute', color: strokeColor, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <IconComponent size={20} />
                          </div>
                        </div>
                        
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600, marginTop: '0.1rem' }}>
                          {fc.factor}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.15rem' }}>
                          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                            {fc.porcentaje}%
                          </span>
                        </div>

                        <span 
                          className={`kpi-trend-badge ${severityClass}`} 
                          style={{ 
                            fontSize: '0.58rem', 
                            padding: '0.12rem 0.45rem',
                            marginTop: '0.1rem',
                            background: fc.porcentaje > 25 ? 'rgba(239, 68, 68, 0.12)' : (fc.porcentaje >= 15 ? 'rgba(251, 146, 60, 0.12)' : 'rgba(16, 185, 129, 0.12)'),
                            color: strokeColor
                          }}
                        >
                          {severityText}
                        </span>
                      </>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalData && (
        <InfoModal
          isOpen={!!modalData}
          onClose={() => setModalData(null)}
          title={modalData.title}
          source={modalData.source}
          description={modalData.description}
          stats={modalData.stats}
          onExplain={modalData.onExplain}
        />
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
