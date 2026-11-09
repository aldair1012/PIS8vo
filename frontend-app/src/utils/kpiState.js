export function indiceKpiSeguro(indice, cantidad) {
  return Number.isInteger(indice) && indice >= 0 && indice < cantidad ? indice : 0;
}
