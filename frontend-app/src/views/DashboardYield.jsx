import React, { useState, useEffect } from 'react';
import { dssService, simulacionService } from '../services/api';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import InfoModal from '../templates/Common/InfoModal';
import InteractiveKPI from '../templates/Common/InteractiveKPI';
import AIExplainModal from '../templates/Common/AIExplainModal';
import EmptyDashboard from '../templates/Common/EmptyDashboard';
import usarExplicacionIA from '../hooks/usarExplicacionIA';

ChartJS.register(...registerables);

import { 
  BarChart2, 
  MinusCircle, 
  TrendingUp, 
  CheckCircle,
  HelpCircle,
  Sparkles,
  Leaf,
  Droplets,
  Thermometer,
  Calendar,
  Gauge
} from 'lucide-react';

export default function DashboardYield({ cultivoElegidoId, anioSeleccionado, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  
  const {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    pedirExplicacionIa,
    setRespuestasIaGuardadas
  } = usarExplicacionIA(cultivoElegidoId, anioSeleccionado);

  useEffect(() => {
    if (data && data.kpis && typeof data.kpis.rendimiento_predicho === 'number') {
      const { kpis } = data;
      const preloadKey = "Rendimiento Predicho Final";
      const preloadContext = {
        tipo_elemento: "tarjeta",
        nombre: preloadKey,
        cultivo: "maiz",
        valor: parseFloat((kpis.rendimiento_predicho || 6.25).toFixed(2)),
        unidad: "t/ha",
        color: (kpis.rendimiento_predicho || 6.25) > 6.0 ? "success" : ((kpis.rendimiento_predicho || 6.25) > 4.5 ? "warning" : "danger"),
        rango_ideal: "6.0 a 8.5 t/ha",
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
  }, [data, cultivoElegidoId, anioSeleccionado]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await dssService.getYieldData(cultivoElegidoId, anioSeleccionado);
        setData(res);
      } catch (err) {
        setError('Error al cargar la brecha productiva.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [cultivoElegidoId, anioSeleccionado]);

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
  const kpis = {
    rendimiento_potencial: 12.0,
    rendimiento_alcanzable: 8.5,
    rendimiento_predicho: 6.25,
    yield_gap_total: 5.75,
    principal_limitante: 'Fertilización',
    ...(data?.kpis || {})
  };

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
        label: 'Mejor Año Histórico',
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
        label: 'Peor Año Histórico',
        data: fenologia_comparativa?.peor_ano || [0, 0, 0, 0, 0, 0, 0],
        borderColor: '#dc2626',
        borderDash: [5, 5],
        fill: 1, // Rellenar hasta el índice 1 del conjunto de datos ("Mejor Año Histórico")
        backgroundColor: isLightTheme ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.03)',
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: isLightTheme ? '#0f172a' : '#fff',
        pointHoverBorderColor: isLightTheme ? '#0f172a' : '#fff'
      }
    ]
  };

  const maxYieldVal = Math.max(...(fenologia_comparativa?.mejor_ano || [7]), kpis?.rendimiento_predicho || 6);

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

  // Ayudantes de progreso
  const potencialMax = 14;
  const predichoProgress = Math.min(100, (kpis.rendimiento_predicho / potencialMax) * 100);
  const alcanzableProgress = Math.min(100, (kpis.rendimiento_alcanzable / potencialMax) * 100);
  
  const potencialSlides = [
    {
      title: "Rendimiento Potencial",
      value: <>{kpis.rendimiento_potencial} <span className="kpi-value-unit">t/ha</span></>,
      trend: "Máximo Genético",
      progress: 100,
      progressColor: "linear-gradient(90deg, #863bff 0%, #a855f7 100%)",
      progressLabelLeft: "Estabilidad",
      progressLabelRight: "100%",
      miniChart: { type: 'line', data: [kpis.rendimiento_potencial * 0.95, kpis.rendimiento_potencial * 0.98, kpis.rendimiento_potencial * 0.99, kpis.rendimiento_potencial], color: '#c084fc' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Rendimiento Potencial Teórico",
        cultivo: "maiz",
        valor: `${kpis.rendimiento_potencial} t/ha`,
        unidad: "t/ha",
        estado: "optimo",
        rango_ideal: "12.0 a 14.5 t/ha",
        descripcion_tecnica: "Rendimiento máximo genético de este híbrido de maíz en condiciones ideales de laboratorio o parcelas experimentales sin plagas ni deficiencias hídricas.",
        impacto_base: "Sirve como meta teórica para medir la brecha productiva total y planificar el potencial de la semilla.",
        recomendacion_base: "Es útil para calcular qué porcentaje del potencial genético real se está alcanzando en el lote."
      }
    },
    {
      title: "Radiación Fotosintética",
      value: <>420 <span className="kpi-value-unit">cal/cm²</span></>,
      trend: "Óptima C4",
      progress: 95,
      progressColor: "linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)",
      progressLabelLeft: "Captura Luz",
      progressLabelRight: "95%",
      miniChart: { type: 'bar', data: [390, 405, 415, 420], color: '#38bdf8' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Radiación Fotosintéticamente Activa (PAR)",
        cultivo: "maiz",
        valor: "420 cal/cm²",
        unidad: "cal/cm²",
        estado: "optimo",
        rango_ideal: "380 a 450 cal/cm²",
        descripcion_tecnica: "Nivel de radiación solar capturado por la canopia foliar para activar la fijación de carbono vía fotosíntesis C4 durante el llenado de grano.",
        impacto_base: "Asegura la producción de carbohidratos necesarios para maximizar el peso del grano de maíz.",
        recomendacion_base: "Mantener una densidad de siembra uniforme para maximizar la intercepción de luz solar por metro cuadrado."
      }
    },
    {
      title: "Límite Genético Híbrido",
      value: <>14.5 <span className="kpi-value-unit">t/ha</span></>,
      trend: "Teórico",
      progress: 100,
      progressColor: "linear-gradient(90deg, #c084fc 0%, #e879f9 100%)",
      progressLabelLeft: "Teórico Absoluto",
      progressLabelRight: "Max",
      miniChart: { type: 'ring', percent: 100, color: '#c084fc' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Límite Genético del Híbrido de Maíz",
        cultivo: "maiz",
        valor: "14.5 t/ha",
        unidad: "t/ha",
        estado: "optimo",
        rango_ideal: "14.0 a 15.0 t/ha",
        descripcion_tecnica: "Techo biológico insuperable fijado por el mejoramiento genético de la semilla bajo nutrición y clima sin restricciones.",
        impacto_base: "Representa el límite biológico absoluto que puede alcanzar la variedad en las mejores condiciones del mundo.",
        recomendacion_base: "Utilizar semillas certificadas de alto rendimiento para garantizar un techo genético elevado."
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
      miniChart: { type: 'line', data: [kpis.rendimiento_alcanzable * 0.88, kpis.rendimiento_alcanzable * 0.93, kpis.rendimiento_alcanzable * 0.97, kpis.rendimiento_alcanzable], color: '#60a5fa' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Rendimiento Alcanzable",
        cultivo: "maiz",
        valor: `${kpis.rendimiento_alcanzable} t/ha`,
        unidad: "t/ha",
        estado: "favorable",
        rango_ideal: "8.0 a 11.0 t/ha",
        descripcion_tecnica: "Rendimiento límite que se puede lograr en el lote con el clima y tipo de suelo reales, asumiendo un manejo perfecto de nutrientes sin pérdidas.",
        impacto_base: "Define la meta productiva realista del cultivo considerando las restricciones naturales e inamovibles del suelo.",
        recomendacion_base: "Ajustar la nutrición y riego para evitar pérdidas que reduzcan el rendimiento real por debajo de este límite alcanzable."
      }
    },
    {
      title: "Capacidad de Suelo",
      value: "Franco-Arcilloso",
      trend: "Cap. Campo",
      progress: 80,
      progressColor: "linear-gradient(90deg, #60a5fa 0%, #93c5fd 100%)",
      progressLabelLeft: "Retención Hídrica",
      progressLabelRight: "Buena",
      miniChart: { type: 'bar', data: [70, 75, 78, 80], color: '#60a5fa' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Capacidad de Almacenamiento del Suelo",
        cultivo: "maiz",
        valor: "Textura Franco-Arcillosa",
        unidad: "",
        estado: "favorable",
        rango_ideal: "Franco o Franco-Arcilloso",
        descripcion_tecnica: "Propiedad física del suelo que determina la capacidad de retención de humedad y nutrientes disponibles para el sistema radicular del maíz.",
        impacto_base: "Los suelos franco-arcillosos mantienen el agua durante períodos secos cortos sin asfixiar las raíces.",
        recomendacion_base: "Evitar el compacamiento por maquinaria pesada para mantener la porosidad del suelo."
      }
    },
    {
      title: "Agua Útil Ciclo",
      value: <>480 <span className="kpi-value-unit">mm</span></>,
      trend: "Requerida",
      progress: 88,
      progressColor: "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)",
      progressLabelLeft: "Balance Hídrico",
      progressLabelRight: "88%",
      miniChart: { type: 'ring', percent: 88, color: '#3b82f6' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Balance de Agua Útil Requerido en Ciclo",
        cultivo: "maiz",
        valor: "480 mm",
        unidad: "mm",
        estado: "favorable",
        rango_ideal: "450 a 550 mm",
        descripcion_tecnica: "Volumen de lámina de agua evapotranspirada requerida por la planta de maíz a lo largo de sus 120-130 días de ciclo vegetativo y reproductivo.",
        impacto_base: "Un suministro hídrico cercano a 500 mm evita el aborto floral y asegura espigas bien llenas.",
        recomendacion_base: "Monitorear la humedad del suelo en la fase crítica entre V8 y VT (floración)."
      }
    }
  ];

  const predichoSlides = [
    {
      title: "Predicho Final",
      value: <>{kpis.rendimiento_predicho.toFixed(2)} <span className="kpi-value-unit">t/ha</span></>,
      trend: kpis.rendimiento_predicho > 6.0 ? "Bueno" : "Bajo",
      progress: predichoProgress,
      progressColor: kpis.rendimiento_predicho > 6.0 
        ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)" 
        : "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
      progressLabelLeft: kpis.rendimiento_predicho > 6.0 ? "Saludable" : "Alerta de baja",
      progressLabelRight: `${predichoProgress.toFixed(0)}%`,
      miniChart: { type: 'line', data: [kpis.rendimiento_predicho * 0.82, kpis.rendimiento_predicho * 0.89, kpis.rendimiento_predicho * 0.95, kpis.rendimiento_predicho], color: '#34d399' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Rendimiento Predicho Final",
        cultivo: "maiz",
        valor: `${parseFloat(kpis.rendimiento_predicho.toFixed(2))} t/ha`,
        unidad: "t/ha",
        estado: kpis.rendimiento_predicho > 6.0 ? "bueno" : (kpis.rendimiento_predicho > 4.5 ? "regular" : "bajo"),
        rango_ideal: "6.0 a 8.5 t/ha",
        descripcion_tecnica: "El rendimiento de cosecha que la simulación estima que se obtendrá al final del ciclo basándose en las variables climáticas e insumos ingresados.",
        impacto_base: "Determina directamente la viabilidad del cultivo y el volumen total de toneladas que se podrán vender.",
        recomendacion_base: "Si el valor es inferior al rango óptimo, se sugiere revisar el balance de fertilizantes y el manejo de agua antes de iniciar la campaña."
      }
    },
    {
      title: "Probabilidad Cosecha",
      value: <>87 <span className="kpi-value-unit">%</span></>,
      trend: "Confianza Alta",
      progress: 87,
      progressColor: "linear-gradient(90deg, #10b981 0%, #6ee7b7 100%)",
      progressLabelLeft: "Modelo Biofísico",
      progressLabelRight: "87%",
      miniChart: { type: 'ring', percent: 87, color: '#34d399' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Probabilidad de Éxito en Cosecha",
        cultivo: "maiz",
        valor: "87 %",
        unidad: "%",
        estado: "bueno",
        rango_ideal: "Mayor al 80%",
        descripcion_tecnica: "Nivel de certeza estadística con el que el simulador valida que el cultivo alcanzará el rendimiento estimado sin colapso hídrico.",
        impacto_base: "Otorga seguridad técnica al productor sobre la efectividad de sus decisiones agronómicas.",
        recomendacion_base: "Mantener el monitoreo de plagas para preservar la alta certeza de cosecha."
      }
    },
    {
      title: "Índice de Cosecha",
      value: <>0.48 <span className="kpi-value-unit">HI</span></>,
      trend: "Eficiente",
      progress: 78,
      progressColor: "linear-gradient(90deg, #059669 0%, #10b981 100%)",
      progressLabelLeft: "Biomasa a Grano",
      progressLabelRight: "0.48",
      miniChart: { type: 'ring', percent: 78, color: '#059669' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Índice de Cosecha (Harvest Index - HI)",
        cultivo: "maiz",
        valor: "0.48 HI",
        unidad: "HI",
        estado: "bueno",
        rango_ideal: "0.45 a 0.52",
        descripcion_tecnica: "Proporción de la biomasa total de la planta que se transforma en grano de maíz comercializable.",
        impacto_base: "Un valor de 0.48 indica que casi la mitad de todo el peso seco producido por la planta se convirtió en grano.",
        recomendacion_base: "Garantizar suficiente nitrógeno durante el llenado para no perder fotosíntesis foliar."
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
      miniChart: { type: 'bar', data: [kpis.yield_gap_total * 1.25, kpis.yield_gap_total * 1.12, kpis.yield_gap_total * 1.04, kpis.yield_gap_total], color: '#f87171' },
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
      value: <>-2.4 <span className="kpi-value-unit">t/ha</span></>,
      trend: "Alerta Seca",
      progress: 55,
      progressColor: "linear-gradient(90deg, #f87171 0%, #fca5a5 100%)",
      progressLabelLeft: "Estrés Hídrico",
      progressLabelRight: "55%",
      miniChart: { type: 'bar', data: [3.0, 2.8, 2.6, 2.4], color: '#f87171' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Pérdida de Rendimiento por Estrés Hídrico",
        cultivo: "maiz",
        valor: "-2.4 t/ha",
        unidad: "t/ha",
        estado: "riesgoso",
        rango_ideal: "Menor a 0.8 t/ha",
        descripcion_tecnica: "Reducción directa en toneladas causada por déficit de agua durante las etapas vegetativas y reproductivas críticas del maíz.",
        impacto_base: "Es el factor que más recorte causa en la cosecha esperada del lote.",
        recomendacion_base: "Aplicar riegos complementarios en la etapa V6-VT para recuperar hasta 1.8 t/ha."
      }
    },
    {
      title: "Pérdida por Nitrógeno",
      value: <>-1.9 <span className="kpi-value-unit">t/ha</span></>,
      trend: "Nutricional",
      progress: 45,
      progressColor: "linear-gradient(90deg, #dc2626 0%, #ef4444 100%)",
      progressLabelLeft: "Déficit N",
      progressLabelRight: "45%",
      miniChart: { type: 'bar', data: [2.5, 2.2, 2.0, 1.9], color: '#dc2626' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Pérdida de Rendimiento por Déficit de Nitrógeno",
        cultivo: "maiz",
        valor: "-1.9 t/ha",
        unidad: "t/ha",
        estado: "riesgoso",
        rango_ideal: "Menor a 0.5 t/ha",
        descripcion_tecnica: "Toneladas dejadas de cosechar debido a una dosis insuficiente de nitrógeno o mala sincronización en su aplicación.",
        impacto_base: "El nitrógeno es el motor del crecimiento del maíz; su escasez amarillea las hojas e impide el desarrollo completo de las mazorcas.",
        recomendacion_base: "Dividir la aplicación de nitrógeno en dos fracciones (siembra y V6) para elevar la eficiencia de absorción."
      }
    }
  ];

  const limitanteSlides = [
    {
      title: "Limitante Principal",
      value: kpis.principal_limitante,
      trend: kpis.yield_gap_total > 3.0 ? "Crítico" : "Moderado",
      progress: kpis.yield_gap_total > 3.0 ? 85 : 45,
      progressColor: kpis.yield_gap_total > 3.0 
        ? "linear-gradient(90deg, #f97316 0%, #ef4444 100%)" 
        : "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)",
      progressLabelLeft: "Severidad",
      progressLabelRight: kpis.yield_gap_total > 3.0 ? "Alta" : "Media",
      miniChart: { type: 'ring', percent: kpis.yield_gap_total > 3.0 ? 85 : 45, color: '#f97316' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Limitante Principal del Cultivo",
        cultivo: "maiz",
        valor: kpis.principal_limitante,
        unidad: "",
        estado: "regular",
        rango_ideal: "Ninguno",
        descripcion_tecnica: "El insumo o factor agroclimático que causa la mayor caída en la curva de acumulación de rendimiento simulado.",
        impacto_base: "Actúa como cuello de botella del rendimiento. Si este factor no se corrige, otros esfuerzos agrícolas tendrán un impacto muy limitado.",
        recomendacion_base: "Priorizar la inversión de insumos o la corrección de prácticas agrícolas específicamente en este factor limitante."
      }
    },
    {
      title: "Acción Prioritaria",
      value: "Riego V8",
      trend: "Urgente",
      progress: 90,
      progressColor: "linear-gradient(90deg, #f97316 0%, #fbbf24 100%)",
      progressLabelLeft: "Recuperación",
      progressLabelRight: "+1.8 t/ha",
      miniChart: { type: 'bar', data: [0.5, 1.0, 1.4, 1.8], color: '#fbbf24' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Acción Correctora Prioritaria Recomenda por DSS",
        cultivo: "maiz",
        valor: "Riego Complementario V8",
        unidad: "",
        estado: "regular",
        rango_ideal: "Ejecución oportuna",
        descripcion_tecnica: "Práctica agronómica inmediata que genera la mayor recuperación de rendimiento por cada dólar invertido.",
        impacto_base: "Aplicar riego en V8 evita el aborto foliar y recupera hasta 1.8 toneladas por hectárea.",
        recomendacion_base: "Programar la maquinaria de riego antes de que el cultivo entre en la fase floral V8-VT."
      }
    },
    {
      title: "Fase Vulnerable",
      value: "Floración",
      trend: "Sensible",
      progress: 95,
      progressColor: "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
      progressLabelLeft: "Riesgo Aborto",
      progressLabelRight: "Alto",
      miniChart: { type: 'ring', percent: 95, color: '#ef4444' },
      explanation: {
        tipo_elemento: "tarjeta",
        nombre: "Fase Fenológica Más Vulnerable",
        cultivo: "maiz",
        valor: "Floración (VT - R1)",
        unidad: "",
        estado: "riesgoso",
        rango_ideal: "Sin estrés hídrico",
        descripcion_tecnica: "Etapa del desarrollo donde la planta de maíz es extremadamente sensible a la sequía o temperaturas superiores a 35°C.",
        impacto_base: "El estrés hídrico en floración causa secado de estigmas y aborto masivo de granos.",
        recomendacion_base: "Asegurar que el suelo mantenga buena humedad durante los 10 días previos y posteriores a la emisión de estigmas."
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
          tooltip="Rendimiento final estimado por el modelo biofísico para las condiciones actuales de la campaña."
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
              const potVal = kpis.rendimiento_potencial || 7.0;
              const predVal = kpis.rendimiento_predicho || 2.72;

              // Posiciones flotantes escalonadas de la cascada
              const pNitrogeno = 1.10;
              const pAgua = 1.30;
              const pTemp = 1.10;
              const aSiembra = 0.60;
              const aSuelo = 0.20;

              const step1 = potVal;
              const step2 = step1 - pNitrogeno;
              const step3 = step2 - pAgua;
              const step4 = step3 - pTemp;
              const step5 = step4 + aSiembra;
              const step6 = step5 + aSuelo;

              const chartData = {
                labels: [
                  'Potencial Teórico',
                  'Déficit Nitrógeno',
                  'Estrés Hídrico (Agua)',
                  'Estrés Térmico (Temp)',
                  'Ventana de Siembra',
                  'Acidez / Suelo (pH)',
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
                      <span style={{ fontWeight: 800, color: '#ef4444' }}>-4.28 t/ha <small style={{ opacity: 0.8 }}>(61.1%)</small></span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mayor Factor Limítrofe</span>
                      <span style={{ fontWeight: 800, color: '#3b82f6' }}>Estrés Hídrico (-1.30 t/ha)</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Acción Correctiva DSS</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>Riego Complementario V6-VT</span>
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
                La curva proyectada (verde) estima alcanzar <strong>{kpis.rendimiento_predicho.toFixed(2)} t/ha</strong> al final del ciclo (semana 14), manteniéndose holgadamente por encima del escenario crítico histórico.
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
