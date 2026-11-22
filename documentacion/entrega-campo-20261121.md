# ZeaSys en campo · 21 de noviembre de 2026

## Qué exactitud se puede comunicar

En Siembra, la referencia mensual se ajustó con 1 592 registros de ESPAC 2025 y se calibró con 418 registros de otros segmentos de la encuesta. Para publicar una cifra por provincia, producto y mes se exigieron cinco segmentos de ajuste. De 624 registros reservados para la prueba, 482 tenían una combinación cubierta. El error absoluto medio fue 1,395 t/ha. La banda nominal del 50 % incluyó 217 de 482 observaciones (45,0 %) y la del 90 % incluyó 452 (93,8 %). La encuesta excluye parcelas sin superficie cosechada positiva. La misma referencia se aplica a dos fechas dentro de un mes. [Cálculo reproducible](../ml-engine/scripts/referencia_mensual_espac.py) · [Resultados](../backend-api/data/referencias/planificacion-mensual-espac.json).

Para el simulador de manejo, el candidato de 30 variables alcanzó 0,927 t/ha en el CSV histórico de procedencia pendiente. Los pesos publicados siguen siendo exploratorios. La precisión personal queda disponible cuando una cosecha documentada puede emparejarse con su predicción previa. El seguimiento admite observaciones fechadas, NDVI y adjuntos privados. Entrenar pesos de seguimiento y medir el error prospectivo requieren series con desenlace conocido. [Ensayo del simulador](revision-modelo-y-aplicacion-20261120.md) · [Registro de campañas](fuentes-evaluacion-cosechas.md).

## Dónde comprobar los cambios

La revisión del 22 de noviembre contrastó la referencia mensual con otra edición oficial. Aplicar la referencia publicada de 2025 a 2 129 registros cubiertos de 2024 produjo un MAE de 1,461 t/ha. Ajustar el mismo método con 2024 y evaluarlo sobre 1 823 siembras cubiertas de 2025 dio 1,681 t/ha. De 2 152 registros elegibles de esas siembras, 329 carecían de referencia suficiente. En esta última comparación, 627 de 1 823 cayeron dentro de la banda nominal del 50 % y 1 586 dentro de la del 90 %. Estos resultados aplican a la referencia territorial de monocultivos de grano seco con hectáreas efectivamente cosechadas. [Comparación reproducible](../ml-engine/scripts/contrastar_ediciones_espac.py) · [Microdatos ESPAC 2024](https://www.ecuadorencifras.gob.ec/documentos/web-inec/Estadisticas_agropecuarias/espac/2024/2_DD_DATOS_ABIERTOS_ESPAC_2024.zip).

La mediana que utiliza sólo el tipo de grano obtuvo menor MAE en los mismos registros de ambas comparaciones: 1,431 t/ha en 2024 y 1,635 t/ha en las siembras de 2025. Por eso Siembra y Simular ofrecen primero esa referencia sencilla. Las medianas y las bandas de provincia y mes sirven para explorar los antecedentes territoriales.

En Rendimiento, el seguimiento experimental revisa la predicción inicial a los 45 días usando el último NDVI medido y registrado entre los días 38 y 44. Son edades de comparación elegidas para este piloto. Ajusta el error de la planificación con una regresión lineal local frente al NDVI. Exige seis campañas anteriores, cobertura del NDVI en el ajuste y cinco evaluaciones en orden temporal. Muestra el ajuste sólo si mejora el MAE en más del 5 % frente a la planificación original y a una corrección media sin NDVI. La selección usa comparaciones históricas y necesita validación prospectiva. El plan y su intervalo originales se conservan. Los registros del propio productor permanecen en su cuenta.

| Pantalla | Recorrido |
| --- | --- |
| Siembra y Clima | Comparar dos fechas, lluvias previstas, RONI, grados-día y balance semanal. Revisar cobertura, fuente del relieve y límites de los coeficientes. |
| Simular | Cambiar lluvia o nitrógeno, consultar el tornado en t/ha y revisar las entradas y sus fuentes. |
| Rendimiento | Contrastar campañas previas, revisar cobertura de intervalos y consultar el historial. |
| Finanzas | Consultar 447 precios mensuales de ocho provincias, de enero de 2016 a octubre de 2026 según disponibilidad. Aplicar un precio histórico al presupuesto y comparar tres escenarios de margen. [Libro del MAGP](https://sipa.agricultura.gob.ec/descargas/base-estadistica/modulo_economico/precios-productor.xlsx). |
| Mis parcelas | Abrir el mapa, conceder y retirar acceso de lectura a un técnico y exportar las parcelas autorizadas. |
| Asistente | Autorizar el uso del proveedor, elegir modo simple y registrar una observación desde el chat. Configuración permite retirar la autorización. |

## Operación local

- XAMPP sirve la compilación de Vite. Los archivos JavaScript y CSS con hash disponen de gzip negociado y caché larga. El estado de los servicios se consulta en [salud local](http://localhost/ZeaSys/salud).
- El respaldo de MariaDB se programa con `tools/programar-respaldo.ps1`. La tarea usa la cuenta de Windows del titular y arranca al estar disponible si pasó la hora. Cada ejecución prueba la restauración en una base temporal antes de publicar el archivo comprimido en el perfil privado. Las copias permanecen en el mismo equipo hasta que el operador las traslade a un soporte privado. [Respaldo completo de otros servicios](respaldo-local.md).
- Para cargar los ejemplos de Costa y Sierra, crea una cuenta ficticia con dominio `example.test` y ejecuta `C:\xampp\php\php.exe tools/parcelas_demostracion.php productor@example.test` con el correo de esa cuenta. Los escenarios de demostración no aportan cosechas al cálculo de precisión.
- Docker arranca con `docker/iniciar-demo.ps1`. El perfil opcional del asistente local se levanta con `-Asistente`. Gemini directo necesita la clave del proveedor en el servidor. WhatsApp requiere configurar Meta, la plantilla, el webhook, el proceso horario y la suscripción del productor. [Activación de WhatsApp](avisos-lluvia-whatsapp.md).
