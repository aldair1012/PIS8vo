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

function diaCalendario(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const date = new Date(`${fecha}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === fecha ? date : null;
}

function desplazarFecha(fecha, dias) {
  const date = diaCalendario(fecha);
  if (!date || !Number.isInteger(dias)) return null;
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

export function finCultivo(fecha, dias) {
  if (!fecha || fecha < '1950-01-01' || fecha > '2100-12-31' || !Number.isInteger(dias) || dias < 1 || dias > 730) return null;
  return desplazarFecha(fecha, dias - 1);
}

export function diasCultivo(inicio, fin) {
  const a = diaCalendario(inicio), b = diaCalendario(fin);
  if (!a || !b || b < a) return null;
  return (b - a) / 86400000 + 1;
}

// Guarda las dos entradas que mandan. La tercera siempre se obtiene de ellas.
export function periodoCultivo(fecha = '', dias = '') {
  return { fecha: fecha || '', dias: String(dias ?? ''), cosecha: finCultivo(fecha, Number(dias)) || '', calculado: 'cosecha' };
}

export function editarPeriodo(actual, campo, valor) {
  if (actual[campo] === valor) return actual;
  const siguiente = { ...actual, [campo]: valor };
  if (campo === actual.calculado) {
    // Al corregir una estimación se conserva la siembra siempre que exista.
    if (campo === 'fecha') siguiente.calculado = actual.dias ? 'cosecha' : 'dias';
    if (campo === 'cosecha') siguiente.calculado = actual.fecha || !actual.dias ? 'dias' : 'fecha';
    if (campo === 'dias') siguiente.calculado = actual.fecha || !actual.cosecha ? 'cosecha' : 'fecha';
  }
  const { fecha, dias, cosecha, calculado } = siguiente;
  if (calculado === 'dias') {
    const duracion = diasCultivo(fecha, cosecha);
    siguiente.dias = duracion !== null && duracion <= 730 ? String(duracion) : '';
  } else if (calculado === 'fecha') {
    const n = Number(dias);
    siguiente.fecha = Number.isInteger(n) && n >= 1 && n <= 730 ? desplazarFecha(cosecha, 1 - n) || '' : '';
  } else {
    siguiente.cosecha = finCultivo(fecha, Number(dias)) || '';
  }
  return siguiente;
}

export function errorPeriodo({ fecha, cosecha, dias }, inicioMinimo = '1950-01-01') {
  if (fecha && (fecha < inicioMinimo || fecha > '2100-12-31')) return 'La fecha de siembra queda fuera del período admitido.';
  if (cosecha && !fecha) return 'Para usar la cosecha prevista, completa también la siembra o la duración.';
  if (cosecha && cosecha < fecha) return 'La cosecha prevista debe coincidir con la siembra o ser posterior.';
  if (cosecha && !dias) return 'El ciclo entre la siembra y la cosecha debe tener entre 1 y 730 días.';
  return '';
}
