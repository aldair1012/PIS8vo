import { parseScenarioNumber } from './simulationInput.js';
export function numeroFertilizacion(value) {
  const parsed = parseScenarioNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}
export function validarProductoFertilizante(producto) {
  if (numeroFertilizacion(producto.dosis) === null) return 'La dosis debe ser un número positivo o cero, sin separadores de miles ambiguos.';
  for (const campo of ['N','P','K','Mg','S']) {
    const n=numeroFertilizacion(producto[campo]);
    if (n===null || n>100) return `El porcentaje de ${campo} debe estar entre 0 y 100.`;
  }
  if (String(producto.precio ?? '').trim() && numeroFertilizacion(producto.precio) === null) return 'El precio debe ser un número positivo o cero.';
  return null;
}
