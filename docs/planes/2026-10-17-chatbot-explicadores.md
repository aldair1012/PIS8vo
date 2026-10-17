# Plan: Chatbot + Explicadores reformados

**Spec:** `docs/specs/2026-10-17-chatbot-explicadores-design.md`  
**Restricción:** re-captura de huella autorizada (única `--modo=capturar` del proyecto).

## Fase A — Dominio Chat (backend)

1. `Dominio/{RouterChatInterface,RedactorInterface,MemoriaSesionInterface}.php`
2. `Infraestructura/{RouterChat,Redactor,MemoriaSesion}.php`
   - RouterChat: robusto — sinónimos, variaciones, preguntas compuestas, fallback general. Intenciones: indicador, ubicacion, clima, financiero, plaga, general.
   - Redactor: ensambla secciones en texto natural + datos en vivo + cierre con acción.
   - MemoriaSesion: historial (20) + contexto (cultivos, variedad, zona, última simulación) + temas.
3. `Aplicacion/ChatService.php` — orquesta router → redactor → memoria.
4. `Http/ChatController.php` — `POST /api/chat/preguntar` con `{pregunta, vista}`.
5. Binding en contenedor + ruta en rutas.php.
6. **Verificación:** `php -r` smoke (router clasifica, redactor ensambla, memoria guarda) + commit.

## Fase B — Reforma de 46 explicadores

1. Re-escribir cada explicador con estructura variada por familia (rendimiento, financiero, clima, suelo/agua, plagas, fenología).
2. Zonas específicas (Costa/Sierra/Amazonía), recomendaciones concretas (producto+dosis+momento), lenguaje natural sin genericidades, 2+ plantillas por sección con rotación por hash de sesión.
3. **Verificación:** suite de contrato → `CONTRATO OK` + commit.

## Fase C — Re-captura + paso 30

1. `--modo=capturar` (autorizado por spec).
2. Añadir paso 30 `chat responde indicador`: pregunta al chatbot por un indicador conocido, verifica respuesta con nombre + sección.
3. **Verificación:** comparar OK + negativo OK + commit.

## Fase D — Widget flotante (frontend)

1. `src/components/ChatbotWidget.jsx` — botón flotante, panel, chips contextuales, historial, delay 300ms.
2. `src/services/chatService.js` — cliente del endpoint.
3. Integrar en layout principal.
4. **Verificación:** build OK + commit.

## Cierre

- Suite 30 pasos OK + negativo OK.
- Informe final.
