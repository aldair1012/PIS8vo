import referencias from '../../../backend-api/data/referencias/espac2025-productos-maiz.json';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function referenciasProvincia(provincia) {
  return referencias.productos.flatMap(producto => {
    const registro = producto.provincias.find(row => normalize(row.provincia) === normalize(provincia));
    return registro ? [{ producto: producto.nombre, unidad: producto.unidad, ...registro }] : [];
  });
}

export default function ReferenciasMaiz({ provincia }) {
  const rows = referenciasProvincia(provincia);
  return <section className="maize-reference" aria-label="Referencias de otros productos de maíz">
    <h2>Grano y choclo: referencias separadas</h2>
    <p>ESPAC {referencias.edicion} · {provincia || 'Selecciona una parcela con provincia identificada'}. Resumen calculado por ZeaSys a partir de microdatos del INEC.</p>
    {rows.length ? <div className="ydp-table-scroll" tabIndex={0} role="region" aria-label="Referencias provinciales por producto, desplazable"><table><thead><tr><th scope="col">Producto</th><th scope="col">Rendimiento de referencia</th><th scope="col">Registros</th></tr></thead><tbody>{rows.map(row => <tr key={row.producto}><th scope="row">{row.producto}</th><td>{new Intl.NumberFormat('es-EC', {maximumFractionDigits: 2}).format(row.rendimiento_t_ha)} {row.unidad}</td><td>{row.registros}</td></tr>)}</tbody></table></div> : <p>No hay grupos con al menos cinco registros compatibles para esta provincia.</p>}
    <p className="ydp-chart-note">El choclo se conserva como choclo; no se convierte en grano seco. La fuente no distingue color ni variedad comercial. Estos valores no pronostican tu cosecha.</p>
    <details><summary>Fuente, cálculo y límites</summary><p>{referencias.metodo}</p><p>{referencias.limites}</p><a href="https://anda.inec.gob.ec/anda5/index.php/catalog/1319" target="_blank" rel="noreferrer">Consultar INEC · ESPAC 2025</a></details>
  </section>;
}
