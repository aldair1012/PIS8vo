# Rediseño visual completo de ZeaSys — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use galyarder-framework:subagent-driven-development (recommended) or galyarder-framework:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseño visual completo del frontend: paleta dark/light, tipografía Inter, glassmorphism, charts interactivos, skeleton loaders, accesibilidad WCAG AA.

**Architecture:** CSS custom properties para theming (dark/light), componentes React con clases utilitarias, Chart.js con opciones mejoradas (tooltips, animaciones, responsive). Sin dependencias nuevas.

**Tech Stack:** React 19, Vite 8, Chart.js 4.5, lucide-react, Tailwind (via clases custom en index.css).

---

## File Structure

```
frontend-app/src/
├── index.css                          ← tokens CSS, glassmorphism, componentes base
├── App.jsx                            ← integrar theme provider + ChatbotWidget
├── templates/Common/Sidebar.jsx       ← rediseño glassmorphism
├── templates/Common/Navbar.jsx        ← blur backdrop + avatar
├── components/
│   ├── ChatbotWidget.jsx              ← ya implementado
│   ├── Skeleton.jsx                   ← nuevo: skeleton loaders
│   ├── EmptyState.jsx                 ← nuevo: empty states
│   └── Toast.jsx                      ← nuevo: toast notifications
├── views/
│   ├── DashboardYield.jsx             ← charts mejorados
│   ├── DashboardScenario.jsx          ← charts mejorados
│   ├── DashboardClimate.jsx           ← charts mejorados
│   ├── DashboardFinance.jsx           ← charts mejorados
│   ├── Cultivos.jsx                   ← formularios rediseñados
│   ├── Simular.jsx                    ← formulario rediseñado
│   ├── History.jsx                    ← tabla rediseñada
│   ├── MapPage.jsx                    ← mapa rediseñado
│   └── Configuracion.jsx              ← formularios rediseñados
└── assets/styles.css                  ← estilos legacy (se reemplaza gradualmente)
```

---

## Task 1: Design tokens y tema global (index.css)

**Files:**
- Modify: `frontend-app/src/index.css`

- [ ] **Step 1: Reemplazar tokens CSS con paleta dark/light completa**

