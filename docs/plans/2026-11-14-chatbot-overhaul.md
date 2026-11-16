# Chatbot Overhaul Implementation Plan

- Feature: Overhaul del Chat Bot de ZeaSys (funcionalidad, diseño e interacción)
- Author: Flint (dirección: founder / equipo ZeaSys)
- Date: 2026-11-14
- Status: Implementado y revisado el 2026-11-15; ver `documentacion/revision-clima-chatbot-20261115.md`.

Este plan se conserva como antecedente. La petición posterior del usuario amplió el diseño del widget y autorizó Gemini con búsqueda pública, manteniendo los PDF como apoyo cuando se solicitan. El marcado «Útil» se conserva localmente durante la sesión; no es un sistema de entrenamiento ni de analítica del modelo. La búsqueda depende de la cuota del proveedor.

## Problem Statement

El chatbot de ZeaSys ya tiene contexto agrícola, memoria de sesión, favoritos, fuentes documentales y cobertura de tests, pero la experiencia y la robustez no están al nivel de pulido de las demás fases del producto:

1. **Widget (frontend)**: sin feedback de prensa/estado en botones, composer sin auto-resize ni límite de longitud, foco sin retorno al launcher al cerrar, auto-scroll agresivo, indicador de escritura básico, follow-ups genéricos fijos, mensajes con `key` por índice (frágil).
2. **Backend**: no valida contra un enum canónico de vistas, umbral de respuesta corta insuficiente (`< 20`), retry no garantizado contra la pregunta original.
3. **Calidad**: el usuario reporta respuestas muy largas / poco entendibles o muy cortas; fuentes solo cuando el usuario las pide.

Referencia: `docs/superpowers/specs/2026-11-14-chatbot-overhaul-design.md`

## Goals

1. Interacción completa del widget: feedback positivo, auto-resize composer (max 2000 chars), foco (apertura/cierre/retorno), auto-scroll inteligente, indicador de escritura, follow-ups contextuales por vista, reintentar conforme a la pregunta.
2. Diseño: motion correcto (ease-out, <300ms UI, sin `scale(0)`, reduced motion), estados de prensa en todos los botones.
3. Robustez backend: whitelist de vistas canónicas + umbral mínimo de respuesta.
4. Cobertura: e2e ampliado + tests backend.

## Non-Goals

- No cambiar el proveedor IA (Flowise) ni redactar respuestas en backend.
- No exponer `secciones`/`accion`/`confianza` al frontend (sin capacidad real del flujo).
- No migrar arquitectura ni añadir librerías de animación.

## Anti-Goals

- No animar acciones de teclado.
- No introducir gradientes/nuevos estilos (mantener identidad 60/30/10 agrícola).

## Decisions

1. **Feedback positivo**: acción "Útil" (ThumbsUp + Check) en respuestas del asistente; estado local por mensaje (`feedback`); persistencia pendiente (sin endpoint).
2. **Respuestas**: backend ajusta extensión a la pregunta (reglas en prompt); umbral mínimo de contenido aceptable = **10 caracteres** (builder decision: `mb_strlen($texto) < 10` → error); frontend refuerza con follow-ups contextuales + detección de respuesta corta.
3. **Vista canónica**: aceptar `{yield, scenarios, climate, finance, map, simular, history}`; validar con `ValidacionException` en `ChatController`; el test de contrato pasa de `dashboard-financial` → `finance`.
4. **Retry**: reenvía pregunta normalizada + contexto exactos; estado `consultando`; error conserva `pregunta` para reintento.
5. **Usuario final**: respuesta solo texto salvo que pregunte por la fuente; errores sin internals.

## Plan

Abordar el diseño aprobado con el Approach A (overhaul completo en 3 fases):

- **Fase 1** — Widget (frontend): tareas 1–7.
- **Fase 2** — Backend: tarea 8.
- **Fase 3** — Pruebas: tareas 9–10.
- **Fase 4** — Verificación: tarea 11.

## Tasks

