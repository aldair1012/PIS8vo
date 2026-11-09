# Fuentes oficiales para un nuevo dataset de maíz de ZeaSys

Investigación iniciada el 7 de noviembre de 2026 (hora de Ecuador). Algunas descargas tienen fecha UTC del 8 de noviembre. Se aplicó la skill de investigación para contrastar documentos originales y separar datos obtenidos de recursos todavía pendientes.

## Conclusión y alcance

Sí hay fuentes ecuatorianas con procedencia documentada que pueden sustentar una base más defendible que el CSV actual, cuyo origen no está acreditado. **No se encontró un archivo oficial que reúna, en cada cosecha, las 38 columnas que hoy utiliza el sistema.** Hay que construir un contrato de datos respaldado por las variables que realmente se consiguen y comprobar después su capacidad predictiva.

Una fuente oficial acredita quién la publica y su metodología. No garantiza que el modelo resultante sea más preciso ni convierte una encuesta en una medición experimental. Los datos de encuesta, las estaciones meteorológicas, los mapas estimados y los ensayos tienen unidades de observación diferentes.

Se descargaron archivos oficiales en `descargas/`, se registraron URL y huella SHA-256 en `manifest.json` y se preparó un subconjunto separado para investigación. El archivo de entrenamiento, los modelos y las bases de datos de usuarios permanecen sin cambios durante este trabajo.

El usuario confirmó que la ubicación debe guiar la selección de referencias. Se documentó ese requisito y se corrigió la selección de estaciones y el tratamiento de vacíos del histórico en el motor existente. Ver [criterios territoriales, cambios y pendientes](seleccion-territorial.md). Esto no implica que los nuevos archivos descargados ya alimenten el modelo.

## 1. Base principal comprobada: INEC ESPAC 2025

