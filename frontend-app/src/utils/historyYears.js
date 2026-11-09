// La API guarda la fecha de las simulaciones en `fecha` (DATETIME de MySQL).
// Leer el año sin convertir a UTC evita desplazar fechas próximas a Año Nuevo.
export function historyYears(simulations = [], currentYear = new Date().getFullYear()) {
  const years = new Set([currentYear]);
  for (const simulation of simulations) {
    const match = /^(\d{4})-\d{2}-\d{2}(?:[ T]|$)/.exec(simulation.fecha ?? '');
    if (!match) continue;
    const year = Number(match[1]);
    if (year >= 2000 && year <= 2100) years.add(year);
  }
  return [...years].sort((a, b) => a - b);
}
