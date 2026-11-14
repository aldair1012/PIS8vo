export function annualRain(reference) {
  if (!reference || typeof reference.valor !== 'number' || !Number.isFinite(reference.valor) || reference.valor < 0 || reference.unidad !== 'mm/año' || !reference.fuente || !reference.periodo) return null;
  return reference;
}

export function comparisonAnnualRain(run, current) {
  const saved = annualRain(run?.lluvia_anual_referencia);
  const reference = saved ?? annualRain(current);
  return reference ? { reference, saved: Boolean(saved) } : null;
}
