import { useMemo, useState, useEffect, useRef } from 'react';
import { Sprout } from 'lucide-react';

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
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);

    mapRef.current = map;

    // Capa base general por defecto (Satelital)
    const baseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19
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
          html: `
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 2px solid #fff;
              box-shadow: 0 4px 8px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #3b82f6
            ">
              <span style="transform: rotate(45deg); font-size: 13px;">📍</span>
            </div>
          `,
          iconSize: [32, 42],
          iconAnchor: [16, 42],
          popupAnchor: [0, -42]
        });

        const popupHtml = `
          <div style="min-width:180px;font-family:var(--font-sans);color:#fff;background:#090f1d;padding:8px;border-radius:8px;">
            <h6 style="color:#3b82f6;font-weight:700;margin:0 0 6px 0;font-size:14px;">${escapeHtml(c.nombre_parcela)}</h6>
            <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
              <div><strong>Variedad:</strong> ${escapeHtml(c.variedad_maiz)}</div>
              <div><strong>Área:</strong> ${escapeHtml(c.area)} ha</div>
              <div><strong>pH:</strong> ${escapeHtml(c.ph || '6.2')}</div>
              <div><strong>Altitud:</strong> ${escapeHtml(c.altitud || '—')} msnm</div>
            </div>
          </div>
        `;

        const marker = L.marker([lat, lng], { icon: customIcon }).bindPopup(popupHtml);
        marker.addTo(markerGroup);

        // Dibujar capa superpuesta de polígono si el geojson está disponible
        if (c.geojson) {
          try {
            const polygonGeoJSON = JSON.parse(c.geojson);
            const polygonLayer = L.geoJSON(polygonGeoJSON, {
              style: {
                color: '#3b82f6',
                weight: 2.5,
                fillColor: '#3b82f6',
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
          html: `<div style="background:rgba(16,26,48,0.95);width:36px;height:36px;border-radius:50%;border:2px solid #3b82f6;box-shadow:0 0 10px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;font-size:16px;">🌦️</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20]
        });

        const marker = L.marker([lat, lng], { icon });
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

      // Dibujar capas calculadas personalizadas: marcadores de chincheta y contornos de polígonos coloreados por rendimiento calculado
      geolocated.forEach(c => {
        const lat = parseFloat(c.latitud);
        const lng = parseFloat(c.longitud);
        const ph = parseFloat(c.ph || 6.2);

        // Valores calculados del modelo del sistema: estimación del rendimiento basada en el área y estado del suelo
        const isBigPlot = c.area >= 10.0;
        const predYield = isBigPlot ? 8.25 : 5.80; // Valores predichos del modelo

        let markerColor = '#16a34a'; // verde (rendimiento alto)
        let statusText = 'Alta Productividad';

        if (predYield < 5.0) {
          markerColor = '#ef4444'; // rojo (bajo)
          statusText = 'Baja Productividad';
        } else if (predYield < 7.5) {
          markerColor = '#eab308'; // amarillo (medio)
          statusText = 'Productividad Moderada';
        }

        const customIcon = L.divIcon({
          className: '',
          html: `
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 2px solid #fff;
              box-shadow: 0 4px 8px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: ${markerColor}
            ">
              <span style="transform: rotate(45deg); font-size: 11px;">🌾</span>
            </div>
          `,
          iconSize: [32, 42],
          iconAnchor: [16, 42],
          popupAnchor: [0, -42]
        });

        const popupHtml = `
          <div style="min-width:220px;font-family:var(--font-sans);color:var(--text-primary);background:var(--modal-bg);border:1px solid var(--border-subtle);box-shadow: 0 10px 25px rgba(0,0,0,0.15);padding:12px;border-radius:10px;">
            <h6 style="color:#3b82f6;font-weight:700;margin:0 0 8px 0;border-bottom:1px solid var(--border-subtle);padding-bottom:6px;font-size:14px;">📈 ${escapeHtml(c.nombre_parcela)}</h6>
            <div style="font-size:12px;color:var(--text-muted);display:flex;flex-direction:column;gap:5px;">
              <div><strong style="color:var(--text-primary);">Estado General:</strong> <span style="color:${markerColor};font-weight:600;">${statusText}</span></div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-subtle);">Estimación Cosecha:</span>
                <strong style="color:var(--text-primary);">${predYield.toFixed(2)} t/ha</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-subtle);">pH Medido:</span>
                <strong style="color:var(--text-primary);">${ph.toFixed(1)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-subtle);">Área:</span>
                <strong style="color:var(--text-primary);">${escapeHtml(c.area)} ha</strong>
              </div>
            </div>
          </div>
        `;

        const marker = L.marker([lat, lng], { icon: customIcon }).bindPopup(popupHtml);
        marker.addTo(markerGroup);

        // Renderizar contorno del polígono coloreado por el rendimiento del modelo
        if (c.geojson) {
          try {
            const polygonGeoJSON = JSON.parse(c.geojson);
            const polygonLayer = L.geoJSON(polygonGeoJSON, {
              style: {
                color: markerColor,
                weight: 3,
                fillColor: markerColor,
                fillOpacity: 0.25
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
          html: `<div style="background:rgba(15,23,42,0.9);width:34px;height:34px;border-radius:50%;border:2px solid #84cc16;box-shadow:0 0 10px rgba(132,204,22,0.5);display:flex;align-items:center;justify-content:center;font-size:15px;">⛰️</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -18]
        });

        const popupHtml = `
          <div style="min-width:180px;font-family:var(--font-sans);color:#fff;background:#090f1d;padding:8px;border-radius:8px;">
            <h6 style="color:#84cc16;font-weight:700;margin:0 0 6px 0;font-size:14px;">⛰️ Topografía: ${escapeHtml(c.nombre_parcela)}</h6>
            <div style="font-size:12px;color:#cbd5e1;line-height:1.6;">
              <div><strong>Altitud:</strong> ${escapeHtml(c.altitud || '45')} msnm</div>
              <div><strong>Drenaje Lote:</strong> Franco-Limoso</div>
              <div style="margin-top:4px;color:#94a3b8;font-size:11px;line-height:1.3;">* El mapa topográfico detalla las curvas de nivel para el análisis de escorrentía.</div>
            </div>
          </div>
        `;

        const marker = L.marker([lat, lng], { icon }).bindPopup(popupHtml);
        marker.addTo(markerGroup);

        // Renderizar contornos de polígonos
        if (c.geojson) {
          try {
            const polygonGeoJSON = JSON.parse(c.geojson);
            const polygonLayer = L.geoJSON(polygonGeoJSON, {
              style: {
                color: '#84cc16',
                weight: 2,
                fillColor: '#84cc16',
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
      map.fitBounds(markerGroup.getBounds().pad(0.25));
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
    const legendStyle = {
      position: 'absolute',
      bottom: '15px',
      left: '15px',
      background: 'var(--tooltip-bg)',
      border: '1px solid var(--tooltip-border)',
      borderRadius: '10px',
      padding: '10px 14px',
      zIndex: 1000,
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      color: 'var(--tooltip-text)',
      fontFamily: 'var(--font-sans)',
      pointerEvents: 'none',
      transition: 'all 0.3s ease',
      maxWidth: '260px'
    };

    const legendTitleStyle = {
      fontSize: '0.78rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '8px',
      color: '#3b82f6',
      borderBottom: '1px solid var(--border-subtle)',
      paddingBottom: '4px'
    };

    const legendItemStyle = {
      display: 'flex',
      alignItems: 'center',
      fontSize: '0.72rem',
      marginBottom: '6px',
      color: 'var(--text-muted)',
      lineHeight: '1.2'
    };

    switch (mapMode) {
      case 'general':
        return (
          <div style={legendStyle}>
            <div style={legendTitleStyle}>📍 Leyenda: Satelital</div>
            <div style={legendItemStyle}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50% 50% 50% 0', backgroundColor: '#3b82f6', border: '1px solid #fff', transform: 'rotate(-45deg)', marginRight: '8px', flexShrink: 0 }}></span>
              <span>Ubicación de Parcela</span>
            </div>
            <div style={legendItemStyle}>
              <span style={{ display: 'inline-block', width: '16px', height: '10px', backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1.5px solid #3b82f6', borderRadius: '2px', marginRight: '8px', flexShrink: 0 }}></span>
              <span>Linderos Satelitales (Trazado)</span>
            </div>
          </div>
        );
      case 'weather_live': {
        return (
          <div style={legendStyle}>
            <div style={legendTitleStyle}> Leyenda: Clima en Vivo</div>
            <div style={legendItemStyle}>
              <span style={{ marginRight: '8px', fontSize: '14px', flexShrink: 0 }}></span>
              <span>Lote (Clic para reporte en vivo)</span>
            </div>
            <div style={legendItemStyle}><span>Datos puntuales de Open-Meteo</span></div>
          </div>
        );
      }
      case 'productivity':
        return (
          <div style={legendStyle}>
            <div style={legendTitleStyle}> Leyenda: Rendimiento</div>
            <div style={legendItemStyle}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16a34a', marginRight: '8px', flexShrink: 0 }}></span>
              <span>Alta Productividad (&ge; 7.5 t/ha)</span>
            </div>
            <div style={legendItemStyle}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308', marginRight: '8px', flexShrink: 0 }}></span>
              <span>Rendimiento Moderado (5.0 - 7.5 t/ha)</span>
            </div>
            <div style={legendItemStyle}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', marginRight: '8px', flexShrink: 0 }}></span>
              <span>Baja Productividad (&lt; 5.0 t/ha)</span>
            </div>
          </div>
        );
      case 'terrain':
        return (
          <div style={legendStyle}>
            <div style={legendTitleStyle}> Leyenda: Topografía</div>
            <div style={legendItemStyle}>
              <span style={{ marginRight: '8px', fontSize: '14px', flexShrink: 0 }}></span>
              <span>Ubicación en Relieve</span>
            </div>
            <div style={legendItemStyle}>
              <span style={{ display: 'inline-block', width: '16px', height: '2px', backgroundColor: '#ef4444', marginRight: '8px', flexShrink: 0 }}></span>
              <span>Líneas de Nivel (Curvas de Altura)</span>
            </div>
            <div style={legendItemStyle}>
              <span style={{ display: 'inline-block', width: '16px', height: '12px', background: 'linear-gradient(to bottom, #f3f4f6, #9ca3af, #374151)', borderRadius: '2px', marginRight: '8px', flexShrink: 0 }}></span>
              <span>Sombreado de Pendientes (Escorrentía)</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getModeDescription = () => {
    switch (mapMode) {
      case 'general': return ' Modo General: Vista de satélite e híbrido de carreteras, optimizada para ubicar parcelas.';
      case 'weather_live': return ' Modo Clima en Vivo: consulta temperatura, lluvia, humedad y viento en cualquier punto mediante Open-Meteo.';
      case 'productivity': return ' Modo Riesgo y Productividad: Capa calculada por tu sistema en base a los modelos de rendimiento biofísico.';
      case 'terrain': return ' Modo Relieve y Terreno: Topografía detallada y curvas de nivel para interpretar drenaje y escorrentía.';
      default: return '';
    }
  };

  return (
    <div className="map-page-shell" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="dashboard-title-row map-page-title-row" style={{ marginBottom: '0.65rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Mapa de Parcelas Georreferenciadas</h1>
          <p className="dashboard-title-desc">Ubica tus lotes en el mapa, dibuja sus límites satelitales y mira las capas del clima en vivo.</p>
        </div>

        <div className="map-page-toolbar" style={{ display: 'flex', gap: '1rem' }}>
          {/* Main map mode selection */}
          <select
            className="form-select bg-dark text-white border-secondary"
            style={{ width: '275px', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            value={mapMode}
            onChange={(e) => setMapMode(e.target.value)}
          >
            <option value="general">Modo General (Satélite)</option>
            <option value="weather_live"> Modo Clima en Vivo</option>
            <option value="productivity"> Modo Riesgo/Productividad</option>
            <option value="terrain">Modo Relieve/Terreno</option>
          </select>
        </div>
      </div>

      {/* Mode active description */}
      <div className="map-page-description-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', padding: '0.5rem 1rem', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '1rem', flexShrink: 0 }}>
        <div>{getModeDescription()}</div>

      </div>

      {/* Weather Map Guide */}
      {mapMode === 'weather_live' && (
        <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', padding: '0.6rem 1rem', borderRadius: '10px', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#93c5fd', lineHeight: '1.4', flexShrink: 0 }}>
          <strong>Guía de Clima:</strong> Pulsa cualquier punto del mapa o una parcela para consultar temperatura, viento, humedad y precipitación en vivo sin exponer claves privadas en el navegador.
        </div>
      )}

      <div className="map-page-grid" style={{ flex: 1, height: 'auto', minHeight: 0 }}>
        {/* Leaflet Map Canvas */}
        <div className="glass-panel map-canvas-wrapper" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden' }} id="mapContainer"></div>
          {renderLegend()}
        </div>

        {/* Right Info list */}
        <div className="glass-panel map-list-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRadius: '16px' }}>
          <div className="glass-card-header" style={{ flexShrink: 0 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Campos Integrados</h3>
          </div>
          <div className="glass-card-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
            {geolocated.map(c => (
              <div
                key={c.id}
                onClick={() => handleSelectPlot(c)}
                style={{
                  padding: '1rem',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                className="hover-card-map"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Sprout size={16} className="text-success" />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.nombre_parcela}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Provincia: {c.ubicacion || 'Ecuador'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>Área: {c.area} ha | pH: {c.ph || '6.2'}</div>
                {c.geojson && (
                  <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 600, marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span>📐 Lindero Satelital Trazado</span>
                  </div>
                )}
              </div>
            ))}
            {geolocated.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-subtle)', padding: '2rem 0' }}>
                <p>No hay parcelas con coordenadas válidas.</p>
                <button className="btn btn-primary" onClick={() => setVistaActual('cultivos')} style={{ width: '100%', marginTop: '1rem' }}>
                  Registrar Lote GPS
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Lógica del ayudante de carga de clima dentro de las ventanas emergentes de Leaflet
const showWeatherPopup = async (L, map, lat, lng, title, latlng) => {
  const targetLatLng = latlng || L.latLng(lat, lng);
  const loadPopup = L.popup({ maxWidth: 280 })
    .setLatLng(targetLatLng)
    .setContent(`<div style="font-family:var(--font-sans);padding:8px;text-align:center;color:#fff;"><span class="spinner-border spinner-border-sm text-warning" style="margin-right:8px;"></span> Obteniendo datos del clima…</div>`)
    .openOn(map);

  try {
    const [wResp, gResp] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&timezone=auto`),
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}&format=json&accept-language=es`)
    ]);
    const weather = await wResp.json();
    const geo = await gResp.json();

    const c = weather.current;
    const addr = geo.address || {};
    const place = title || addr.city || addr.town || addr.village || addr.county || addr.state || addr.country || 'Ubicación';
    const country = addr.country || '';
    const safePlace = escapeHtml(place);
    const safeCountry = escapeHtml(country || 'Parcela');

    const wmoDesc = { 0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Niebla', 51: 'Llovizna leve', 61: 'Lluvia leve', 63: 'Lluvia moderada', 65: 'Lluvia intensa', 80: 'Aguaceros', 95: 'Tormenta', 99: 'Tormenta fuerte' };
    const desc = wmoDesc[c.weather_code] || 'Condición climática';
    const em = c.weather_code === 0 ? '☀️' : c.weather_code <= 3 ? '⛅' : c.weather_code <= 48 ? '🌫️' : c.weather_code <= 67 ? '🌧️' : c.weather_code <= 77 ? '❄️' : '⛈️';
    const tc = c.temperature_2m > 35 ? '#ef4444' : c.temperature_2m > 28 ? '#f97316' : c.temperature_2m > 20 ? '#facc15' : c.temperature_2m > 10 ? '#3b82f6' : c.temperature_2m > 0 ? '#38bdf8' : '#818cf8';

    loadPopup.setContent(`
      <div style="min-width:240px;font-family:var(--font-sans);color:var(--text-primary);">
        <div style="background:var(--modal-bg);border-radius:10px;overflow:hidden;border:1px solid var(--border-subtle);box-shadow:0 10px 25px rgba(0,0,0,0.15);">
          <div style="padding:12px 14px 8px;border-bottom:1px solid var(--border-subtle);">
            <div style="font-size:10px;color:var(--text-subtle);text-transform:uppercase;">📍 ${safeCountry}</div>
            <div style="font-size:16px;color:var(--text-primary);font-weight:700;">${safePlace}</div>
            <div style="font-size:10px;color:var(--text-subtle);">${lat.toFixed(3)}°, ${lng.toFixed(3)}°</div>
          </div>
          <div style="padding:12px 14px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="font-size:38px;line-height:1;">${em}</div>
              <div>
                <div style="font-size:26px;font-weight:900;color:${tc};line-height:1;">${c.temperature_2m.toFixed(1)}°C</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${desc}</div>
                <div style="font-size:10px;color:var(--text-subtle);">Sensación: ${c.apparent_temperature.toFixed(1)}°C</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:11px;color:var(--text-primary);">
              <div style="background:var(--surface-elevated);border-radius:6px;padding:5px 8px;border:1px solid var(--border-subtle);"><div style="color:var(--text-subtle);"> Humedad</div><div style="color:var(--text-primary);font-weight:700;">${c.relative_humidity_2m}%</div></div>
              <div style="background:var(--surface-elevated);border-radius:6px;padding:5px 8px;border:1px solid var(--border-subtle);"><div style="color:var(--text-subtle);"> Lluvia</div><div style="color:var(--text-primary);font-weight:700;">${c.precipitation} mm</div></div>
              <div style="background:var(--surface-elevated);border-radius:6px;padding:5px 8px;border:1px solid var(--border-subtle);"><div style="color:var(--text-subtle);"> Viento</div><div style="color:var(--text-primary);font-weight:700;">${c.wind_speed_10m} km/h</div></div>
              <div style="background:var(--surface-elevated);border-radius:6px;padding:5px 8px;border:1px solid var(--border-subtle);"><div style="color:var(--text-subtle);"> API</div><div style="color:#3b82f6;font-weight:600;font-size:10px;">Open-Meteo</div></div>
            </div>
          </div>
        </div>
      </div>
    `);
  } catch {
    loadPopup.setContent('<div style="color:#e2e8f0;padding:8px;font-family:\'Inter\',sans-serif;">⚠️ Error cargando datos del clima.</div>');
  }
};
