// Los proveedores ofrecen estimaciones: los datos ausentes no se sustituyen por valores inventados.
export function leerAltitud(respuesta) {
  const valor = respuesta?.elevation?.[0];
  return typeof valor === 'number' && Number.isFinite(valor) ? valor.toFixed(1) : null;
}
export function leerPhSuelo(respuesta) {
  const pixel = respuesta?.features?.[0]?.properties?.pixel_value;
  if (pixel !== undefined) return typeof pixel === 'number' && Number.isFinite(pixel) && pixel > 0 && pixel <= 140 ? (pixel / 10).toFixed(1) : null;
  const capas = respuesta?.properties?.layers;
  if (!Array.isArray(capas)) return null;
  const valor = capas.find((capa) => capa?.name === 'phh2o')?.depths?.[0]?.values?.mean;
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 && valor <= 140 ? (valor / 10).toFixed(1) : null;
}

export function urlPhSuelo(lat, lon) {
  const params = new URLSearchParams({ map: '/map/phh2o.map', SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo', LAYERS: 'phh2o_0-5cm_mean', QUERY_LAYERS: 'phh2o_0-5cm_mean', SRS: 'EPSG:4326', BBOX: [lon - .001, lat - .001, lon + .001, lat + .001].join(','), WIDTH: '3', HEIGHT: '3', X: '1', Y: '1', STYLES: '', FORMAT: 'image/png', INFO_FORMAT: 'application/geo+json' });
  return `https://maps.isric.org/mapserv?${params}`;
}
