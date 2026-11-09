import schema from '../../../backend-api/data/referencias/entradas-campo.json' with { type: 'json' };
import { parseScenarioNumber } from './simulationInput.js';

export const camposCultivo = schema.campos;

export function prepararCamposCultivo(campos, temperatura) {
  const result = {};
  for (const [key, raw] of Object.entries(campos)) {
    const rule = camposCultivo[key];
    if (!rule) throw new Error(`Parámetro de campo no admitido: ${key}`);
    if (raw === '') continue;
    if (rule.opciones && !rule.entero) {
      if (!Object.hasOwn(rule.opciones, raw)) throw new Error(`Selecciona una opción válida para ${rule.label}.`);
      result[key] = raw;
      continue;
    }
    const value = parseScenarioNumber(raw);
    if (value === null || (rule.entero && !Number.isInteger(value)) || (rule.opciones ? !Object.hasOwn(rule.opciones, value) : value < rule.min || value > rule.max)) {
      throw new Error(`Revisa ${rule.label}: introduce un valor válido${rule.opciones ? '' : ` entre ${rule.min} y ${rule.max}`}.`);
    }
    result[key] = value;
  }
  if ((result.temperatura_min_c ?? temperatura) > temperatura || (result.temperatura_max_c ?? temperatura) < temperatura) {
    throw new Error('La temperatura mínima debe ser menor o igual a la media, y la máxima mayor o igual.');
  }
  return result;
}

export function finCultivo(fecha, dias) {
  if (!fecha || !Number.isInteger(dias) || dias < 1 || dias > 730 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const date = new Date(`${fecha}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== fecha || date.getUTCFullYear() < 1950 || date.getUTCFullYear() > 2100) return null;
  date.setUTCDate(date.getUTCDate() + dias - 1);
  return date.toISOString().slice(0, 10);
}
