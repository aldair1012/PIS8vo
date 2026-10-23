import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  CloudSun,
  Leaf,
  Lock,
  MapPin,
  Mail,
  Menu,
  Moon,
  Sun,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { authService } from '../services/api';
import CornCobModel from '../templates/Common/CornCobModel';
import PlatformLogo from '../templates/Common/PlatformLogo';
import useSectionSnap from './landing/useSectionSnap';
import heroPhoto from '../assets/landing/maize-hero.png';
import yieldPhoto from '../assets/landing/yield.jpg';
import climateSoilPhoto from '../assets/landing/climate-soil.jpg';
import decisionsPhoto from '../assets/landing/field-decisions.jpg';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '200107748008-3j1itt8eobnbec6ur1n4vguj4r999k3d.apps.googleusercontent.com';
const HERO_FLIP_DURATION_MS = 1020;
const HERO_FLIP_REDUCED_DURATION_MS = 420;

function CapabilityFlipCard({ icon, tone, title, summary, details, href, linkLabel, image, imagePosition = 'center' }) {
  const [flipped, setFlipped] = useState(false);

  const handlePointerUp = (event) => {
    if (event.pointerType === 'mouse' || event.target.closest('a')) return;
    setFlipped((current) => !current);
    if (document.activeElement === event.currentTarget) event.currentTarget.blur();
  };

  return (
    <article
      className={`zeasys-capability-flip is-${tone}${flipped ? ' is-flipped' : ''}`}
      tabIndex={0}
      aria-label={`${title}. Pasa el cursor, enfoca o toca la tarjeta para conocer más.`}
      onPointerUp={handlePointerUp}
    >
      <div className="zeasys-capability-flip-inner">
        <div className="zeasys-capability-face zeasys-capability-front">
          <img className="zeasys-capability-image" src={image} alt="" style={{ objectPosition: imagePosition }} aria-hidden="true" />
          <div className={`zeasys-capability-icon is-${tone}`}>{icon}</div>
          <h3>{title}</h3>
          <p>{summary}</p>
          <span className="zeasys-capability-hint">Ver detalles <ArrowRight size={14} /></span>
        </div>
        <div className="zeasys-capability-face zeasys-capability-back">
          <span className="zeasys-capability-back-kicker">Lectura por parcela</span>
          <h3>{title}</h3>
          <ul>{details.map((detail) => <li key={detail}><CheckCircle2 size={15} /> {detail}</li>)}</ul>
          <a href={href}>{linkLabel} <ArrowRight size={14} /></a>
        </div>
      </div>
    </article>
  );
}

function AgriculturalPattern({ variant }) {
  return (
    <svg
      className={`zeasys-agro-pattern zeasys-agro-pattern--${variant}`}
      viewBox="0 0 1440 720"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g className="zeasys-field-furrows">
        <path d="M-120 704C190 510 485 492 835 716" />
        <path d="M35 716C285 548 520 543 790 716" />
        <path d="M228 720C404 592 570 590 754 720" />
        <path d="M735 720C958 520 1195 508 1535 688" />
        <path d="M864 720C1050 570 1242 558 1498 704" />
        <path d="M1016 720C1155 616 1304 608 1467 715" />
      </g>
      <g className="zeasys-maize-stalk">
        <path className="zeasys-maize-stem" d="M1211 603C1208 482 1217 330 1207 132" />
        <path d="M1209 405C1128 368 1094 316 1085 248C1152 270 1205 320 1209 405Z" />
        <path d="M1211 481C1296 435 1333 375 1332 303C1261 333 1215 392 1211 481Z" />
        <path d="M1208 302C1148 270 1122 226 1118 178C1170 195 1205 235 1208 302Z" />
        <path d="M1209 247C1263 216 1287 173 1284 127C1238 147 1211 188 1209 247Z" />
        <path className="zeasys-maize-cob" d="M1214 314C1250 297 1274 304 1285 329C1282 382 1256 414 1213 424C1207 383 1207 347 1214 314Z" />
        <path className="zeasys-maize-grain" d="M1226 324L1273 367M1220 342L1263 388M1243 316L1280 351M1217 365L1247 400" />
        <path className="zeasys-maize-tassel" d="M1207 133L1179 88M1207 133L1205 75M1207 133L1232 84M1207 133L1251 107M1207 133L1162 111" />
      </g>
    </svg>
  );
}

