export function parseSimulationNumber(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim().replace(',', '.');
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function precipitationPeriod(simulation) {
  if (simulation?.trazabilidad?.periodo_precipitacion) return simulation.trazabilidad.periodo_precipitacion;
  try {
    return JSON.parse(simulation?.escenarios_json ?? '{}')._zeasys_modelo?.trazabilidad?.periodo_precipitacion ?? 'periodo no confirmado';
  } catch {
    return 'periodo no confirmado';
  }
}

export function normalizarDecimalEntrada(value) {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  // Agrupaciones inequívocas: 3.500,25 o 3,500.25.
  if (/^-?\d{1,3}(?:\.\d{3})+,\d+$/.test(raw)) return raw.replaceAll('.', '').replace(',', '.');
  if (/^-?\d{1,3}(?:,\d{3})+\.\d+$/.test(raw)) return raw.replaceAll(',', '');
  // 3,500 puede significar 3500 o 3.5: pedir aclaración evita cambiar el dato.
  if (/^-?[1-9]\d{0,2},\d{3}$/.test(raw)) return raw;
  return /^-?\d*,\d*$/.test(raw) ? raw.replace(',', '.') : raw;
}

export function parseScenarioNumber(value) {
  const normalized = normalizarDecimalEntrada(value);
  if (typeof normalized === 'string' && normalized.includes(',')) return null;
  return parseSimulationNumber(normalized);
}
