// Los proveedores ofrecen estimaciones: los datos ausentes no se sustituyen por valores inventados.
export function leerAltitud(respuesta) {
  const valor = respuesta?.elevation?.[0];
  return typeof valor === 'number' && Number.isFinite(valor) ? valor.toFixed(1) : null;
}
export function leerPhSuelo(respuesta) {
  const capas = respuesta?.properties?.layers;
  if (!Array.isArray(capas)) return null;
  const valor = capas.find((capa) => capa?.name === 'phh2o')?.depths?.[0]?.values?.mean;
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 && valor <= 140 ? (valor / 10).toFixed(1) : null;
}