function AccessCard({
  registering,
  error,
  googleLoading,
  googleStatus,
  googleButtonRef,
  handleSubmit,
  handleRegisterSubmit,
  correo,
  setCorreo,
  contrasena,
  setContrasena,
  nombre,
  setNombre,
  confirmar,
  setConfirmar,
  remember,
  setRemember,
  loading,
  switchToRegister,
  switchToLogin,
  containerRef,
  className = '',
  modeAnimating = false,
  onClose,
  ariaHidden = false,
}) {
  return (
    <div ref={containerRef} id="zeasys-login-card" className={`zeasys-login-card${registering ? ' zeasys-login-card--register' : ''}${className ? ` ${className}` : ''}`} aria-hidden={ariaHidden}>
      {onClose && <button type="button" className="zeasys-auth-close" onClick={onClose} aria-label="Volver a la vista de parcela"><X size={18} /></button>}
      <div className={`zeasys-auth-mode-card${modeAnimating ? ' is-switching' : ''}`}>
        <div className="zeasys-login-card-head">
          <div className="zeasys-login-mark"><PlatformLogo variant="mark" size={44} /></div>
          <div>
            <span className="zeasys-login-overline">{registering ? 'Registro seguro' : 'Acceso seguro'}</span>
            <h2 id="access-title">{registering ? 'Crear cuenta' : 'Bienvenido a ZeaSys'}</h2>
            <p>{registering ? 'Guarda tus parcelas y consulta sus datos.' : 'Continúa al centro de decisiones de tu parcela.'}</p>
          </div>
        </div>
        {error && <div className="zeasys-login-error" role="alert">{error}</div>}
        <div className={`zeasys-google-signin${googleLoading ? ' is-loading' : ''}`} aria-busy={googleLoading}>
          {googleStatus === 'ready' ? (
            <div ref={googleButtonRef} className="zeasys-google-button-host" />
          ) : (
            <div className="zeasys-google-status" role={googleStatus === 'error' ? 'alert' : 'status'}>
              {googleStatus === 'error'
                ? 'No se pudo cargar Google. Revisa la conexión o la configuración del sitio.'
                : 'Preparando acceso con Google…'}
            </div>
          )}
          {googleLoading && <span className="zeasys-google-progress" role="status">Conectando…</span>}
        </div>
        <div className="zeasys-login-divider"><span /> <em>o con correo</em> <span /></div>
        {registering ? (
          <form onSubmit={handleRegisterSubmit} className="zeasys-login-form zeasys-register-form">
            <label><span><User size={14} /> Nombre completo</span><input type="text" placeholder="Juan Pérez" value={nombre} onChange={(event) => setNombre(event.target.value)} required /></label>
            <label><span><Mail size={14} /> Correo electrónico</span><input type="email" placeholder="tu-correo@ejemplo.com" value={correo} onChange={(event) => setCorreo(event.target.value)} required /></label>
            <div className="zeasys-register-password-grid">
              <label><span><Lock size={14} /> Contraseña</span><input type="password" placeholder="••••••••" value={contrasena} onChange={(event) => setContrasena(event.target.value)} required /></label>
              <label><span><Lock size={14} /> Confirmar</span><input type="password" placeholder="Repetir" value={confirmar} onChange={(event) => setConfirmar(event.target.value)} required /></label>
            </div>
            <button type="submit" className="zeasys-submit-btn" disabled={loading}>{loading ? 'Creando cuenta...' : <>Crear cuenta <ArrowRight size={17} /></>}</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="zeasys-login-form">
            <label><span><Mail size={14} /> Correo electrónico</span><input type="email" placeholder="tu-correo@ejemplo.com" value={correo} onChange={(event) => setCorreo(event.target.value)} required /></label>
            <label><span><Lock size={14} /> Contraseña</span><input type="password" placeholder="••••••••••••" value={contrasena} onChange={(event) => setContrasena(event.target.value)} required /></label>
            <div className="zeasys-login-options"><label className="zeasys-check-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Recordar sesión</label><button type="button" onClick={() => alert('Para restablecer su contraseña, contacte al administrador de ZeaSys.')}>¿Olvidaste tu contraseña?</button></div>
            <button type="submit" className="zeasys-submit-btn" disabled={loading}>{loading ? 'Ingresando...' : <>Iniciar sesión <ArrowRight size={17} /></>}</button>
          </form>
        )}
        <p className="zeasys-register-prompt">{registering ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'} <button type="button" onClick={registering ? switchToLogin : switchToRegister}>{registering ? 'Inicia sesión' : 'Crear cuenta'}</button></p>
      </div>
    </div>
  );
}

export default function Login({ onLoginSuccess, switchToRegister, switchToLogin, registering = false, theme = 'dark', onToggleTheme }) {
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleStatus, setGoogleStatus] = useState(GOOGLE_CLIENT_ID ? 'loading' : 'error');
  const [remember, setRemember] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [activeSection, setActiveSection] = useState('inicio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authCardOpen, setAuthCardOpen] = useState(false);
  const [authModeAnimating, setAuthModeAnimating] = useState(false);
  const googleCallbackRef = useRef(null);
  const googleInitializedRef = useRef(false);
  const googleButtonRef = useRef(null);
  const authPanelRef = useRef(null);
  const heroAccessButtonRef = useRef(null);
  const authModeSwapTimerRef = useRef(null);
  const authModeEndTimerRef = useRef(null);
  const authFocusTimerRef = useRef(null);
  const authOpenTimerRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const scrollDirectionRef = useRef('idle');
  const scrollDistanceRef = useRef(0);
  const scrollFrameRef = useRef(null);

  useSectionSnap(!authCardOpen && !mobileMenuOpen);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    const handlePageScroll = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        const currentScrollY = Math.max(window.scrollY, 0);
        const delta = currentScrollY - lastScrollYRef.current;
        const direction = delta > 0 ? 'down' : delta < 0 ? 'up' : scrollDirectionRef.current;

        if (direction !== scrollDirectionRef.current) {
          scrollDirectionRef.current = direction;
          scrollDistanceRef.current = 0;
        }
        scrollDistanceRef.current += Math.abs(delta);

        if (currentScrollY <= 20 || mobileMenuOpen) {
          setNavVisible(true);
        } else if (direction === 'up' && scrollDistanceRef.current >= 8) {
          setNavVisible(true);
          scrollDistanceRef.current = 0;
        } else if (direction === 'down' && scrollDistanceRef.current >= 36) {
          setNavVisible(false);
          scrollDistanceRef.current = 0;
        }

        lastScrollYRef.current = currentScrollY;
        scrollFrameRef.current = null;
      });
    };

    window.addEventListener('scroll', handlePageScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handlePageScroll);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const closeMobileMenu = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'resize' && window.innerWidth <= 960) return;
      setMobileMenuOpen(false);
    };
    window.addEventListener('resize', closeMobileMenu);
    document.addEventListener('keydown', closeMobileMenu);
    return () => {
      window.removeEventListener('resize', closeMobileMenu);
      document.removeEventListener('keydown', closeMobileMenu);
    };
  }, []);

  useEffect(() => {
    const sectionIds = ['inicio', 'capacidades', 'datos', 'contacto'];
    const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    let frameId = 0;

    const updateActiveSection = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        const readingLine = window.scrollY + window.innerHeight * 0.34;
        const currentSection = sections.reduce((current, section) => (
          section.offsetTop <= readingLine ? section.id : current
        ), sections[0]?.id || 'inicio');
        setActiveSection(currentSection);
        frameId = 0;
      });
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    window.addEventListener('hashchange', updateActiveSection);
    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
      window.removeEventListener('hashchange', updateActiveSection);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const handleGoogleAuth = useCallback(async (idToken) => {
    if (!GOOGLE_CLIENT_ID) {
      setError('No hay Client ID de Google configurado.');
      return;
    }
    setError(null);
    setGoogleLoading(true);
    try {
      const data = await authService.googleLogin(idToken, remember);
      onLoginSuccess(data.user);
    } catch (err) {
      const msg = err.response?.data?.message
        || (typeof err.response?.data?.error === 'string' ? err.response.data.error : 'Error al conectar con el servidor.');
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [onLoginSuccess, remember]);

  useEffect(() => {
    googleCallbackRef.current = handleGoogleAuth;
  }, [handleGoogleAuth]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return undefined;
    }
    let active = true;
    const init = () => {
      if (!active) return;
      if (!window.google?.accounts?.id) {
        setGoogleStatus('error');
        return;
      }
      try {
        if (!googleInitializedRef.current) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async (response) => {
              if (response.credential) await googleCallbackRef.current?.(response.credential);
              else setError('Error al obtener credenciales de Google.');
            },
            ux_mode: 'popup',
            auto_select: false,
          });
          googleInitializedRef.current = true;
        }
        setGoogleStatus('ready');
      } catch {
        setGoogleStatus('error');
      }
    };
    const fail = () => {
      if (active) setGoogleStatus('error');
    };
    let script = document.querySelector('script[data-google-gsi]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client?hl=es';
      script.async = true;
      script.setAttribute('data-google-gsi', 'true');
      script.addEventListener('load', init);
      script.addEventListener('error', fail);
      document.body.appendChild(script);
    } else if (window.google?.accounts?.id) {
      init();
    } else {
      script.addEventListener('load', init);
      script.addEventListener('error', fail);
    }
    const timeout = window.setTimeout(() => {
      if (!window.google?.accounts?.id) fail();
    }, 10000);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      script.removeEventListener('load', init);
      script.removeEventListener('error', fail);
    };
  }, []);

  useEffect(() => {
    if (!authCardOpen || googleStatus !== 'ready') return undefined;
    const host = googleButtonRef.current;
    if (!host || !window.google?.accounts?.id) return undefined;

    let renderedWidth = 0;
    const render = () => {
      const width = Math.min(400, Math.floor(host.clientWidth));
      if (width < 100 || (width === renderedWidth && host.hasChildNodes())) return;
      try {
        host.replaceChildren();
        window.google.accounts.id.renderButton(host, {
          type: 'standard',
          theme: theme === 'dark' ? 'outline_dark' : 'outline',
          size: 'large',
          text: registering ? 'signup_with' : 'continue_with',
          shape: 'rectangular',
          width,
          locale: 'es',
        });
        renderedWidth = width;
      } catch {
        setGoogleStatus('error');
      }
    };

    const frame = window.requestAnimationFrame(render);
    window.addEventListener('resize', render);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', render);
    };
  }, [authCardOpen, googleStatus, registering, theme]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authService.login(correo, contrasena, remember);
      onLoginSuccess(data.user);
    } catch (err) {
      const msg = err.response?.data?.message
        || (typeof err.response?.data?.error === 'string' ? err.response.data.error : null)
        || 'Error al conectar con el servidor.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (contrasena !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const data = await authService.register(nombre, correo, contrasena, confirmar);
      onLoginSuccess(data.user);
    } catch (err) {
      const msg = err.response?.data?.message
        || (typeof err.response?.data?.error === 'string' ? err.response.data.error : null)
        || 'Error al conectar con el servidor.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const openRegister = () => {
    setError(null);
    setLoading(false);
    switchToRegister?.();
  };

  const openLogin = () => {
    setError(null);
    setLoading(false);
    switchToLogin?.();
  };

  const clearAuthTimers = useCallback(() => {
    [authModeSwapTimerRef, authModeEndTimerRef, authFocusTimerRef, authOpenTimerRef].forEach((timerRef) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    });
  }, []);

  const closeAccess = useCallback(() => {
    clearAuthTimers();
    setAuthModeAnimating(false);
    setAuthCardOpen(false);
    setError(null);
    setLoading(false);
    switchToLogin?.();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    authFocusTimerRef.current = window.setTimeout(() => {
      heroAccessButtonRef.current?.focus({ preventScroll: true });
      authFocusTimerRef.current = null;
    }, reducedMotion ? HERO_FLIP_REDUCED_DURATION_MS : HERO_FLIP_DURATION_MS);
  }, [clearAuthTimers, switchToLogin]);

  useEffect(() => clearAuthTimers, [clearAuthTimers]);

  useEffect(() => {
    if (!authCardOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closeAccess();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [authCardOpen, closeAccess]);

  const focusAuthForm = useCallback((delay = 0) => {
    if (authFocusTimerRef.current !== null) window.clearTimeout(authFocusTimerRef.current);
    authFocusTimerRef.current = window.setTimeout(() => {
      authPanelRef.current?.querySelector('input:not([type="checkbox"])')?.focus({ preventScroll: true });
      authFocusTimerRef.current = null;
    }, delay);
  }, []);

  const switchAuthMode = (nextMode) => {
    const wantsRegister = nextMode === 'register';
    if (authModeAnimating || registering === wantsRegister) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const modeDuration = reducedMotion ? 380 : 760;
    const contentSwapDelay = Math.round(modeDuration * 0.48);

    setAuthModeAnimating(true);
    setError(null);
    authModeSwapTimerRef.current = window.setTimeout(() => {
      if (wantsRegister) openRegister();
      else openLogin();
      authModeSwapTimerRef.current = null;
    }, contentSwapDelay);
    authModeEndTimerRef.current = window.setTimeout(() => {
      setAuthModeAnimating(false);
      authModeEndTimerRef.current = null;
      focusAuthForm();
    }, modeDuration);
  };

  const irAlAcceso = () => {
    clearAuthTimers();
    setAuthModeAnimating(false);
    openLogin();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const heroSection = document.getElementById('inicio');
    const heroBounds = heroSection?.getBoundingClientRect();
    const needsScroll = Boolean(heroBounds && (heroBounds.bottom < 160 || heroBounds.top > window.innerHeight - 160));
    const revealDelay = needsScroll ? (reducedMotion ? 140 : 460) : 34;
    const flipDuration = reducedMotion ? HERO_FLIP_REDUCED_DURATION_MS : HERO_FLIP_DURATION_MS;

    if (authCardOpen) {
      focusAuthForm();
      return;
    }

    setAuthCardOpen(false);
    if (needsScroll) heroSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // A short two-frame pause guarantees that the browser paints the front face
    // before applying the 180-degree state, so the transition is always visible.
    authOpenTimerRef.current = window.setTimeout(() => {
      setAuthCardOpen(true);
      authOpenTimerRef.current = null;
    }, revealDelay);
    focusAuthForm(revealDelay + flipDuration);
  };

  const closeMenu = () => setMobileMenuOpen(false);
  const openAccessFromMenu = () => {
    closeMenu();
    irAlAcceso();
  };

  return (
    <div className={`zeasys-home zeasys-home--${theme}`}>
      <a className="zeasys-skip-link" href="#contenido-principal">Saltar al contenido principal</a>
      <header className={`zeasys-home-nav ${navVisible || mobileMenuOpen ? 'is-visible' : 'is-hidden'}${mobileMenuOpen ? ' has-open-menu' : ''}`}>
        <a className="zeasys-home-brand" href="#inicio" aria-label="ZeaSys, inicio"><PlatformLogo variant="wordmark" size={36} /></a>
        <nav id="zeasys-mobile-navigation" className={`zeasys-home-links${mobileMenuOpen ? ' is-open' : ''}`} aria-label="Navegación principal">
          <a className={activeSection === 'inicio' ? 'is-active' : undefined} aria-current={activeSection === 'inicio' ? 'page' : undefined} href="#inicio" onClick={closeMenu}>Inicio</a><a className={activeSection === 'capacidades' ? 'is-active' : undefined} aria-current={activeSection === 'capacidades' ? 'page' : undefined} href="#capacidades" onClick={closeMenu}>Capacidades</a><a className={activeSection === 'datos' ? 'is-active' : undefined} aria-current={activeSection === 'datos' ? 'page' : undefined} href="#datos" onClick={closeMenu}>Datos y modelos</a><a className={activeSection === 'contacto' ? 'is-active' : undefined} aria-current={activeSection === 'contacto' ? 'page' : undefined} href="#contacto" onClick={closeMenu}>Contacto</a>
          <button type="button" className="zeasys-mobile-login" onClick={openAccessFromMenu} aria-controls="zeasys-login-card" aria-expanded={authCardOpen}>Ingresar <ArrowRight size={16} /></button>
        </nav>
        <div className="zeasys-home-nav-actions"><button type="button" className="zeasys-theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><button type="button" className="zeasys-nav-login" onClick={irAlAcceso} aria-controls="zeasys-login-card" aria-expanded={authCardOpen}>Ingresar <ArrowRight size={15} /></button><button type="button" className="zeasys-mobile-menu-toggle" onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen} aria-controls="zeasys-mobile-navigation" aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}>{mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}</button></div>
      </header>

      <main id="contenido-principal">
        <section
          id="inicio"
          className="zeasys-home-hero"
          style={{ '--hero-photo': `url("${heroPhoto}")` }}
        >
          <div className="zeasys-home-hero-copy">
            <h1>Decisiones mejores para <span>cada parcela.</span></h1>
            <p className="zeasys-home-lead">ZeaSys reúne clima, suelo, rendimiento y finanzas para entender qué está pasando en tu cultivo y actuar a tiempo.</p>
            <div className="zeasys-hero-actions"><button type="button" className="zeasys-primary-btn" onClick={() => document.getElementById('capacidades')?.scrollIntoView({ behavior: 'smooth' })}>Ver capacidades <ArrowRight size={17} /></button><button ref={heroAccessButtonRef} type="button" className="zeasys-secondary-link zeasys-secondary-button" onClick={irAlAcceso} aria-controls="zeasys-login-card" aria-expanded={authCardOpen}>Ingresar <ArrowRight size={15} /></button></div>
          </div>
          <div className="zeasys-hero-visual">
            <div className={`zeasys-hero-flip${authCardOpen ? ' is-open' : ''}${registering ? ' is-registering' : ''}`}>
              <div className="zeasys-hero-flip-inner">
                <div className="zeasys-hero-flip-face zeasys-hero-flip-front" aria-hidden={authCardOpen}>
                  <div className="zeasys-visual-heading"><span>Vista de parcela</span><h2>La señal del campo, en una sola lectura.</h2><p>Rendimiento, clima y brecha productiva con datos del sistema.</p></div>
                  <div className="zeasys-dashboard-preview">
                    <div className="zeasys-preview-topline"><span><Leaf size={14} /> Parcela monitoreada</span><span className="zeasys-status-pill"><span /> Datos sincronizados</span></div>
                    <div className="zeasys-preview-location"><MapPin size={13} /> Finca La Esperanza <small>·</small> Lote MZ-04</div>
                    <div className="zeasys-preview-main-kpi"><div><span>Rendimiento previsto</span><strong>3.26 <small>t/ha</small></strong></div><div className="zeasys-kpi-up"><TrendingUp size={16} /> +8.4%</div></div>
                    <div className="zeasys-preview-chart" aria-hidden="true"><span className="chart-bar chart-bar-1" /><span className="chart-bar chart-bar-2" /><span className="chart-bar chart-bar-3" /><span className="chart-bar chart-bar-4" /><span className="chart-bar chart-bar-5" /><span className="chart-bar chart-bar-6" /><span className="chart-line" /></div>
                    <div className="zeasys-preview-grid"><div><span><CloudSun size={13} /> Riesgo climático</span><strong>Moderado</strong><em>Con datos locales</em></div><div><span><Activity size={13} /> Brecha productiva</span><strong>27%</strong><em>Oportunidad de mejora</em></div></div>
                    <div className="zeasys-preview-meta"><span>Última lectura <strong>Hoy, 08:40</strong></span><span>Ciclo <strong>Maíz 2026</strong></span></div>
                  </div>
                </div>
                <AccessCard
                  containerRef={authPanelRef}
                  className="zeasys-hero-flip-face zeasys-hero-auth-back"
                  modeAnimating={authModeAnimating}
                  onClose={closeAccess}
                  ariaHidden={!authCardOpen}
                  registering={registering}
                  error={error}
                  googleLoading={googleLoading}
                  googleStatus={googleStatus}
                  googleButtonRef={googleButtonRef}
                  handleSubmit={handleSubmit}
                  handleRegisterSubmit={handleRegisterSubmit}
                  correo={correo}
                  setCorreo={setCorreo}
                  nombre={nombre}
                  setNombre={setNombre}
                  contrasena={contrasena}
                  setContrasena={setContrasena}
                  confirmar={confirmar}
                  setConfirmar={setConfirmar}
                  remember={remember}
                  setRemember={setRemember}
                  loading={loading}
                  switchToRegister={() => switchAuthMode('register')}
                  switchToLogin={() => switchAuthMode('login')}
                />
              </div>
            </div>
          </div>
        </section>

        <section id="capacidades" className="zeasys-capabilities-section">
          <AgriculturalPattern variant="capabilities" />
          <div className="zeasys-section-heading">
            <div><span className="zeasys-section-kicker">Una mirada completa del lote</span><h2>De la señal del campo a una acción clara.</h2></div>
            <p>Menos intuición aislada. Más contexto para decidir riego, manejo, siembra y rentabilidad.</p>
          </div>
          <div className="zeasys-capability-grid">
            <CapabilityFlipCard
              tone="green"
              image={yieldPhoto}
              imagePosition="58% center"
              icon={<BarChart3 size={21} />}
              title="Rendimiento y brecha"
              summary="Compara el potencial genético, el rendimiento alcanzable y lo que realmente puede entregar tu parcela."
              details={['Potencial y rendimiento alcanzable', 'Brecha productiva por parcela', 'Escenarios comparables de manejo']}
              href="#datos"
              linkLabel="Ver indicadores"
            />
            <CapabilityFlipCard
              tone="blue"
              image={climateSoilPhoto}
              imagePosition="center 58%"
              icon={<CloudSun size={21} />}
              title="Clima y suelo"
              summary="Integra señales meteorológicas y edáficas para anticipar estrés hídrico, riesgos y ventanas de manejo."
              details={['Clima vinculado a la parcela', 'Agua útil y condiciones del suelo', 'Alertas para anticipar riesgos']}
              href="#datos"
              linkLabel="Explorar datos"
            />
            <CapabilityFlipCard
              tone="warm"
              image={decisionsPhoto}
              imagePosition="center"
              icon={<ClipboardCheck size={21} />}
              title="Decisiones explicadas"
              summary="Consulta un indicador y recibe una explicación clara conectada con los datos visibles de tu parcela."
              details={['Contexto específico de la parcela', 'Fuentes y estimaciones identificadas', 'Acciones claras y verificables']}
              href="#contacto"
              linkLabel="Ver cómo se explica"
            />
          </div>
        </section>

        <section id="datos" className="zeasys-data-section">
          <AgriculturalPattern variant="data" />
          <div className="zeasys-data-card zeasys-data-card--with-model">
            <div className="zeasys-data-card-copy">
              <span className="zeasys-section-kicker">Diseñado para datos, no para suposiciones</span>
              <h2>Una fuente de verdad para cada decisión agrícola.</h2>
              <p>Visualiza la procedencia de tus datos, separa valores reales de estimaciones y entiende qué factor está limitando el rendimiento.</p>
              <ul><li><CheckCircle2 size={17} /> Valores con fuente y estado de disponibilidad</li><li><CheckCircle2 size={17} /> Escenarios comparables antes de cambiar una práctica</li><li><CheckCircle2 size={17} /> Explicaciones con el contexto de tu parcela</li></ul>
            </div>
            <figure className="zeasys-corn-model" aria-label="Modelo tridimensional de una mazorca de maíz">
              <CornCobModel />
              <figcaption><span>Objeto de estudio</span><strong>Maíz · Zea mays</strong></figcaption>
            </figure>
          </div>
        </section>

      </main>

      <footer id="contacto" className="zeasys-home-footer">
        <div className="zeasys-footer-main">
          <div className="zeasys-footer-brand">
            <a className="zeasys-home-brand" href="#inicio" aria-label="ZeaSys, inicio"><PlatformLogo variant="wordmark" size={34} /></a>
            <p>Sistema de apoyo a decisiones agrícolas que reúne datos de campo, predicciones y contexto productivo en una sola lectura.</p>
            <address className="zeasys-footer-contact"><span><MapPin size={14} /> Ecuador</span><a href="mailto:zeasys123@gmail.com"><Mail size={14} /> zeasys123@gmail.com</a></address>
            <div className="zeasys-footer-status"><span /> Servicios operativos · Motor XGBoost</div>
          </div>
          <div className="zeasys-footer-column"><h3>Plataforma</h3><a href="#inicio">Inicio</a><a href="#capacidades">Capacidades</a><a href="#datos">Datos y modelos</a></div>
          <div className="zeasys-footer-column"><h3>Producto</h3><a href="#inicio">Vista de parcela</a><a href="#capacidades">Decisiones explicadas</a><button type="button" onClick={irAlAcceso}>Ingresar a ZeaSys</button></div>
          <div className="zeasys-footer-column"><h3>Soporte</h3><a href="mailto:zeasys123@gmail.com?subject=Ayuda%20con%20ZeaSys">Centro de ayuda</a><a href="mailto:zeasys123@gmail.com?subject=Consulta%20sobre%20ZeaSys">Contacto</a><span>Privacidad y uso responsable de datos</span></div>
        </div>
        <div className="zeasys-footer-bottom"><span>© {new Date().getFullYear()} ZeaSys. Todos los derechos reservados.</span><span>Datos claros · Decisiones agrícolas responsables</span></div>
      </footer>
    </div>
  );
}
