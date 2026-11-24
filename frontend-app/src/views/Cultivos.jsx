import { editarPeriodo, errorPeriodo, periodoCultivo } from '../utils/fieldInputs';
import { useState, useEffect, useRef } from 'react';
import { parcelasService } from '../services/api';
import PanelTecnico from '../components/PanelTecnico';
import { leerAltitud, leerPhSuelo, urlPhSuelo } from '../utils/datosParcela';
import '../utils/mapRuntime';
import { nombrarControlesMapa, observarTamanoMapa } from '../utils/mapAccessibility';
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

// El navegador valida la cadena completa antes de convertir coma o punto decimal.
const decimalPattern = '([0-9]+([.,][0-9]+)?|[.,][0-9]+)';
const coordinatePattern = `-?${decimalPattern}`;

export default function Cultivos({ onCultivoChanged, onboardingStep, onNextOnboardingStep, onAbrirRegistroCampo }) {
  const [cultivos, setCultivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [panelTecnico, setPanelTecnico] = useState(false);

  const [nombre, setNombre] = useState('');
  const [variedad, setVariedad] = useState('');
  const [variedadPersonalizada, setVariedadPersonalizada] = useState('');
  const [tipo, setTipo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [area, setArea] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [periodo, setPeriodo] = useState(() => periodoCultivo());
  const fechaSiembra = periodo.fecha;
  const cambiarPeriodo = (campo, valor) => setPeriodo(previous => editarPeriodo(previous, campo, valor));
  const [altitud, setAltitud] = useState('');
  const [ph, setPh] = useState('');
  const [estadoPh, setEstadoPh] = useState('');
  const [estadoAltitud, setEstadoAltitud] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [searchStatus, setSearchStatus] = useState('');
  const activeSearch = useRef(null);
  useEffect(() => () => activeSearch.current?.abort(), []);
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
    observarTamanoMapa(map);

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
      map.pm.setLang('es');
      map.pm.setGlobalOptions({ tooltips: false });
      map.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawPolygon: true,
        drawPolyline: false,
        drawCircle: false,
        drawCircleMarker: false,
        drawRectangle: true,
        drawText: false,
        rotateMode: false,
        editMode: true,
        dragMode: false,
        cutPolygon: false,
        removalMode: true
      });
      nombrarControlesMapa(map);

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
    if (!searchQuery.trim() || !mapRef.current) return;
    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setSearchStatus('Buscando ubicación…');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=ec&limit=1&q=${encodeURIComponent(searchQuery.trim())}`, { signal: controller.signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        setSearchStatus(`Ubicación encontrada: ${first.display_name}`);
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
      } else {
        setSearchStatus('No encontramos ese lugar. Prueba con el cantón o marca el punto en el mapa.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') setSearchStatus('No pudimos consultar el mapa. Puedes escribir las coordenadas de tu parcela.');
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
      const res = await fetch(urlPhSuelo(lat, lng), { signal: AbortSignal.timeout(8000) });
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
    const num = Number(clean);
    return Number.isFinite(num) ? num : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    setError(null);
    setSuccess(null);

    if (!nombre || !nombre.trim()) {
      setError('Por favor, ingresa un nombre para la parcela.');
      return;
    }

    const problemaPeriodo = errorPeriodo(periodo);
    if (problemaPeriodo) { setError(problemaPeriodo); return; }
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
      ciclo_dias: periodo.dias ? Number(periodo.dias) : null,
      tipo_fecha_siembra: 'prevista',
      altitud: parseNum(altitud),
      ph: parseNum(ph),
      geojson: geojson || null
    };

    savingRef.current = true;
    setSaving(true);
    try {
      await parcelasService.crear(payload);
      setSuccess('Lote registrado exitosamente.');
      
      setSearchStatus('');
      setSearchQuery('');
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
      setPeriodo(periodoCultivo());
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
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleCopyCoords = async (lat, lng) => {
    const latitude = parseNum(lat), longitude = parseNum(lng);
    if (latitude === null || longitude === null) return;
    const text = `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId('coordinates');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('No se pudieron copiar las coordenadas.');
    }
  };

  return (
    <div className="cultivos-workspace" style={{ display: 'flex', flexDirection: 'column', height: 'var(--cultivos-page-height, calc(100vh - 110px))', overflow: 'var(--cultivos-page-overflow, hidden)' }}>
      <div className='dashboard-title-row' style={{ marginBottom: '0.75rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Gestionar Lotes y Parcelas</h1>
          <p className='dashboard-title-desc' style={{ margin: '0.15rem 0 0 0', fontSize: '0.8125rem' }}>
            Marca la parcela en el mapa o escribe sus coordenadas. Puedes dibujar el contorno para calcular el área.
          </p>
          <span role="status" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {loading ? 'Actualizando parcelas...' : (cultivos.length === 1 ? '1 parcela registrada' : `${cultivos.length} parcelas registradas`)}
          </span>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setPanelTecnico(true)}>Acompañamiento técnico</button>
        {onAbrirRegistroCampo && <button type="button" className="btn btn-secondary" onClick={onAbrirRegistroCampo} disabled={!cultivos.length}>Registro de campo</button>}
      </div>
      {panelTecnico && <PanelTecnico parcelas={cultivos} onClose={() => setPanelTecnico(false)} />}

      {success && (
        <div role='status' className='bg-success-alpha text-success' style={{ padding: '0.6rem 0.9rem', borderRadius: '8px', fontSize: '0.9375rem', marginBottom: '0.75rem', border: '1px solid rgba(22, 163, 74, 0.25)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <Info size={15} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div role='alert' className='bg-danger-alpha text-danger' style={{ padding: '0.6rem 0.9rem', borderRadius: '8px', fontSize: '0.9375rem', marginBottom: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <Info size={15} />
          <span>{error}</span>
        </div>
      )}

      {onboardingStep === 1 && (
        <div style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--zs-primary) 16%, transparent) 0%, color-mix(in srgb, var(--zs-secondary) 14%, transparent) 100%)',
          border: '1.5px solid color-mix(in srgb, var(--zs-primary) 38%, transparent)',
          borderRadius: '10px',
          padding: '0.65rem 0.9rem',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexShrink: 0
        }}>
          <div style={{ background: 'var(--zs-primary)', color: 'var(--zs-accent-contrast)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>1</div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 0.15rem 0', color: 'var(--text-primary)' }}>
              ¡Bienvenido a ZeaSys! Paso 1 de 3: Registra tu Primera Parcela
            </h4>
            <p style={{ fontSize: '0.8125rem', margin: 0, color: 'var(--text-muted)' }}>
              Dibuja los linderos en el mapa o completa los datos para guardar tu lote y pasar automáticamente a tu primera simulación.
            </p>
          </div>
        </div>
      )}

      <div className='glass-panel' style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className='glass-card-header' style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <Plus size={18} className='text-secondary' />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Registrar Nueva Parcela</h2>
        </div>

        <form className="cultivos-create-form" onSubmit={handleSubmit} style={{ flex: 1, display: 'grid', gridTemplateColumns: 'var(--cultivos-form-columns, minmax(0, 1.2fr) minmax(0, 1fr))', gap: '1.25rem', padding: '1rem 1.25rem', overflow: 'hidden' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexShrink: 0 }}>
              <h3 className='form-label' style={{ margin: 0, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
                <Map size={16} aria-hidden='true' /> Ubicación de la parcela
              </h3>
              <button
                type="button"
                onClick={() => handleCopyCoords(latitud, longitud)}
                disabled={parseNum(latitud) === null || parseNum(longitud) === null}
                aria-label={copiedId === 'coordinates' ? 'Coordenadas copiadas' : 'Copiar coordenadas'}
                title={copiedId === 'coordinates' ? 'Coordenadas copiadas' : 'Copiar coordenadas'}
                style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: latitud && longitud ? 'pointer' : 'not-allowed', padding: '0.25rem' }}
              >
                {copiedId === 'coordinates' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

              <div className="cultivos-map-toolbar cultivos-map-search">
                <input
                  type='text'
                  aria-label='Buscar una ubicación en Ecuador'
                  placeholder='Cantón o localidad'
                  value={searchQuery}
                  onChange={(e) => { activeSearch.current?.abort(); setSearchStatus(''); setSearchQuery(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMapSearch(); } }}
                  className='form-input cultivos-map-search-input'
                />
                <button type='button' onClick={handleMapSearch} className='btn cultivos-map-search-button'>
                  Buscar
                </button>
              </div>
            <div className='cultivos-map-shell' style={{ position: 'relative', flex: 'var(--cultivos-map-flex, 1)', minHeight: 'var(--cultivos-map-height, 0)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}></div>
            </div>
            <p className="parcela-map-status" role="status">{searchStatus}</p>
          </div>

          <div className="cultivos-form-fields" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'var(--cultivos-fields-overflow, auto)', paddingRight: '0.25rem' }}>
            <h3 className="parcela-section-title">Datos del lote</h3>
            <p className="parcela-form-note">Los campos con * son obligatorios. Puedes escribir los decimales con coma o punto.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label htmlFor="parcela-nombre" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Sprout size={11} /> Nombre del Lote *</label>
                <input id="parcela-nombre" type='text' className='form-input' placeholder='Ej: Lote Norte' value={nombre} onChange={e => setNombre(e.target.value)} required style={{ padding: '0.45rem 0.65rem', fontSize: '0.9375rem' }} />
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label htmlFor="parcela-tipo" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem' }}>Tipo de Maíz *</label>
                <select id="parcela-tipo" className='form-select' value={tipo} onChange={e => handleTipoChange(e.target.value)} required style={{ padding: '0.45rem 0.65rem', fontSize: '0.9375rem' }}>
                  <option value=''>Selecciona el tipo de maíz</option>
                  {TIPOS_MAIZ_ECUADOR.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label htmlFor="parcela-variedad" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Layers size={11} /> Variedad o híbrido *</label>
                <select id="parcela-variedad" className='form-select' value={variedad} onChange={e => handleVariedadChange(e.target.value)} required disabled={!tipo} style={{ padding: '0.45rem 0.65rem', fontSize: '0.9375rem' }}>
                  <option value=''>{tipo ? 'Selecciona la variedad' : 'Selecciona primero el tipo'}</option>
                  {variedadesPorTipo.map(v => <option key={v} value={v}>{v}</option>)}
                  <option value={OTRA_VARIEDAD}>{VARIEDAD_PERSONALIZADA}</option>
                </select>
                {tipo && variedadesPorTipo.length === 0 && <p className='form-hint'>Este tipo no tiene variedades en la selección priorizada. Puedes registrar el nombre real de tu semilla; todavía no tiene una ficha de adaptación en el catálogo.</p>}
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label htmlFor="parcela-area" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Grid size={11} /> Área (ha) *</label>
                <input id="parcela-area" 
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='Ej: 5.25' 
                  value={area} 
                  onChange={e => setArea(e.target.value)}
                  pattern={decimalPattern} title="Escribe un número sin separadores de miles, por ejemplo 5,25."
                  required 
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.9375rem' }} 
                />
              </div>
            </div>

            {variedad === OTRA_VARIEDAD && <div className='form-group' style={{ marginBottom: 0 }}>
              <label htmlFor="parcela-semilla" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem' }}>Nombre tal como aparece en la semilla *</label>
              <input id="parcela-semilla" type='text' className='form-input' placeholder='Ej: nombre local o marca del híbrido' value={variedadPersonalizada} onChange={e => setVariedadPersonalizada(e.target.value)} required maxLength={120} style={{ padding: '0.45rem 0.65rem', fontSize: '0.9375rem' }} />
            </div>}

            <h3 className="parcela-section-title">Ubicación y suelo</h3>

            <div className="cultivos-location-fields" style={{ display: 'grid', gridTemplateColumns: 'var(--cultivos-location-columns, repeat(3, minmax(0, 1fr)))', gap: '0.5rem' }}>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label htmlFor="parcela-latitud" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem' }}>Latitud *</label>
                <input id="parcela-latitud" 
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='-2.189' 
                  value={latitud} 
                  onChange={e => { invalidarDatosUbicacion(); setLatitud(e.target.value); }}
                  pattern={coordinatePattern} title="Escribe una coordenada decimal, por ejemplo -1,25."
                  required 
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8125rem' }} 
                />
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label htmlFor="parcela-longitud" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem' }}>Longitud *</label>
                <input id="parcela-longitud" 
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='-79.889' 
                  value={longitud} 
                  onChange={e => { invalidarDatosUbicacion(); setLongitud(e.target.value); }}
                  pattern={coordinatePattern} title="Escribe una coordenada decimal, por ejemplo -1,25."
                  required 
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8125rem' }} 
                />
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label htmlFor="parcela-ph" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Droplet size={10} /> pH Suelo</label>
                <input id="parcela-ph" aria-describedby={estadoPh ? 'parcela-ph-estado' : undefined}
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='6.5' 
                  value={ph} 
                  onChange={e => { consultaPh.current += 1; setEstadoPh('Valor ingresado manualmente.'); setPh(e.target.value); }}
                  pattern={decimalPattern} title="Escribe un número sin separadores de miles, por ejemplo 5,25."
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8125rem' }} 
                />
                {estadoPh && <small id="parcela-ph-estado" role="status" style={{ color: 'var(--zs-muted)', fontSize: '0.8125rem', lineHeight: 1.35 }}>{estadoPh}</small>}
              </div>
            </div>

            {(() => {
              const latVal = parseNum(latitud);
              const lngVal = parseNum(longitud);
              const isOutside = latVal !== null && lngVal !== null && (latVal < -5.2 || latVal > 1.6 || lngVal < -81.6 || lngVal > -75.0);
              if (!isOutside) return null;
              return (
                <div className='bg-danger-alpha text-danger' style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span><strong>Ubicación fuera de Ecuador:</strong> Coordenadas no válidas.</span>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label htmlFor="parcela-ubicacion" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={11} /> Ubicación / Provincia</label>
                <input id="parcela-ubicacion" aria-describedby={estadoUbicacion ? 'parcela-ubicacion-estado' : undefined} type='text' className='form-input' placeholder='Guayas, Ecuador' value={ubicacion} onChange={e => { consultaUbicacion.current += 1; setEstadoUbicacion('Ubicación ingresada manualmente.'); setUbicacion(e.target.value); }} style={{ padding: '0.45rem 0.65rem', fontSize: '0.9375rem' }} />
                {estadoUbicacion && <small id="parcela-ubicacion-estado" role="status" style={{ color: 'var(--zs-muted)', fontSize: '0.8125rem', lineHeight: 1.35 }}>{estadoUbicacion}</small>}
              </div>
              <div className='form-group' style={{ marginBottom: 0 }}>
                <label htmlFor="parcela-altitud" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mountain size={11} /> Altitud (msnm)</label>
                <input id="parcela-altitud" aria-describedby={estadoAltitud ? 'parcela-altitud-estado' : undefined}
                  type='text' 
                  inputMode='decimal' 
                  className='form-input' 
                  placeholder='45' 
                  value={altitud} 
                  onChange={e => { consultaAltitud.current += 1; setEstadoAltitud('Valor ingresado manualmente.'); setAltitud(e.target.value); }}
                  pattern={decimalPattern} title="Escribe un número sin separadores de miles, por ejemplo 5,25."
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.9375rem' }} 
                />
                {estadoAltitud && <small id="parcela-altitud-estado" role="status" style={{ color: 'var(--zs-muted)', fontSize: '0.8125rem', lineHeight: 1.35 }}>{estadoAltitud}</small>}
              </div>
            </div>

            <h3 className="parcela-section-title">Plan de siembra</h3>

            <div className='form-group' style={{ marginBottom: '0.2rem' }}>
              <label htmlFor="parcela-fecha" className='form-label' style={{ fontSize: '0.8125rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={11} /> Fecha prevista de siembra *</label>
              <input id="parcela-fecha" type='date' className='form-input' value={fechaSiembra} onChange={e => cambiarPeriodo('fecha',e.target.value)} required style={{ padding: '0.45rem 0.65rem', fontSize: '0.9375rem' }} />
            </div>

            <div className="cultivos-periodo">
              <label htmlFor="parcela-cosecha">Fecha prevista de cosecha</label>
              <input id="parcela-cosecha" type="date" className="form-input" value={periodo.cosecha} min={fechaSiembra || undefined} aria-describedby="parcela-periodo-ayuda" onChange={e => cambiarPeriodo('cosecha', e.target.value)} />
              <label htmlFor="parcela-dias">Duración del cultivo en días</label>
              <input id="parcela-dias" className="form-input" type="number" min="1" max="730" step="1" value={periodo.dias} aria-describedby="parcela-periodo-ayuda" onChange={e => cambiarPeriodo('dias', e.target.value)} />
              <p id="parcela-periodo-ayuda" className="parcela-form-note">Con dos datos se calcula el tercero. La siembra cuenta como día 1. La fecha y la duración guardadas se usarán al simular.</p>
            </div>
            <div className="parcela-save-row">
              <button type='submit' disabled={saving} className='btn btn-primary' style={{ width: '100%', padding: '0.65rem', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', borderRadius: '10px' }}>
                <Plus size={18} /> {saving ? 'Guardando parcela…' : 'Registrar Parcela'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
