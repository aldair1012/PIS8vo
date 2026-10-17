import React, { useState, useEffect, useRef } from 'react';
import { cultivosService } from '../services/api';
import { 
  Plus, 
  Trash2, 
  MapPin, 
  Sprout, 
  Info, 
  Layers, 
  Grid, 
  Droplet, 
  Mountain, 
  Calendar, 
  Copy, 
  Check,
  Map,
  ArrowUpDown,
  Maximize2,
  Minimize2
} from 'lucide-react';

// Funciones auxiliares para validar inputs numéricos
const limpiarTextoNumerico = (valor, permiteNegativo = false) => {
  if (!valor || typeof valor !== 'string') return valor;
  let limpio = valor.replace(/[\/\*\+eE]/g, '');
  if (permiteNegativo) {
    return limpio.replace(/[^0-9.,\-]/g, '');
  }
  return limpio.replace(/[\-]/g, '').replace(/[^0-9.,]/g, '');
};

const evitarOperadores = (e, permiteNegativo = false) => {
  const teclas = ['/', '*', '+', 'e', 'E'];
  if (!permiteNegativo) {
    teclas.push('-');
  }
  if (teclas.includes(e.key)) {
    e.preventDefault();
  }
};

export default function Cultivos({ onCultivoChanged, onboardingStep, onNextOnboardingStep }) {
  const [cultivos, setCultivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');

  const VARIEDADES_POR_TIPO = {
    'Duro Amarillo': [
      'Híbrido convencional',
      'Pioneer P4039',
      'INIAP H-551',
      'Dekalb DK-7088',
      'INIAP H-603 Superior',
      'INIAP H-553',
      'INIAP Renacer',
      'Dekalb 5005',
      'Emblema 777',
      'INIAP H-248 Soberano',
      'INIAP H-601',
      'INIAP H-553 (adaptado)',
      'Tuxpeño',
      'Maíz Duro Amazónico (genérico)'
    ],
    'Suave Harinoso': [
      'INIAP 180',
      'INIAP 101 Blanco Harinoso',
      'INIAP 111 Guagal',
      'INIAP 122 Chaucho',
      'INIAP 124 Mishca',
      'INIAP 102 Blanco Blandito',
      'INIAP 192 Chulpi',
      'INIAP 199 Racimo de Uva',
      'INIAP 103 Mishqui Sara',
      'INIAP 153 Zhima'
    ],
    'Duro Amarillo / Blanco': [
      'INIAP 198 Canguil',
      'Bonanza Dulce'
    ]
  };

  const [nombre, setNombre] = useState('');
  const [variedad, setVariedad] = useState('Híbrido convencional');
  const [tipo, setTipo] = useState('Duro Amarillo');
  const [ubicacion, setUbicacion] = useState('');
  const [area, setArea] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [fechaSiembra, setFechaSiembra] = useState('');
  const [altitud, setAltitud] = useState('');
  const [ph, setPh] = useState('');
  const [geojson, setGeojson] = useState('');

  const handleTipoChange = (newTipo) => {
    setTipo(newTipo);
    const list = VARIEDADES_POR_TIPO[newTipo] || [];
    if (list.length > 0) {
      setVariedad(list[0]);
    }
  };

  const handleVariedadChange = (newVariedad) => {
    setVariedad(newVariedad);
    for (const [t, list] of Object.entries(VARIEDADES_POR_TIPO)) {
      if (list.includes(newVariedad)) {
        setTipo(t);
        break;
      }
    }
  };

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const geomanLayersRef = useRef(null);
  const soilLayerGroupRef = useRef(null);
  const currentMarkerRef = useRef(null);

  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapLayerOption, setMapLayerOption] = useState('satellite');
  const [searchQuery, setSearchQuery] = useState('');

  const cargarCultivos = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await cultivosService.obtenerTodos();
      const list = Array.isArray(res) ? res : (res?.cultivos || []);
      setCultivos(list);
    } catch (err) {
      console.error('Error al cargar la lista de cultivos:', err);
      setError('Error al cargar la lista de cultivos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCultivos();
  }, []);

  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;
    const L = window.L;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true
    }).setView([-1.8312, -78.1834], 6);
    mapRef.current = map;

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19
    }).addTo(map);

    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(map);

    const geomanLayers = L.featureGroup().addTo(map);
    geomanLayersRef.current = geomanLayers;

    const soilLayerGroup = L.layerGroup().addTo(map);
    soilLayerGroupRef.current = soilLayerGroup;

    if (map.pm) {
      map.pm.setGlobalOptions({ tooltips: false });
      map.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawPolygon: true,
        drawPolyline: false,
        drawCircle: false,
        drawCircleMarker: false,
        drawRectangle: true,
        editMode: true,
        dragMode: false,
        cutPolygon: false,
        removalMode: true
      });

      map.on('pm:create', (e) => {
        const layer = e.layer;
        geomanLayers.clearLayers();
        if (currentMarkerRef.current) {
          map.removeLayer(currentMarkerRef.current);
          currentMarkerRef.current = null;
        }

        geomanLayers.addLayer(layer);

        if (e.shape === 'Marker') {
          const latlng = layer.getLatLng();
          setLatitud(latlng.lat.toFixed(7));
          setLongitud(latlng.lng.toFixed(7));
          fetchAltitude(latlng.lat, latlng.lng);
          fetchAddress(latlng.lat, latlng.lng);
          fetchSoilPh(latlng.lat, latlng.lng);
          setGeojson(JSON.stringify(layer.toGeoJSON()));
        } else if (e.shape === 'Polygon' || e.shape === 'Rectangle') {
          const latlngs = layer.getLatLngs()[0];
          if (latlngs && latlngs.length > 0) {
            const calculatedArea = calculatePolygonAreaHectares(latlngs);
            setArea(calculatedArea.toString());

            let sumLat = 0, sumLng = 0;
            latlngs.forEach(p => { sumLat += p.lat; sumLng += p.lng; });
            const centerLat = sumLat / latlngs.length;
            const centerLng = sumLng / latlngs.length;

            setLatitud(centerLat.toFixed(7));
            setLongitud(centerLng.toFixed(7));
            fetchAltitude(centerLat, centerLng);
            fetchAddress(centerLat, centerLng);
            fetchSoilPh(centerLat, centerLng);

            if (window.activeMapLayerRef?.current === 'soil') {
              drawSoilGrid(L, map, centerLat, centerLng);
            }
          }
          setGeojson(JSON.stringify(layer.toGeoJSON()));
        }
      });
    }

    map.on('click', (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (currentMarkerRef.current) {
        map.removeLayer(currentMarkerRef.current);
      }

      const marker = L.marker([lat, lng]).addTo(map);
      currentMarkerRef.current = marker;

      setLatitud(lat.toFixed(7));
      setLongitud(lng.toFixed(7));
      fetchAltitude(lat, lng);
      fetchAddress(lat, lng);
      fetchSoilPh(lat, lng);

      if (window.activeMapLayerRef?.current === 'soil') {
        drawSoilGrid(L, map, lat, lng);
      }
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 310);
      return () => clearTimeout(timer);
    }
  }, [isMapExpanded]);

  const activeMapLayerRef = useRef(mapLayerOption);
  useEffect(() => {
    activeMapLayerRef.current = mapLayerOption;
    window.activeMapLayerRef = activeMapLayerRef;

    if (!mapRef.current || !soilLayerGroupRef.current || !window.L) return;
    const L = window.L;
    const map = mapRef.current;
    const soilLayerGroup = soilLayerGroupRef.current;

    if (mapLayerOption === 'satellite') {
      soilLayerGroup.clearLayers();
    } else {
      const c = map.getCenter();
      drawSoilGrid(L, map, c.lat, c.lng);
    }
  }, [mapLayerOption]);

  const handleMapSearch = async () => {
    if (!searchQuery || !searchQuery.trim() || !mapRef.current) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);

        mapRef.current.setView([lat, lon], 14);

        if (currentMarkerRef.current) {
          mapRef.current.removeLayer(currentMarkerRef.current);
        }

        const marker = window.L.marker([lat, lon]).addTo(mapRef.current);
        currentMarkerRef.current = marker;

        setLatitud(lat.toFixed(7));
        setLongitud(lon.toFixed(7));
        setUbicacion(first.display_name);
        fetchAltitude(lat, lon);
        fetchSoilPh(lat, lon);
      }
    } catch (err) {
      console.error('Error searching map location:', err);
    }
  };

  const getSimulatedSoilPh = (lat, lng) => {
    const factor = Math.abs(Math.sin(lat * 80) + Math.cos(lng * 80)) / 2;
    return (5.5 + factor * 2.3).toFixed(1);
  };

  const calculatePolygonAreaHectares = (latlngs) => {
    if (!latlngs || latlngs.length < 3) return 0;
    let areaVal = 0;
    const numPoints = latlngs.length;
    for (let i = 0; i < numPoints; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[(i + 1) % numPoints];
      const x1 = p1.lng * 111320 * Math.cos(p1.lat * Math.PI / 180);
      const y1 = p1.lat * 110540;
      const x2 = p2.lng * 111320 * Math.cos(p2.lat * Math.PI / 180);
      const y2 = p2.lat * 110540;
      areaVal += (x1 * y2) - (x2 * y1);
    }
    areaVal = Math.abs(areaVal / 2);
    return parseFloat((areaVal / 10000).toFixed(2));
  };

  const fetchAltitude = async (lat, lng) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
      const data = await res.json();
      if (data && data.elevation && data.elevation.length > 0) {
        setAltitud(data.elevation[0].toFixed(1));
      } else {
        setAltitud('45.0');
      }
    } catch (e) {
      setAltitud('45.0');
    }
  };

  const fetchAddress = async (lat, lng) => {
    try {
      setUbicacion('Obteniendo ubicación...');
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}&format=json&accept-language=es`);
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const place = addr.neighbourhood || addr.suburb || addr.village || addr.hamlet || addr.subdivision || addr.county || '';
        const city = addr.city || addr.town || addr.city_district || addr.state || '';
        const country = addr.country || '';
        
        let formatted = '';
        if (place) formatted += place;
        if (city) formatted += (formatted ? ' - ' : '') + city;
        if (country) formatted += (formatted ? ' - ' : '') + country;
        
        setUbicacion(formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      } else {
        setUbicacion(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    } catch (e) {
      setUbicacion(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const fetchSoilPh = async (lat, lng) => {
    try {
      const basePh = getSimulatedSoilPh(lat, lng);
      setPh(basePh);

      const res = await fetch(`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng.toFixed(4)}&lat=${lat.toFixed(4)}&property=phh2o&depth=0-5cm`);
      const data = await res.json();
      if (data && data.properties && data.properties.layers) {
        const phLayer = data.properties.layers.find(l => l.name === 'phh2o');
        if (phLayer && phLayer.depths && phLayer.depths[0] && phLayer.depths[0].values) {
          const meanPh = phLayer.depths[0].values.mean;
          if (meanPh && meanPh > 0) {
            setPh((meanPh / 10).toFixed(1));
          }
        }
      }
    } catch (e) {
      setPh(getSimulatedSoilPh(lat, lng));
    }
  };

  const drawSoilGrid = (L, map, centerLat, centerLng) => {
    const soilLayerGroup = soilLayerGroupRef.current;
    if (!soilLayerGroup) return;
    soilLayerGroup.clearLayers();
    const step = 0.005;
    const startLat = centerLat - 3 * step;
    const startLng = centerLng - 3 * step;

    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const cellLat = startLat + i * step;
        const cellLng = startLng + j * step;
        const bounds = [
          [cellLat, cellLng],
          [cellLat + step, cellLng + step]
        ];
        
        const cellPh = getSimulatedSoilPh(cellLat + step/2, cellLng + step/2);
        let color = '#3b82f6';
        if (cellPh < 5.5) color = '#ef4444';
        else if (cellPh < 6.0) color = '#fbbf24';
        else if (cellPh > 7.5) color = '#a78bfa';

        L.rectangle(bounds, {
          color: color,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.22,
          interactive: false
        }).addTo(soilLayerGroup);
      }
    }
  };

  const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const clean = String(val).replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!nombre || !nombre.trim()) {
      setError('Por favor, ingresa un nombre para la parcela.');
      return;
    }

    if (!fechaSiembra || !fechaSiembra.trim()) {
      setError('Por favor, selecciona la fecha estimada de siembra.');
      return;
    }

    const areaVal = parseNum(area);
    if (!areaVal || areaVal <= 0) {
      setError('Por favor, ingresa el área de la parcela en hectáreas (ha).');
      return;
    }

    const latVal = parseNum(latitud);
    const lngVal = parseNum(longitud);
    if (latVal !== null && lngVal !== null && (latVal < -5.2 || latVal > 1.6 || lngVal < -81.6 || lngVal > -75.0)) {
      setError('Las coordenadas están fuera de los límites de Ecuador continental.');
      return;
    }

    const payload = {
      nombre_parcela: nombre,
      variedad_maiz: variedad,
      tipo_maiz: tipo,
      ubicacion: ubicacion || null,
      area: areaVal,
      latitud: latVal,
      longitud: lngVal,
      fecha_siembra: fechaSiembra || null,
      altitud: parseNum(altitud),
      ph: parseNum(ph),
      geojson: geojson || null
    };

    try {
      await cultivosService.crear(payload);
      setSuccess('Lote registrado exitosamente.');
      
      setNombre('');
      setUbicacion('');
      setArea('');
      setLatitud('');
      setLongitud('');
      setFechaSiembra('');
      setAltitud('');
      setPh('');
      setGeojson('');

      if (geomanLayersRef.current) geomanLayersRef.current.clearLayers();
      if (currentMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(currentMarkerRef.current);
        currentMarkerRef.current = null;
      }

      cargarCultivos();
      onCultivoChanged();
      if (onboardingStep === 1 && onNextOnboardingStep) {
        setSuccess('¡Excelente! Parcela registrada. Redirigiendo a tu primera simulación...');
        setTimeout(() => {
          onNextOnboardingStep('simular');
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el cultivo.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta parcela? Se perderán las simulaciones asociadas.')) return;
    setError(null);
    setSuccess(null);
    try {
      await cultivosService.eliminar(id);
      setSuccess('Lote eliminado correctamente.');
      cargarCultivos();
      onCultivoChanged();
    } catch (err) {
      setError('Error al eliminar la parcela.');
    }
  };

  const handleCopyCoords = (lat, lng, id) => {
    if (!lat || !lng) return;
    const text = `${Number(lat).toFixed(7)}, ${Number(lng).toFixed(7)}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getPhCategory = (phVal) => {
    if (!phVal) return 'optimal';
    const val = Number(phVal);
    if (val < 5.5) return 'acidic';
    if (val > 7.5) return 'alkaline';
    return 'optimal';
  };

  const formatDateString = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const sortedCultivos = [...cultivos].sort((a, b) => {
    if (sortOrder === 'desc') {
      return b.id - a.id;
    } else {
      return a.id - b.id;
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)', overflow: 'hidden' }}>
      <div className='dashboard-title-row' style={{ marginBottom: '0.75rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Gestionar Lotes y Parcelas</h1>
          <p className='dashboard-title-desc' style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem' }}>
            Registra tus lotes de producción mediante linderos satelitales o posicionamiento manual.
          </p>
        </div>
      </div>

      {success && (
        <div className='bg-success-alpha text-success' style={{ padding: '0.6rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '0.75rem', border: '1px solid rgba(22, 163, 74, 0.25)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <Info size={15} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className='bg-danger-alpha text-danger' style={{ padding: '0.6rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <Info size={15} />
          <span>{error}</span>
        </div>
      )}

      {onboardingStep === 1 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '10px',
          padding: '0.65rem 0.9rem',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexShrink: 0
        }}>
          <div style={{ background: '#3b82f6', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>1</div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 0.15rem 0', color: 'var(--text-primary)' }}>
              ¡Bienvenido a ZeaSys! Paso 1 de 3: Registra tu Primera Parcela
            </h4>
            <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text-muted)' }}>
              Dibuja los linderos en el mapa o completa los datos para guardar tu lote y pasar automáticamente a tu primera simulación.
            </p>
          </div>
        </div>
      )}

      <div className='glass-panel' style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className='glass-card-header' style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <Plus size={18} className='text-secondary' />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Registrar Nueva Parcela</h3>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', padding: '1rem 1.25rem', overflow: 'hidden' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexShrink: 0 }}>
              <label className='form-label' style={{ marginBottom: 0, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
                <Map size={13} color='#3b82f6' /> Trazado Satelital y Selección de Terreno
              </label>
            </div>

            <div className='cultivos-map-shell' style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <div style={{ position: 'absolute', top: '8px', right: '50px', zIndex: 1000, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', padding: '3px 6px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <select value={mapLayerOption} onChange={(e) => setMapLayerOption(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.7rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
                  <option value='satellite'>Vista Satelital</option>
                  <option value='soil'>Mapa de Suelo (pH)</option>
                </select>
              </div>

              <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 1000, width: 'calc(100% - 110px)', maxWidth: '260px', display: 'flex', gap: '0.3rem', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <input
                  type='text'
                  placeholder='Buscar ubicación...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMapSearch(); } }}
                  className='form-input'
                  style={{ height: '26px', fontSize: '0.72rem', background: 'rgba(255, 255, 255, 0.05)', border: 'none', borderRadius: '4px', padding: '0 0.4rem', color: '#fff', flex: 1 }}
                />
                <button type='button' onClick={handleMapSearch} className='btn' style={{ padding: '0 0.5rem', height: '26px', fontSize: '0.7rem', borderRadius: '4px', background: 'linear-gradient(135deg, #863bff, #3b82f6)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                  Buscar
                </button>
              </div>

              <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}></div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
              Información del Lote
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Sprout size={11} /> Nombre del Lote *</label>
                <input type='text' className='form-input' placeholder='Ej: Lote Norte' value={nombre} onChange={e => setNombre(e.target.value)} required style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }} />
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Layers size={11} /> Variedad de Maíz *</label>
                <select className='form-select' value={variedad} onChange={e => handleVariedadChange(e.target.value)} required style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}>
                  {(VARIEDADES_POR_TIPO[tipo] || []).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem' }}>Tipo de Maíz *</label>
                <select className='form-select' value={tipo} onChange={e => handleTipoChange(e.target.value)} required style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}>
                  <option value='Duro Amarillo'>Duro Amarillo</option>
                  <option value='Suave Harinoso'>Suave Harinoso</option>
                  <option value='Duro Amarillo / Blanco'>Duro Amarillo / Blanco</option>
                </select>
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Grid size={11} /> Área (ha) *</label>
                <input 
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='Ej: 5.25' 
                  value={area} 
                  onChange={e => setArea(limpiarTextoNumerico(e.target.value))} 
                  onKeyDown={evitarOperadores}
                  required 
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }} 
                />
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem', marginTop: '0.15rem' }}>
              Geolocalización y Edafología
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>Latitud *</label>
                <input 
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='-2.189' 
                  value={latitud} 
                  onChange={e => setLatitud(limpiarTextoNumerico(e.target.value, true))} 
                  onKeyDown={e => evitarOperadores(e, true)}
                  required 
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.78rem' }} 
                />
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>Longitud *</label>
                <input 
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='-79.889' 
                  value={longitud} 
                  onChange={e => setLongitud(limpiarTextoNumerico(e.target.value, true))} 
                  onKeyDown={e => evitarOperadores(e, true)}
                  required 
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.78rem' }} 
                />
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.7rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Droplet size={10} /> pH Suelo</label>
                <input 
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='6.5' 
                  value={ph} 
                  onChange={e => setPh(limpiarTextoNumerico(e.target.value))} 
                  onKeyDown={evitarOperadores}
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.78rem' }} 
                />
              </div>
            </div>

            {(() => {
              const latVal = parseNum(latitud);
              const lngVal = parseNum(longitud);
              const isOutside = latVal !== null && lngVal !== null && (latVal < -5.2 || latVal > 1.6 || lngVal < -81.6 || lngVal > -75.0);
              if (!isOutside) return null;
              return (
                <div className='bg-danger-alpha text-danger' style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span><strong>Ubicación fuera de Ecuador:</strong> Coordenadas no válidas.</span>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={11} /> Ubicación / Provincia</label>
                <input type='text' className='form-input' placeholder='Guayas, Ecuador' value={ubicacion} onChange={e => setUbicacion(e.target.value)} style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }} />
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mountain size={11} /> Altitud (msnm)</label>
                <input 
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='45' 
                  value={altitud} 
                  onChange={e => setAltitud(limpiarTextoNumerico(e.target.value))} 
                  onKeyDown={evitarOperadores}
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }} 
                />
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem', marginTop: '0.15rem' }}>
              Planificación Agrónoma
            </div>

            <div className='form-group' style={{ marginBottom: '0.2rem' }}>
              <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={11} /> Fecha de Siembra *</label>
              <input type='date' className='form-input' value={fechaSiembra} onChange={e => setFechaSiembra(e.target.value)} required style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }} />
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
              <button type='submit' className='btn btn-primary' style={{ width: '100%', padding: '0.65rem', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', borderRadius: '10px' }}>
                <Plus size={18} /> Registrar Parcela
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
