# ADR-002: Kernel sin framework (autoloader PSR-4 manual, sin Composer)

**Estado:** Aceptado  
**Fecha:** 2026-10-16

## Contexto

El entorno es XAMPP sin Composer ni framework. El sistema legacy usaba `require_once` manual y `new` directo en constructores. Se necesitaba un kernel que proporcionara autoloading, routing, contenedor DI y manejo de errores sin dependencias externas.

## Decisión

Implementar un kernel propio de ~15 clases en `src/Kernel/`: `AutoloaderPsr4`, `Router`, `Container`, `Peticion`, `RespuestaJson`, `Cors`, `AutenticacionMiddleware`, `ManejadorErrores` y 6 excepciones tipadas (`ZeaSysException` + 5 subtipos). Namespace raíz `ZeaSys\` → `backend-api/src/`.

## Consecuencias

- **Ventajas:** cero dependencias, control total, portabilidad XAMPP garantizada.
- **Costos:** sin features de framework (validación, migrations, events).
- **Mantenimiento:** el kernel es pequeño (~800 líneas total) y está cubierto por la suite de contrato.
