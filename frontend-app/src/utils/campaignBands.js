// Orden estadístico bilateral de residuos (observado - predicho). Los extremos
// finitos al 90 % requieren al menos 19 residuos y al 50 % requieren tres.
export function campaignBands(harvests, simulation) {
  const result = { n: 0, median: null, bands: [] };
  const prediction = simulation?.rendimiento_t_ha;
  const cutoff = simulation?.fecha?.replace('T', ' ');
  if (!cutoff || !simulation.version_modelo || !Number.isFinite(prediction)) return result;
  const residuals = harvests
    .filter(row => row.base_comparable && row.prediccion?.version_modelo === simulation.version_modelo
      && row.prediccion.id !== simulation.id && row.fecha_siembra !== simulation.parcela_ejecucion?.fecha_siembra
      && row.fecha_cosecha < cutoff.slice(0, 10) && row.registrado_en?.replace('T', ' ') < cutoff)
    .map(row => row.observado_t_ha - row.prediccion.rendimiento_t_ha)
    .filter(Number.isFinite).sort((a, b) => a - b);
  result.n = residuals.length;
  if (!result.n) return result;
  const mid = Math.floor(result.n / 2);
  result.median = Math.max(0, prediction + (result.n % 2 ? residuals[mid] : (residuals[mid - 1] + residuals[mid]) / 2));
  for (const [level, divisor] of [[50, 4], [90, 20]]) {
    const rank = Math.floor((result.n + 1) / divisor);
    if (rank < 1) continue;
    result.bands.push({ level, low: Math.max(0, prediction + residuals[rank - 1]),
      high: Math.max(0, prediction + residuals[result.n - rank]) });
  }
  return result;
}
