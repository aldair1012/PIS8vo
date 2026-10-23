# Proveedores de datos de ZeaSys

## Estado actual

El motor de predicción conserva las 36 columnas del modelo y no sustituye los
valores que el usuario está simulando. Las APIs externas se almacenan en
`precision_data` como contexto verificable para dashboards y chatbot.

| Campo | Proveedor | Tipo | Uso |
| --- | --- | --- | --- |
| `precision_data.weather` | Open-Meteo | Pronóstico | Clima actual, lluvia a 7 días, ET₀, VPD, radiación, temperatura y humedad del suelo por capa |
| `precision_data.nasa_power` | NASA POWER | Respaldo diario | Se usa sólo si Open-Meteo falla |
| `precision_data.open_meteo_historico` | Open-Meteo Historical | Reanálisis | Se solicita bajo demanda para comparar históricos |
| `precision_data.inamhi_historico` | INAMHI local | Observación histórica | Estación más cercana y estadísticas cargadas desde los datos locales |
| `precision_data.soilgrids` | SoilGrids | Propiedades estimadas del suelo | pH, arcilla, arena, limo y carbono orgánico cuando existe el píxel |

## Clima actual y pronóstico

`ServicioClimaActual` consulta `ProveedorOpenMeteoForecast` y guarda el
resultado en caché durante 30 minutos por coordenada redondeada. Devuelve:

- `actual`: temperatura, humedad relativa, precipitación, viento y descripción
  del clima observado en el corto plazo;
- `pronostico_7d`: siete días con temperatura máxima/mínima, lluvia,
  probabilidad de lluvia y descripción;
- `fuente`, `consultado_en`, `desde_cache` y `disponible`.

La altitud se envía a Open-Meteo cuando la parcela la tiene; si falta, no se
inventa una elevación. Si el proveedor falla, el bloque queda como no disponible
y el resto del contexto sigue funcionando.

No confundir con `precision_data.weather`, que es la entrada meteorológica del
motor de predicción. `clima_hoy` y `pronostico_7d` son la lectura de corto plazo
para dashboards y chatbot; `clima_promedio_30d` es la serie observada de los
últimos 30 días de Open-Meteo Archive.

## Precio de referencia del maíz

`backend-api/data/precio_maiz_referencia.json` contiene la franja oficial del
MAGP para la campaña 2026:

| Campo | Valor |
| --- | --- |
| piso | `USD 17,45/qq` |
| techo | `USD 19,61/qq` |
| promedio | `USD 18,53/qq` |
| fecha de fuente | `2026-03-27` |

Es una **referencia oficial**, no una cotización de mercado en tiempo real. El
chat debe citar fuente y fecha sólo cuando el usuario las pida. El módulo
financiero usa su propio precio de cálculo; no se debe presentar la franja MAGP
como precio efectivo de venta.

## Solicitar históricos

El endpoint `POST /predict` sigue funcionando igual. Para incluir los últimos
30 días del histórico Open-Meteo en la respuesta se puede añadir:

```json
{
  "incluir_historico": true
}
```

La respuesta incluye un resumen (`temperatura_media_c`,
`precipitacion_total_mm`, `et0_total_mm` y `radiacion_media_mj_m2_d`) y la serie
diaria en `precision_data.open_meteo_historico.daily`.

## Semántica de valores faltantes

- `quality: "model"`: valor de un modelo meteorológico.
- `quality: "reanalysis"`: serie histórica/reanálisis.
- `quality: "unavailable"`: el proveedor respondió sin datos o no estaba disponible.
- Un valor ausente no se reemplaza por cero ni por una cifra teórica.

El chatbot debe utilizar `source`, `quality`, `observed_date`/`retrieved_at` y
las unidades antes de explicar cualquier indicador.

## Límites operativos

Las consultas tienen timeout y no bloquean la predicción. Si fallan ambos
proveedores meteorológicos, el modelo mantiene el escenario enviado por el
usuario y devuelve el error en `provider_errors`.

