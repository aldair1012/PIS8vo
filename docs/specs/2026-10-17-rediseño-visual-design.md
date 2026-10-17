# Spec: Rediseño visual completo de ZeaSys

**Fecha:** 2026-10-17  
**Estado:** Aprobado (brainstorming)  
**Subproyecto:** 3 de 3 (rediseño visual)

## 1. Objetivo

Rediseño visual completo del frontend de ZeaSys: paleta de colores (modo oscuro + claro), tipografía, layout, componentes, y mejora de gráficos (estructura, orden, interactividad). El objetivo es una interfaz moderna, profesional, accesible y consistente.

## 2. Alcance

- **Toda la interfaz** se rediseña: sidebar, navbar, cards, formularios, tablas, modales, badges, botones.
- **Modo oscuro (default) + modo claro** con toggle persistente.
- **Gráficos:** estructura mejorada (KPIs arriba → chart principal → secundarios → tabla), interactividad (tooltips ricos, hover, click drill-down, leyenda clickeable), animaciones de entrada, responsive.
- **UX:** skeleton loaders, empty states, toast notifications, page transitions, accesibilidad WCAG AA.

## 3. Paleta de colores

### Modo oscuro (default)
- Fondo base: `#0f172a` (slate-900)
- Fondo secundario: `#1e293b` (slate-800)
- Fondo de cards: `rgba(30, 41, 59, 0.6)` con blur 12px (glassmorphism)
- Texto principal: `#f1f5f9` (slate-100)
- Texto secundario: `#94a3b8` (slate-400)
- Acento primario: `#22c55e` (green-500)
- Acento secundario: `#3b82f6` (blue-500)
- Advertencia: `#f59e0b` (amber-500)
- Peligro: `#ef4444` (red-500)
- Bordes: `rgba(148, 163, 184, 0.15)`

### Modo claro
- Fondo base: `#f8fafc` (slate-50)
- Fondo secundario: `#ffffff`
- Fondo de cards: `rgba(255, 255, 255, 0.8)` con blur 12px
- Texto principal: `#0f172a` (slate-900)
- Texto secundario: `#475569` (slate-600)
- Acentos: mismos (green-500, blue-500, amber-500, red-500)
- Bordes: `rgba(148, 163, 184, 0.2)`

## 4. Tipografía

- Fuente principal: `Inter` (Google Fonts) — pesos 400, 500, 600, 700
- Fuente mono: `JetBrains Mono` para datos numéricos en dashboards
- Escalas: 0.75rem (caption) → 0.875rem (small) → 1rem (body) → 1.125rem (subtitle) → 1.25rem (title) → 1.5rem (heading)
- Line-height: 1.5 body, 1.25 headings

## 5. Layout

- Sidebar: 260px expandido, 64px colapsado, glassmorphism + blur
- Navbar: 64px, sticky, con blur backdrop
- Content: padding 1.5rem, max-width 1440px
- Grid de dashboards: responsive 1→2→3 columnas
- Cards: border-radius 12px, sombra suave, hover lift (translateY -2px)

## 6. Charts

- Estructura: KPIs arriba → chart principal → charts secundarios → tabla de datos
- Interactividad: tooltips ricos (valor + unidad + contexto), hover highlight, click para drill-down (navegar a la vista detallada del punto de datos), leyenda clickeable (mostrar/ocultar series)
- Colores consistentes: paleta de 6 colores para datasets, accesible (WCAG AA)
- Animaciones: entrada suave (fade + slide), transiciones de 300ms
- Responsive: charts se redimensionan automáticamente

## 7. Componentes rediseñados

- Cards: glassmorphism, border-radius 12px, hover lift, sombra dinámica
- Botones: gradiente sutil, border-radius 8px, hover con shadow glow
- Inputs: border sutil, focus ring verde, padding generoso
- Badges: pastel con texto oscuro, border-radius 6px
- Modales: backdrop blur, centrado, animación scale-in
- Sidebar: glassmorphism, iconos lucide, hover con highlight verde sutil
- Navbar: blur backdrop, avatar con borde verde, título limpio
- Tablas: zebra striping sutil, hover row highlight, headers sticky

## 8. Mejoras de UX

- Loading states: skeleton loaders en vez de spinners
- Empty states: ilustraciones SVG simples + mensaje + CTA
- Error states: toast notifications con icono y mensaje
- Transiciones: page transitions con fade (200ms)
- Accesibilidad: focus visible, ARIA labels, contraste WCAG AA en ambos temas

## 9. Fuera de alcance

- Cambios en la lógica de negocio o backend
- Nuevas funcionalidades (solo visual)
- Tests automatizados de UI (no hay framework de testing frontend)
- Cambios en el chatbot widget (ya implementado)
