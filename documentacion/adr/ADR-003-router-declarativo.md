# ADR-003: Router declarativo con tabla de rutas

**Estado:** Aceptado  
**Fecha:** 2026-10-16

## Contexto

El sistema legacy despachaba con un `switch` sobre `$_GET['action']` en `index.php`. Se necesitaba un mecanismo de routing que permitiera migrar rutas incrementalmente (dominio a dominio) sin cambiar el front controller.

## Decisión

Usar una **tabla declarativa** en `src/Config/rutas.php` como única fuente de verdad. Cada entrada mapea una ruta a un controlador FQCN + acción (o `acciones` por método para `api/cultivos`). El `Router` resuelve la ruta desde `PATH_INFO`/`$_GET['action']`, aplica el middleware de autenticación y despacha al controlador.

## Consecuencias

- **Ventajas:** migración incremental, rutas visibles en un solo lugar, flags `publica`/`sesion` por ruta.
- **Costos:** sin parámetros de ruta dinámicos (p. ej. `/api/cultivos/{id}`), sin rate-limiting por ruta.
- **Extensión futura:** parámetros de ruta y middleware por ruta son cambios mecánicos.
