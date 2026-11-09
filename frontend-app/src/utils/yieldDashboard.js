// Las métricas se derivan de la ejecución elegida; nunca de otra parcela.
export const yieldFactors = {
  temperatura_media_c: 'Temperatura media', humedad_relativa_pct: 'Humedad', precipitacion_mm: 'Precipitación', nitrogeno_kg_ha: 'Nitrógeno', ph_suelo: 'pH del suelo', tipo_suelo: 'Textura', variedad: 'Variedad', provincia: 'Provincia', zona: 'Zona', tipo_grano: 'Tipo de grano', riego_tipo: 'Tipo de riego', fosforo_p2o5_kg_ha: 'Fósforo', potasio_k2o_kg_ha: 'Potasio', densidad_plantas_ha: 'Densidad de plantas', ciclo_dias: 'Duración del ciclo', lamina_riego_mm: 'Lámina de riego', biofertilizante: 'Biofertilizante',
  precipitacion: 'Precipitación', fertilizante: 'Fertilización', temperatura: 'Temperatura',
  humedad: 'Humedad', phSuelo: 'pH del suelo', tipoSuelo: 'Textura del suelo',
  materia_organica_pct: 'Materia orgánica', profundidad_suelo_cm: 'Profundidad del suelo',
  textura_arcilla_pct: 'Arcilla del suelo', textura_arena_pct: 'Arena del suelo', textura_limo_pct: 'Limo del suelo',
  altitud_msnm: 'Altitud', temperatura_min_c: 'Temperatura mínima', temperatura_max_c: 'Temperatura máxima',
  horas_luz_dia: 'Horas de luz', magnesio_kg_ha: 'Magnesio', azufre_kg_ha: 'Azufre',
  aplicaciones_nitrogeno: 'Aplicaciones de nitrógeno', semilla_certificada: 'Semilla certificada',
  ndvi_v6_vegetativo: 'Índice de vegetación en crecimiento', ndvi_vt_floracion: 'Índice de vegetación en floración',
  ndvi_floracion: 'Índice de vegetación en floración', ndvi_r3_llenado_grano: 'Índice de vegetación en llenado',
  plagas_presentes: 'Plagas registradas', presion_plaga_score: 'Índice de presión de plagas', control_plaga: 'Control de plagas',
};

const provincias = ['Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'];
export const isYieldNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const normalizePlace = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function provinceFromLocation(value) {
  const place = ` ${normalizePlace(value)} `;
  return provincias.find((name) => place.includes(` ${normalizePlace(name)} `)) ?? null;
}

export function regionalHistory(periods, province, year) {
  const rows = periods.map((period) => ({ year: period.año, record: period.provincias.find((row) => normalizePlace(row.provincia) === normalizePlace(province)) ?? null }));
  return { rows, selected: rows.find((row) => row.year === year)?.record ?? null, coverage: rows.filter((row) => row.record !== null).length };
}

export function simulationHistory(simulations, selected, limit = 12) {
  const chronological = [...simulations].sort((a, b) => String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')) || a.id - b.id);
  const recent = chronological.slice(-limit);
  if (selected && !recent.some((row) => row.id === selected.id)) recent.unshift(selected);
  return recent;
}

export function yieldAnalysis(simulation, catalogue = {}) {
  const contributions = Object.entries(simulation?.explicacion_modelo?.aportes ?? simulation?.impactos_modelo_shap ?? {})
    .filter(([key, value]) => key !== 'area' && isYieldNumber(value))
    .map(([key, value]) => ({ key, name: yieldFactors[key] ?? key.replaceAll('_', ' '), value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const negativeTotal = contributions.reduce((sum, row) => sum + Math.max(0, -row.value), 0);
  const limiting = contributions.filter((row) => row.value < 0).map((row) => ({ ...row, share: -row.value / negativeTotal * 100 }));
  const potential = catalogue.rendimiento_maximo_catalogo;
  const predicted = simulation?.rendimiento_t_ha;
  const explanation = simulation?.explicacion_modelo;
  const sum = contributions.reduce((total, row) => total + row.value, 0);
  const base = isYieldNumber(explanation?.base) && !explanation.recortada
    && Math.abs(explanation.base + sum - predicted) < 0.01 ? explanation.base : null;
  let cursor = base;
  const cascade = isYieldNumber(base) ? [
    { name: 'Base', range: [0, base], value: base, kind: 'base' },
    ...contributions.map((row) => {
      const start = cursor;
      cursor += row.value;
      return { ...row, range: [start, cursor], kind: 'contribution' };
    }),
    { name: 'Predicción', range: [0, predicted], value: predicted, kind: 'total' },
  ] : [];
  return {
    contributions, limiting, cascade,
    gap: isYieldNumber(potential) && isYieldNumber(predicted) ? potential - predicted : null,
    potential: isYieldNumber(potential) ? potential : null,
    primary: limiting[0] ?? null,
  };
}
