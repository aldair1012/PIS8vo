/**
 * PantallaCarga: estado de espera unificado de ZeaSys.
 * - Variante en línea (por defecto) para esperas breves dentro de un panel.
 * - Variante `pantalla` para cargas de vista completa: incluye esqueleto con brillo.
 * Mantiene role="status" y arranca con "Cargando…" para lectores de pantalla y pruebas.
 */
function BroteMaiz() {
  return (
    <svg className="zs-carga-brote" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <ellipse className="zs-carga-brote-tierra" cx="24" cy="43.5" rx="13" ry="2.5" />
      <path className="zs-carga-brote-tallo" d="M24 43 C24 37 23.8 30 24 22.5" />
      <path className="zs-carga-brote-hoja zs-carga-brote-hoja--izq" d="M24 22.5 C19 16.5 11.5 13 3.5 15.5 C9 22.5 17.5 25.5 24 22.5 Z" />
      <path className="zs-carga-brote-hoja zs-carga-brote-hoja--der" d="M24 22.5 C28.5 15.5 36 11.5 44.5 13.5 C40 21.5 31 26.5 24 22.5 Z" />
    </svg>
  );
}

export default function PantallaCarga({ mensaje = 'Cargando…', pantalla = false }) {
  return (
    <div className={pantalla ? 'zs-carga zs-carga--pantalla' : 'zs-carga'} role="status" aria-live="polite" aria-busy="true">
      <span className="zs-carga-emblema" aria-hidden="true">
        <BroteMaiz />
      </span>
      <span className="zs-carga-linea">
        <span className="zs-carga-texto">{mensaje}</span>
        <span className="zs-carga-puntos" aria-hidden="true"><i /><i /><i /></span>
      </span>
      {pantalla ? (
        <span className="zs-carga-esqueleto" aria-hidden="true">
          <span className="zs-carga-hilera zs-carga-hilera--panel" />
          <span className="zs-carga-hilera" />
          <span className="zs-carga-hilera" />
          <span className="zs-carga-hilera zs-carga-hilera--corta" />
        </span>
      ) : null}
    </div>
  );
}
