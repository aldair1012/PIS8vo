import { AlertTriangle, CloudRain, Droplets, Waves } from 'lucide-react';

/**
 * Panel de estado agrícola de Clima y cultivo.
 * Reúne señales que ya existen en la respuesta del sistema —Pacífico (NOAA),
 * pronóstico (Open-Meteo), agua en suelo y etapa del cultivo— en una sola
 * lectura. No inventa cifras: cuando una señal falta se muestra «Sin dato».
 */
const nf = (value, digits = 0) => value === null || value === undefined || value === '' || Number.isNaN(Number(value))
  ? 'Sin dato'
  : new Intl.NumberFormat('es-EC', { maximumFractionDigits: digits }).format(Number(value));

const STAGES = [
  { code: 'siembra', label: 'Siembra', sub: 'INICIO' },
  { code: 'VE', label: 'Emergencia', sub: 'VE' },
  { code: 'V2-V8', label: 'Vegetativo', sub: 'V2 – V8' },
  { code: 'VT-R1', label: 'Floración', sub: 'VT – R1' },
  { code: 'R2-R5', label: 'Llenado', sub: 'R2 – R5' },
  { code: 'R6', label: 'Madurez', sub: 'R6' },
];

// Misma codificación fenológica que el registro de campo y el backend
// (ServicioMedicionesRendimiento::ETAPAS), normalizada para texto libre.
function matchStage(text) {
  if (!text) return null;
  const raw = String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/siembra/.test(raw)) return 'siembra';
  if (/r6|madurez/.test(raw)) return 'R6';
  if (/r2|r3|r4|r5|llenado/.test(raw)) return 'R2-R5';
  if (/vt|r1|florac|polin/.test(raw)) return 'VT-R1';
  if (/v2|v8|vegetativo/.test(raw)) return 'V2-V8';
  if (/\bve\b|emergencia/.test(raw)) return 'VE';
  return null;
}

