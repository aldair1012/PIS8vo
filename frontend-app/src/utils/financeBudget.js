export function financeNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function financeInputNumber(value) {
  const number = financeNumber(value);
  return number !== null && number >= 0 ? number : null;
}

export function financeInputText(value) {
  const number = financeInputNumber(value);
  return number === null ? '' : String(number);
}

const product = (...values) => {
  if (values.some((value) => value === null)) return null;
  return financeNumber(values.reduce((result, value) => result * value, 1));
};

/** Vista previa del formulario: un campo vacío no se convierte en cero ni rescata un dato anterior. */
export function financeBudgetPreview(inputs, areaValue) {
  const area = financeInputNumber(areaValue);
  const validArea = area !== null && area > 0 ? area : null;
  const yieldQq = financeInputNumber(inputs.rendimientoQq);
  const priceQq = financeInputNumber(inputs.precioMaizQq);
  const costs = ['costoSemilla', 'costoFert', 'costoRiego', 'costoProteccion', 'otrosVar', 'costosFijos'].map((key) => financeInputNumber(inputs[key]));
  const costPerHa = costs.includes(null) ? null : financeNumber(costs.reduce((sum, value) => sum + value, 0));
  const revenuePerHa = product(yieldQq, priceQq);
  const marginPerHa = revenuePerHa !== null && costPerHa !== null ? financeNumber(revenuePerHa - costPerHa) : null;
  return {
    area: validArea, yieldQq, priceQq, costPerHa,
    production: product(yieldQq, validArea),
    revenue: product(revenuePerHa, validArea),
    cost: product(costPerHa, validArea),
    margin: product(marginPerHa, validArea),
  };
}

export function financeSourceLabel(source) {
  return ({
    supuesto_ingresado_usuario: 'Supuesto ingresado para este escenario',
    precio_por_tonelada_ingresado_convertido_a_qq: 'Precio supuesto convertido de tonelada a quintal',
    supuesto_configurable_sin_cotizacion_mercado: 'Supuesto configurable; no es cotización de mercado',
    supuesto_configurable_sin_costo_observado: 'Supuesto configurable; no es gasto observado',
    media_rendimientos_modelo_guardados: 'Media de las simulaciones guardadas del periodo',
    no_disponible: 'Sin dato de origen',
  })[source] ?? 'Origen no documentado';
}