[Portal oficial y documentación](https://www.ecuadorencifras.gob.ec/estadisticas-agropecuarias-2/) · [ZIP de datos abiertos](https://www.ecuadorencifras.gob.ec/documentos/web-inec/Estadisticas_agropecuarias/espac/2025/2_DD_DATOS_ABIERTOS_ESPAC_2025.zip).

El archivo de cultivos transitorios descargado tiene **13.666 filas y 115 columnas**. Al seleccionar los cuatro grupos de publicación de maíz se obtienen estos recuentos, calculados directamente del CSV:

| Grupo publicado | Filas |
| --- | ---: |
| Maíz duro seco | 2.263 |
| Maíz suave seco | 1.935 |
| Maíz suave choclo | 727 |
| Maíz duro choclo | 51 |
| Total de los cuatro grupos | 4.976 |

Son registros de encuesta, no un recuento de productores independientes. No incluyen maíz forrajero que pudiera estar agrupado en otras categorías. El subconjunto conserva las 115 columnas originales sin rellenar vacíos ni alterar etiquetas.

Variables verificadas en el diccionario de **esta edición**:

| Información | Campo de origen | Precaución |
| --- | --- | --- |
| Provincia | `ual_prov` | Conservar la etiqueta original al normalizar. Hay etiquetas con espacios y zona no delimitada. |
| Tipo de maíz y estado publicado | `ct_nclavr` | Separar duro, suave, seco y choclo. |
| Condición solo/asociado | `ct_k504` | Una asociación requiere revisar cómo se atribuye la superficie. |
| Clase de semilla | `ct_k506` | Común, mejorada, certificada, híbrida nacional o internacional. No identifica el nombre del híbrido. |
| Calendario | `ct_k507`, `ct_k508`, `ct_k509` | Mes de siembra, año de siembra y mes de cosecha, respectivamente. No hay día exacto en estos campos. |
| Superficie | `ct_k510ha`, `ct_k511ha` | Sembrada y cosechada, en hectáreas. |
| Producción estandarizada | `ct_prod` | Toneladas métricas según documentación. Conservar también estado y unidades de captura. |
| Riego | `ct_riego`, `ct_porc_*` | Uso y proporciones de métodos. No mide milímetros aplicados. |
| Fertilizantes | `ct_cantidad_*`, `ct_umed_*` | Cantidad y unidad de productos. No equivale directamente a kg de nutriente por ha. |
| Pérdidas y plaguicidas | `ct_k512`, `ct_plagas`, `ct_apliplagui` | Pérdida de superficie o uso de plaguicidas no es una escala de presión de plaga. |
| Diseño de encuesta | `fact_exp_fin` y claves de identificación | Mantener para análisis ponderado y para evitar tratar registros relacionados como independientes. |

El perfil de metadatos publicado declara **CC-BY-4.0**. Se conserva la atribución al INEC. La guía menciona 116 variables para transitorios, mientras el CSV obtenido tiene 115: se documentó esa diferencia y se mantuvo el archivo real. El diccionario combina códigos con etiquetas: por ejemplo, riego se publica como SI/NO, aunque su descripción enumera códigos.

## 2. Complementos y estado real de acceso

| Fuente | Información relevante | Qué se comprobó y qué falta |
| --- | --- | --- |
| [MAG/SIPA: rendimientos objetivos](https://sipa.agricultura.gob.ec/index.php/rendimientos-de-maiz-duro-2025-cp) | Rendimientos y caracterización de maíz amarillo duro. También hay páginas de prácticas y ediciones 2024/2026. | Se localizaron portales y tableros. No se consiguió una tabla completa por parcela con las 38 entradas. Los agregados sirven para contraste territorial. |
| [INAMHI: lluvia mensual](https://www.datosabiertos.gob.ec/dataset/precipitacion-total-mensual/resource/98c77d18-e863-4e00-8a22-eb47f2981d9c) y [temperatura media](https://www.datosabiertos.gob.ec/dataset/temperatura-media-mensual/resource/29d46d3d-2c26-46a7-b7e2-8bed24fbba5c) | Estación, coordenadas, altitud, año y valores de los doce meses. | Ambos CSV descargados. Lluvia: 20.588 registros estación-año y 947 códigos de estación. Temperatura: 6.498 y 360. Años presentes 1960–2019, con vacíos. No significa cobertura completa ni estaciones actualmente activas. |
| [IGM: geopedología y perfiles](https://www.geoportaligm.gob.ec/proyecto_nacional/) | Textura, profundidad, pH, materia orgánica, ubicación y altitud de perfiles. | Descargado un perfil de ejemplo con análisis físicos y químicos. Es pasto en Carchi, medido en 2014, y no se añadió como cosecha de maíz. Hay que recuperar los perfiles o capas pertinentes a la zona del cultivo. |
| [MAG: fertilidad química 2022, 30 m](https://www.datosabiertos.gob.ec/dataset/mapa-digital-de-fertilidad-quimica-de-los-suelos-del-ecuador-continental) | Capas anunciadas de propiedades químicas del suelo. | Ficha y diccionario descargados. El diccionario describe clases de fertilidad. Pendiente obtener y revisar metadatos, profundidad, unidades y valores de las capas numéricas de cada propiedad. |
| [INIAP: ensayos del híbrido H-603](https://repositorio.iniap.gob.ec/items/167c75ef-de78-4f29-9939-2e7e71fea5f9) | Comparaciones de híbridos bajo condiciones hídricas y ambientes concretos. | La ficha documenta ensayos multisitio 2010–2013. No se obtuvieron observaciones de todas las repeticiones. Una media de un ensayo no es una cosecha nueva de cada provincia. |
| [INIAP: omisión de nutrientes, Pichilingue](https://tecnologia.iniap.gob.ec/2025/04/28/evaluacion-de-la-tecnica-de-omision-de-nutrientes-en-la-formacion-de-hibridos-simples-de-maiz/) y [artículo original](https://doi.org/10.15446/rfnam.v78n1.113460) | Tratamientos con N, P, K, Mg, S y B y variables agronómicas. | Nota institucional y artículo consultados. Investiga producción de semilla para formar un híbrido. Faltan datos por repetición y confirmar compatibilidad con predicción de grano comercial. |

Los archivos INAMHI descargados tienen un historial más extenso que las copias locales de la aplicación, que contienen 2000–2019. **Ambos conjuntos terminan en 2019**: no se deben presentar como clima observado del ciclo de una cosecha de 2025. El [catálogo INAMHI](https://www.inamhi.gob.ec/catalogo-de-productos/) identifica productos adicionales de humedad relativa y temperaturas mínimas/máximas, sin demostrar que estén disponibles inmediatamente como CSV abierto.

Para empezar con años coincidentes se identificó también el [portal ESPAC 2019](https://www.ecuadorencifras.gob.ec/encuesta-de-superficie-y-produccion-agropecuaria-continua-2019/) y su enlace a datos CSV. Esa edición aún no se descargó ni armonizó en esta investigación. La coincidencia temporal sigue sin probar correspondencia espacial exacta.

Las condiciones de uso varían: el gestor IGM declara CC BY-NC 4.0, el catálogo de fertilidad MAG una licencia no comercial y el artículo de nutrientes CC BY-NC-SA 4.0. Conservar atribución y revisar la licencia de cada recurso antes de incluirlo en un paquete distribuido.

## 3. Lo que todavía no puede completarse de forma fiable

La correspondencia de las **38 columnas actuales**, sin omitir ninguna, está en `correspondencia-38-columnas.csv`, con identificadores de fuentes resueltos en `fuentes-verificadas.json`.

Persisten especialmente estos huecos de información enlazada a cada cosecha:

- Nombre exacto de híbrido y densidad de plantas en la encuesta principal.
- Dosis efectivas de nutrientes y calendario de aplicaciones. Producto nitrogenado no equivale a nitrógeno puro, ni P del suelo a P2O5 aplicado.
- Milímetros de riego y uso específico de biofertilizantes. Superficie regada no determina volumen, y abono orgánico no demuestra inoculación microbiana.
- NDVI en V6, VT y R3 de la misma parcela. Requiere imágenes, geometría, fechas fenológicas y control de nubes. Además, una predicción hecha antes de R3 no puede usar una observación futura de R3 como si ya se conociera.
- Una definición reproducible de `presion_plaga_score`, de `horas_luz_dia` y de los umbrales de `categoria_cosecha`.

No llenar estos campos con promedios provinciales presentados como mediciones. Si se usan aproximaciones, deben tener nombre, origen, incertidumbre y un diseño de evaluación compatibles.

## 4. Archivos preparados y reproducción

- `candidatos/maiz_espac2025_original.csv`: las 4.976 filas seleccionadas, con todos sus campos originales.
- `candidatos/revision_rendimiento_espac2025.csv`: revisión auxiliar con línea de origen y alertas por tipo de producto, asociación, superficie o producción ausente.
- `perfil-candidato-espac2025.json`: recuentos, controles y huellas de las salidas.
- `perfil-inamhi-detalle.json`: cobertura y vacíos de las dos descargas meteorológicas.
- `manifest.json`: trazabilidad de los archivos descargados. `descargas/` y `candidatos/` se excluyen de Git para evitar versionar binarios y copias reproducibles.

Con las descargas locales presentes, desde la raíz del proyecto:

```powershell
python tools/preparar_candidato_espac.py
```

El programa verifica la huella de la descarga y compara la exportación con las filas originales campo por campo. No toca el entrenamiento ni el modelo. En la revisión auxiliar calcula `ct_prod / ct_k511ha` únicamente para maíz publicado como seco, cultivo solo y estado primario grano seco con superficie positiva y producción no negativa. Resultan **2.068 cocientes de maíz duro y 729 de suave**. Son cocientes para revisar, sin ajuste adicional de humedad ni garantía de elegibilidad para entrenar. No son la precisión de un modelo.

## 5. Decisión recomendada para ZeaSys

1. Usar ESPAC como base candidata principal, empezando por maíz duro seco si ese es el alcance elegido para el nuevo modelo. Conservar los otros tipos separados.
2. Reunir varias ediciones, diccionarios y reglas de unidades. Verificar objetivo de rendimiento, humedad y condiciones de cultivo antes de comparar con el CSV actual.
3. Obtener clima del mismo ciclo y suelo de la misma ubicación cuando la información pública lo permita. A una escala provincial se puede estudiar contexto provincial, sin atribuirle precisión de parcela.
4. Pedir o localizar microdatos documentados del MAG/INIAP para los campos agronómicos faltantes. No extraer observaciones individuales ficticias de un promedio publicado.
5. Entrenar una versión experimental con las variables disponibles, manteniendo grupos relacionados y años separados en la evaluación, y comparar errores por región y tipo de maíz. Las variables conocidas después de cosechar se reservan para etiquetas o evaluación, no para una predicción previa.
6. Sustituir el modelo activo solo después de comprobar el contrato de entrada y una mejora en datos independientes compatibles. Tener más filas o una institución como fuente no demuestra por sí solo mayor precisión.

No hace falta inventar las 38 columnas para iniciar una base sólida. Si las fuentes sostienen menos variables, un modelo con menos entradas bien documentadas puede ser más defendible. Su rendimiento tendrá que medirse.

## 6. Verificación y activación de los cambios del motor

- 47 pruebas del motor y proveedores correctas, incluidas las nueve nuevas de estaciones y datos ausentes.
- `npm run lint` y `npm run build` correctos. No hubo rediseño visual en este trabajo.
- Las 38 columnas del mapa coinciden en nombre y orden con el CSV actual y todas las fuentes tienen identificador resuelto.
- Siete descargas contrastadas con sus huellas SHA-256. Se comprobó que el CSV de entrenamiento conserva su huella previa.
- Con la copia operativa real se verificó una coordenada de prueba en Manabí: estación PORTOVIEJO-UTM a 1,74 km, periodo 2000–2019, 18 años completos de lluvia y 17 de temperatura. Esto es una prueba del selector, no una evaluación agrícola ni una parcela del usuario.
- El código está guardado y probado. El proceso del motor abierto necesita reinicio para cargar los cambios: el intento de reiniciarlo fue rechazado por el control automático de ejecución con el mensaje `blocked by policy`. No se detuvo ese proceso y no se considera activada la corrección en él.
