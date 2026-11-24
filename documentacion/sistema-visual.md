# Sistema visual de ZeaSys

## Identidad y componentes

La portada presenta el producto y da acceso a la cuenta. La sesión de trabajo comienza con la parcela activa. La portada usa `landing-system.css`. Las pantallas autenticadas comparten `internal-system.css`, `product-design.css` y los estilos de su módulo.

| Uso | Claro | Oscuro |
| --- | --- | --- |
| Fondo de trabajo | Gris cálido `#E7E6E1` | Carbón verdoso `#181C1A` |
| Superficie de lectura | Blanco suave `#FAF9F8` | Superficie oscura `#252D29` |
| Acción y serie principal | Petróleo `#345C50` | Petróleo `#4D766A` |
| Serie secundaria y motivos de cultivo | Salvia `#7C9084` | Salvia `#88A092` |
| Texto principal | Carbón `#222523` | Marfil `#F3F1EB` |
| Detalle de marca | Maíz `#E9B949` | Maíz `#E9B949` |

Los bordes y textos secundarios se derivan por mezcla. La interfaz reserva los colores semánticos de alerta y error para estados que también tengan texto o icono. La cartografía y la fotografía conservan sus propios colores. La marca combina una hoja con una pequeña franja maíz. Los gráficos distinguen temperatura y precipitación mediante línea, barras, unidades y etiquetas.

Las pantallas mantienen la tipografía sans del proyecto, cifras tabulares, paneles con bordes de un píxel y radios de unos 14 px. El foco se distingue del estado seleccionado. La navegación compacta conserva los nombres accesibles de los controles. Los iconos decorativos se excluyen de la lectura por voz. La tarjeta de acceso gira al abrirse y conserva el cambio animado entre formularios. Las personas que activan movimiento reducido reciben el formulario inmediatamente.

## Auditoría y recorrido por módulo

| Vista / código | Punto de partida observado | Resultado y comprobación funcional |
| --- | --- | --- |
| Portada · Login | Panel ilustrativo sobre fotografía de fondo, pasos y promesas simultáneos | Título, foto curva y cuatro funciones. Explorar lleva a las capacidades e Ingresar gira la tarjeta. |
| Acceso y registro · Login | Tiempos independientes para giro y foco, panel oscuro fijo en ambos temas | Formulario con superficie del tema, opción de mostrar contraseña, envío y cambio de modo. El foco respeta una interacción iniciada por el usuario. |
| Carga · PantallaCarga | Brote y esqueleto existentes con acento independiente | Acento maíz del tema y estado de espera existente. |
| Navegación · Sidebar | Menú degradado y mapas e historial anidados | Navegación lateral con selección petróleo y entradas directas a Mapas, Historial y Configuración. En móvil se abre y cierra con controles de teclado. |
| Parcelas y mapa · Cultivos, MapPage | Formulario y mapa con requisitos distintos de altura y selección | Superficies del tema, panel de mapa y leyenda legible. Continúan el dibujo, coordenadas y registro de la parcela. |
| Siembra · DashboardScenario | Calendario, ficha del plan y simulaciones en una misma vista | Paneles comunes, fecha y riego declarados en el plan y calendario con acceso a las fechas guardadas. |
| Clima · DashboardClimate | Un gráfico alternaba lluvia y temperatura. La precipitación actual llegaba en la API y faltaba en el resumen | Cuatro indicadores, dos gráficos históricos en escritorio y selector de variable en móvil. Se conserva la tabla, la fuente, el período, las fechas originales y la acción de consultar al asistente. |
| Simular · Simular | Preparación y resultados con pestañas diferenciadas | Selector de pasos agrupado, escenario activo reconocible y parámetros de la parcela conservados. |
| Rendimiento · DashboardRendimiento | Tarjetas de indicadores y gráficos con realces diferentes | Encabezados de panel y unidades consistentes. Las ejecuciones siguen determinando los aportes y comparaciones. |
| Finanzas · DashboardFinance | Campos de presupuesto, costes y estimaciones conviven en una página larga | Formularios y tarjetas comparten la escala de superficies. El origen de los supuestos y los ceros introducidos siguen visibles. |
| Historial · History | Acceso desde Rendimiento y cabecera con medidas fijas | Acceso lateral y título adaptable. Selección, filtro y consulta se mantienen. |
| Registro de campo · RegistroCampo | Formulario extenso en diálogo | Grupos de mediciones con leyendas y márgenes adaptables. El área de lectura conserva la parcela elegida. |
| Configuración · Configuracion | Controles de cuenta y preferencias repartidos en tarjetas | Acceso directo y encabezados de sección de la familia visual del sistema. |
| Asistente · ChatbotWidget | Panel lateral con contexto, fuentes desplegables y compositor | Respuesta y fuentes mantienen superficies diferenciadas, con contraste explícito en el resumen y foco visible al escribir. |

## Verificación reproducible

Desde `frontend-app`, ejecutar `npm run lint`, `npm test` y `npm run build`. El último comando compila con Vite y sincroniza los artefactos con XAMPP. Los archivos de la raíz publicados se regeneran desde el código fuente.

Para las pruebas de navegador que escriben en la base, usar la URL del entorno desechable que imprime `python -X utf8 -u backend-api/tests/integracion/ejecutar.py --mantener`. Asignar esa URL a `ZEASYS_E2E_ORIGIN` y ejecutar `npm run test:e2e`. Cerrar el entorno con Enter al terminar. Las capturas de auditoría usan cuentas y campañas de prueba. La conectividad externa de Google y Gemini requiere una comprobación separada con credenciales del despliegue.
