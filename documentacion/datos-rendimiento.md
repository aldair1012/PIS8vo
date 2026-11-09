# Fuentes disponibles para Rendimiento

Revisión local del 24 de octubre de 2026. Los archivos originales no se modificaron.

## Inventario

| Archivo | Contenido verificado | Alcance y uso posible |
| --- | --- | --- |
| `ml-engine/data/inamhi-precipitacion-2019diciembre.csv` | 5.768 filas de estación/año, 484 estaciones, años 2000–2019; columnas mensuales, coordenadas y altitud. | El dashboard elige una estación dentro de 100 km, prioriza estaciones con al menos ocho años con 12 meses reportados y grafica las sumas anuales. No rellena meses faltantes ni trata la estación como si estuviera dentro de la parcela. |
| `ml-engine/data/inamhi-temperaturamedia-2019diciembre.csv` | 1.965 filas de estación/año, 196 estaciones, años 2000–2019. | Contexto térmico histórico. La cobertura de estaciones difiere de la de lluvia; cruzar por identificador de estación y año, conservar vacíos. |
| `ml-engine/data/maiz_ecuador_training_data.csv` | 2.366 filas, 38 columnas, 22 provincias y 25 variedades. Incluye rendimiento, ciclo, riego, textura, nutrientes, NDVI y variables de plagas. | Entrenamiento y análisis de relaciones. No tiene fecha, identificador de parcela ni fuente por fila. El repositorio no permite acreditar cada fila como observación histórica real de una parcela. No usar sus promedios como mediciones del usuario. |
| `backend-api/data/agronomia_data.json` | 33 fichas de variedades, 9 condiciones agronómicas, 12 referencias de fertilización, 16 fichas de plagas/enfermedades y 16 calendarios de siembra. | Referencias generales por variedad o zona. Los calendarios marcan meses de siembra/cosecha; las plagas describen etapas críticas, sin series de incidencias observadas por fecha y parcela. El catálogo es una compilación interna; conservar esa atribución y validar las fichas antes de tratarlas como máximos experimentales. |
| `ml-engine/data/reglas_decision.json` | 22 reglas por región, variedad, etapa y condición. | Contexto para recomendaciones. No son resultados de monitoreo actual ni un modelo validado para cuantificar pérdidas. |
| `rag-sources/` | Cinco PDF de INIAP, MAG e INEC, documentados en `SOURCES.md`. | Biblioteca de consulta. La existencia de una guía o un boletín agregado no implica disponer de medidas de la parcela. |
| `frontend-app/src/data/sipa-maiz-duro-2020-2025.json` | Serie provincial de maíz duro seco 2020–2025 importada desde la base SIPA/MAG. | Gráfico provincial de Rendimiento. No identifica la variedad ni una cosecha observada del lote. |
| `backend-api/data/referencias/gaez-v4-ecuador-maiz.json` | Recorte geográfico de dos GeoTIFF oficiales FAO/IIASA GAEZ v4; cada celda corresponde a 5 minutos de arco (~9 km). | Devuelve los rendimientos potencial y alcanzable del píxel de la parcela. Son escenarios modelados para maíz genérico y expresados en materia seca. Los GeoTIFF originales se conservan en `backend-api/data/cache/fuentes_gaez_v4/`; pueden regenerarse con `scripts/import_gaez_ecuador.py`. |

## Indicadores y requisitos

