const documentos = {
  'mag-guia-productores-maiz-amarillo-2026.pdf': ['MAG · Guía de maíz amarillo', 2026, 8],
  'iniap-guia-produccion-maiz-sierra-2021.pdf': ['INIAP · Maíz de la Sierra', 2021, 149],
  'iniap-guia-maiz-amarillo-litoral-2014.pdf': ['INIAP · Maíz del Litoral', 2014, 26],
  'iniap-manual-produccion-maiz-2007.pdf': ['INIAP / FAO · Manual de maíz', 2007, 23],
  'inec-espac-resultados-2025.pdf': ['INEC · Resultados ESPAC', 2025, 52],
};
export default function FuentesChat({ referencias, fuentesWeb, sugerenciasBusqueda }) {
  const rows = Array.isArray(referencias) ? referencias.filter(ref => documentos[ref?.archivo] && Number.isInteger(ref.pagina_pdf) && ref.pagina_pdf > 0 && ref.pagina_pdf <= documentos[ref.archivo][2]) : [];
  const web=(Array.isArray(fuentesWeb)?fuentesWeb:[]).filter(ref=>{try{const u=new URL(ref.url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}});
  if (!rows.length&&!web.length&&!sugerenciasBusqueda) return null;
  return <div className="zeasys-chat-evidence">
    {web.length>0&&<details className="zeasys-chat-sources"><summary>Fuentes de la web ({web.length})</summary><ul>{web.map((ref,i)=><li key={`${ref.url}:${i}`}><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.titulo||new URL(ref.url).hostname}<span>Consultar publicación ↗</span></a></li>)}</ul></details>}
    {rows.length>0&&<details className="zeasys-chat-sources"><summary>Documentos de apoyo ({rows.length})</summary><p>Fragmentos encontrados para esta pregunta. Las citas de la respuesta indican cuáles se utilizaron.</p><ul>{rows.map((ref,i)=><li key={`${ref.archivo}-${ref.pagina_pdf}-${i}`}>{documentos[ref.archivo][0]} · {documentos[ref.archivo][1]} · página PDF {ref.pagina_pdf}</li>)}</ul></details>}
    {typeof sugerenciasBusqueda==='string'&&sugerenciasBusqueda.length<=64000&&<iframe className="zeasys-chat-google-search" title="Sugerencias de búsqueda de Google" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={sugerenciasBusqueda}/>}
  </div>;
}
