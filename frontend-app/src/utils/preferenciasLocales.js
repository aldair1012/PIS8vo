// Las preferencias son opcionales cuando el navegador restringe el almacenamiento.
export function leerPreferencia(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

export function guardarPreferencia(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* Sigue vigente durante esta sesión. */ }
}