Variables CSS: `--bg-base`, `--bg-secondary`, `--bg-card`, `--bg-card-hover`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-primary` (#22c55e), `--accent-secondary` (#3b82f6), `--accent-warning` (#f59e0b), `--accent-danger` (#ef4444), `--border`, `--shadow-sm/md/lg`, `--radius-sm/md/lg`, `--blur`.

Modo claro: clase `.light-theme` en body con variables invertidas.

- [ ] **Step 2: Tipografía**

Importar Inter (400,500,600,700) y JetBrains Mono (400,500) desde Google Fonts. Aplicar `font-family: 'Inter', system-ui, sans-serif` a body. Clase `.font-mono` para JetBrains Mono.

- [ ] **Step 3: Componentes base**

`.card` — glassmorphism: `background: var(--bg-card)`, `backdrop-filter: blur(12px)`, `border: 1px solid var(--border)`, `border-radius: 12px`, `box-shadow: var(--shadow-md)`, transición hover lift.

`.btn-primary` — gradiente verde, border-radius 8px, hover shadow glow.

`.btn-secondary` — fondo transparente, borde sutil, hover highlight.

`.input-field` — border sutil, focus ring verde, padding 0.625rem 0.875rem, border-radius 8px.

`.badge` — pastel con texto oscuro, border-radius 6px, padding 0.25rem 0.5rem.

`.table-row` — zebra striping, hover highlight.

- [ ] **Step 4: Utilidades**

`.skeleton` — animación pulse para loading states.
`.empty-state` — centrado, icono grande, texto muted, CTA.
`.toast` — posición fixed bottom-right, animación slide-in.
`.page-transition` — fade-in 200ms.

- [ ] **Step 5: Commit**

```bash
git add frontend-app/src/index.css
git commit -m "feat(ui): design tokens, tipografia Inter y componentes base con glassmorphism"
```

---

## Task 2: Sidebar y Navbar

**Files:**
- Modify: `frontend-app/src/templates/Common/Sidebar.jsx`
- Modify: `frontend-app/src/templates/Common/Navbar.jsx`

- [ ] **Step 1: Rediseñar Sidebar**

Glassmorphism: `background: var(--bg-card)`, `backdrop-filter: blur(16px)`, borde derecho sutil. Iconos lucide con tamaño 18px. Hover: highlight verde sutil (`rgba(34,197,94,0.1)`). Item activo: borde izquierdo verde 3px + fondo verde sutil. Transición de collapse: width animada 200ms.

- [ ] **Step 2: Rediseñar Navbar**

Sticky, blur backdrop (`backdrop-filter: blur(12px)`), avatar con borde verde 2px, título limpio con peso 600, dropdown de cultivos con glassmorphism.

- [ ] **Step 3: Commit**

```bash
git add frontend-app/src/templates/Common/Sidebar.jsx frontend-app/src/templates/Common/Navbar.jsx
git commit -m "feat(ui): sidebar y navbar con glassmorphism y transiciones"
```

---

## Task 3: Componentes reutilizables (Skeleton, EmptyState, Toast)

**Files:**
- Create: `frontend-app/src/components/Skeleton.jsx`
- Create: `frontend-app/src/components/EmptyState.jsx`
- Create: `frontend-app/src/components/Toast.jsx`

- [ ] **Step 1: Skeleton.jsx** — componente con props `width`, `height`, `variant` (text, circle, rect). Animación pulse.

- [ ] **Step 2: EmptyState.jsx** — props `icon`, `title`, `description`, `action` (button). Centrado, icono grande muted, texto, CTA opcional.

- [ ] **Step 3: Toast.jsx** — props `message`, `type` (success/error/warning/info), `duration`. Posición fixed bottom-right, animación slide-in, auto-dismiss.

- [ ] **Step 4: Commit**

```bash
git add frontend-app/src/components/Skeleton.jsx frontend-app/src/components/EmptyState.jsx frontend-app/src/components/Toast.jsx
git commit -m "feat(ui): componentes Skeleton, EmptyState y Toast"
```

---

## Task 4: Dashboards — charts mejorados

**Files:**
- Modify: `frontend-app/src/views/DashboardYield.jsx`
- Modify: `frontend-app/src/views/DashboardScenario.jsx`
- Modify: `frontend-app/src/views/DashboardClimate.jsx`
- Modify: `frontend-app/src/views/DashboardFinance.jsx`

- [ ] **Step 1: Crear configuración base de Chart.js**

Archivo `frontend-app/src/utils/chartConfig.js` con: colores consistentes (paleta de 6), tooltips ricos (callback con valor + unidad + contexto), animaciones (duration 800ms, easing easeOutQuart), responsive, leyenda clickeable, grid lines sutiles.

- [ ] **Step 2: Rediseñar DashboardYield**

KPIs arriba (cards con glassmorphism) → chart principal (waterfall) → charts secundarios (fenología, factores) → tabla de datos. Skeleton loaders mientras carga. Empty state si no hay datos.

- [ ] **Step 3: Rediseñar DashboardScenario**

KPIs → percentiles (chart) → heatmap → ranking → tabla de viabilidad de siembra. Skeleton loaders. Empty state.

- [ ] **Step 4: Rediseñar DashboardClimate**

KPIs → timeline de anomalía → agua por estrato → timeline fenológico. Skeleton loaders. Empty state.

- [ ] **Step 5: Rediseñar DashboardFinance**

KPIs → sensibilidad (heatmap) → waterfall costos → ROI estrategias. Skeleton loaders. Empty state.

- [ ] **Step 6: Commit**

```bash
git add frontend-app/src/utils/chartConfig.js frontend-app/src/views/Dashboard*.jsx
git commit -m "feat(ui): dashboards con charts interactivos, skeleton loaders y empty states"
```

---

## Task 5: Formularios y vistas restantes

**Files:**
- Modify: `frontend-app/src/views/Cultivos.jsx`
- Modify: `frontend-app/src/views/Simular.jsx`
- Modify: `frontend-app/src/views/History.jsx`
- Modify: `frontend-app/src/views/MapPage.jsx`
- Modify: `frontend-app/src/views/Configuracion.jsx`

- [ ] **Step 1: Cultivos.jsx** — formularios con inputs rediseñados (focus ring verde, padding generoso), cards con glassmorphism, tabla de cultivos con hover highlight.

- [ ] **Step 2: Simular.jsx** — formulario de simulación con inputs rediseñados, progress steps, resultado con cards.

- [ ] **Step 3: History.jsx** — tabla con zebra striping, hover highlight, headers sticky, paginación.

- [ ] **Step 4: MapPage.jsx** — mapa con glassmorphism overlay, controles rediseñados.

- [ ] **Step 5: Configuracion.jsx** — secciones con cards, inputs rediseñados, toggle de tema.

- [ ] **Step 6: Commit**

```bash
git add frontend-app/src/views/Cultivos.jsx frontend-app/src/views/Simular.jsx frontend-app/src/views/History.jsx frontend-app/src/views/MapPage.jsx frontend-app/src/views/Configuracion.jsx
git commit -m "feat(ui): formularios, tablas y vistas rediseñadas con nuevo sistema visual"
```

---

## Task 6: Tema claro/oscuro y accesibilidad

**Files:**
- Modify: `frontend-app/src/App.jsx`
- Modify: `frontend-app/src/index.css`

- [ ] **Step 1: Toggle de tema en App.jsx**

Persistir en localStorage, aplicar clase `.light-theme` a body, toggle con botón en Navbar. Respetar preferencia del sistema (`prefers-color-scheme`).

- [ ] **Step 2: Ajustes de accesibilidad**

Focus visible (`:focus-visible` con outline verde), ARIA labels en botones, contraste WCAG AA verificado en ambos temas, skip-to-content link.

- [ ] **Step 3: Commit**

```bash
git add frontend-app/src/App.jsx frontend-app/src/index.css
git commit -m "feat(ui): tema claro/oscuro con toggle y accesibilidad WCAG AA"
```

---

## Task 7: Build y verificación

- [ ] **Step 1: Build del frontend**

```bash
cd frontend-app && npm run build
```
Expected: build exitoso, archivos copiados a raíz.

- [ ] **Step 2: Verificar que el frontend carga sin errores en el navegador**

Abrir `http://localhost/ZeaSys` y verificar:
1. Login carga correctamente
2. Dashboard se ve con el nuevo diseño
3. Toggle de tema funciona
4. Charts se renderizan
5. Chatbot widget visible y funcional

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat(ui): rediseño visual completo de ZeaSys (dark+light, charts, accesibilidad)"
```
