const documentos = {
  'mag-guia-productores-maiz-amarillo-2026.pdf': ['MAG · Guía de maíz amarillo', 2026, 8],
  'iniap-guia-produccion-maiz-sierra-2021.pdf': ['INIAP · Maíz de la Sierra', 2021, 149],
  'iniap-guia-maiz-amarillo-litoral-2014.pdf': ['INIAP · Maíz del Litoral', 2014, 26],
  'iniap-manual-produccion-maiz-2007.pdf': ['INIAP / FAO · Manual de maíz', 2007, 23],
  'inec-espac-resultados-2025.pdf': ['INEC · Resultados ESPAC', 2025, 52],
};
export default function FuentesChat({ referencias }) {
  const rows = Array.isArray(referencias) ? referencias.filter(ref => documentos[ref?.archivo] && Number.isInteger(ref.pagina_pdf) && ref.pagina_pdf > 0 && ref.pagina_pdf <= documentos[ref.archivo][2]) : [];
  if (!rows.length) return null;
  return <details className="zeasys-chat-sources"><summary>Documentos consultados ({rows.length})</summary><p>Fragmentos encontrados para esta pregunta. Revisa las citas de la respuesta para saber cuáles se utilizaron.</p><ul>{rows.map((ref,i)=><li key={`${ref.archivo}-${ref.pagina_pdf}-${i}`}>{documentos[ref.archivo][0]} · {documentos[ref.archivo][1]} · página PDF {ref.pagina_pdf}</li>)}</ul></details>;
}
