// Revisión a una edad fija del cultivo. No identifica una fase fenológica.
const DIA = 86400000;
const MIN_AJUSTE = 6;
const MIN_PRUEBA = 5;
const mover = (fecha, dias) => new Date(Date.parse(fecha + 'T00:00:00Z') + dias * DIA).toISOString().slice(0, 10);
const dia = fecha => typeof fecha === 'string' ? fecha.slice(0, 10) : '';
function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const instante = Date.parse(fecha+'T00:00:00Z');
  return Number.isFinite(instante) && new Date(instante).toISOString().slice(0,10) === fecha;
}

function lectura(siembra, observaciones) {
  const corte = mover(siembra, 45);
  const inicio = mover(corte, -7);
  const datos = observaciones.filter(o => o.fecha_siembra === siembra && o.fecha >= inicio && o.fecha < corte &&
    dia(o.registrado_en) && dia(o.registrado_en) < corte && o.ndvi != null && o.ndvi !== '' &&
    Number.isFinite(Number(o.ndvi)) && Math.abs(Number(o.ndvi)) <= 1);
  if (!datos.length) return null;
  const ultima = datos.reduce((fecha, o) => o.fecha > fecha ? o.fecha : fecha, '');
  const valores = datos.filter(o => o.fecha === ultima).map(o => Number(o.ndvi));
  return { corte, ndvi: valores.reduce((a,b) => a+b,0)/valores.length, fecha: ultima };
}

function ajustar(anteriores, objetivo) {
  if (anteriores.length < MIN_AJUSTE) return null;
  const x = anteriores.map(a => a.ndvi);
  if (objetivo.ndvi < Math.min(...x) || objetivo.ndvi > Math.max(...x)) return null;
  const mediaX = x.reduce((a,b) => a+b,0)/x.length;
  const mediaError = anteriores.reduce((s,a) => s+a.error,0)/x.length;
  const varianza = x.reduce((s,v) => s+(v-mediaX)**2,0);
  if (varianza < 1e-8) return null;
  const pendiente = anteriores.reduce((s,a) => s+(a.ndvi-mediaX)*(a.error-mediaError),0)/varianza;
  return { ajustada: Math.max(0,objetivo.base + mediaError + pendiente*(objetivo.ndvi-mediaX)),
    simple: Math.max(0,objetivo.base + mediaError) };
}

export function seguimientoNdvi(cosechas, observaciones, simulacion, hoy) {
  const siembra = simulacion?.parcela_ejecucion?.fecha_siembra;
  const plan = dia(simulacion?.fecha);
  if (!fechaValida(siembra) || !fechaValida(plan) || plan > siembra || !simulacion.version_modelo || !Number.isFinite(simulacion.rendimiento_t_ha)) {
    return { motivo:'Selecciona una predicción versionada guardada a más tardar el día de siembra.' };
  }
  const corte = mover(siembra,45);
  if (hoy < corte) return { motivo:'La primera revisión con NDVI corresponde al ' + corte + '.' };
  if (cosechas.some(c => c.fecha_siembra === siembra && c.fecha_cosecha <= corte)) return { motivo:'La cosecha ocurrió antes de completar el periodo de seguimiento.' };
  const objetivo = lectura(siembra, observaciones);
  if (!objetivo) return { motivo:'Falta un NDVI medido y registrado entre los días 38 y 44 desde la siembra.' };
  const historial = [];
  for (const c of cosechas) {
    const p = c.prediccion;
    if (!c.base_comparable || !p || p.version_modelo !== simulacion.version_modelo ||
        !fechaValida(c.fecha_siembra) || !fechaValida(c.fecha_cosecha) || !fechaValida(dia(p.fecha)) ||
        dia(p.fecha) > c.fecha_siembra || !dia(c.registrado_en) || dia(c.registrado_en) >= corte ||
        c.fecha_cosecha >= corte || c.fecha_siembra === siembra || !Number.isFinite(c.observado_t_ha) ||
        !Number.isFinite(p.rendimiento_t_ha)) continue;
    const dato = lectura(c.fecha_siembra, observaciones);
    if (!dato || dato.corte >= c.fecha_cosecha) continue;
    historial.push({ ...dato, base:p.rendimiento_t_ha, real:c.observado_t_ha, error:c.observado_t_ha-p.rendimiento_t_ha,
      disponible: [c.fecha_cosecha,dia(c.registrado_en)].sort()[1] });
  }
  const pruebas = [];
  for (const caso of historial) {
    const calculo = ajustar(historial.filter(h => h.disponible < caso.corte), caso);
    if (calculo) pruebas.push([caso.base,calculo.simple,calculo.ajustada].map(v => Math.abs(v-caso.real)));
  }
  const ajuste = ajustar(historial,{ ...objetivo, base:simulacion.rendimiento_t_ha });
  const resultado = { n:historial.length, pruebas:pruebas.length, corte, lectura:objetivo.fecha };
  if (pruebas.length < MIN_PRUEBA || !ajuste) return { ...resultado, motivo:'Se conserva la planificación. El ajuste necesita seis campañas previas, cinco evaluaciones posteriores y NDVI dentro del intervalo observado.' };
  const [base,simple,ndvi] = [0,1,2].map(i => pruebas.reduce((s,p) => s+p[i],0)/pruebas.length);
  const metricas = { ...resultado, maePlan:base, maeSimple:simple, maeNdvi:ndvi };
  if (ndvi >= 0.95*Math.min(base,simple)) return { ...metricas, motivo:'Se conserva la planificación. El NDVI no redujo el error al menos un 5 % frente a ambas referencias.' };
  return { ...metricas, rendimiento:ajuste.ajustada };
}
