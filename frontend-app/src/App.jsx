import { lazy, Suspense, useCallback, useState, useEffect, useRef } from 'react';
import Sidebar from './templates/Common/Sidebar';
import { provinceFromLocation } from './utils/yieldDashboard';
import Navbar from './templates/Common/Navbar';
import Login from './views/Login';
import { AlertTriangle } from 'lucide-react';
import { authService, parcelasService, simulacionService } from './services/api';
import PantallaCarga from './components/PantallaCarga';
import StartupRecovery from './components/StartupRecovery';
import { guardarPreferencia, leerPreferencia } from './utils/preferenciasLocales';

const DashboardScenario = lazy(() => import('./views/DashboardScenario'));
const DashboardClimate = lazy(() => import('./views/DashboardClimate'));
const DashboardYield = lazy(() => import('./views/DashboardRendimiento'));
const DashboardFinance = lazy(() => import('./views/DashboardFinance'));
const Cultivos = lazy(() => import('./views/Cultivos'));
const RegistroCampo = lazy(() => import('./components/RegistroCampo'));
const Simular = lazy(() => import('./views/Simular'));
const History = lazy(() => import('./views/History'));
const MapPage = lazy(() => import('./views/MapPage'));
const Configuracion = lazy(() => import('./views/Configuracion'));
const ChatbotWidget = lazy(() => import('./components/ChatbotWidget'));
const ConsejoModal = lazy(() => import('./components/ConsejoModal'));