| Indicador | Qué puede hacerse con las fuentes actuales | Qué sigue faltando |
| --- | --- | --- |
| Potencial zonal y alcanzable de secano | Se leen las capas de potencial irrigado (200 mm/m de agua disponible, insumos altos) y rendimiento alcanzable medio de tierras agrícolas actuales bajo secano (insumos altos). Ambas corresponden a maíz genérico, clima 1981–2010 y unidad `t MS/ha`; la diferencia se calcula entre esas dos referencias. | No son valores medidos de la parcela, ni del híbrido, ni de la campaña actual. No se comparan con el rendimiento predicho del modelo, que usa otra base de humedad. |
| Máximo experimental por híbrido | Solo aparece al coincidir la variedad exacta con un ensayo publicado. Se incorporó INIAP H-603 Superior: media 8,48 y máximo 10,82 t/ha; 29 localidades (2010–2013), máximo bajo riego en época seca. | La parcela debe tener el nombre específico del híbrido. El máximo del ensayo no es un límite genético universal ni un rendimiento garantizado. |
| PAR estimada reciente | Rendimiento consulta `ServicioDatosTerreno`, que ya recibe la radiación de Open-Meteo Archive y aproxima PAR. Se expone valor, unidades, método y alcance. Solo se publica cuando el bloque climático procede de la API y el valor es finito y no negativo. | Disponibilidad de radiación por coordenadas. Una medición PAR directa o una serie del ciclo exige otra fuente/periodo específico. |
| Lluvia histórica | Se grafica la serie mensual INAMHI de la estación cercana, sumando solo años con los 12 meses reportados. | No es lectura en la parcela; la base termina en 2019 y tiene vacíos. |
| Lluvia y ET₀ desde siembra | Open-Meteo Historical / ECMWF IFS entrega sumas diarias a ~9 km desde la fecha **estimada** guardada en la parcela, con cobertura indicada. ET₀ es evaporación de referencia. | No confirma la siembra real, no es evapotranspiración del maíz (ETc), no incluye riego ni constituye por sí sola un balance o una medición de agua útil. |
| Agua disponible del suelo | SoilGrids estima capacidad disponible del perfil 0–100 cm al combinar θ33 y θ1500 por intervalos de profundidad. Se muestra como referencia del modelo espacial, no como humedad actual. | Para agua útil real del ciclo faltan capacidad de campo y marchitez medidas, profundidad efectiva de raíces, humedad inicial, lluvia efectiva, riego y ETc del cultivo. |
| Índice de cosecha | Los archivos auditados no incluyen las dos masas necesarias. | Masa seca de grano y biomasa aérea seca total, de la misma parcela y cosecha. Calcular su relación; no deducirla del rendimiento por hectárea. |
| Fase vulnerable | Calendarios, ciclos y etapas críticas sirven de referencia para un seguimiento orientativo. | Seguimiento fenológico local y criterios de riesgo validados para declarar una fase vulnerable actual. No asignar una etapa observada solo por días desde siembra. |
| Riesgo por plagas | Fichas y reglas describen problemas y etapas. | Observaciones fechadas de incidencia/severidad y seguimiento de la parcela para cuantificar un riesgo actual o una pérdida. |
| Límite genético | El catálogo tiene máximos reportados de referencia. | Evidencia experimental específica. Un máximo observado o publicado no establece por sí solo el límite genético. |

## PAR conectada al dashboard

El proveedor existente calcula `radiacion_par = media(shortwave_radiation_sum) × 2,06`.
La entrada solar está en MJ/m²/día; la salida aproximada en mol/m²/día.
El coeficiente es una hipótesis de conversión del proveedor existente, no una calibración
de un sensor de la parcela. Se etiqueta como **PAR estimada reciente**.

La ventana solicitada por ese proveedor es de 30 días recientes. Se promedian los días
disponibles y puede usarse la caché de hasta 24 horas. Este contexto se entrega en
`referencias_contexto.radiacion_par`, separado de las entradas de la simulación guardada.
Si el proveedor falla o la radiación falta, el indicador permanece no disponible;
no se sustituye por valores de respaldo.

Documentación del proveedor de radiación solar: https://open-meteo.com/en/docs/historical-weather-api

## Referencias externas añadidas

- **FAO/IIASA GAEZ v4:** capas `maiz200a_yld.tif` y `ycHr_mze.tif`, clima CRUTS32 1981–2010, insumos altos. El API oficial de FAO describe la primera como potencial agroclimático irrigado con 200 mm/m de agua disponible y la segunda como rendimiento medio alcanzable de secano en tierras agrícolas actuales. Ambas están en kg de peso seco/ha; ZeaSys divide entre 1.000 para presentar t MS/ha. [GAEZ v4](https://www.fao.org/gaez/gaezv4/en).
- **SoilGrids / ISRIC:** capas de humedad volumétrica a 33 y 1500 kPa para 0–5, 5–15, 15–30, 30–60 y 60–100 cm. La capacidad del perfil se estima con `Σ(θ33 − θ1500) × espesor`; SoilGrids es predicción espacial y publica distribuciones de incertidumbre. [Capas, intervalos y cuantiles](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html).
- **ECMWF IFS vía Open-Meteo:** lluvia y ET₀ diarias desde la fecha estimada reciente, valores solo cuando al menos 90% de los días del intervalo están disponibles. [Histórico, resolución y variables](https://open-meteo.com/en/docs/historical-weather-api).
- **INIAP H-603 Superior:** referencia de ensayo de la ficha `variedades-verificadas.json`; valores y condiciones provienen del estudio INIAP de 29 localidades 2010–2013. [Repositorio INIAP](https://repositorio.iniap.gob.ec/items/167c75ef-de78-4f29-9939-2e7e71fea5f9).
