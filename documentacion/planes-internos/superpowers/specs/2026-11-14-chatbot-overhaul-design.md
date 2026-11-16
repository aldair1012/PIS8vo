# Diseño: Overhaul del Chat Bot de ZeaSys (funcionalidad, diseño e interacción)

- **Fecha:** 2026-11-14
- **Tema:** Mejoras integrales del asistente conversacional ZeaSys
- **Estado:** Implementado y revisado el 2026-11-15; ver `documentacion/revision-clima-chatbot-20261115.md`.

Las solicitudes posteriores del usuario autorizaron la nueva presentación, la consulta de conocimiento general y de fuentes web mediante Gemini. Este documento describe el diseño original; el informe del 15 de noviembre registra el comportamiento vigente, las verificaciones y el límite de cuota externa.

## 1. Intent y el porqué

El chatbot ya existe en tres fases (widget React, backend Flowise, memoria/contexto) y cubre clima, rendimiento, margen, simulación y fuentes documentales. La misión del usuario: **enfocarse el 100% en mejorar el chatbot — funcionamiento, diseño e interacción — en todas las pestañas y fases**, investigando, usando skills y mejorando todo lo relacionado.

## 2. Goals / Non-goals / Anti-goals

### Goals
1. **Interacción**: feedback positivo en respuestas; auto-resize composer; foco (apertura/cierre/retorno); auto-scroll inteligente; indicador de escritura; follow-ups contextuales; límites de longitud; reintentar conforme a la pregunta.
2. **Diseño**: motion correcto (ease-out, <300ms UI, sin `scale(0)`, reduced motion).
3. **Robustez backend**: validar enum de `vista`; umbral de respuesta corta; reglas anti-invento.
4. **Calidad de respuesta**: guiar longitud/extensión según la pregunta; fuentes solo cuando se piden.

### Non-goals
- No cambiar el proveedor IA (Flowise) ni redactar respuestas en backend.
- No exponer `secciones`/`accion`/`confianza` al frontend (sin capacidad real del flujo).
- No añadir librerías de animación ni cambiar identidad visual.

### Anti-goals
- No animar acciones de teclado.
- No introducir gradientes/nuevos estilos.

## 3. Constraints

- Stack React + Vite + plain CSS; separación landing/workspace.
- `styles.css`, `internal-system.css`, `product-design.css` como frentes de estilos.
- Verificación: `npm run lint`, `npm run build` (frontend-app); `php tests/chat/ejecutar.php` (backend).

## 4. Approaches

### A. Overhaul completo en 3 fases (RECOMENDADA)
1. Widget/presentación + interacción (React + CSS).
2. Robustez backend (enum vista, umbral respuesta).
3. Pruebas e2e/backend.

**Decisión:** A.

## 5. Design decisions (finales, con decisiones del cliente)

1. **Feedback positivo**: todo lo relacionado — acción de feedback positivo ("útil") en respuestas del asistente. UI-first con estado por mensaje; persistencia queda como deuda técnica hasta existir endpoint.
2. **Respuestas**: el backend ajusta extensión a la pregunta (prompt); umbral mínimo de contenido aceptable; frontend refuerza con follow-ups contextuales y detección de respuesta corta.
3. **Vista**: set canónico aceptado por backend: `yield, scenarios, climate, finance, map, simular, history` (vistas con asistente); `cultivos` y `configuracion` quedan fuera (chat oculto). Validar con `ValidacionException`. El test de contrato usa `vista: 'dashboard-financial'` (inconsistente) → se actualiza a un valor canónico (`finance`).
4. **Retry**: reenvía la pregunta normalizada + contexto exactos; estado vuelve a `consultando`; error queda en historial con su pregunta para reintento.
5. **Usuario**: respuesta solo texto salvo que pregunte por la fuente (follow-up "¿Cuál es la fuente y la fecha?"); mensajes de error sin detalles internos.

## 6. What’s left to the builder

- Implementar fases 1–3, ampliar pruebas, ejecutar verificaciones.

## 7. Riesgos / mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper e2e existentes | Conservar selectores/roles clave. |
| Enum vista vs contrato | Actualizar test a `finance`; regenerar snapshot si aplica. |
| Feedback persistencia | Solo UI por ahora. |
| Motion/reduced motion | Regla global existente. |
