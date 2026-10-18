const CAMPOS_TEXTO = ['texto', 'text', 'contenido', 'content', 'description', 'descripcion', 'respuesta', 'answer', 'message'];
const CAMPOS_TITULO = ['titulo', 'title', 'nombre', 'name'];

export const normalizarTextoChat = (valor) => {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }
  if (Array.isArray(valor)) {
    return valor.map(normalizarTextoChat).filter(Boolean).join('\n');
  }
  if (typeof valor !== 'object') return '';

  const titulo = CAMPOS_TITULO.map((campo) => valor[campo]).find((campo) => typeof campo === 'string' && campo.trim());
  const contenido = CAMPOS_TEXTO.map((campo) => valor[campo]).find((campo) => campo !== undefined && campo !== null);
  if (contenido !== undefined) {
    const texto = normalizarTextoChat(contenido);
    return titulo && texto ? `**${titulo}**\n${texto}` : texto || (titulo ? String(titulo) : '');
  }
  if (titulo) return String(titulo);

  return Object.values(valor).map(normalizarTextoChat).filter(Boolean).join('\n');
};
