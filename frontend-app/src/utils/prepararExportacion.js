// Prepara una copia verificable antes de iniciar la descarga.
export async function prepararExportacion({ secciones, usuario, obtenerParcelas, obtenerHistorial, obtenerMediciones, progreso = () => {}, ahora = new Date() }) {
  if (!Object.values(secciones).some(Boolean)) throw new Error('Selecciona al menos una sección para descargar.');
  const datos = { meta: { app: 'ZeaSys', exportado_por: usuario.nombre, fecha_exportacion: ahora.toISOString(), formato_version: 1 } };
  let parcelas = [];
  if (secciones.cultivos || secciones.kpis || secciones.mediciones) {
    progreso('Consultando parcelas…');
    const respuesta = await obtenerParcelas();
    parcelas = Array.isArray(respuesta) ? respuesta : respuesta?.cultivos;
    if (!Array.isArray(parcelas)) throw new Error('No se pudo comprobar la lista de parcelas.');
  }
  if (secciones.cultivos) datos.lotes_gps = parcelas;
  if (secciones.simulaciones) {
    progreso('Consultando historial de simulaciones…');
    const primera = await obtenerHistorial(null, 1, 100);
    const { total, paginas } = primera?.paginacion ?? {};
    if (!Number.isInteger(total) || total < 0 || !Number.isInteger(paginas) || paginas < 1 || !Array.isArray(primera.simulaciones)) throw new Error('No se pudo comprobar el historial de simulaciones.');
    const historial = [...primera.simulaciones];
    for (let pagina = 2; pagina <= paginas; pagina += 1) {
      progreso(`Consultando simulaciones: página ${pagina} de ${paginas}…`);
      const respuesta = await obtenerHistorial(null, pagina, 100);
      if (!Array.isArray(respuesta?.simulaciones) || respuesta.paginacion?.total !== total || respuesta.paginacion?.paginas !== paginas || respuesta.paginacion?.pagina !== pagina) throw new Error('El historial cambió durante la descarga. Inténtalo de nuevo.');
      historial.push(...respuesta.simulaciones);
    }
    const ids = new Set(historial.map((item) => String(item.id ?? '')));
    if (historial.length !== total || ids.has('') || ids.size !== total) throw new Error('No se pudo obtener el historial completo. Inténtalo de nuevo.');
    datos.historial_simulaciones = historial;
  }
  if (secciones.mediciones) {
    datos.registros_campo = [];
    for (const [indice, parcela] of parcelas.entries()) {
      progreso(`Consultando registros de campo: ${indice + 1} de ${parcelas.length}…`);
      const registro = await obtenerMediciones(parcela.id);
      if (!registro || typeof registro.datos !== 'object' || registro.datos === null) throw new Error('No se pudieron comprobar los registros de campo.');
      datos.registros_campo.push({ parcela_id: parcela.id, nombre_parcela: parcela.nombre_parcela, ...registro });
    }
  }
  if (secciones.kpis) datos.resumen_kpi = { total_lotes: parcelas.length };
  return datos;
}

export function crearArchivoJson(datos) {
  const contenido = JSON.stringify(datos, null, 2);
  const archivo = new Blob([contenido], { type: 'application/json;charset=utf-8' });
  if (!archivo.size) throw new Error('El archivo está vacío. Inténtalo de nuevo.');
  return archivo;
}