### Task 1 — IDs únicos en mensajes del asistente (F1, widget)
- [ ] Asignar `id` único a cada mensaje (usuario y asistente) al crearse en `enviarPregunta` (`crypto.randomUUID()` con fallback).
- [ ] Usar `key={mensaje.id ?? \`${mensaje.rol}-${index}\`}` en el render de la lista.
- Archivo: `frontend-app/src/components/ChatbotWidget.jsx`.

### Task 2 — Feedback positivo en respuestas (F1, widget)
- [ ] Añadir estado `feedback` (mapa clave → booleano) y helper `marcarUtil(mensaje, index)`.
- [ ] Añadir botón en burbuja del asistente (oculto si error o escribiendo): icono `ThumbsUp`/`Check`, texto "Útil", `aria-pressed`.
- [ ] Estilos `.zeasys-chat-useful` / `.is-marked` en capa de estilos correspondiente.
- Archivo: `frontend-app/src/components/ChatbotWidget.jsx` + estilos.

### Task 3 — Composer: auto-resize + maxLength (F1, widget)
- [ ] `maxLength={2000}` en el textarea; función `autoDimensionar` (scrollHeight, max altura 120px, overflow auto).
- [ ] `onChange` → setInput + autoDimensionar; tras enviar, reset de altura.
- Archivo: `frontend-app/src/components/ChatbotWidget.jsx`.

### Task 4 — Foco: retorno al launcher al cerrar (F1, widget)
- [ ] Añadir `launcherRef` al botón tab; effect: al cerrar (`abierto === false`) → `launcherRef.current?.focus()`.

### Task 5 — Auto-scroll inteligente (F1, widget)
- [ ] `alFondoRef` + `onScroll` en contenedor de mensajes (threshold ~90px).
- [ ] Effect: si `abierto && alFondoRef.current` → scroll al final.

### Task 6 — Indicador de escritura con dots (F1, widget)
- [ ] Reemplazar `Loader2` por 3 dots CSS + texto "Analizando tus datos…".
- [ ] CSS: keyframes `zeasys-chat-typing-bounce`; `@media (prefers-reduced-motion: reduce)` sin animación.

### Task 7 — Follow-ups contextuales por vista (F1, widget)
- [ ] `sugerenciasSiguientes = SUGERENCIAS[vistaActual] || GENERICAS`.
- [ ] Tras último asistente sin error: sugerencias contextuales (`slice(0, 2)`) + "¿Cuál es la fuente y la fecha de los datos que usaste?".

### Task 8 — Backend: whitelist de vistas + umbral mínimo respuesta (F2)
- [ ] `ChatController`: lista canónica `VISTAS_VALIDAS = ['yield','scenarios','climate','finance','map','simular','history']`; validar `vista` contra whitelist → `ValidacionException`.
- [ ] `GeminiFlowise`: umbral `mb_strlen($texto, 'UTF-8') < 10` (antes `< 20`).

### Task 9 — Ampliar e2e chatbot (F3)
- [ ] Test: follow-ups contextuales tras respuesta + botón "Ver fuente".
- [ ] Test: feedback positivo ("Útil") se marca y persiste en UI (aria-pressed).
- [ ] Test: reintentar tras error responde nueva respuesta.
- [ ] Test: foco vuelve al launcher al cerrar.

### Task 10 — Ampliar tests backend chat (F3)
- [ ] Añadir casos: vista no canónica → error; respuesta < 10 chars → `ServicioExternoException`.

### Task 11 — Verificación (F4)
- [ ] `npm run lint` y `npm run build` en `frontend-app`.
- [ ] `npm test` (utils) y `php tests/chat/ejecutar.php` (backend).
- [ ] E2E Playwright si hay entorno disponible.

## Commit plan

- Commits pequeños por tarea: `feat(chatbot): ids únicos`, `feat(chatbot): feedback positivo`, etc., en español conventional commits.

## Self-review checklist (anti-placeholder)

- [ ] Sin TBD/TODOs.
- [ ] Tasks bite-sized (2–4 pasos).
- [ ] Código con snippets concretos.
- [ ] Comandos de verificación reales.

## Execution

Próximo paso: tras tu aprobación de este plan, empezar por Task 1 y avanzar fase por fase con verificación al final de cada fase.
