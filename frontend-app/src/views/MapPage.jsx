import { useMemo, useState, useEffect, useRef } from 'react';
import { Sprout, Ruler } from 'lucide-react';
import '../utils/mapRuntime';
import '../assets/map-page.css';
import { observarTamanoMapa } from '../utils/mapAccessibility';

const DEFAULT_LAT = -1.8312;
const DEFAULT_LNG = -78.1834;
const DEFAULT_ZOOM = 6;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
})[character]);

// Paleta compartida con los gráficos del informe. Los colores no codifican
// una predicción: solo identifican capas y rangos registrados.
const MAP_COLORS = {
  sky: '#2C6E94',
  maize: '#8A6A1C',
  forest: '#1F5C38',
  clay: '#9A4530'
};

const svgIcon = (paths) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const MAP_ICON = {
  leaf: svgIcon('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),
  cloud: svgIcon('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'),
  mountain: svgIcon('<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>'),
  ruler: svgIcon('<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>'),
  sun: svgIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
  rain: svgIcon('<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>'),
  snow: svgIcon('<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/>'),
  storm: svgIcon('<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>')
};

const numberFormatters = new Map();
const numberText = (value, digits = 1) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (!numberFormatters.has(digits)) {
    numberFormatters.set(digits, new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }));
  }
  return numberFormatters.get(digits).format(number);
};
const textOr = (value, fallback = 'Sin registrar') => (value === null || value === undefined || String(value).trim() === '' ? fallback : String(value));
const areaText = (value) => (numberText(value, 2) ? `${numberText(value, 2)} ha` : 'Sin registrar');
const areaColor = (value) => {
  const area = Number(value);
  if (!Number.isFinite(area)) return MAP_COLORS.sky;
  return area >= 10 ? MAP_COLORS.forest : area >= 5 ? MAP_COLORS.maize : MAP_COLORS.sky;
};
const areaRange = (value) => {
  const area = Number(value);
  if (!Number.isFinite(area)) return 'Sin dato';
  return area >= 10 ? '10 ha o más' : area >= 5 ? 'De 5 a 10 ha' : 'Menos de 5 ha';
};
const markerHtml = (color, icon, shape = 'pin') => `<div class="map-marker${shape === 'round' ? ' map-marker--round' : ''}" style="--marker-color:${color}">${icon}</div>`;
const popupRow = (label, value) => `<div class="map-popup-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
const generalPopup = (plot) => `
  <div class="map-popup">
    <p class="map-popup-kicker">Parcela</p>
    <h3 class="map-popup-title">${escapeHtml(textOr(plot.nombre_parcela, 'Parcela sin nombre'))}</h3>
    <dl class="map-popup-list">
      ${popupRow('Variedad', textOr(plot.variedad_maiz))}
      ${popupRow('Área', areaText(plot.area))}
      ${popupRow('pH', numberText(plot.ph, 1) || 'Sin dato')}
      ${popupRow('Altitud', numberText(plot.altitud, 0) ? `${numberText(plot.altitud, 0)} msnm` : 'Sin dato')}
    </dl>
  </div>`;
const surfacePopup = (plot) => `
  <div class="map-popup map-popup--wide">
    <p class="map-popup-kicker">Superficie y suelo</p>
    <h3 class="map-popup-title">${escapeHtml(textOr(plot.nombre_parcela, 'Parcela sin nombre'))}</h3>
    <dl class="map-popup-list">
      ${popupRow('Área registrada', areaText(plot.area))}
      ${popupRow('Rango', areaRange(plot.area))}
      ${popupRow('pH registrado', numberText(plot.ph, 1) || 'Sin dato')}
      ${popupRow('Altitud registrada', numberText(plot.altitud, 0) ? `${numberText(plot.altitud, 0)} msnm` : 'Sin dato')}
    </dl>
    <p class="map-popup-note">El rendimiento se estima en Rendimiento a partir de una simulación guardada.</p>
  </div>`;
const terrainPopup = (plot) => `
  <div class="map-popup">
    <p class="map-popup-kicker">Relieve y terreno</p>
    <h3 class="map-popup-title">${escapeHtml(textOr(plot.nombre_parcela, 'Parcela sin nombre'))}</h3>
    <dl class="map-popup-list">
      ${popupRow('Altitud registrada', numberText(plot.altitud, 0) ? `${numberText(plot.altitud, 0)} msnm` : 'Sin dato')}
      ${popupRow('Área registrada', areaText(plot.area))}
    </dl>
    <p class="map-popup-note">Las curvas de nivel ayudan a leer el relieve; este mapa no calcula escorrentía.</p>
  </div>`;

export default function MapPage({ cultivos, setCultivoElegidoId, setVistaActual }) {
  const [mapMode, setMapMode] = useState('general'); // 'general' | 'weather_live' | 'productivity' | 'terrain'

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerGroupRef = useRef(null);
  const baseLayerRef = useRef(null);
  const labelsLayerRef = useRef(null);
  // Filtrar parcelas de cultivos geolocalizadas
  const geolocated = useMemo(() => (cultivos || []).filter((cultivo) =>
    cultivo.latitud !== null && cultivo.latitud !== '' && cultivo.longitud !== null && cultivo.longitud !== '' &&
    Number.isFinite(Number(cultivo.latitud)) && Number.isFinite(Number(cultivo.longitud))
  ), [cultivos]);

  // Inicializar Mapa Leaflet
  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;
    const L = window.L;

    // Crear Mapa
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true
    }).setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);
    L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);

    mapRef.current = map;
    observarTamanoMapa(map);

    // Capa base general por defecto (Satelital)
    const baseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxNativeZoom: 17, maxZoom: 19
    }).addTo(map);
    baseLayerRef.current = baseLayer;

    // Capa de etiquetas / límites
    const labelsLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(map);
    labelsLayerRef.current = labelsLayer;

    // Grupo de características (FeatureGroup) para marcadores y polígonos de cultivos
    const markerGroup = L.featureGroup().addTo(map);
    markerGroupRef.current = markerGroup;

    // Manejador de clics para clima en vivo en modo temperatura
    const onMapClick = (e) => {
      if (window.activeMapModeRef?.current === 'weather_live') {
        showWeatherPopup(L, map, e.latlng.lat, e.latlng.lng, null, e.latlng);
      }
    };
    map.on('click', onMapClick);

    // Corrección de redibujo de diseño
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.off('click', onMapClick);
      map.remove();
    };
  }, []);

  // Actualizar la referencia del modo de mapa activo para que el manejador de clics del mapa obtenga el estado correcto
  const activeMapModeRef = useRef(mapMode);
  useEffect(() => {
    activeMapModeRef.current = mapMode;
    window.activeMapModeRef = activeMapModeRef;
  }, [mapMode]);

  // Manejar el renderizado de marcadores y capas cuando cambia el modo o la lista de cultivos.
  useEffect(() => {
    if (!mapRef.current || !markerGroupRef.current || !window.L) return;
    const L = window.L;
    const map = mapRef.current;
    const markerGroup = markerGroupRef.current;

    // 1. Limpiar capas previas, marcadores y capas base
    markerGroup.clearLayers();

    // Eliminar capas base antiguas para permitir el intercambio
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    if (labelsLayerRef.current) map.removeLayer(labelsLayerRef.current);

    // 2. Configurar capas base según el modo
    if (mapMode === 'general') {
      // Modo General: Satélite Esri + Límites híbridos
      baseLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri Satellite',
        maxZoom: 19
      }).addTo(map);

      labelsLayerRef.current = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
      }).addTo(map);

      // Renderizar marcadores y contornos de polígonos para el Modo General
      geolocated.forEach(c => {
        const lat = parseFloat(c.latitud);
        const lng = parseFloat(c.longitud);
        if (isNaN(lat) || isNaN(lng)) return;

        const customIcon = L.divIcon({
          className: '',
          html: markerHtml(MAP_COLORS.sky, MAP_ICON.leaf),
          iconSize: [32, 42],
          iconAnchor: [16, 42],
          popupAnchor: [0, -42]
        });

        const popupHtml = generalPopup(c);
        const marker = L.marker([lat, lng], { icon: customIcon, title: `Parcela ${textOr(c.nombre_parcela, 'sin nombre')}` }).bindPopup(popupHtml);
        marker.addTo(markerGroup);

        // Dibujar capa superpuesta de polígono si el geojson está disponible
        if (c.geojson) {
          try {
            const polygonGeoJSON = JSON.parse(c.geojson);
            const polygonLayer = L.geoJSON(polygonGeoJSON, {
              style: {
                color: MAP_COLORS.sky,
                weight: 2.5,
                fillColor: MAP_COLORS.sky,
                fillOpacity: 0.2
              }
            }).bindPopup(popupHtml);
            markerGroup.addLayer(polygonLayer);
          } catch (err) {
            console.error("Error drawing geojson in general mode:", err);
          }
        }
      });

    }
    else if (mapMode === 'weather_live') {
      // Clima en vivo sin credenciales expuestas: el usuario consulta datos
      // puntuales de Open-Meteo al pulsar el mapa o una parcela.
      baseLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      // Agregar marcadores de información simple sobre los cultivos
      geolocated.forEach(c => {
        const lat = parseFloat(c.latitud);
        const lng = parseFloat(c.longitud);
        const icon = L.divIcon({
          className: '',
          html: markerHtml(MAP_COLORS.sky, MAP_ICON.cloud, 'round'),
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -20]
        });

        const marker = L.marker([lat, lng], { icon, title: `Clima en ${textOr(c.nombre_parcela, 'la parcela')}` });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          showWeatherPopup(L, map, lat, lng, c.nombre_parcela);
        });
        marker.addTo(markerGroup);
      });

    }
    else if (mapMode === 'productivity') {
      // Riesgo/Productividad: Satélite + Límites híbridos (ideal para inspeccionar campos físicamente)
      baseLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri Satellite',
        maxZoom: 19
      }).addTo(map);

      labelsLayerRef.current = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
      }).addTo(map);

      // La capa usa la superficie registrada de cada parcela. No infiere
      // rendimiento ni estado productivo: esos datos se calculan en Rendimiento
      // a partir de una simulación guardada.
      geolocated.forEach(c => {
        const lat = parseFloat(c.latitud);
        const lng = parseFloat(c.longitud);
        const plotColor = areaColor(c.area);

        const customIcon = L.divIcon({
          className: '',
          html: markerHtml(plotColor, MAP_ICON.ruler),
          iconSize: [32, 42],
          iconAnchor: [16, 42],
          popupAnchor: [0, -42]
        });

        const popupHtml = surfacePopup(c);
        const marker = L.marker([lat, lng], { icon: customIcon, title: `Superficie de ${textOr(c.nombre_parcela, 'la parcela')}` }).bindPopup(popupHtml);
        marker.addTo(markerGroup);

        // El contorno usa el mismo color que el rango de superficie.
        if (c.geojson) {
          try {
            const polygonGeoJSON = JSON.parse(c.geojson);
            const polygonLayer = L.geoJSON(polygonGeoJSON, {
              style: {
                color: plotColor,
                weight: 3,
                fillColor: plotColor,
                fillOpacity: 0.2
              }
            }).bindPopup(popupHtml);
            markerGroup.addLayer(polygonLayer);
          } catch (err) {
            console.error("Error drawing geojson: ", err);
          }
        }
      });

    }
    else if (mapMode === 'terrain') {
      // Relieve/Terreno: Mapa base topográfico que muestra curvas de nivel de altitud y sombreado de relieve
      baseLayerRef.current = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap contributors',
        maxZoom: 17
      }).addTo(map);

      // Agregar marcadores simples de chincheta con ventanas emergentes de información de altitud
      geolocated.forEach(c => {
        const lat = parseFloat(c.latitud);
        const lng = parseFloat(c.longitud);
        const icon = L.divIcon({
          className: '',
          html: markerHtml(MAP_COLORS.forest, MAP_ICON.mountain, 'round'),
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18]
        });

        const popupHtml = terrainPopup(c);
        const marker = L.marker([lat, lng], { icon, title: `Relieve de ${textOr(c.nombre_parcela, 'la parcela')}` }).bindPopup(popupHtml);
        marker.addTo(markerGroup);

        // Renderizar contornos de polígonos
        if (c.geojson) {
          try {
            const polygonGeoJSON = JSON.parse(c.geojson);
            const polygonLayer = L.geoJSON(polygonGeoJSON, {
              style: {
                color: MAP_COLORS.forest,
                weight: 2,
                fillColor: MAP_COLORS.forest,
                fillOpacity: 0.15
              }
            }).bindPopup(popupHtml);
            markerGroup.addLayer(polygonLayer);
          } catch {
            console.warn(`Geometría inválida para la parcela ${c.id}`);
          }
        }
      });
    }

    // Establecer los límites de la vista del mapa a los marcadores
    if (geolocated.length > 0 && mapMode !== 'weather_live') {
      map.fitBounds(markerGroup.getBounds().pad(0.25), { maxZoom: 16 });
    }
  }, [geolocated, mapMode]);

  // Volar al marcador seleccionado
  const handleSelectPlot = (c) => {
    if (!mapRef.current) return;
    setCultivoElegidoId(c.id);
    mapRef.current.flyTo([parseFloat(c.latitud), parseFloat(c.longitud)], 15, {
      duration: 1.5
    });
  };

  const renderLegend = () => {
    const swatch = (className, color) => <span className={className} style={{ '--swatch': color }} aria-hidden="true" />;

    switch (mapMode) {
      case 'general':
        return (
          <div className="map-legend" role="group" aria-label="Leyenda de la vista satelital">
            <p className="map-legend-title">Vista satelital</p>
            <div className="map-legend-item">{swatch('map-legend-pin', MAP_COLORS.sky)}<span>Parcela geolocalizada</span></div>
            {geolocated.some(plot => plot.geojson) && (
              <div className="map-legend-item">{swatch('map-legend-swatch', MAP_COLORS.sky)}<span>Lindero registrado</span></div>
            )}
          </div>
        );
      case 'weather_live':
        return (
          <div className="map-legend" role="group" aria-label="Leyenda del clima en vivo">
            <p className="map-legend-title">Clima en vivo</p>
            <div className="map-legend-item">{swatch('map-legend-dot', MAP_COLORS.sky)}<span>Haz clic en una parcela o en el mapa</span></div>
            <div className="map-legend-item"><span>Datos puntuales de Open-Meteo</span></div>
          </div>
        );
      case 'productivity':
        return (
          <div className="map-legend" role="group" aria-label="Leyenda de superficie registrada">
            <p className="map-legend-title">Superficie registrada</p>
            <div className="map-legend-item">{swatch('map-legend-dot', MAP_COLORS.sky)}<span>Menos de 5 ha</span></div>
            <div className="map-legend-item">{swatch('map-legend-dot', MAP_COLORS.maize)}<span>De 5 a 10 ha</span></div>
            <div className="map-legend-item">{swatch('map-legend-dot', MAP_COLORS.forest)}<span>10 ha o más</span></div>
          </div>
        );
      case 'terrain':
        return (
          <div className="map-legend" role="group" aria-label="Leyenda del relieve">
            <p className="map-legend-title">Relieve y terreno</p>
            <div className="map-legend-item">{swatch('map-legend-dot', MAP_COLORS.forest)}<span>Parcela geolocalizada</span></div>
            <div className="map-legend-item">{swatch('map-legend-line', MAP_COLORS.clay)}<span>Curvas de nivel</span></div>
            <div className="map-legend-item">{swatch('map-legend-gradient', MAP_COLORS.forest)}<span>Sombreado del relieve</span></div>
          </div>
        );
      default:
        return null;
    }
  };

  const getModeDescription = () => {
    switch (mapMode) {
      case 'general': return 'Vista satelital para ubicar tus parcelas y revisar sus linderos.';
      case 'weather_live': return 'Consulta temperatura, lluvia, humedad y viento en cualquier punto del mapa.';
      case 'productivity': return 'Colorea las parcelas según su superficie registrada. El rendimiento se estima en Rendimiento.';
      case 'terrain': return 'Mapa topográfico con curvas de nivel para interpretar el relieve de la zona.';
      default: return '';
    }
  };

  const totalArea = geolocated.reduce((sum, plot) => {
    const area = Number(plot.area);
    return sum + (Number.isFinite(area) ? area : 0);
  }, 0);
  const plotsWithBoundary = geolocated.filter(plot => plot.geojson).length;
  const plotsWithPh = geolocated.filter(plot => numberText(plot.ph, 1)).length;

  return (
    <div className="map-page-shell">
      <div className="map-page-heading">
        <div>
          <p className="map-eyebrow">Ubicación y terreno</p>
          <h1>Mapa de parcelas</h1>
          <p className="dashboard-title-desc">Ubica tus parcelas, revisa sus linderos y consulta el clima en el punto que elijas.</p>
        </div>

        <div className="map-page-toolbar">
          <select
            aria-label="Capa del mapa de parcelas"
            className="map-mode-select"
            value={mapMode}
            onChange={(e) => setMapMode(e.target.value)}
          >
            <option value="general">Vista satelital</option>
            <option value="weather_live">Clima en vivo</option>
            <option value="productivity">Superficie y suelo</option>
            <option value="terrain">Relieve y terreno</option>
          </select>
        </div>
      </div>

      <div className="map-page-description-bar" aria-live="polite">{getModeDescription()}</div>

      {mapMode === 'weather_live' && (
        <div className="map-weather-guide">
          <strong>Clima en vivo.</strong> Haz clic en el mapa o en una parcela para consultar temperatura, lluvia, humedad y viento. Los datos provienen de Open-Meteo.
        </div>
      )}

      <div className="map-page-grid">
        <div className="glass-panel map-canvas-wrapper">
          <div ref={mapContainerRef} id="mapContainer" role="region" aria-label="Mapa interactivo de parcelas"></div>
          {renderLegend()}
        </div>

        <div className="glass-panel map-list-wrapper">
          <div className="glass-card-header">
            <h2>Tus parcelas</h2>
          </div>
          <div className="map-plot-list">
            {geolocated.map(c => (
              <button type="button" key={c.id} className="map-plot-card" onClick={() => handleSelectPlot(c)}>
                <span className="map-plot-card-head">
                  <Sprout size={16} aria-hidden="true" />
                  <span>{textOr(c.nombre_parcela, 'Parcela sin nombre')}</span>
                </span>
                <span className="map-plot-meta">{textOr(c.ubicacion, 'Ubicación sin registrar')} · {areaText(c.area)}</span>
                <span className="map-plot-meta">
                  {numberText(c.ph, 1) ? `pH ${numberText(c.ph, 1)}` : 'pH sin registrar'} · {numberText(c.altitud, 0) ? `${numberText(c.altitud, 0)} msnm` : 'altitud sin registrar'}
                </span>
                {c.geojson && (
                  <span className="map-plot-tag">
                    <Ruler size={13} aria-hidden="true" />
                    Lindero registrado
                  </span>
                )}
              </button>
            ))}
            {geolocated.length === 0 && (
              <div className="map-list-empty">
                <strong>No hay parcelas con coordenadas.</strong>
                <span>Registra una parcela con ubicación para verla en el mapa.</span>
                <button type="button" className="map-empty-action" onClick={() => setVistaActual('cultivos')}>Registrar parcela</button>
              </div>
            )}
          </div>
          {geolocated.length > 0 && (
            <>
              <div className="map-list-summary">
                <p className="map-list-summary-title">Resumen de parcelas</p>
                <div className="map-list-stats">
                  <div className="map-list-stat"><span>Parcelas</span><strong>{geolocated.length}</strong></div>
                  <div className="map-list-stat"><span>Superficie</span><strong>{numberText(totalArea, 2) || '0,00'} ha</strong></div>
                  <div className="map-list-stat"><span>Con lindero</span><strong>{plotsWithBoundary}</strong></div>
                  <div className="map-list-stat"><span>Con pH</span><strong>{plotsWithPh}</strong></div>
                </div>
              </div>
              <p className="map-list-footnote">Selecciona una parcela para centrarla en el mapa.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Lógica del ayudante de carga de clima dentro de las ventanas emergentes de Leaflet
const showWeatherPopup = async (L, map, lat, lng, title, latlng) => {
  const targetLatLng = latlng || L.latLng(lat, lng);
  const loadPopup = L.popup({ maxWidth: 300 })
    .setLatLng(targetLatLng)
    .setContent('<div class="map-popup"><div class="map-weather-loading" role="status"><span class="map-spinner" aria-hidden="true"></span><span>Consultando el clima…</span></div></div>')
    .openOn(map);

  try {
    const [wResp, gResp] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&timezone=auto`),
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}&format=json&accept-language=es`)
    ]);
    if (!wResp.ok) throw new Error('El proveedor del clima no respondió.');
    const weather = await wResp.json();
    const geo = gResp.ok ? await gResp.json().catch(() => ({})) : {};

    const current = weather.current;
    if (!current) throw new Error('El proveedor del clima no devolvió datos actuales.');

    const addr = geo.address || {};
    const place = title || addr.city || addr.town || addr.village || addr.county || addr.state || addr.country || 'Ubicación';
    const country = addr.country || '';
    const safePlace = escapeHtml(place);
    const safeCountry = escapeHtml(country || 'Parcela');

    const wmoDesc = {
      0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
      45: 'Niebla', 48: 'Niebla con escarcha', 51: 'Llovizna leve', 53: 'Llovizna moderada',
      55: 'Llovizna intensa', 61: 'Lluvia leve', 63: 'Lluvia moderada', 65: 'Lluvia intensa',
      71: 'Nevada leve', 73: 'Nevada moderada', 75: 'Nevada intensa', 80: 'Aguaceros',
      81: 'Aguaceros moderados', 82: 'Aguaceros fuertes', 95: 'Tormenta', 96: 'Tormenta con granizo',
      99: 'Tormenta fuerte con granizo'
    };
    const desc = wmoDesc[current.weather_code] || 'Condición climática';
    const weatherIcon = current.weather_code === 0
      ? MAP_ICON.sun
      : current.weather_code <= 48
        ? MAP_ICON.cloud
        : current.weather_code <= 67
          ? MAP_ICON.rain
          : current.weather_code <= 77
            ? MAP_ICON.snow
            : MAP_ICON.storm;
    const temperature = numberText(current.temperature_2m, 1) || '—';
    const feelsLike = numberText(current.apparent_temperature, 1) || '—';
    const humidity = numberText(current.relative_humidity_2m, 0) || '—';
    const precipitation = numberText(current.precipitation, 1) || '0.0';
    const wind = numberText(current.wind_speed_10m, 0) || '—';
    const tempClass = current.temperature_2m > 35 ? 'is-hot'
      : current.temperature_2m > 28 ? 'is-warm'
        : current.temperature_2m > 20 ? 'is-mild'
          : current.temperature_2m > 10 ? 'is-cool' : 'is-cold';

    loadPopup.setContent(`
      <div class="map-popup map-popup--wide">
        <div class="map-weather-head">
          <p class="map-popup-kicker">Clima en vivo · ${safeCountry}</p>
          <h3 class="map-popup-title">${safePlace}</h3>
          <p class="map-weather-coordinates">${lat.toFixed(3)}°, ${lng.toFixed(3)}°</p>
        </div>
        <div class="map-weather-hero">
          <span class="map-weather-icon">${weatherIcon}</span>
          <div>
            <p class="map-weather-temperature ${tempClass}">${temperature}°C</p>
            <p class="map-weather-description">${escapeHtml(desc)}</p>
            <p class="map-weather-feels">Sensación ${feelsLike}°C</p>
          </div>
        </div>
        <div class="map-weather-grid">
          <div class="map-weather-cell"><span>Humedad</span><strong>${humidity}%</strong></div>
          <div class="map-weather-cell"><span>Lluvia</span><strong>${precipitation} mm</strong></div>
          <div class="map-weather-cell"><span>Viento</span><strong>${wind} km/h</strong></div>
          <div class="map-weather-cell"><span>Fuente</span><strong><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></strong></div>
        </div>
        <p class="map-weather-source">Datos actuales de Open-Meteo. La ubicación se aproxima con OpenStreetMap.</p>
      </div>
    `);
  } catch {
    loadPopup.setContent('<div class="map-popup"><p class="map-weather-error">No se pudo consultar el clima. Revisa tu conexión e intenta de nuevo.</p></div>');
  }
};
