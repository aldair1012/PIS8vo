# Revisión integral — 9 de noviembre de 2026

Trabajo realizado en el orden solicitado 1 → 7 → 6 → 2, seguido por ampliación de
referencias de maíz, documento Word, portada y revisión de dashboards. Se preservaron
las cuentas y datos reales y los cambios existentes del propietario.

## Funcionamiento reparado

- El acceso por correo llamaba un método inexistente del repositorio: respondía 500.
  Ahora utiliza el contrato correcto; se verifican acceso, rechazo de clave incorrecta
  y conservación exacta de espacios en contraseñas.
- El esquema vacío incluía un índice sobre la columna eliminada `rol`. Se retiró
  ese índice para permitir una instalación nueva sin reintroducir roles.
- Los favoritos fallaban por un parámetro PDO con nombre no ASCII. Se conserva la
  columna `año` y se utiliza un marcador SQL válido.
- Las pruebas y herramientas que aún llamaban rutas anteriores del API se actualizaron
  al contrato vigente. Los identificadores internos de las vistas se conservan.
- Limpiar el chat cancela la petición y descarta respuestas anteriores. El servidor
  ya protege contra respuestas tardías tras limpiar o cerrar sesión. Los documentos
  consultados se muestran en un detalle plegado, distinguiéndolos de las citas usadas.
- El pH en Mis parcelas utiliza el WMS de ISRIC; se verificó HTTP 200, CORS y conversión
  de unidad en una coordenada de referencia. Los datos manuales prevalecen sobre una
  consulta que termina más tarde. No se rellena un pH inventado al fallar.
- Se recuperó el acceso a Registro de campo desde Mis parcelas. Guardar un cambio
  conserva los otros grupos de mediciones. La prueba funciona también al repetirse.
- Se corrigió el análisis numérico del calculador de fertilizantes; 100 kg de urea
  al 46% producen 46 kg N/ha. Se validan dosis, porcentajes y precios, se eliminan
  precios supuestos y se limpia el aporte al retirar el último producto. La conversión
  no se presenta como una recomendación universal de dosis o calendario.

## Datos y modelo

- Se mantienen separados maíz duro seco, suave seco, duro en choclo y suave en choclo.
  Las referencias provinciales se calculan sobre cultivo solo, estado compatible,
  superficie/producción completas, pesos positivos y mínimo cinco registros por grupo.
- Grupos publicables: duro seco, 18 provincias / 2.054 registros; suave seco,
  10 / 718; duro en choclo, 3 / 29; suave en choclo, 9 / 651. Son resúmenes calculados
  por ZeaSys sobre microdatos, distintos de tabulados oficiales completos. No permiten
  asignar colores ni nombres comerciales que la encuesta no documenta.
- El ensayo separado de choclo utiliza 705 registros, 241 segmentos y 17 provincias.
  Con separación por segmento, el RMSE de referencia fue 2,958 t/ha y los dos candidatos
  2,931 y 2,994 t/ha; el R² fue negativo. No se publicó un predictor de choclo ni se
  sustituyeron los pesos activos. Resultados en `evaluacion-espac2025-choclo-20261109.json`.
- La serie SIPA de maíz duro se cotejó de nuevo con la hoja oficial: coinciden sus
  cifras y se restauró la metainformación de origen. No se muestra como una serie
  equivalente de choclo o maíz suave.
- Se retiró el objetivo arbitrario de 5,4 t/ha y se muestra la mediana de ejecuciones
  guardadas. Se retiraron los semáforos y umbrales agrícolas no justificados en la tabla
  de simulaciones; ordenar resultados no demuestra riesgo, calidad o éxito futuro.

## Interfaz y portada

Paleta HSL con primitivas compartidas, semántica por tema y alias de componentes.
La portada mantiene fotografía y difusión en ambos temas; explica el uso en tres pasos
y rotula su panel como ilustrativo, sin cifras fingidas. Las caras ocultas del acceso
no reciben foco.

Se revisaron Mis parcelas, Simular cosecha, Rendimiento, Siembra, Clima y cultivo,
Finanzas, Mapa de parcelas, Simulaciones guardadas y Configuración. Se corrigieron
etiquetas de formularios, jerarquía de títulos, controles del mapa, objetivos táctiles,
contraste, foco y desplazamiento de tablas, calendario por teclado, ayudas de gráficos
y tamaños móviles. El resultado de simulación dejó de ensanchar la pantalla en 390 px. El formulario de parcelas apila mapa y campos en móvil/tableta; los tres tamaños se verificaron también con controles alcanzables. Se limitó el acercamiento automático de un único marcador y se observa el tamaño del mapa para evitar capas parciales al cambiar la barra lateral.
Los gráficos ECharts mantienen el callback actual, generan descripción accesible y
respetan movimiento reducido; los nombres utilizados en ayuda HTML se escapan.

## Verificación y límites de las pruebas

- Lint y compilación Vite correctos; compilación copiada a XAMPP. Persiste un aviso
  de tamaño de algún fragmento generado; no impidió compilar ni ejecutar.
- 40 pruebas de utilidades frontend correctas; suites PHP y 68 pruebas del motor
  correctas; 20 recorridos HTTP principales correctos más limpieza de datos ficticios.
- Navegación, conexión, variedades, chat y portada se comprobaron en navegador.
  La matriz completa ejecutó 38 casos, más tres pruebas nuevas del formulario de parcelas; un caso inicialmente dependía de un valor fijo
  de la base ficticia al repetirse y se hizo independiente de ese valor. Los tres
  recorridos de guardado/descarga/registro se revalidaron correctamente y la última
  ejecución de los 12 casos de simulación/flujo resultó correcta.
- Auditoría: 54 combinaciones de vista/tema/tamaño, seis portadas y doce estados
  adicionales de registro y fertilizantes. Siembra se revalidó en sus seis combinaciones y parcelas/mapa en doce combinaciones
  tras la corrección de foco; no quedan violaciones detectadas de las reglas aplicadas
  en esa matriz consolidada. Se conservaron los resultados originales locales.
- Se inspeccionaron capturas y el Word renderizado. Axe no certifica todos los aspectos
  de accesibilidad; gráficos, contenido y estados no cubiertos necesitan criterio humano.
- `mysql.db` volvió a comprobarse: OK. La página principal responde HTTP 200. No se
  reimportó la base actual ni se reemplazaron tablas compartidas de otros proyectos.

No se demuestra ausencia universal de errores ni precisión agrícola en campo. El CSV
histórico conserva procedencia no acreditada. El archivo agronómico local compilado
y el mapa esquemático no se certifican por fila; esto se explica en el Word. Faltan
cosechas independientes para validar resultados reales. Las APIs y la generación de
texto siguen dependiendo de servicios externos y de sus credenciales/disponibilidad.

## Entregables

- `ZeaSys-referencias-datos-20261109.docx`: 29 fuentes, 14 variedades, cinco PDF con
  huella, campos, pantallas, código y límites. Las fuentes comerciales y los datos
  declarados/calculados no se presentan como certificación pública.
- `referencias-datos-sistema-20261109.json`: inventario regenerable.
- `auditoria-ui-20261109.json`: matriz consolidada de la revisión.
- `REVISION_DOCENTES.md` y paquete ZIP: código, compilación y datos públicos, con
  manifiesto de integridad. No incluye cuentas, base personal, avatares ni claves.
