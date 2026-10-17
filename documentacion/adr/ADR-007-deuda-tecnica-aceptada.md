# ADR-007: Deuda técnica aceptada (por paridad congelada)

**Estado:** Aceptado  
**Fecha:** 2026-10-16

## Contexto

El sistema legacy tiene comportamientos que son deuda técnica pero que no pueden cambiarse sin romper la paridad de la API. Se registran aquí para futuras fases post-migración.

## Decisión

Se aceptan y documentan los siguientes ítems:

1. **`asegurarColumnasPerfil()`:** ALTER TABLE en cada request de `UsuarioRepositoryMysql` (schema migration en runtime). Se conserva por paridad; mover a migrations es trabajo de F06+.
2. **`mt_rand` en pérdidas por fecha de Siembra:** `ServicioAnaliticaYield` usa `mt_rand(2,6)` para calcular pérdidas. La suite normaliza este valor; cambiarlo rompería el contrato.
3. **Uploads de avatar sin limpieza:** `deleteAvatar` no borra el archivo físico (comportamiento legacy). Los archivos residuales se acumulan en `public/uploads/avatars/`.
4. **Rutas sin parámetros dinámicos:** el Router no soporta `/api/cultivos/{id}`; todo va por query string.
5. **Sin rate-limiting:** no hay throttling en ningún endpoint.
6. **`getConnection()` global:** los repositorios usan el global legacy `getConnection()` en vez de PDO inyectado. Puente transitorio hasta F06.
7. **`CURLOPT_SSL_VERIFYPEER, false`** en `VerificadorTokenGoogle`: verificación MITM-able. Heredado del legacy.
8. **IDOR en explain():** `explain()` no valida pertenencia del cultivo/simulación explicada. Heredado; corrección post-paridad.

## Consecuencias

- Estos ítems no bloquean la migración. Se registran para priorización post-F06.
- Cualquier corrección requiere actualizar la suite de contrato y verificar paridad nuevo-vs-nuevo.
