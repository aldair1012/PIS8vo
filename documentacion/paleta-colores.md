# Paleta compartida de ZeaSys

La portada y el espacio de trabajo comparten los colores base definidos en `frontend-app/src/assets/palette.css`. Cada interfaz los adapta mediante variables semánticas; la fotografía principal conserva su tratamiento en ambos temas. Los indicadores de estado y los gráficos mantienen colores diferenciados que transmiten significado.

| Uso | Oscuro | Claro |
| --- | --- | --- |
| Fondo de página | `#101a15` | `#e4ece2` |
| Superficie principal | `#1b2a22` | `#ffffff` |
| Superficie secundaria | `#15251c` | `#eaf2e6` |
| Texto principal | `#f0f4ef` | `#192c23` |
| Texto secundario | `#c2d0c3` | `#435b4a` |
| Acción principal | `#b5d98b` sobre texto `#102416` | `#176441` con texto blanco |
| Enfoque | `#9ed1ff` | `#165f9c` |

Contrastes WCAG calculados para pares principales: texto oscuro sobre página 16,00:1; texto secundario oscuro sobre superficie 9,35:1; texto claro sobre superficie 14,73:1; texto secundario claro sobre página 6,14:1; acciones oscuro y claro 10,31:1 y 7,15:1 respectivamente. Estos valores cubren solo los pares indicados y no sustituyen la revisión de los estados y componentes individuales.

La configuración de colores de canvas se conserva en `frontend-app/src/utils/chartConfig.js` porque Chart.js necesita valores de color resueltos. Los componentes especializados y las bibliotecas de mapas pueden mantener colores propios por legibilidad y significado de datos.
