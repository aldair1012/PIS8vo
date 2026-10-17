import React, { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import { Lock, Mail, ArrowRight, ShieldCheck, Activity, Cpu, CloudSun, DollarSign, TrendingUp } from 'lucide-react';
import PlatformLogo from '../templates/Common/PlatformLogo';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '200107748008-3j1itt8eobnbec6ur1n4vguj4r999k3d.apps.googleusercontent.com';

// Botón de Google personalizado que sigue la estética de la marca (#6A3FA0 -> #4D7BFF)
function GoogleBtn({ onClick, loading, label = 'Continuar con Google' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '0.8rem 1.2rem',
        background: loading ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(77, 123, 255, 0.25)',
        borderRadius: '16px',
        color: '#ffffff',
        fontSize: '0.9rem',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: loading ? 0.6 : 1,
        fontFamily: 'inherit',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      }}
      onMouseEnter={e => {
        if (!loading) {
          e.currentTarget.style.background = 'rgba(77, 123, 255, 0.12)';
          e.currentTarget.style.borderColor = 'rgba(77, 123, 255, 0.5)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(77, 123, 255, 0.2)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        e.currentTarget.style.borderColor = 'rgba(77, 123, 255, 0.25)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.25)';
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {loading ? 'Conectando...' : label}
    </button>
  );
}

export default function Login({ onLoginSuccess, switchToRegister }) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  const handleGoogleAuth = useCallback(async (idToken) => {
    if (!GOOGLE_CLIENT_ID) { setError('No hay Client ID de Google configurado.'); return; }
    setError(null);
    setGoogleLoading(true);
    try {
      const data = await authService.googleLogin(idToken, remember);
      onLoginSuccess(data.user);
    } catch (err) {
      const msg = err.response?.data?.message || (typeof err.response?.data?.error === 'string' ? err.response?.data?.error : 'Error al conectar con el servidor.');
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [remember, onLoginSuccess]);

  const triggerGoogleSignIn = useCallback(() => {
    if (!window.google?.accounts?.id) { 
      setError('Google Sign-In no está disponible aún. Recarga la página.'); 
      return; 
    }
    try {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const hiddenBtn = document.querySelector('#google-hidden-btn div[role="button"]');
          if (hiddenBtn) {
            hiddenBtn.click();
          }
        }
      });
    } catch (e) {
      console.warn("Google prompt error", e);
    }
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const init = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (response.credential) { await handleGoogleAuth(response.credential); }
          else { setError('Error al obtener credenciales de Google.'); }
        },
        ux_mode: 'popup',
        auto_select: false
      });

      const hiddenContainer = document.getElementById('google-hidden-btn');
      if (hiddenContainer) {
        hiddenContainer.innerHTML = '';
        window.google.accounts.id.renderButton(
          hiddenContainer,
          { theme: 'outline', size: 'large', type: 'standard' }
        );
      }
    };
    if (!document.querySelector('script[data-google-gsi]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true; script.defer = true;
      script.setAttribute('data-google-gsi', 'true');
      script.onload = init;
      document.body.appendChild(script);
    } else if (window.google?.accounts?.id) { init(); }
  }, [handleGoogleAuth]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const data = await authService.login(correo, contrasena, remember);
      onLoginSuccess(data.user);
    } catch (err) {
      const msg = err.response?.data?.message || (typeof err.response?.data?.error === 'string' ? err.response?.data?.error : null) || 'Error al conectar con el servidor.';
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      background: '#10191C',
      color: '#ffffff',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      
      {/* ==========================================
          LEFT HERO SECTION (60% Desktop Split)
         ========================================== */}
      <div className="auth-side-panel" style={{
        width: '60%',
        height: '100vh',
        maxHeight: '100vh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '2rem 3rem 1.75rem 3rem',
        overflow: 'hidden',
        borderRight: '1px solid rgba(77, 123, 255, 0.15)',
        background: '#10191C',
        boxSizing: 'border-box'
      }}>
        {/* Background Aerial Drone Image with Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url('/images/corn_field_tech.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.38,
          filter: 'brightness(0.7) contrast(1.15)',
          zIndex: 0
        }} />

        {/* Dark Radial Gradient & Tech Overlays */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 30% 40%, rgba(16, 25, 28, 0.5) 0%, rgba(16, 25, 28, 0.95) 90%)',
          zIndex: 1
        }} />

        {/* Ambient Brand Glows (Electric Blue & Purple ONLY) */}
        <div style={{ position: 'absolute', top: '5%', left: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(106, 63, 160, 0.35) 0%, transparent 70%)', filter: 'blur(70px)', zIndex: 1, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '10%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(77, 123, 255, 0.25) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 1, pointerEvents: 'none' }} />

        {/* Futuristic Overlay Grid / GIS Network Lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15, zIndex: 1, pointerEvents: 'none' }}>
          <defs>
            <pattern id="gis-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#4D7BFF" strokeWidth="0.75" strokeDasharray="3,3" />
              <circle cx="60" cy="60" r="1.5" fill="#6A3FA0" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gis-grid)" />
          {/* Polygons / AI nodes */}
          <polygon points="120,180 320,140 450,260 220,310" fill="rgba(77, 123, 255, 0.04)" stroke="#4D7BFF" strokeWidth="1.2" strokeDasharray="4,4" />
          <polygon points="480,300 720,240 850,420 580,480" fill="rgba(106, 63, 160, 0.05)" stroke="#6A3FA0" strokeWidth="1.5" />
          <circle cx="320" cy="140" r="4" fill="#4D7BFF" />
          <circle cx="720" cy="240" r="4" fill="#6A3FA0" />
        </svg>

        {/* Top Header Tag */}
        <div style={{ zIndex: 2, position: 'relative' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            background: 'rgba(106, 63, 160, 0.18)',
            border: '1px solid rgba(106, 63, 160, 0.4)',
            backdropFilter: 'blur(10px)'
          }}>
            <Cpu size={13} color="#4D7BFF" />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Decision Support System • Enterprise
            </span>
          </div>
        </div>

        {/* Center Main Hero Typography & Floating KPI Glass Cards */}
        <div style={{ zIndex: 2, position: 'relative', margin: 'auto 0', maxWidth: '680px' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            lineHeight: 1.12,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            marginBottom: '0.85rem'
          }}>
            Decisiones inteligentes{' '}
            <span style={{
              background: 'linear-gradient(135deg, #6A3FA0 0%, #4D7BFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}>
              para tu cultivo
            </span>
          </h1>

          <p style={{
            fontSize: '0.92rem',
            lineHeight: 1.55,
            color: 'rgba(255, 255, 255, 0.75)',
            fontWeight: 400,
            marginBottom: '1.75rem',
            maxWidth: '600px'
          }}>
            Predicción de rendimiento, simulación de escenarios, análisis climático y apoyo inteligente para la toma de decisiones agrícolas.
          </p>

          {/* Floating Glassmorphism Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            {/* Card 1: Estimated Yield */}
            <div style={{
              background: 'rgba(16, 25, 28, 0.65)',
              border: '1px solid rgba(77, 123, 255, 0.2)',
              backdropFilter: 'blur(16px)',
              borderRadius: '14px',
              padding: '0.85rem 1rem',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem'
            }}>
              <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'rgba(77, 123, 255, 0.15)', border: '1px solid rgba(77, 123, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={18} color="#4D7BFF" />
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Rendimiento Estimado</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', marginTop: '1px' }}>9.7 <span style={{ fontSize: '0.72rem', color: '#4D7BFF', fontWeight: 600 }}>t/ha</span></div>
              </div>
            </div>

            {/* Card 2: Climate Risk */}
            <div style={{
              background: 'rgba(16, 25, 28, 0.65)',
              border: '1px solid rgba(106, 63, 160, 0.25)',
              backdropFilter: 'blur(16px)',
              borderRadius: '14px',
              padding: '0.85rem 1rem',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem'
            }}>
              <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'rgba(106, 63, 160, 0.18)', border: '1px solid rgba(106, 63, 160, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloudSun size={18} color="#6A3FA0" />
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Riesgo Climático</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', marginTop: '1px' }}>Bajo <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>(Monitoreado)</span></div>
              </div>
            </div>

            {/* Card 3: Water Stress */}
            <div style={{
              background: 'rgba(16, 25, 28, 0.65)',
              border: '1px solid rgba(77, 123, 255, 0.2)',
              backdropFilter: 'blur(16px)',
              borderRadius: '14px',
              padding: '0.85rem 1rem',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem'
            }}>
              <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'rgba(77, 123, 255, 0.15)', border: '1px solid rgba(77, 123, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={18} color="#4D7BFF" />
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Estrés Hídrico</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', marginTop: '1px' }}>12% <span style={{ fontSize: '0.72rem', color: '#4D7BFF', fontWeight: 600 }}>Óptimo</span></div>
              </div>
            </div>

            {/* Card 4: Financial Projection */}
            <div style={{
              background: 'rgba(16, 25, 28, 0.65)',
              border: '1px solid rgba(106, 63, 160, 0.25)',
              backdropFilter: 'blur(16px)',
              borderRadius: '14px',
              padding: '0.85rem 1rem',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem'
            }}>
              <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'rgba(106, 63, 160, 0.18)', border: '1px solid rgba(106, 63, 160, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={18} color="#6A3FA0" />
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Margen Neto Proyectado</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', marginTop: '1px' }}>$319.48 <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>/ha</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Statistics Row */}
        <div style={{
          zIndex: 2,
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', color: '#22c55e', height: '1.35rem', marginBottom: '2px' }}>
              <ShieldCheck size={20} />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '1px' }}>Modelos de simulación confiables</div>
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>1,240</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '1px' }}>Parcelas simuladas</div>
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4D7BFF', fontFamily: 'var(--font-mono)' }}>+18%</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '1px' }}>Incremento estimado</div>
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#6A3FA0', fontFamily: 'var(--font-mono)' }}>IA</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '1px' }}>Modelos predictivos</div>
          </div>
        </div>

      </div>

      {/* ==========================================
          RIGHT LOGIN PANEL (40% Desktop Split)
         ========================================== */}
      <div style={{
        width: '40%',
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 2.5rem',
        background: '#10191C',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* Floating Glass Panel */}
        <div style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(16, 25, 28, 0.85)',
          border: '1px solid rgba(77, 123, 255, 0.18)',
          borderRadius: '20px',
          padding: '2rem 2rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          boxSizing: 'border-box'
        }}>
          
          {/* Official Large ZeaSys Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <PlatformLogo size={95} />
          </div>

          {/* Header Title */}
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.25rem' }}>
              Bienvenido nuevamente
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem' }}>
              Accede a la plataforma de simulación agrícola.
            </p>
          </div>

          {error && (
            <div style={{
              padding: '0.6rem 0.85rem',
              borderRadius: '10px',
              fontSize: '0.78rem',
              marginBottom: '1rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              lineHeight: 1.35
            }}>
              {error}
            </div>
          )}

          {/* Official Brand Styled Google Button */}
          <GoogleBtn onClick={triggerGoogleSignIn} loading={googleLoading} label="Continuar con Google" />
          <div id="google-hidden-btn" style={{ display: 'none' }}></div>

          {/* Divider */}
          <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
            <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '0.72rem', fontWeight: 500 }}>o con correo</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.35rem'
              }}>
                <Mail size={12} color="#4D7BFF" /> Correo Electrónico
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="usuario@zeasys.com"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.9rem',
                  fontSize: '0.85rem',
                  borderRadius: '12px',
                  background: 'rgba(10, 15, 18, 0.8)',
                  border: '1px solid rgba(77, 123, 255, 0.2)',
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.35rem'
              }}>
                <Lock size={12} color="#6A3FA0" /> Contraseña
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={contrasena}
                onChange={e => setContrasena(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.9rem',
                  fontSize: '0.85rem',
                  borderRadius: '12px',
                  background: 'rgba(10, 15, 18, 0.8)',
                  border: '1px solid rgba(106, 63, 160, 0.25)',
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Checkbox & Forgot Password */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', userSelect: 'none', color: 'rgba(255, 255, 255, 0.65)' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ width: '14px', height: '14px', accentColor: '#4D7BFF', cursor: 'pointer' }}
                />
                Recordar sesión
              </label>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#4D7BFF', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                onClick={() => alert('Para restablecer su contraseña, contacte al administrador de ZeaSys.')}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* Main Gradient Login Button (#6A3FA0 -> #4D7BFF) */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem 1.2rem',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6A3FA0 0%, #4D7BFF 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 6px 24px rgba(77, 123, 255, 0.35)',
                transition: 'all 0.25s ease',
                marginTop: '0.25rem'
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(77, 123, 255, 0.5)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(77, 123, 255, 0.35)';
              }}
            >
              {loading ? 'Ingresando...' : (<>Iniciar Sesión <ArrowRight size={16} /></>)}
            </button>
          </form>

          {/* Bottom Switch to Register */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.78rem' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>¿No tienes una cuenta? </span>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#4D7BFF', fontSize: '0.78rem', fontFamily: 'inherit' }}
              onClick={switchToRegister}
            >
              Crear cuenta
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}

