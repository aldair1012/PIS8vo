import { annualRain } from '../utils/annualRain';

export default function AnnualRainReference({ reference, unavailable = false }) {
  const rain = annualRain(reference);
  if (!rain) return unavailable ? <p className="annual-rain-reference">Lluvia anual de referencia no disponible. Confirma la ubicación de la parcela o vuelve a consultar más tarde.</p> : null;
  const value = new Intl.NumberFormat('es-EC', {maximumFractionDigits:1}).format(rain.valor);
  return <aside className="annual-rain-reference" aria-label="Referencia histórica de lluvia anual">
    <strong>Lluvia anual de referencia: {value} mm/año</strong>
    <p>{rain.fuente} · {rain.periodo} · {rain.años_completos} años completos{rain.estacion ? ` · Estación ${rain.estacion} a ${rain.distancia_km} km` : ''}</p>
    <p>Promedio histórico de la zona. No representa la lluvia del ciclo ni predice cuánto lloverá en tu campaña.{rain.ubicacion_referencia?.tipo === 'centro_localidad_aproximado' ? ' Se usó el centro de la localidad; ubica la parcela en el mapa para precisar la consulta.' : ''}</p>
    {rain.url?.startsWith('https://') && <a href={rain.url} target="_blank" rel="noopener noreferrer">Consultar fuente y metodología</a>}
  </aside>;
}