const viewTitles = {
  yield: 'Rendimiento proyectado', scenarios: 'Siembra', climate: 'Clima y cultivo',
  finance: 'Viabilidad financiera', map: 'Mapa de parcelas', simular: 'Nueva simulación',
  history: 'Historial de simulaciones', configuracion: 'Configuración', cultivos: 'Mis parcelas',
  asistente: 'Asistente de la parcela', campo: 'Cuaderno de campo',
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [sessionError, setSessionError] = useState(null);
  const authGeneration = useRef(0);
  const [isRegistering, setIsRegistering] = useState(false);

  // Estados del diseño (Layout)
  const [vistaActual, setVistaActual] = useState('yield');
  const [registroCampoId, setRegistroCampoId] = useState(null);
  const [solicitudFecha, setSolicitudFecha] = useState(null);
  const [revisionMediciones, setRevisionMediciones] = useState(0);
  const [cultivos, setCultivos] = useState([]);
  const [cultivosError, setCultivosError] = useState(false);
  const [cultivosCargando, setCultivosCargando] = useState(true);
  const solicitudCultivos = useRef(0);
  const [cultivoElegidoId, setCultivoElegidoId] = useState(null);
  const [añoSeleccionado, setAñoSeleccionado] = useState(() => new Date().getFullYear());
  const [contextoDashboard, setContextoDashboard] = useState(null);
  const [contextoSimulacion, setContextoSimulacion] = useState(null);
  const [iaEncendida, setIaEncendida] = useState(false);
  const [recargarDatos, setRecargarDatos] = useState(0);
  const [menuCerrado, setMenuCerrado] = useState(typeof window !== 'undefined' && window.innerWidth <= 1080);
  const [theme, setTheme] = useState(() => leerPreferencia('theme') === 'dark' ? 'dark' : 'light');
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  const cultivoActivo = cultivos.find(c => c.id === cultivoElegidoId);
  const tieneCoordenadas = cultivoActivo?.latitud !== null && cultivoActivo?.latitud !== undefined
    && cultivoActivo?.longitud !== null && cultivoActivo?.longitud !== undefined;
  const fueraDeEcuador = cultivoActivo && tieneCoordenadas && (
    Number(cultivoActivo.latitud) < -5.2 ||
    Number(cultivoActivo.latitud) > 1.6 ||
    Number(cultivoActivo.longitud) < -81.6 ||
    Number(cultivoActivo.longitud) > -75.0
  );

  // Nueva Simulación tiene su propio selector de parcela. El chat debe usar
  // ese sujeto y esos parámetros, no la selección global de los dashboards.
  const enSimulacion = vistaActual === 'simular';
  const cultivoChatId = enSimulacion ? (contextoSimulacion?.cultivoId ?? null) : cultivoElegidoId;
  const cultivoChatActivo = enSimulacion ? (contextoSimulacion?.cultivoActivo ?? null) : cultivoActivo;
  const simulacionChat = enSimulacion ? (contextoSimulacion?.datos ?? null) : null;
  // El asistente comparte una sola conversación entre los paneles del
  // dashboard y conserva otra para el borrador de Nueva Simulación.
  const ambitoChat = enSimulacion ? 'simulacion' : 'dashboard';
  // Mis lotes y Configuración no ofrecen asistente: allí el chat no aplica.
  const chatOculto = vistaActual === 'cultivos' || vistaActual === 'configuracion';
  // Inicialización perezosa desde localStorage; evita setState en efecto.
  // El modal solo se renderiza cuando hay usuario autenticado.
  const [consejoPendiente, setConsejoPendiente] = useState(() => leerPreferencia('zeasys-consejo-mostrado') !== '1');

  // Aplicar tema
  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
    guardarPreferencia('theme', theme);
  }, [theme]);

  useEffect(() => {
    const actualizarViewport = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', actualizarViewport);
    return () => window.removeEventListener('resize', actualizarViewport);
  }, []);

  // Recalcular tamaño de gráficos y contenedores al abrir/cerrar barra lateral
  // Recalcular tamaño de gráficos al abrir/cerrar barra lateral (optimizado: solo 2 eventos)
  useEffect(() => {
    const t1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    const t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [menuCerrado]);

  // Verificar autenticación al inicio
  useEffect(() => {
    let vigente = true;
    async function checkAuth() {
      try {
        const data = await authService.yo();
        if (!vigente) return;
        setAuthError(false);
        if (data.autenticado) {
          setUser(data.usuario);
        }
      } catch (err) {
        if (!vigente) return;
        console.error('Session validation failed:', err);
        setAuthError(true);
      } finally {
        if (vigente) setAuthChecked(true);
      }
    }
    checkAuth();
    return () => { vigente = false; };
  }, [authAttempt]);

  const [onboardingStep, setOnboardingStep] = useState(0);

  // Obtener parcelas y verificar el servicio de IA cuando el usuario está logueado
  const cargarCultivos = useCallback(async () => {
    const generation = authGeneration.current;
    const solicitud = ++solicitudCultivos.current;
    setCultivosCargando(true);
    try {
      const data = await parcelasService.listar();
      if (generation !== authGeneration.current || solicitud !== solicitudCultivos.current || !user) return;
      if (!Array.isArray(data)) throw new Error('La respuesta de parcelas no es válida.');
      setCultivosError(false);
      setCultivos(data);
      const isDone = user?.id ? leerPreferencia(`onboarding_done_${user.id}`) === 'true' : false;

      if (data.length === 0 && !isDone) {
        setVistaActual('cultivos');
        setOnboardingStep(1);
        setCultivoElegidoId(null);
      } else {
        setOnboardingStep(0);
        if (data.length === 0) {
          setCultivoElegidoId(null);
        } else if (cultivoElegidoId && !data.some(c => c.id === cultivoElegidoId)) {
          setCultivoElegidoId(data[0].id);
        } else if (!cultivoElegidoId) {
          setCultivoElegidoId(data[0].id);
        }
      }
    } catch (err) {
      if (generation !== authGeneration.current || solicitud !== solicitudCultivos.current || !user) return;
      console.error('Error fetching crops:', err);
      setCultivosError(true);
    } finally {
      if (generation === authGeneration.current && solicitud === solicitudCultivos.current && user) setCultivosCargando(false);
    }
  }, [cultivoElegidoId, user]);

  const revisarEstadoIa = useCallback(async () => {
    try {
      const data = await simulacionService.estadoIA();
      setIaEncendida(data.running);
    } catch {
      setIaEncendida(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const initialRefresh = setTimeout(() => {
        cargarCultivos();
        revisarEstadoIa();
      }, 0);
      // Verificar periódicamente el estado del servicio de IA
      const interval = setInterval(revisarEstadoIa, 60000);
      return () => {
        clearTimeout(initialRefresh);
        clearInterval(interval);
      };
    }
  }, [cargarCultivos, revisarEstadoIa, user]);

  // El asistente recibe exactamente el conjunto de datos que el usuario está
  // viendo. La clave evita reutilizar un snapshot de otra parcela o año.
  const registrarContextoDashboard = useCallback((vista, datos) => {
    if (!datos || typeof datos !== 'object') { setContextoDashboard(previous => previous?.vista === vista ? null : previous); return; }
    setContextoDashboard({ vista, datos, cultivoId: cultivoElegidoId, año: añoSeleccionado });
  }, [cultivoElegidoId, añoSeleccionado]);
  const registrarScenario = useCallback((datos) => registrarContextoDashboard('scenarios', datos), [registrarContextoDashboard]);
  const registrarClimate = useCallback((datos) => registrarContextoDashboard('climate', datos), [registrarContextoDashboard]);
  const registrarYield = useCallback((datos) => registrarContextoDashboard('yield', datos), [registrarContextoDashboard]);
  const registrarFinance = useCallback((datos) => registrarContextoDashboard('finance', datos), [registrarContextoDashboard]);
  const registrarSimulacion = useCallback((contexto) => {
    setContextoSimulacion(contexto);
  }, []);

  const limpiarSesion = useCallback(() => {
      authGeneration.current++;
      setUser(null);
      setCultivos([]);
      setCultivosError(false);
      setCultivosCargando(true);
      setCultivoElegidoId(null);
      setVistaActual('yield');
      setOnboardingStep(0);
      setIsRegistering(false);
      setContextoDashboard(null);
      setContextoSimulacion(null);
      setSessionError(null);
  }, []);

  useEffect(() => {
    window.addEventListener('zeasys:session-expired', limpiarSesion);
    return () => window.removeEventListener('zeasys:session-expired', limpiarSesion);
  }, [limpiarSesion]);

  const cerrarSesion = async () => {
    try {
      await authService.cerrarSesion();
      limpiarSesion();
    } catch (err) {
      if (err.response?.status === 401) limpiarSesion();
      else setSessionError('No se pudo cerrar la sesión en el servidor. Comprueba la conexión e inténtalo de nuevo.');
    }
  };

  const handleLoginSuccess = (u) => {
    authGeneration.current++;
    setUser(u);
    setSessionError(null);
    // Al autenticarse, cargarCultivos() verificará si ya posee parcelas en la base de datos
    setVistaActual('yield');
    setOnboardingStep(0);
  };

  const handleNextOnboardingStep = (nextStep, targetView) => {
    setOnboardingStep(nextStep);
    if (targetView) {
      setVistaActual(targetView);
    }
  };

  const handleCompleteOnboarding = () => {
    if (user?.id) {
      guardarPreferencia(`onboarding_done_${user.id}`, 'true');
    }
    setOnboardingStep(0);
    setVistaActual('yield');
  };

  const handleSimulationCompleted = ({ cultivoId } = {}) => {
    // Incrementar disparador para recargar listas de historial
    setRecargarDatos(prev => prev + 1);
    if (Number.isInteger(Number(cultivoId)) && Number(cultivoId) > 0) {
      setCultivoElegidoId(Number(cultivoId));
    }
  };

  const handleCultivoChanged = () => {
    cargarCultivos();
  };

  const activeTitle = viewTitles[vistaActual] || 'Centro de cultivo';
  useEffect(() => {
    document.title = user ? `${activeTitle} · ZeaSys` : isRegistering ? 'Crear cuenta · ZeaSys' : 'ZeaSys - IA y Precisión Agrícola';
  }, [user, activeTitle, isRegistering]);

  if (!authChecked) {
    return <div role="status" className="flex-center" style={{ height: '100vh', background: 'var(--background)', color: 'var(--text-muted)' }}>Validando sesión de ZeaSys...</div>;
  }

  if (authError) {
    return (
      <StartupRecovery title="No se pudo conectar con ZeaSys" action="Reintentar conexión" light={theme === 'light'}
        onRetry={() => { setAuthChecked(false); setAuthAttempt(valor => valor + 1); }}>
        Comprueba tu conexión y vuelve a intentarlo.
      </StartupRecovery>
    );
  }

  if (!user) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        switchToRegister={() => setIsRegistering(true)}
        switchToLogin={() => setIsRegistering(false)}
        registering={isRegistering}
        theme={theme}
        onToggleTheme={() => setTheme((valor) => (valor === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  return (
    <div className="app-container zeasys-workspace">
      <a className="workspace-skip-link" href="#workspace-content">Ir al contenido</a>
      {/* Ambient background glow blobs for premium glassmorphism */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>
      <div className="ambient-glow-3"></div>

      {/* Sidebar Navigation */}
      <Sidebar
        vistaActual={vistaActual}
        setVistaActual={destino => {
          if (destino === 'campo') { setRegistroCampoId(cultivoElegidoId ?? cultivos[0]?.id ?? ''); return; }
          if (destino === 'asistente' && !chatOculto) { window.dispatchEvent(new Event('zeasys:abrir-chat')); return; }
          setVistaActual(destino);
        }}
        cerrarSesion={cerrarSesion}
        menuColapsado={menuCerrado}
        setMenuColapsado={setMenuCerrado}
      />

      {/* Backdrop overlay for mobile sidebar expansion */}
      {!menuCerrado && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMenuCerrado(true)}
        />
      )}

      {/* Main Panel */}
      <div className="main-content">
        {sessionError && <div role="alert" className="bg-danger-alpha text-danger" style={{ padding: '1rem' }}>{sessionError}</div>}
        <Navbar
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          title={activeTitle}
          cultivos={cultivos}
          cultivoElegidoId={cultivoElegidoId}
          setCultivoElegidoId={setCultivoElegidoId}
          añoSeleccionado={añoSeleccionado}
          setAnioSeleccionado={setAñoSeleccionado}
          aniosDisponibles={vistaActual === 'scenarios' ? contextoDashboard?.datos?.años_disponibles : undefined}
          user={user}
          iaEncendida={iaEncendida}
          menuCerrado={menuCerrado}
          setMenuCerrado={setMenuCerrado}
          vistaActual={vistaActual}
          setVistaActual={setVistaActual}
        />

        <main
          id="workspace-content"
          tabIndex={0}
          className="content-body"
          style={['map', 'cultivos'].includes(vistaActual) ? {
            minHeight: isMobileView ? 'auto' : 'calc(100vh - 64px)',
            height: isMobileView ? 'auto' : 'calc(100vh - 64px)',
            overflowY: `var(--workspace-map-overflow, ${isMobileView ? 'auto' : 'hidden'})`,
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: '1.25rem 1.5rem'
          } : {
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '1.25rem 1.5rem',
            flex: 1
          }}
        >
          {cultivosCargando && cultivos.length === 0 && vistaActual !== 'configuracion' ? <PantallaCarga mensaje="Cargando tus parcelas…" pantalla /> : cultivosError && vistaActual !== 'configuracion' ? (
            <div role="alert">
              <h2>No se pudieron cargar tus parcelas</h2>
              <p>Comprueba la conexión y vuelve a intentarlo. Tus datos guardados no se han modificado.</p>
              <button type="button" onClick={cargarCultivos}>Reintentar carga</button>
            </div>
          ) : <Suspense fallback={<PantallaCarga mensaje="Cargando vista…" />}>
          {fueraDeEcuador && ['scenarios', 'climate', 'yield', 'finance'].includes(vistaActual) && (
            <div className="bg-danger-alpha text-danger" style={{
              padding: '1rem',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              lineHeight: '1.4',
              fontSize: '0.85rem'
            }}>
              <AlertTriangle size={22} className="text-danger" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Atención: Parcela fuera del límite de calibración del DSS.</strong>
                <p style={{ margin: '0.2rem 0 0 0', color: 'rgba(239, 68, 68, 0.85)', fontSize: '0.8rem' }}>
                  Esta parcela se encuentra localizada en <strong>{cultivoActivo.ubicacion || 'el exterior'}</strong> (Coordenadas: {Number(cultivoActivo.latitud).toFixed(4)}, {Number(cultivoActivo.longitud).toFixed(4)}), fuera del territorio ecuatoriano. Los modelos y bases de datos históricos de este DSS están calibrados de forma exclusiva para Ecuador, por lo que las predicciones y recomendaciones mostradas en este panel carecen de validez agronómica para este lote.
                </p>
              </div>
            </div>
          )}

          {['map','cultivos','yield','history'].includes(vistaActual) && <nav className="workspace-subnav" aria-label="Vistas de la sección">
            {(['map','cultivos'].includes(vistaActual) ? [['cultivos','Registro de parcelas'],['map','Mapa de parcelas']] : [['yield','Análisis de la parcela'],['history','Simulaciones guardadas']]).map(([id,nombre]) =>
              <button type="button" className="workspace-view-option" key={id} aria-current={vistaActual===id ? 'page' : undefined} onClick={()=>setVistaActual(id)}>{nombre}</button>)}
          </nav>}
          {vistaActual === 'asistente' && <section className="field-evidence"><h1>Asistente de la parcela</h1><p>Elige tu parcela en el selector superior para consultar su campaña.</p><button type="button" className="btn btn-secondary" onClick={()=>window.dispatchEvent(new Event('zeasys:abrir-chat'))}>Abrir conversación</button></section>}
          {vistaActual === 'scenarios' && (
            <DashboardScenario
              key={cultivoElegidoId}
              cultivoElegidoId={cultivoElegidoId}
              añoSeleccionado={añoSeleccionado}
              onNavigate={setVistaActual}
              onDashboardData={registrarScenario}
              onSelectYear={setAñoSeleccionado}
              onCropUpdated={cargarCultivos}
            />
          )}
          {vistaActual === 'climate' && (
            <DashboardClimate
              cultivoElegidoId={cultivoElegidoId}
              cultivoActivo={cultivoActivo}
              añoSeleccionado={añoSeleccionado}
              onNavigate={setVistaActual}
              onDashboardData={registrarClimate}
              onAbrirRegistroCampo={() => setRegistroCampoId(cultivoElegidoId)}
              revisionMediciones={revisionMediciones}
            />
          )}
          {vistaActual === 'yield' && (
            <DashboardYield
              revisionMediciones={revisionMediciones}
              cultivoElegidoId={cultivoElegidoId}
              añoSeleccionado={añoSeleccionado}
              onNavigate={(destino, fechaSimulacion) => {
                if (destino === 'cultivos' && fechaSimulacion === 'registro') setRegistroCampoId(cultivoElegidoId);
                if (destino === 'finance' && typeof fechaSimulacion === 'string') {
                  const añoSimulacion = Number(fechaSimulacion.slice(0, 4));
                  if (Number.isInteger(añoSimulacion) && añoSimulacion >= 2000 && añoSimulacion <= 2100) {
                    setAñoSeleccionado(añoSimulacion);
                  }
                }
                setVistaActual(destino);
              }}
              onDashboardData={registrarYield}
              onAbrirRegistroCampo={() => setRegistroCampoId(cultivoElegidoId)}
            />
          )}
          {vistaActual === 'finance' && (
            <DashboardFinance
              provinciaParcela={provinceFromLocation(cultivoActivo?.ubicacion)}
              cultivoElegidoId={cultivoElegidoId}
              añoSeleccionado={añoSeleccionado}
              onNavigate={setVistaActual}
              onDashboardData={registrarFinance}
            />
          )}
          {vistaActual === 'map' && (
            <MapPage
              cultivos={cultivos}
              setCultivoElegidoId={setCultivoElegidoId}
              setVistaActual={setVistaActual}
            />
          )}
          {vistaActual === 'simular' && (
            <Simular
              parcelaInicialId={cultivoElegidoId}
              solicitudFecha={solicitudFecha}
              consumirSolicitudFecha={setSolicitudFecha}
              cultivos={cultivos}
              onSimulationCompleted={handleSimulationCompleted}
              onNavigate={setVistaActual}
              onboardingStep={onboardingStep}
              onNextOnboardingStep={handleCompleteOnboarding}
              onSimulationContextChange={registrarSimulacion}
            />
          )}
          {vistaActual === 'history' && (
            <History
              recargarDatos={recargarDatos}
            />
          )}
          {registroCampoId !== null && (
            <Suspense fallback={<PantallaCarga mensaje="Cargando registro…" />}>
              <RegistroCampo
                cultivos={cultivos}
                initialId={registroCampoId}
                onUpdated={(id) => { if (String(id) === String(cultivoElegidoId)) setRevisionMediciones(value => value + 1); }}
                onClose={() => setRegistroCampoId(null)}
              />
            </Suspense>
          )}

          {vistaActual === 'cultivos' && (
            <Cultivos
              onCultivoChanged={handleCultivoChanged}
              onAbrirRegistroCampo={() => setRegistroCampoId(cultivoElegidoId ?? cultivos[0]?.id ?? null)}
              onboardingStep={onboardingStep}
              onNextOnboardingStep={(targetView) => handleNextOnboardingStep(2, targetView)}
            />
          )}
          {vistaActual === 'configuracion' && (
            <Configuracion
              user={user}
              setUser={setUser}
              theme={theme}
              setTheme={setTheme}
              cerrarSesion={cerrarSesion}
              cultivos={cultivos}
            />
          )}
          </Suspense>}
        </main>
      </div>

      {user && consejoPendiente && !cultivosCargando && (
        <Suspense fallback={null}>
          <ConsejoModal onClose={() => setConsejoPendiente(false)} />
        </Suspense>
      )}

      {/* Chatbot Widget */}
      {user && !chatOculto && !cultivosError && (
        <Suspense fallback={null}>
        <ChatbotWidget
          abrirAlMontar={vistaActual === 'asistente'}
          key={`chat-${ambitoChat}-${cultivoChatId || 'sin-parcela'}-${añoSeleccionado || 'sin-año'}`}
          vistaActual={vistaActual}
          usuarioId={user.id}
          cultivoElegidoId={cultivoChatId}
          añoSeleccionado={añoSeleccionado}
          contextoDashboard={contextoDashboard}
          cultivoActivo={cultivoChatActivo}
          simulacion={simulacionChat}
          onRegistrarObservacion={setRegistroCampoId}
          onSimularFecha={cultivoId => {
            setSolicitudFecha(prev => ({ cultivoId, numero: (prev?.numero ?? 0) + 1 }));
            setVistaActual('simular');
          }}
        />
        </Suspense>
      )}
    </div>
  );
}
