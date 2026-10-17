# ADR-005: Strategy para explicabilidad (46 explicadores)

**Estado:** Aceptado  
**Fecha:** 2026-10-16

## Contexto

`SimulacionController::explain()` tenía una cadena `if/elseif` de 46 ramas (~700 líneas) que seleccionaba un explicador según palabras clave en el nombre del indicador. Era inextensible y difícil de testear.

## Decisión

Extraer cada rama a una clase `Explicador*` individual que implementa `ExplicadorInterface` (`explicar(array $datos): array`). Un `RegistroExplicadores` ordenado mantiene el orden de evaluación (que es contrato). `ServicioExplicabilidad` orquesta: contexto → primer match → estrategia.

## Consecuencias

- **Ventajas:** nuevo indicador = 1 clase + 1 fila en el registro. Testable aisladamente.
- **Riesgos:** regresiones de orden de matching → cubiertas por la suite de contrato (279 casos verificados).
- **Ramas muertas:** 4 explicadores son inalcanzables por shadowing en el registro (preservados por paridad).
