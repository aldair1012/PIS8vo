# ZeaSys · Cuaderno de campo digital

## Dirección

El agricultor debe reconocer su parcela, introducir condiciones y leer la proyección. La inspiración de las referencias se traduce en navegación agrupada, superficies neutras, un indicador principal verde y gráficos legibles. No se incorporan métricas ficticias, búsquedas sin función ni elementos bancarios decorativos.

## Contrato visual

- Claro: fondo gris salvia, superficies blancas, tinta verde muy oscura, acción verde bosque.
- Oscuro: fondo carbón verdoso, superficies elevadas discretas, tinta clara y acción verde hoja.
- Acentos de gráficos: verde para producción, maíz para referencia y azul para agua/clima. Los riesgos mantienen su color semántico.
- Tres niveles de tokens: primitivas, semántica de tema y alias de componente. Los estilos internos viven separados de la portada.
- Tarjetas: radios de 20 px, borde tenue, sombra ligera; sin neumorfismo que reduzca el contraste.
- Jerarquía: título de página, KPI, gráfico, detalle. Cifras tabulares y unidades pequeñas pero visibles.
- Navegación: Mi cultivo → Análisis y decisiones → Seguimiento. Cada enlace conserva su función existente.
- Controles: mínimo 44 px, foco visible, estados activos explícitos. Temas accesibles desde la cabecera y configuración.
- Adaptación: paneles en dos columnas cuando hay espacio, una columna móvil; las alturas siguen al contenido.
- Movimiento: conservar los tres indicadores rotativos por KPI cada cinco segundos, pausa individual al pasar el cursor y reducción de movimiento del sistema operativo.

## Implementación

- `internal-system.css`: tokens y compatibilidad con componentes antiguos.
- `product-design.css`: composición visual interna, navegación, formularios, tablas, indicadores y asistente.
- `landing-system.css`: portada y acceso; fotografía agrícola preservada en ambos temas.
- `chartConfig.js`: colores resueltos para gráficos canvas.

La capa visual no altera predicciones, registros, permisos o consultas. La revisión visual en navegador queda para el usuario según su preferencia; lint y build no sustituyen esa revisión.
