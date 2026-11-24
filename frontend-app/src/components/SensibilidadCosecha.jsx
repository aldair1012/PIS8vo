const nombres = { precipitacion_mm: 'Lluvia', nitrogeno_kg_ha: 'Nitrógeno' };
const fmt = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 3 });

export default function SensibilidadCosecha({ filas }) {
  if (!Array.isArray(filas) || !filas.length) return null;
  const escala = Math.max(0.0001, ...filas.flatMap(f => f.cambios_t_ha.map(Math.abs)));
  return <section className="simulation-section"><h3>Sensibilidad del rendimiento</h3>
    <p>Se reduce y aumenta un 20 % cada entrada por separado. La línea central indica el rendimiento del escenario original. La fecha de siembra carece de un efecto directo en este modelo.</p>
    {filas.map(fila => <div key={fila.variable}><h4>{nombres[fila.variable] ?? fila.variable}</h4>
      {fila.cambios_t_ha.map((cambio, i) => <div className="sensitivity-row" key={i}>
        <span>{i ? '+20 %' : '−20 %'} · {fmt.format(fila.valores[i])} {fila.unidad}</span>
        <span className="sensitivity-track" aria-hidden="true"><i style={{ left: cambio < 0 ? `${50 - 50 * Math.abs(cambio) / escala}%` : '50%', width: `${50 * Math.abs(cambio) / escala}%`, background: i ? 'var(--zs-primary)' : 'var(--zs-danger)' }} /></span>
        <strong>{cambio > 0 ? '+' : ''}{fmt.format(cambio)} t/ha</strong>
      </div>)}</div>)}
  </section>;
}
