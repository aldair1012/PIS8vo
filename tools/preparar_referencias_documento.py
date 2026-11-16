"""Inventario reproducible de fuentes, campos y usos; no certifica el modelo."""
import hashlib
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def load(path): return json.loads((ROOT/path).read_text(encoding='utf-8-sig'))

def main():
    sources=[]
    def add(id,publisher,title,url,fields,views,code,limit,status='Fuente institucional identificada'):
        for path in code:
            if not (ROOT/path).is_file(): raise ValueError(f'No existe {path}')
        sources.append(dict(id=id,institucion=publisher,titulo=title,url=url,campos=fields,pantallas=views,codigo=code,limite=limit,estado=status))
    add('MET-01','Open-Meteo','Weather Forecast API','https://open-meteo.com/en/docs',
        'Temperatura a 2 m (°C), humedad relativa (%), viento (km/h), precipitación (mm), probabilidad de precipitación (%), pronóstico de corto plazo; agua volumétrica y temperatura estimadas del suelo 0–10 cm.',
        'Clima y cultivo; valores de ubicación de la parcela; contexto del asistente.',
        ['ml-engine/src/data_providers.py','backend-api/src/Dominios/Lotes/Aplicacion/CultivoService.php','backend-api/src/Dominios/Terreno/Infraestructura/ProveedorOpenMeteoForecast.php','frontend-app/src/views/DashboardClimate.jsx'],
        'Salida de modelos meteorológicos interpolados; no una estación instalada en la parcela. No cubre todo el ciclo futuro.')
    add('MET-02','Open-Meteo / ECMWF','Historical Weather API','https://open-meteo.com/en/docs/historical-weather-api',
        'Lluvia acumulada de un periodo; lluvia anual de referencia ERA5 1991–2020 (promedio de 30 totales anuales completos); temperatura y humedad recientes; radiación solar.',
        'Clima y cultivo; comparación con periodos anteriores; referencias de rendimiento; simulación si se solicita el periodo histórico.',
        ['ml-engine/src/data_providers.py','backend-api/src/Dominios/Analitica/Infraestructura/ProveedorReferenciasPublicas.php','backend-api/src/Dominios/Terreno/Infraestructura/ProveedorLluviaAnual.php','backend-api/src/Dominios/Terreno/Infraestructura/ProveedorOpenMeteo.php','frontend-app/src/utils/climateEvidence.js'],
        'Reanálisis/modelos en malla. Se conserva el periodo consultado; un promedio anual no sustituye la lluvia del ciclo.')
    add('MET-06','NOAA Climate Prediction Center','Relative Oceanic Niño Index (RONI), ERSSTv6','https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/',
        'Índice RONI, anomalía trimestral relativa, período y serie reciente. NOAA lo usa para seguimiento oficial desde febrero de 2026.',
        'Clima y cultivo → Referencias de la zona → El Niño y La Niña; contexto del asistente.',
        ['backend-api/src/Dominios/Terreno/Infraestructura/ProveedorNoaaOni.php','frontend-app/src/views/DashboardClimate.jsx'],
        'Referencia del Pacífico tropical, no lluvia ni riesgo de la parcela. Cinco períodos consecutivos son un criterio histórico; no se declara un episodio oficial automáticamente. Los valores recientes pueden revisarse dos meses.')
    add('MET-03','NASA POWER','Daily point API','https://power.larc.nasa.gov/docs/services/api/',
        'Variables meteorológicas diarias de respaldo para series históricas compatibles.',
        'Motor de datos climáticos, cuando falla el proveedor principal y el periodo permite respaldo.',
        ['ml-engine/src/data_providers.py'], 'Recurso de respaldo; su uso depende de disponibilidad y contrato del periodo. No añade cosechas reales.')
    manifest=load('documentacion/fuentes-maiz/manifest.json')
    inamhi=next((x['url'] for x in manifest if 'precipit' in x.get('archivo','').lower()),'https://www.datosabiertos.gob.ec/')
    add('MET-04','INAMHI / portal de datos abiertos de Ecuador','Series mensuales históricas conservadas en el proyecto',inamhi,
        'Código/nombre/coordenadas de estación, mes/año, precipitación mensual (mm); temperatura media en el archivo de temperatura.',
        'Simular cosecha: referencia anual automática; Rendimiento: comparación por ejecución; Clima y cultivo; contexto del asistente y metadatos de nuevas simulaciones.',
        ['ml-engine/data/inamhi-precipitacion-2019diciembre.csv','ml-engine/data/inamhi-temperaturamedia-2019diciembre.csv','backend-api/src/Dominios/Analitica/Infraestructura/ProveedorReferenciasPublicas.php','backend-api/src/Dominios/Terreno/Infraestructura/ProveedorLluviaAnual.php'],
        'Estación más cercana a no más de 100 km y con al menos ocho años completos. La referencia anual es el promedio de totales de años con doce meses. Subconjunto local 2000–2019 verificado fila por fila contra la descarga oficial, sin modificar valores. Mes ausente no es cero; la estación no mide necesariamente la parcela.')
    add('MET-05','Open-Meteo / GeoNames','Geocoding API','https://open-meteo.com/en/docs/geocoding-api',
        'Coordenadas del centro de una localidad ecuatoriana cuando la parcela no tiene GPS.',
        'Consulta de lluvia anual de referencia; se etiqueta como centro aproximado de localidad.',
        ['backend-api/src/Dominios/Terreno/Infraestructura/ProveedorLluviaAnual.php'],
        'Sólo coincidencia exacta y única en Ecuador. Localidades homónimas sin resolver no generan una referencia. No reemplaza el polígono de la parcela.')
    add('SUE-01','ISRIC','SoilGrids 2.0: propiedades del suelo y unidades','https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html',
        'pH en agua; arcilla, arena y limo (%); carbono orgánico y materia orgánica derivada; profundidad 0–5 cm para autocompletado.',
        'Mis parcelas (pH); Simular cosecha (textura, pH y apoyo opcional); trazabilidad del resultado.',
        ['frontend-app/src/utils/datosParcela.js','backend-api/src/Dominios/Terreno/Infraestructura/ProveedorSoilGrids.php','backend-api/src/Dominios/Terreno/Aplicacion/TexturaSuelo.php'],
        'Predicción espacial de una malla, no análisis de laboratorio. Se divide pH por 10 y las fracciones por 10. Materia orgánica es una conversión, no medición. El agricultor puede corregir el dato.')
    add('SUE-02','FAO','Crop evapotranspiration: total available water','https://www.fao.org/4/x0490e/x0490e0e.htm',
        'Agua útil del perfil (mm), derivada de capacidad de campo, punto de marchitez y espesor de capas.',
        'Clima y cultivo; referencias de suelo; registro de campo para mediciones declaradas.',
        ['backend-api/src/Dominios/Analitica/Infraestructura/ProveedorReferenciasPublicas.php'],
        'Agua útil de SoilGrids es estimada; agua útil del registro depende de los datos declarados. No es humedad actual medida ni riego aplicado.')
    add('REF-01','FAO / IIASA','Global Agro-Ecological Zones v4 (2021)','https://www.fao.org/gaez/gaezv4/en',
        'Potencial zonal y rendimiento alcanzable, t de materia seca/ha; capas de maíz y condiciones de manejo/clima.',
        'Rendimiento → Consultar referencias de la zona.',
        ['backend-api/data/referencias/gaez-v4-ecuador-maiz.json','backend-api/src/Dominios/Analitica/Infraestructura/ProveedorReferenciasPublicas.php'],
        'Malla aproximada de 9 km; periodos climáticos históricos de las capas. No es potencial genético de la variedad ni cosecha de esta parcela. No comparar con choclo ni grano húmedo sin una base común.')
    add('EST-01','INEC','ESPAC 2025: microdatos de cultivos transitorios','https://anda.inec.gob.ec/anda5/index.php/catalog/1319',
        'Tipo de maíz; estado de cosecha; provincia; mes de siembra; clase de semilla; área sembrada/cosechada (ha); producción (t); factor de expansión y segmentos.',
        'Rendimiento → referencias separadas de grano y choclo; investigación de modelos de grano seco y choclo.',
        ['backend-api/data/referencias/espac2025-productos-maiz.json','tools/preparar_referencias_maiz.py','ml-engine/src/espac_dataset.py','ml-engine/scripts/evaluar_espac2025.py'],
        'Resumen calculado por ZeaSys sobre registros filtrados, distinto de un tabulado oficial completo. La fuente no acredita color, variedad comercial ni coordenadas individuales. Los ensayos no sustituyen al modelo activo.')
    add('EST-02','MAG / SIPA','Estadísticas de maíz: serie 2020–2025','https://sipa.agricultura.gob.ec/index.php/maiz',
        'Superficie cosechada (ha), producción bruta (t) y rendimiento de maíz duro seco (t/ha), nacional/provincial, por año.',
        'Rendimiento → histórico provincial; contexto del chatbot cuando corresponde al tipo registrado.',
        ['frontend-app/src/data/sipa-maiz-duro-2020-2025.json','scripts/import_sipa_maiz.py','frontend-app/src/views/DashboardRendimiento.jsx'],
        'Solo maíz duro seco. La nota de fuente indica estandarización a 13% de humedad y 1% de impurezas. No es la cosecha de la cuenta ni una serie de choclo.')
    price=load('backend-api/data/precio_maiz_referencia.json')
    add('ECO-01','MAGP','Precio de sustentación de maíz amarillo duro, campaña 2026',price['url_fuente'],
        'Piso y techo publicados por quintal; punto medio calculado y calidad comercial indicada en el archivo.',
        'Finanzas → referencia de precio; el agricultor introduce precio y presupuesto del escenario.',
        ['backend-api/data/precio_maiz_referencia.json','backend-api/src/Dominios/Analitica/Aplicacion/ServicioAnaliticaFinancial.php'],
        'Referencia con año y calidad; no es precio de mercado en tiempo real. El punto medio no acredita una transacción. No aplicar directamente a choclo o canguil.')
    geo=load('backend-api/data/referencias/provincias-ecuador.json')['metadata']
    add('GEO-01','INEC / HDX / geoBoundaries','Límites provinciales simplificados, referencia 2018',geo['url'],
        'Provincia inferida mediante coordenadas; límite administrativo simplificado.',
        'Formulario de simulación; evaluación documental de variedades por territorio.',
        ['backend-api/data/referencias/provincias-ecuador.json'],
        'CC BY 3.0 IGO según metadatos. No delimita propiedad ni certifica linderos; una zona no delimitada no se asigna forzosamente.')
    add('GEO-02','OpenStreetMap Foundation','Nominatim: reverse geocoding','https://nominatim.org/release-docs/latest/api/Reverse/',
        'Nombre aproximado de localidad y provincia a partir de latitud/longitud.',
        'Mis parcelas y apoyo de ubicación del histórico provincial.',
        ['frontend-app/src/views/Cultivos.jsx','frontend-app/src/views/DashboardRendimiento.jsx'],
        'Geocodificación de apoyo, no dato catastral ni medición agrícola.', 'Proveedor cartográfico; no certificación agrícola')
    add('MET-05','Open-Meteo','Elevation API','https://open-meteo.com/en/docs/elevation-api',
        'Altitud estimada sobre el nivel del mar (m).','Mis parcelas: altitud de apoyo y consulta de compatibilidad del catálogo.',
        ['frontend-app/src/views/Cultivos.jsx','frontend-app/src/utils/datosParcela.js'],
        'Modelo de elevación; dato corregible por el agricultor, no un levantamiento topográfico.')
    # Los cinco PDF originales, con huella para asociar páginas revisadas a la edición exacta.
    pdfs=[]
    for line in (ROOT/'rag-sources/SOURCES.md').read_text(encoding='utf8').splitlines():
        m=re.match(r'\| `([^`]+\.pdf)` \| \[([^]]+)\]\((.+)\) \| (\d+) \| (.+) \|',line)
        if not m: continue
        filename,publisher,url,year,use=m.groups(); id=f'PDF-{len(pdfs)+1:02d}'; file=ROOT/'rag-sources'/filename
        add(id,publisher,filename,url,use,'Asistente: recuperación documental y citas de páginas PDF.',
            ['backend-api/data/referencias/rag-corpus.json','backend-api/src/Dominios/Chat/Infraestructura/RecuperadorChroma.php'],
            'Conocimiento de referencia de la edición citada; no datos actuales del lote. Se recuperan páginas relevantes y la respuesta generativa debe respetarlas.')
        pdfs.append(dict(id=id,archivo=filename,anio=int(year),sha256=hashlib.sha256(file.read_bytes()).hexdigest()))
    catalog=load('backend-api/data/referencias/catalogo-maiz-ecuador.json')
    for key,source in catalog['fuentes'].items():
        private=key=='dkecuador'
        add('VAR-'+key,'Bayer / DEKALB' if private else 'INIAP / MAG / FAO, según publicación',source['titulo'],source['url'],
            'Nombre de variedad, uso documentado, región/provincia, altitud y ciclo cuando existen; condiciones de manejo que figuran en la ficha.',
            'Mis parcelas → variedad; Simular → consultar variedades y compatibilidad documental; contexto del asistente.',
            ['backend-api/data/referencias/catalogo-maiz-ecuador.json','frontend-app/src/data/variedadesMaizEcuador.js','backend-api/src/Dominios/Analitica/Infraestructura/RepositorioCatalogoAgronomico.php'],
            'No se completa una condición ausente con valores inventados. Compatibilidad documental no equivale a ensayo local ni precisión predictiva.',
            'Fuente comercial del fabricante; no organismo certificador' if private else 'Publicación institucional identificada en catálogo')
    add('IA-01','Google AI for Developers','Gemini: Grounding with Google Search','https://ai.google.dev/gemini-api/docs/google-search',
        'Explicación generativa, búsqueda pública cuando se requiere, metadatos de enlaces y sugerencias de búsqueda.',
        'Asistente de ZeaSys: conocimiento general, datos autorizados de parcela y documentos solicitados como apoyo.',
        ['flowise-nodes/ZeaSysGeminiSearch/ZeaSysGeminiSearch.js','backend-api/src/Dominios/Chat/Infraestructura/GeminiFlowise.php','frontend-app/src/components/FuentesChat.jsx'],
        'Una respuesta generativa no es un dato agrícola certificado. La web se identifica sólo cuando hay búsqueda real. El 15/11/2026 las llamadas con búsqueda devolvieron cuota excedida (429); las llamadas normales funcionaron. El sistema conserva orientación general y no fabrica enlaces.',
        'Documentación técnica del proveedor; no certificación de respuestas o cosechas')
    calendar=load('backend-api/data/referencias/calendario-agricola-ecuador.json')
    calendar_fields={
        'iniap_sierra_2021':'Épocas de siembra de Sierra y del Austro, condiciones para choclo con riego, texturas/pH de referencia para maíz de altura y antecedentes sanitarios documentados.',
        'agrocalidad_bpa_2014':'Texturas, pH, drenaje del maíz duro y condición de inicio de lluvias para la siembra. No se aplican recetas de plaguicidas.',
        'mag_invierno_2022':'Meses declarados de siembra y nombres de problemas fitosanitarios por provincia en la encuesta de invierno de 2022. No se publican esos porcentajes como riesgo actual.',
        'agrocalidad_vigilancia':'Enlace oficial para conocer vigilancia y comunicar síntomas desconocidos. No proporciona un feed integrado de brotes por parcela.',
    }
    for idx,(key,source) in enumerate(calendar['fuentes'].items(),1):
        add(f'CAL-{idx:02d}',source['institucion'],source['titulo'],source['url'],
            calendar_fields[key]+(' Páginas PDF: '+', '.join(map(str,source['paginas_pdf'])) if source.get('paginas_pdf') else ''),
            'Siembra → Calendario agrícola de tu zona; contexto verificado del asistente.',
            ['backend-api/data/referencias/calendario-agricola-ecuador.json','backend-api/src/Dominios/Analitica/Aplicacion/GuiaCalendarioAgricola.php','frontend-app/src/components/AgriculturalCalendar.jsx'],
            'Referencia por provincia y familia, no óptimo varietal ni diagnóstico actual. MAG 2022 es una encuesta histórica; Agrocalidad 2014 es la edición de la guía. Riego no habilita todas las épocas para grano. El mapa SoilGrids es una estimación superficial, no medición en campo.')
    varieties=[{k:v.get(k) for k in ['nombre','tipo_grano_documentado','usos_documentados','categorias_consumo','fuentes','datos_no_documentados','simulacion_grano_habilitada']} for v in catalog['variedades']]
    result={'fecha_revision':'2026-11-15','titulo':'Fuentes, campos y usos de datos en ZeaSys','fuentes':sources,'pdf_originales':pdfs,'variedades':varieties,
        'advertencia':'Autoría institucional y trazabilidad no equivalen a certificación de la precisión del modelo. El CSV histórico de entrenamiento continúa con procedencia no acreditada; los datos personales y supuestos no son datos certificados.'}
    out=ROOT/'documentacion/referencias-datos-sistema-20261109.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8'); print(f'{len(sources)} fuentes; {len(varieties)} variedades; {len(pdfs)} PDF.')

if __name__=='__main__': main()
