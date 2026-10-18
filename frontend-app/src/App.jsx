import { useCallback, useState, useEffect } from 'react';
import Sidebar from './templates/Common/Sidebar';
import Navbar from './templates/Common/Navbar';
import Login from './views/Login';
import Register from './views/Register';
import DashboardScenario from './views/DashboardScenario';
import DashboardClimate from './views/DashboardClimate';
import DashboardYield from './views/DashboardYield';
import DashboardFinance from './views/DashboardFinance';
import Cultivos from './views/Cultivos';
import Simular from './views/Simular';
import History from './views/History';
import MapPage from './views/MapPage';
import Configuracion from './views/Configuracion';

import ChatbotWidget from './components/ChatbotWidget';
import { AlertTriangle } from 'lucide-react';
import { authService, cultivosService, simulacionService } from './services/api';
import './assets/styles.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Estados del diseño (Layout)
  const [vistaActual, setVistaActual] = useState('yield');
  const [cultivos, setCultivos] = useState([]);
  const [cultivoElegidoId, setCultivoElegidoId] = useState(null);
  const [anioSeleccionado, setAnioSeleccionado] = useState(() => new Date().getFullYear());
  const [contextoDashboard, setContextoDashboard] = useState(null);
  const [iaEncendida, setIaEncendida] = useState(false);
  const [recargarDatos, setRecargarDatos] = useState(0);
  const [menuCerrado, setMenuCerrado] = useState(typeof window !== 'undefined' && window.innerWidth <= 1080);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [notificationDismissedFor, setNotificationDismissedFor] = useState(null);
  const showNotification = Boolean(
    user &&
    notificationDismissedFor !== user.id &&
    localStorage.getItem('hideChartInfoNotify') !== 'true'
  );
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

  // Aplicar tema
  useEffect(() => {
    if (user) {
      document.body.classList.toggle('light-theme', theme === 'light');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme, user]);

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
    async function checkAuth() {
      try {
        const data = await authService.me();
        if (data.authenticated) {
          setUser(data.user);
        }
      } catch (err) {
        console.error('Session validation failed:', err);
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  const [onboardingStep, setOnboardingStep] = useState(0);

  // Obtener parcelas y verificar el servicio de IA cuando el usuario está logueado
  const cargarCultivos = useCallback(async () => {
    try {
      const data = await cultivosService.listar();
      setCultivos(data);
      const isDone = user?.id ? localStorage.getItem(`onboarding_done_${user.id}`) === 'true' : false;

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
      console.error('Error fetching crops:', err);
    }
  }, [cultivoElegidoId, user]);

  const revisarEstadoIa = useCallback(async () => {
    try {
      const data = await simulacionService.iaStatus();
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
    if (!datos || typeof datos !== 'object') return;
    setContextoDashboard({ vista, datos, cultivoId: cultivoElegidoId, anio: anioSeleccionado });
  }, [cultivoElegidoId, anioSeleccionado]);
  const registrarScenario = useCallback((datos) => registrarContextoDashboard('scenarios', datos), [registrarContextoDashboard]);
  const registrarClimate = useCallback((datos) => registrarContextoDashboard('climate', datos), [registrarContextoDashboard]);
  const registrarYield = useCallback((datos) => registrarContextoDashboard('yield', datos), [registrarContextoDashboard]);
  const registrarFinance = useCallback((datos) => registrarContextoDashboard('finance', datos), [registrarContextoDashboard]);

  const cerrarSesion = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.warn('Sesión finalizada:', err);
    } finally {
      setUser(null);
      setCultivos([]);
      setCultivoElegidoId(null);
      setVistaActual('yield');
      setOnboardingStep(0);
      setIsRegistering(false);
    }
  };

  const handleLoginSuccess = (u) => {
    setUser(u);
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
      localStorage.setItem(`onboarding_done_${user.id}`, 'true');
    }
    setOnboardingStep(0);
    setVistaActual('yield');
  };

  const handleSimulationCompleted = () => {
    // Incrementar disparador para recargar listas de historial
    setRecargarDatos(prev => prev + 1);
  };

  const handleCultivoChanged = () => {
    cargarCultivos();
  };

  if (!authChecked) {
    return <div className="flex-center" style={{ height: '100vh', background: 'var(--background)', color: 'var(--text-muted)' }}>Validando sesión de ZeaSys...</div>;
  }

  if (!user) {
    if (isRegistering) {
      return (
        <Register
          onRegisterSuccess={handleLoginSuccess}
          switchToLogin={() => setIsRegistering(false)}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        switchToRegister={() => setIsRegistering(true)}
      />
    );
  }

  // Determinar título de pestaña, Dashboard
  const getActiveTitle = () => {
    switch (vistaActual) {
      case 'yield': return 'DSS 1: Brecha Productiva y Potencial';
      case 'scenarios': return 'DSS 2: Calendario de Viabilidad de Siembra';
      case 'climate': return 'DSS 3: Calendario Fenológico y Riesgo Climático';
      case 'finance': return 'DSS 4: Viabilidad Financiera & ROI';
      case 'map': return 'Mapa de Lotes';
      case 'simular': return 'Nueva Simulación';
      case 'history': return 'Historial de Simulaciones';
      case 'configuracion': return 'Configuración de Usuario y Sistema';
      default: return 'ZeaSys Engine';
    }
  };


  return (
    <div className="app-container">
      {/* Ambient background glow blobs for premium glassmorphism */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>
      <div className="ambient-glow-3"></div>

      {/* Sidebar Navigation */}
      <Sidebar
        vistaActual={vistaActual}
        setVistaActual={setVistaActual}
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
        <Navbar
          title={getActiveTitle()}
          cultivos={cultivos}
          cultivoElegidoId={cultivoElegidoId}
          setCultivoElegidoId={setCultivoElegidoId}
          anioSeleccionado={anioSeleccionado}
          setAnioSeleccionado={setAnioSeleccionado}
          user={user}
          iaEncendida={iaEncendida}
          menuCerrado={menuCerrado}
          setMenuCerrado={setMenuCerrado}
          vistaActual={vistaActual}
          setVistaActual={setVistaActual}
        />

        <div
          className="content-body"
          style={['map', 'cultivos'].includes(vistaActual) ? {
            minHeight: isMobileView ? 'auto' : 'calc(100vh - 64px)',
            height: isMobileView ? 'auto' : 'calc(100vh - 64px)',
            overflowY: isMobileView ? 'auto' : 'hidden',
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

          {vistaActual === 'scenarios' && (
            <DashboardScenario
              cultivoElegidoId={cultivoElegidoId}
              anioSeleccionado={anioSeleccionado}
              onNavigate={setVistaActual}
              onDashboardData={registrarScenario}
            />
          )}
          {vistaActual === 'climate' && (
            <DashboardClimate
              cultivoElegidoId={cultivoElegidoId}
              anioSeleccionado={anioSeleccionado}
              onNavigate={setVistaActual}
              onDashboardData={registrarClimate}
            />
          )}
          {vistaActual === 'yield' && (
            <DashboardYield
              cultivoElegidoId={cultivoElegidoId}
              anioSeleccionado={anioSeleccionado}
              onNavigate={setVistaActual}
              onDashboardData={registrarYield}
            />
          )}
          {vistaActual === 'finance' && (
            <DashboardFinance
              cultivoElegidoId={cultivoElegidoId}
              anioSeleccionado={anioSeleccionado}
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
              cultivos={cultivos}
              onSimulationCompleted={handleSimulationCompleted}
              onboardingStep={onboardingStep}
              onNextOnboardingStep={handleCompleteOnboarding}
              onNavigate={setVistaActual}
            />
          )}
          {vistaActual === 'history' && (
            <History
              recargarDatos={recargarDatos}
            />
          )}
          {vistaActual === 'cultivos' && (
            <Cultivos
              onCultivoChanged={handleCultivoChanged}
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
        </div>
      </div>

      {showNotification && (
        <div className="info-modal-overlay" style={{ zIndex: 99999 }}>
          <div className="info-modal-panel" style={{
            width: '100%',
            maxWidth: '430px',
            padding: '2rem 1.75rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.1rem'
          }}>
            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              boxShadow: '0 8px 16px rgba(34, 197, 94, 0.1)'
            }}>
              💡
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: 'var(--modal-text)' }}>
                ZeaSys Analytics
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--modal-text-muted)', lineHeight: '1.55', margin: 0 }}>
                Si deseas ver un diagnóstico técnico detallado sobre cualquiera de los gráficos o métricas del sistema, simplemente <strong>haz clic sobre ellos</strong> para abrir de forma directa el panel de análisis avanzado.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setNotificationDismissedFor(user?.id)}
                className="btn-primary"
                style={{ 
                  padding: '0.65rem', 
                  fontSize: '0.82rem', 
                  borderRadius: '10px', 
                  cursor: 'pointer', 
                  fontWeight: 600,
                  width: '100%'
                }}
              >
                Entendido, Continuar
              </button>
              <button 
                onClick={() => {
                  localStorage.setItem('hideChartInfoNotify', 'true');
                  setNotificationDismissedFor(user?.id);
                }}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-subtle)', 
                  fontSize: '0.72rem', 
                  cursor: 'pointer', 
                  padding: '0.45rem', 
                  textDecoration: 'underline',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-subtle)'}
              >
                No volver a mostrar este mensaje
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot Widget */}
      {user && (
        <ChatbotWidget
          key={`chat-${vistaActual}-${cultivoElegidoId || 'sin-parcela'}-${anioSeleccionado || 'sin-anio'}`}
          vistaActual={vistaActual}
          usuarioId={user.id}
          cultivoElegidoId={cultivoElegidoId}
          anioSeleccionado={anioSeleccionado}
          contextoDashboard={contextoDashboard}
          cultivoActivo={cultivoActivo}
        />
      )}
    </div>
  );
}
