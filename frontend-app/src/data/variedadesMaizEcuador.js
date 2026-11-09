import catalogo from '../../../backend-api/data/referencias/catalogo-maiz-ecuador.json' with { type: 'json' };

export const OTRA_VARIEDAD = '__otra_variedad__';
export const VARIEDAD_PERSONALIZADA = 'Otra variedad local o comercial (especificar)';

// Grupos heredados del formulario. La ficha conserva la clasificación real.
export const TIPOS_MAIZ_ECUADOR = [
  { value: 'Duro Amarillo', label: 'Maíz duro amarillo' },
  { value: 'Duro Amarillo / Blanco', label: 'Canguil y otros maíces blancos duros' },
  { value: 'Suave Harinoso', label: 'Choclo blanco, amarillo y maíces andinos' },
].map((grupo) => ({
  ...grupo,
  variedades: catalogo.variedades.filter((ficha) => ficha.grupo_formulario === grupo.value).map((ficha) => ficha.nombre),
}));

export function buscarFichaMaiz(nombre = '') {
  if (typeof nombre !== 'string') return undefined;
  const clave = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return catalogo.variedades.find(ficha => [ficha.nombre, ...ficha.alias].some(alias => alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') === clave));
}
