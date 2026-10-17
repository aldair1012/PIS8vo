# ADR-004: Contratos congelados y suite de contrato

**Estado:** Aceptado  
**Fecha:** 2026-10-16

## Contexto

La reestructuración debía ser invisible para el frontend: mismas rutas, mismos payloads, mismos códigos HTTP. Sin una red de seguridad, cualquier cambio de comportamiento pasaría desapercibido.

## Decisión

1. **Congelar contratos:** durante toda la migración (F00–F06), las rutas y payloads no cambian. Cualquier diferencia es un bug.
2. **Suite de contrato:** `backend-api/tests/contrato/ejecutar.php` captura la huella "antes" (29 pasos reales) y la compara en cada fase. Normaliza volátiles (ids, fechas, tokens, salidas ML, `mt_rand`), usa tolerancia ±25% en números y comparación estructural para APIs externas. Exit 0/1/2.

## Consecuencias

- **Ventajas:** confianza total en la migración, detección inmediata de regresiones.
- **Costos:** la suite requiere mantenimiento si el contrato cambia (p. ej. nuevos endpoints).
- **Uso:** correr `--modo=comparar` tras cada cambio; `--modo=capturar` solo al inicio.
