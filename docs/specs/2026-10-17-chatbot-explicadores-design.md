# Spec: Chatbot + Explicadores reformados

**Fecha:** 2026-10-17  
**Estado:** Aprobado (brainstorming)  
**Subproyecto:** 2 de 3 (chatbot sobre documentacion + explicadores)

## 1. Objetivo

Chatbot que responda **toda pregunta del sistema** (dashboards, ubicaciones, clima, financiero, plagas, indicadores) con lenguaje natural fluido y preciso, sin LLM. Incluye **memoria contextual completa por sesión** y **reforma de los 46 explicadores** para eliminar genericidad.

## 2. Restricciones

- XAMPP (PHP + MySQL + Flask). Sin Docker, sin APIs externas, sin LLM.
- Paridad de `explain()` congelada → la reforma de explicadores **cambia la salida** → se re-captura la huella de contrato (único `--modo=capturar` autorizado en todo el proyecto).
- El chatbot se añade como **paso 30** de la suite de contrato.
- Frontend: React + Vite + Tailwind + lucide-react (existente).

## 3. Componentes

### 3.1 Reforma de explicadores (46 clases)

**Problema actual:** estructura idéntica de 4 preguntas, frases genéricas, recomendaciones vagas.

**Reforma por familia:**

| Familia | Estructura | Mejoras |
|---------|-----------|---------|
| Rendimiento (12) | Narrativa potencial vs. realidad | Referencia zona real (Costa/Sierra/Amazonía), gap en t/ha y USD, comparación con promedio zona |
| Financiero (10) | Inversión → retorno → riesgo | ROI con escenarios (optimista/base/pesimista), punto de equilibrio en qq y USD, sensibilidad precio |
| Clima (8) | Fenómeno → impacto → ventana | ENSO con efecto específico por zona, anomalías con meses nombrados, ventana de siembra con fechas |
| Suelo/Agua (8) | Balance → limitante → corrección | pH con corrección específica (cal/azufre + dosis), agua útil por estrato con mm, nutrientes con dosis |
| Plagas (5) | Riesgo → control → producto | Productos del catálogo `agronomia_data.json` con dosis y momento, umbrales de acción |
| Fenología (3) | Fase → riesgo → acción | Fechas calculadas desde siembra real, riesgo por etapa con umbral, acción específica |

**Reglas de redacción:**
- Eliminar frases genéricas: "podría mejorar", "rentabilidad atractiva", "es un indicador importante".
- Diagnóstico directo: "tu pH está 0.5 puntos bajo lo óptimo" en vez de "tu pH podría no ser óptimo".
- Acciones concretas: producto + dosis + momento (ej. "cal agrícola 2 t/ha en pre-siembra").
- Cierre con siguiente paso: cada explicación termina con una acción sugerida.
- Variación: mínimo 2 plantillas por sección, rotadas por hash de sesión (no repetitivas).

### 3.2 Dominio Chat

```
src/Dominios/Chat/
├── Dominio/
│   ├── RouterChatInterface.php
│   ├── RedactorInterface.php
│   └── MemoriaSesionInterface.php
├── Infraestructura/
│   ├── RouterChat.php
│   ├── Redactor.php
│   └── MemoriaSesion.php
├── Aplicacion/
│   └── ChatService.php
└── Http/
    └── ChatController.php
```

**RouterChat:** clasifica intención por tokens + contexto de vista. Intenciones: `indicador`, `ubicacion`, `clima`, `financiero`, `plaga`, `general`. Busca el explicador por nombre/parámetros del contexto.

**Redactor:** ensambla las secciones del explicador en texto natural con plantillas variadas + inyección de datos en vivo + cierre con acción. Sin LLM.

**MemoriaSesion:** guarda en `$_SESSION['chat']`:
- `historial`: array de mensajes (máx 20)
- `contexto`: cultivos del usuario, variedad, zona, última simulación
- `temas`: intenciones ya tratadas (para no repetir y seguir el hilo)

**ChatService:** orquesta router → redactor → memoria. Respuesta: `{ texto, secciones, accion, confianza }`.

**ChatController:** `POST /api/chat/preguntar` con `{ pregunta, vista }`. Inyecta datos en vivo del usuario autenticado.

### 3.3 Widget flotante (frontend)

- Botón flotante inferior derecho → panel desplegable (360px, 500px)
- Chips contextuales según vista activa (Yield/Scenario/Climate/Financial/Simular)
- Historial de conversación en sesión (scroll)
- Indicador "escribiendo..." con delay 300ms
- Cierre de sesión limpia la memoria

### 3.4 Suite de contrato

- Re-capturar huella (única vez, autorizada por este spec).
- Añadir paso 30: `chat responde indicador` — pregunta al chatbot por un indicador conocido y verifica que la respuesta contiene el nombre del indicador y al menos una sección.

## 4. Flujo de respuesta

```
Usuario escribe → ChatController → ChatService
  → RouterChat: clasifica intención (tokens + contexto de vista)
  → Busca explicador por nombre/parámetros
  → Inyecta datos en vivo (simulación actual, cultivo, clima)
  → Redactor: ensambla plantillas variadas → texto natural
  → MemoriaSesion: guarda mensaje + actualiza contexto
  → Respuesta JSON: { texto, secciones, accion, confianza }
```

## 5. Verificación

1. Suite de contrato: 30 pasos, `== CONTRATO OK ==` exit 0.
2. Control negativo: huella dañada → exit 1.
3. Prueba de chatbot: pregunta por indicador → respuesta con nombre + secciones.
4. Prueba de memoria: pregunta follow-up → respuesta con contexto de la pregunta anterior.
5. Prueba de widget: frontend carga, chips contextuales, conversación fluida.

## 6. Fuera de alcance

- LLM (Ollama u otro) — no en esta fase.
- Memoria persistente entre sesiones.
- Voz/audio.
- Multi-idioma (solo español).
