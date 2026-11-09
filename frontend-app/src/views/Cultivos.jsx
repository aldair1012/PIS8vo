import { useState, useEffect, useRef } from 'react';
import { parcelasService } from '../services/api';
import { leerAltitud, leerPhSuelo } from '../utils/datosParcela';
import '../utils/mapRuntime';
import { OTRA_VARIEDAD, TIPOS_MAIZ_ECUADOR, VARIEDAD_PERSONALIZADA } from '../data/variedadesMaizEcuador';
import { 
  Plus, 
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
  Map
} from 'lucide-react';

// Funciones auxiliares para validar inputs numéricos
const limpiarTextoNumerico = (valor, permiteNegativo = false) => {
  if (!valor || typeof valor !== 'string') return valor;
  let limpio = valor.replace(/[/*+eE]/g, '');
  if (permiteNegativo) {
    return limpio.replace(/[^0-9.,-]/g, '');
  }
  return limpio.replace(/[-]/g, '').replace(/[^0-9.,]/g, '');
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

  const [nombre, setNombre] = useState('');
  const [variedad, setVariedad] = useState('');
  const [variedadPersonalizada, setVariedadPersonalizada] = useState('');
  const [tipo, setTipo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [area, setArea] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [fechaSiembra, setFechaSiembra] = useState('');
  const [altitud, setAltitud] = useState('');
  const [ph, setPh] = useState('');
  const [estadoPh, setEstadoPh] = useState('');
  const [estadoAltitud, setEstadoAltitud] = useState('');
  const consultaPh = useRef(0);
  const consultaAltitud = useRef(0);
  const consultaUbicacion = useRef(0);
  const [estadoUbicacion, setEstadoUbicacion] = useState('');
  const [geojson, setGeojson] = useState('');

  const handleTipoChange = (newTipo) => {
    setTipo(newTipo);
    setVariedad('');
    setVariedadPersonalizada('');
  };

  const handleVariedadChange = (newVariedad) => {
    setVariedad(newVariedad);
    if (newVariedad !== OTRA_VARIEDAD) setVariedadPersonalizada('');
  };

  const variedadesPorTipo = TIPOS_MAIZ_ECUADOR.find((item) => item.value === tipo)?.variedades ?? [];

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const geomanLayersRef = useRef(null);
  const currentMarkerRef = useRef(null);
  const mapActionsRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');

  const cargarCultivos = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await parcelasService.listar();
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
    const refresh = setTimeout(cargarCultivos, 0);
    return () => clearTimeout(refresh);
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
        const actions = mapActionsRef.current;
        if (!actions) return;
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
          actions.fetchAltitude(latlng.lat, latlng.lng);
          actions.fetchAddress(latlng.lat, latlng.lng);
          actions.fetchSoilPh(latlng.lat, latlng.lng);
          setGeojson(JSON.stringify(layer.toGeoJSON()));
        } else if (e.shape === 'Polygon' || e.shape === 'Rectangle') {
          const latlngs = layer.getLatLngs()[0];
          if (latlngs && latlngs.length > 0) {
            const calculatedArea = actions.calculatePolygonAreaHectares(latlngs);
            setArea(calculatedArea.toString());

            let sumLat = 0, sumLng = 0;
            latlngs.forEach(p => { sumLat += p.lat; sumLng += p.lng; });
            const centerLat = sumLat / latlngs.length;
            const centerLng = sumLng / latlngs.length;

            setLatitud(centerLat.toFixed(7));
            setLongitud(centerLng.toFixed(7));
            actions.fetchAltitude(centerLat, centerLng);
            actions.fetchAddress(centerLat, centerLng);
            actions.fetchSoilPh(centerLat, centerLng);

          }
          setGeojson(JSON.stringify(layer.toGeoJSON()));
        }
      });
    }

    map.on('click', (e) => {
      const actions = mapActionsRef.current;
      if (!actions) return;
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (currentMarkerRef.current) {
        map.removeLayer(currentMarkerRef.current);
      }

      const marker = L.marker([lat, lng]).addTo(map);
      currentMarkerRef.current = marker;

      setLatitud(lat.toFixed(7));
      setLongitud(lng.toFixed(7));
      actions.fetchAltitude(lat, lng);
      actions.fetchAddress(lat, lng);
      actions.fetchSoilPh(lat, lng);

    });

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, []);

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
        consultaUbicacion.current += 1;
        setEstadoUbicacion('Ubicación seleccionada en el mapa.');
        setUbicacion(first.display_name);
        fetchAltitude(lat, lon);
        fetchSoilPh(lat, lon);
      }
    } catch (err) {
      console.error('Error searching map location:', err);
    }
  };

  function calculatePolygonAreaHectares(latlngs) {
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
  }

  async function fetchAltitude(lat, lng) {
    const solicitud = ++consultaAltitud.current;
    setAltitud('');
    setEstadoAltitud('Consultando altitud estimada…');
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
      if (!res.ok) throw new Error('Altitud no disponible');
      const valor = leerAltitud(await res.json());
      if (solicitud !== consultaAltitud.current) return;
      setAltitud(valor ?? '');
      setEstadoAltitud(valor === null ? 'Altitud no disponible; puedes ingresarla manualmente.' : 'Estimación de Open-Meteo; puedes corregirla.');
    } catch {
      if (solicitud === consultaAltitud.current) setEstadoAltitud('Altitud no disponible; puedes ingresarla manualmente.');
    }
  }

  async function fetchAddress(lat, lng) {
    const solicitud = ++consultaUbicacion.current;
    setUbicacion('');
    setEstadoUbicacion('Consultando ubicación…');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}&format=json&accept-language=es`);
      if (!res.ok) throw new Error('Ubicación no disponible');
      const data = await res.json();
      if (solicitud !== consultaUbicacion.current) return;
      const addr = data?.address;
      const place = addr?.neighbourhood || addr?.suburb || addr?.village || addr?.hamlet || addr?.subdivision || addr?.county || '';
      const city = addr?.city || addr?.town || addr?.city_district || addr?.state || '';
      const country = addr?.country || '';
      const nombre = [place, city, country].filter(Boolean).join(' - ');
      setUbicacion(nombre || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setEstadoUbicacion(nombre ? 'Ubicación aproximada de OpenStreetMap.' : 'No se encontró una dirección; se muestran las coordenadas.');
    } catch {
      if (solicitud !== consultaUbicacion.current) return;
      setUbicacion(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setEstadoUbicacion('Dirección no disponible; se muestran las coordenadas.');
    }
  }

  async function fetchSoilPh(lat, lng) {
    const solicitud = ++consultaPh.current;
    setPh('');
    setEstadoPh('Consultando pH estimado…');
    try {
      const res = await fetch(`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng.toFixed(4)}&lat=${lat.toFixed(4)}&property=phh2o&depth=0-5cm`);
      if (!res.ok) throw new Error('pH no disponible');
      const valor = leerPhSuelo(await res.json());
      if (solicitud !== consultaPh.current) return;
      setPh(valor ?? '');
      setEstadoPh(valor === null ? 'pH no disponible; puedes ingresar el resultado de un análisis.' : 'Estimación de SoilGrids (0–5 cm); no es una medición de la parcela.');
    } catch {
      if (solicitud === consultaPh.current) setEstadoPh('pH no disponible; puedes ingresar el resultado de un análisis.');
    }
  }

  const invalidarDatosUbicacion = () => {
    consultaPh.current += 1;
    consultaAltitud.current += 1;
    consultaUbicacion.current += 1;
    setEstadoUbicacion('Coordenadas editadas; revisa la ubicación.');
    setPh('');
    setAltitud('');
    setEstadoPh('Coordenadas editadas; ingresa el pH si lo conoces.');
    setEstadoAltitud('Coordenadas editadas; ingresa la altitud si la conoces.');
  };

  useEffect(() => {
    mapActionsRef.current = {
      calculatePolygonAreaHectares,
      fetchAddress,
      fetchAltitude,
      fetchSoilPh,
    };
    return () => {
      mapActionsRef.current = null;
    };
  });

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

    if (!tipo) {
      setError('Selecciona el tipo de maíz de la parcela.');
      return;
    }

    const variedadFinal = variedad === OTRA_VARIEDAD ? variedadPersonalizada.trim() : variedad;
    if (!variedadFinal) {
      setError(variedad === OTRA_VARIEDAD ? 'Escribe el nombre de la variedad o híbrido.' : 'Selecciona una variedad para el tipo de maíz elegido.');
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
      variedad_maiz: variedadFinal,
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
      await parcelasService.crear(payload);
      setSuccess('Lote registrado exitosamente.');
      
      setNombre('');
      setVariedad('');
      setVariedadPersonalizada('');
      setTipo('');
      consultaUbicacion.current += 1;
      setEstadoUbicacion('');
      setUbicacion('');
      setArea('');
      setLatitud('');
      setLongitud('');
      setFechaSiembra('');
      consultaAltitud.current += 1;
      consultaPh.current += 1;
      setAltitud('');
      setPh('');
      setEstadoPh('');
      setEstadoAltitud('');
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

  const handleCopyCoords = async (lat, lng) => {
    if (!lat || !lng) return;
    const text = `${Number(lat).toFixed(7)}, ${Number(lng).toFixed(7)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId('coordinates');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('No se pudieron copiar las coordenadas.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)', overflow: 'hidden' }}>
      <div className='dashboard-title-row' style={{ marginBottom: '0.75rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Gestionar Lotes y Parcelas</h1>
          <p className='dashboard-title-desc' style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem' }}>
            Registra tus lotes de producción mediante linderos satelitales o posicionamiento manual.
          </p>
          <span role="status" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {loading ? 'Actualizando parcelas...' : `${cultivos.length} parcelas registradas`}
          </span>
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
              <button
                type="button"
                onClick={() => handleCopyCoords(latitud, longitud)}
                disabled={!latitud || !longitud}
                aria-label={copiedId === 'coordinates' ? 'Coordenadas copiadas' : 'Copiar coordenadas'}
                title={copiedId === 'coordinates' ? 'Coordenadas copiadas' : 'Copiar coordenadas'}
                style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: latitud && longitud ? 'pointer' : 'not-allowed', padding: '0.25rem' }}
              >
                {copiedId === 'coordinates' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <div className='cultivos-map-shell' style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <div className="cultivos-map-toolbar cultivos-map-search">
                <input
                  type='text'
                  placeholder='Buscar ubicación...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMapSearch(); } }}
                  className='form-input cultivos-map-search-input'
                />
                <button type='button' onClick={handleMapSearch} className='btn cultivos-map-search-button'>
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
                <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem' }}>Tipo de Maíz *</label>
                <select className='form-select' value={tipo} onChange={e => handleTipoChange(e.target.value)} required style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}>
                  <option value=''>Selecciona el tipo de maíz</option>
                  {TIPOS_MAIZ_ECUADOR.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Layers size={11} /> Variedad o híbrido *</label>
                <select className='form-select' value={variedad} onChange={e => handleVariedadChange(e.target.value)} required disabled={!tipo} style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}>
                  <option value=''>{tipo ? 'Selecciona la variedad' : 'Selecciona primero el tipo'}</option>
                  {variedadesPorTipo.map(v => <option key={v} value={v}>{v}</option>)}
                  <option value={OTRA_VARIEDAD}>{VARIEDAD_PERSONALIZADA}</option>
                </select>
                {tipo && variedadesPorTipo.length === 0 && <p className='form-hint'>Este tipo no tiene variedades en la selección priorizada. Puedes registrar el nombre real de tu semilla; todavía no tiene una ficha de adaptación en el catálogo.</p>}
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

            {variedad === OTRA_VARIEDAD && <div className='form-group' style={{ marginBottom: 0 }}>
              <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem' }}>Nombre tal como aparece en la semilla *</label>
              <input type='text' className='form-input' placeholder='Ej: nombre local o marca del híbrido' value={variedadPersonalizada} onChange={e => setVariedadPersonalizada(e.target.value)} required maxLength={120} style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }} />
            </div>}

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
                  onChange={e => { invalidarDatosUbicacion(); setLatitud(limpiarTextoNumerico(e.target.value, true)); }} 
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
                  onChange={e => { invalidarDatosUbicacion(); setLongitud(limpiarTextoNumerico(e.target.value, true)); }} 
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
                  onChange={e => { consultaPh.current += 1; setEstadoPh('Valor ingresado manualmente.'); setPh(limpiarTextoNumerico(e.target.value)); }} 
                  onKeyDown={evitarOperadores}
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.78rem' }} 
                />
                {estadoPh && <small role="status" style={{ color: 'var(--zs-muted)', fontSize: '0.7rem', lineHeight: 1.35 }}>{estadoPh}</small>}
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
                <input type='text' className='form-input' placeholder='Guayas, Ecuador' value={ubicacion} onChange={e => { consultaUbicacion.current += 1; setEstadoUbicacion('Ubicación ingresada manualmente.'); setUbicacion(e.target.value); }} style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }} />
                {estadoUbicacion && <small role="status" style={{ color: 'var(--zs-muted)', fontSize: '0.7rem', lineHeight: 1.35 }}>{estadoUbicacion}</small>}
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label className='form-label' style={{ fontSize: '0.72rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mountain size={11} /> Altitud (msnm)</label>
                <input 
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='45' 
                  value={altitud} 
                  onChange={e => { consultaAltitud.current += 1; setEstadoAltitud('Valor ingresado manualmente.'); setAltitud(limpiarTextoNumerico(e.target.value)); }} 
                  onKeyDown={evitarOperadores}
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }} 
                />
                {estadoAltitud && <small role="status" style={{ color: 'var(--zs-muted)', fontSize: '0.7rem', lineHeight: 1.35 }}>{estadoAltitud}</small>}
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