export default function ClimateStatusPanel({ enso, ensoEstado, ensoIndex, ensoNota, forecast, soilWater, balance, stage, thermal, today, ask, riskIndex, lowRainProb, usefulWater }) {
  const validProbs = (Array.isArray(forecast) ? forecast : [])
    .map(day => day?.prob_precipitacion_pct)
    .filter(value => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number);
  const minProb = validProbs.length ? Math.min(...validProbs) : null;
  const maxProb = validProbs.length ? Math.max(...validProbs) : null;

  const warmPacific = ensoEstado === 'Anomalía cálida';
  const phase = warmPacific ? 'Niño' : ensoEstado === 'Anomalía fría' ? 'Niña' : (ensoIndex !== null ? 'Neutro' : 'Sin dato');
  const phaseTag = ensoIndex === null ? 'sin índice'
    : enso?.vigente === false ? 'referencia' : 'activo';

  const signals = [];
  if (warmPacific) signals.push('Pacífico cálido');
  if (soilWater !== null && soilWater !== undefined && Number(soilWater) < 30) signals.push('poca agua en el suelo');
  if (minProb !== null && minProb < 30) signals.push('baja probabilidad de lluvia');
  if (balance?.complete && Number(balance.balance) < 0) signals.push('déficit lluvia − ET₀');
  // El sistema ya reserva un índice de riesgo: se usa cuando el backend lo
  // publica; mientras tanto la lectura compuesta es orientativa y se dice.
  const officialRisk = riskIndex?.estado && riskIndex.estado !== 'no_disponible' && riskIndex.nivel
    ? riskIndex.nivel
    : null;
  const risk = officialRisk || (signals.length === 0 ? 'Bajo' : signals.length === 1 ? 'Moderado' : 'Alto');
  const riskDetail = officialRisk
    ? (riskIndex.motivo || riskIndex.descripcion || 'Índice publicado por el sistema')
    : (signals.length ? `Señales: ${signals.join(' · ')}` : 'Sin señales desfavorables en los datos disponibles');
  const rainProb = lowRainProb !== null && lowRainProb !== undefined && Number.isFinite(Number(lowRainProb)) ? Number(lowRainProb) : minProb;
  const waterValue = usefulWater !== null && usefulWater !== undefined && Number.isFinite(Number(usefulWater)) ? Number(usefulWater) : soilWater;
  const waterIsOfficial = waterValue !== soilWater;

  const thermalStage = (thermal?.hitos || [])
    .filter(hit => hit?.fecha && hit.fecha <= (today || '') && matchStage(hit.etapa))
    .map(hit => matchStage(hit.etapa))
    .pop();
  const currentStage = thermalStage || matchStage(stage?.valor);
  const stageOrigin = thermalStage ? 'estimación térmica' : stage?.valor ? 'tu observación de campo' : null;

  const askAbout = (question) => ask?.(question);

  return (
    <section className="climate-status-panel" aria-labelledby="climate-status-title">
      <div className="climate-status-topline">
        <span className="climate-status-kicker">LECTURA DE LA PARCELA</span>
        <h2 id="climate-status-title">Estado del clima y del cultivo</h2>
      </div>

      <div className="climate-status-cards">
        <button
          type="button"
          className={`climate-reading climate-reading--enso climate-status-card climate-status-card--enso${warmPacific || ensoEstado === 'Anomalía fría' ? ' climate-reading--enso-alerta' : ''}`}
          onClick={() => askAbout('Explícame el fenómeno de El Niño y La Niña que muestra Clima y cultivo. ¿Cómo se relaciona esta referencia del Pacífico con la fecha de siembra de mi parcela —actual o futura— y qué conviene revisar en el pronóstico de mi ubicación?')}
        >
          <Waves size={22} aria-hidden="true" />
          <span className="climate-status-card-body">
            <strong className="climate-status-value climate-status-value--risk">{phase} <em>({phaseTag})</em></strong>
            <span className="climate-status-label">ESTADO ENSO</span>
            <span className="climate-status-detail">{ensoEstado ?? 'Sin dato'}{enso?.periodo ? ` · ${enso.periodo}` : ''}</span>
            <span className="climate-reading-note">{ensoNota}</span>
          </span>
          <span className="climate-reading-title">El Niño y La Niña</span>
        </button>

        <button
          type="button"
          className="climate-status-card"
          onClick={() => askAbout('Explícame la probabilidad mínima y máxima de lluvia prevista en los próximos siete días para mi parcela. ¿Qué significa cada porcentaje y por qué no mide el riesgo de perder la cosecha?')}
        >
          <CloudRain size={22} aria-hidden="true" />
          <span className="climate-status-card-body">
            <strong className="climate-status-value">{nf(rainProb)} <small>%</small></strong>
            <span className="climate-status-label">PROB. LLUVIA MÍNIMA</span>
            <span className="climate-status-delta">máx. {nf(maxProb)} % en 7 días</span>
          </span>
          <span className="climate-reading-title">Probabilidad del pronóstico</span>
        </button>

        <button
          type="button"
          className="climate-status-card"
          onClick={() => askAbout('Explícame la humedad estimada del suelo de 0 a 10 cm que muestra Clima y cultivo. ¿Por qué no basta ese porcentaje para decidir cuándo y cuánto regar?')}
        >
          <Droplets size={22} aria-hidden="true" />
          <span className="climate-status-card-body">
            <strong className="climate-status-value">{nf(waterValue)} <small>{waterIsOfficial ? 'mm' : '%'}</small></strong>
            <span className="climate-status-label">{waterIsOfficial ? 'AGUA ÚTIL INICIAL' : 'AGUA EN SUELO 0–10 CM'}</span>
            <span className="climate-status-delta">{waterIsOfficial ? 'modelo del sistema' : 'del volumen · estimación, no sensor'}</span>
          </span>
          <span className="climate-reading-title">Agua en la capa superficial</span>
        </button>

        <button
          type="button"
          className="climate-status-card climate-status-risk"
          onClick={() => askAbout(officialRisk
            ? `Explica el índice de riesgo ${risk.toLowerCase()} publicado para mi parcela y qué señales lo sustentan. Aclara su alcance y vigencia.`
            : `Resume por qué la lectura compuesta de señales de mi parcela es de riesgo ${risk.toLowerCase()}: Pacífico, probabilidad de lluvia, agua en suelo y balance lluvia menos ET₀. Aclara que no es una alerta oficial.`)}
        >
          <AlertTriangle size={22} aria-hidden="true" />
          <span className="climate-status-card-body">
            <span className="climate-status-label">RIESGO ESTACIONAL</span>
            <strong className="climate-status-value climate-status-value--risk">{risk}</strong>
            <span className="climate-status-detail">{riskDetail}</span>
          </span>
          <span className="climate-reading-title">Lectura compuesta</span>
        </button>
      </div>

      <div className="climate-status-divider" />

      <div className="climate-stage-block">
        <span className="climate-status-kicker">ESTADO DE CRECIMIENTO DEL CULTIVO — ETAPAS FENOLÓGICAS</span>
        <div className="climate-crop-grid climate-stage-rail">
          <p className="climate-stage-caption">
            {currentStage
              ? <>Etapa señalada por {stageOrigin}: <strong>{stage?.valor || STAGES.find(item => item.code === currentStage)?.label}</strong>.</>
              : 'Sin etapa confirmada: regístrala en Tu cultivo y tus observaciones para seguir el ciclo.'}
          </p>
          <ol className="climate-stage-list">
            {STAGES.map((item, index) => {
              const reached = currentStage ? index <= STAGES.findIndex(s => s.code === currentStage) : false;
              const current = item.code === currentStage;
              return (
                <li key={item.code} className={`climate-stage${current ? ' is-current' : ''}${reached ? ' is-reached' : ''}`}>
                  <span className="climate-stage-name">{item.label}</span>
                  <span className="climate-stage-code">{current ? 'ETAPA ACTUAL' : item.sub}</span>
                  <span className="climate-stage-dot" aria-hidden="true" />
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <p className="climate-status-source">
        Fuentes: NOAA (índice del Pacífico) · Open-Meteo (pronóstico y suelo) · catálogo agronómico local.
        Indicadores orientativos construidos con los datos disponibles: no son alertas oficiales ni pronósticos de pérdida de cosecha.
      </p>
    </section>
  );
}
