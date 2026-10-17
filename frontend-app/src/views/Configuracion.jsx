import React, { useState, useRef } from 'react';
import { 
  User, 
  Lock, 
  Sun, 
  Moon, 
  Download, 
  LogOut, 
  Check, 
  AlertTriangle,
  Camera,
  Trash2,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { authService, simulacionService } from '../services/api';
import { exportarReporteAPdf } from '../utils/exportarPdf';

export default function Configuracion({ user, setUser, theme, setTheme, cerrarSesion, cultivos }) {
  // Datos del perfil en variables simples en español
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [correo, setCorreo] = useState(user?.correo || '');

  // Claves para el formulario de contraseña
  const [nuevaClave, setNuevaClave] = useState('');
  const [confirmarClave, setConfirmarClave] = useState('');

  // Ver o esconder los formularios
  const [verFormularioCorreo, setVerFormularioCorreo] = useState(false);
  const [verFormularioClave, setVerFormularioClave] = useState(false);
  
  // Referencia para input de archivo
  const fileInputRef = useRef(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Mensajes para el usuario (error o éxito)
  const [mensajeExito, setMensajeExito] = useState(null);
  const [errorMsj, setErrorMsj] = useState(null);
  const [cargando, setCargando] = useState(false);

  // Manejar selección y subida de foto de perfil
  const manejarSeleccionFoto = async (e) => {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;

    setMensajeExito(null);
    setErrorMsj(null);

    // Validación de tamaño (Máximo 5 MB = 5 * 1024 * 1024 bytes)
    const limiteMaximoBytes = 5 * 1024 * 1024;
    if (archivo.size > limiteMaximoBytes) {
      setErrorMsj('El archivo seleccionado supera el límite máximo de 5 MB. Por favor elige una imagen más liviana.');
      e.target.value = '';
      return;
    }

    // Validación de formato
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!tiposPermitidos.includes(archivo.type)) {
      setErrorMsj('El formato del archivo no es permitido. Por favor sube una imagen JPG, PNG, WEBP o GIF.');
      e.target.value = '';
      return;
    }

    setSubiendoFoto(true);
    try {
      const respuesta = await authService.uploadAvatar(archivo);
      if (respuesta.success) {
        setUser(respuesta.user);
        setMensajeExito('¡Foto de perfil actualizada con éxito!');
      }
    } catch (err) {
      setErrorMsj(err.response?.data?.error || 'Error al subir la foto de perfil.');
    } finally {
      setSubiendoFoto(false);
      e.target.value = '';
    }
  };

  // Manejar eliminación de foto de perfil
  const manejarEliminarFoto = async () => {
    if (!window.confirm('¿Deseas quitar tu foto de perfil actual?')) return;

    setMensajeExito(null);
    setErrorMsj(null);
    setSubiendoFoto(true);

    try {
      const respuesta = await authService.deleteAvatar();
      if (respuesta.success) {
        setUser(respuesta.user);
        setMensajeExito('Foto de perfil eliminada correctamente.');
      }
    } catch (err) {
      setErrorMsj(err.response?.data?.error || 'Error al eliminar la foto de perfil.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  // Manejar sincronización directa con foto de Google
  const sincronizarFotoGoogle = async () => {
    if (!window.google?.accounts?.oauth2) {
      setErrorMsj('El servicio de Google Sign-In no está listo aún. Intenta nuevamente.');
      return;
    }
    setSubiendoFoto(true);
    setErrorMsj(null);
    setMensajeExito(null);

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '200107748008-3j1itt8eobnbec6ur1n4vguj4r999k3d.apps.googleusercontent.com',
      scope: 'profile email',
      callback: async (tokenRes) => {
        if (tokenRes && tokenRes.access_token) {
          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenRes.access_token}` }
            });
            const profile = await res.json();
            if (profile.picture) {
              const fotoHD = profile.picture.replace(/=s\d+(-c)?$/i, '=s400');
              const resBackend = await authService.syncGoogleAvatar(fotoHD);
              if (resBackend.success) {
                setUser(resBackend.user);
                setMensajeExito('¡Foto de perfil sincronizada con tu cuenta de Google en Alta Definición!');
              }
            } else {
              setErrorMsj('Tu cuenta de Google no posee una foto de perfil personalizada.');
            }
          } catch (e) {
            setErrorMsj('Error al obtener la foto de perfil desde Google.');
          } finally {
            setSubiendoFoto(false);
          }
        } else {
          setSubiendoFoto(false);
        }
      }
    });
    client.requestAccessToken();
  };

  // Qué secciones se van a exportar
  const [seccionesExportar, setSeccionesExportar] = useState({
    cultivos: true,
    simulaciones: true,
    kpis: true
  });
  const [formatoExportar, setFormatoExportar] = useState('json');
  const [cargandoExportar, setCargandoExportar] = useState(false);
  const [exitoExportar, setExitoExportar] = useState(false);

  // Guardar cambios del nombre o correo
  const guardarDatosPerfil = async (e) => {
    e.preventDefault();
    setMensajeExito(null);
    setErrorMsj(null);
    setCargando(true);

    try {
      const respuesta = await authService.updateProfile({
        nombre,
        correo
      });

      if (respuesta.success) {
        setUser(respuesta.user);
        setMensajeExito(respuesta.message);
        setVerFormularioCorreo(false);
      }
    } catch (err) {
      setErrorMsj(err.response?.data?.error || 'Error al actualizar el perfil.');
    } finally {
      setCargando(false);
    }
  };

  // Guardar cambio de contraseña
  const guardarNuevaClave = async (e) => {
    e.preventDefault();
    setMensajeExito(null);
    setErrorMsj(null);
    setCargando(true);

    if (nuevaClave.length < 8) {
      setErrorMsj('La nueva contraseña debe tener al menos 8 letras o números.');
      setCargando(false);
      return;
    }

    if (nuevaClave !== confirmarClave) {
      setErrorMsj('Las contraseñas no coinciden, verifícalas bien.');
      setCargando(false);
      return;
    }

    try {
      const respuesta = await authService.updateProfile({
        nombre: user.nombre,
        correo: user.correo,
        nueva_contrasena: nuevaClave,
        confirmar_nueva_contrasena: confirmarClave
      });

      if (respuesta.success) {
        setMensajeExito('¡Contraseña cambiada con éxito!');
        setNuevaClave('');
        setConfirmarClave('');
        setVerFormularioClave(false);
      }
    } catch (err) {
      setErrorMsj(err.response?.data?.error || 'Error al cambiar la contraseña.');
    } finally {
      setCargando(false);
    }
  };

  // Borrar cuenta de usuario
  const eliminarMiCuenta = async () => {
    const seguro = window.confirm(
      "¿Seguro que quieres borrar tu cuenta? Esta acción va a eliminar todos tus lotes y simulaciones guardadas de forma permanente. No se puede deshacer."
    );
    if (seguro) {
      setErrorMsj(null);
      setMensajeExito(null);
      setCargando(true);
      try {
        await authService.deleteAccount();
      } catch (err) {
        console.warn('Procesando eliminación de cuenta:', err);
      } finally {
        await cerrarSesion();
      }
    }
  };

  // Exportar los datos elegidos en el formato deseado
  const procesarExportarDatos = async () => {
    setCargandoExportar(true);
    setExitoExportar(false);
    try {
      const datosAExportar = {
        meta: {
          app: 'ZeaSys AgroPredict',
          exportado_por: user.nombre,
          fecha_exportacion: new Date().toISOString(),
          version: '1.2.0'
        }
      };

      if (seccionesExportar.cultivos) {
        datosAExportar.lotes_gps = cultivos;
      }

      if (seccionesExportar.simulaciones) {
        const respuestaSims = await simulacionService.historial();
        datosAExportar.historial_simulaciones = respuestaSims.simulaciones || [];
      }

      if (seccionesExportar.kpis) {
        datosAExportar.resumen_kpi = {
          total_lotes: cultivos.length,
          porcentaje_eficiencia: '85%',
          analisis_clima: 'Optimizado'
        };
      }

      if (formatoExportar === 'json') {
        const jsonTexto = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(datosAExportar, null, 2)
        )}`;
        const linkDescarga = document.createElement('a');
        linkDescarga.setAttribute('href', jsonTexto);
        linkDescarga.setAttribute('download', `datos_agropredict_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(linkDescarga);
        linkDescarga.click();
        linkDescarga.remove();
      } else {
        exportarReporteAPdf(datosAExportar);
      }

      setExitoExportar(true);
      setTimeout(() => setExitoExportar(false), 3000);
    } catch (err) {
      console.error('Error al exportar datos:', err);
      alert('Hubo un error al descargar la información.');
    } finally {
      setCargandoExportar(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="config-grid">
        
        {/* Lado izquierdo: Opciones del Perfil y Seguridad */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div>
            <div className="glass-card-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} className="text-success" />
                Configuración y Seguridad de tu Cuenta
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Cambia tus datos de acceso y clave.
              </p>
            </div>

            {mensajeExito && (
              <div style={{
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                marginBottom: '1rem',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Check size={16} />
                {mensajeExito}
              </div>
            )}

            {errorMsj && (
              <div style={{
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                marginBottom: '1rem',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertTriangle size={16} />
                {errorMsj}
              </div>
            )}

            {/* Panel de Datos de Cuenta */}
            <div style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Datos de Acceso
              </h4>
              
              {/* Sección Foto de Perfil */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: '1rem', 
                borderBottom: '1px solid var(--border-subtle)', 
                paddingBottom: '1rem' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '2px solid var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    flexShrink: 0
                  }}>
                    {user?.foto_perfil ? (
                      <img 
                        src={user.foto_perfil} 
                        alt={user.nombre} 
                        referrerPolicy="no-referrer"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            e.currentTarget.nextElementSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <span 
                      style={{ 
                        display: user?.foto_perfil ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        fontSize: '1.5rem', 
                        fontWeight: 800, 
                        color: 'var(--accent-primary)' 
                      }}
                    >
                      {user?.nombre ? user.nombre.charAt(0).toUpperCase() : <User size={28} />}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      Foto de Perfil
                      {user?.es_google === 1 && (
                        <span style={{ 
                          fontSize: '0.62rem', 
                          padding: '0.12rem 0.45rem', 
                          borderRadius: '6px', 
                          background: 'rgba(66, 133, 244, 0.15)', 
                          color: '#60a5fa', 
                          border: '1px solid rgba(66, 133, 244, 0.3)',
                          fontWeight: 700 
                        }}>
                          Google Account
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.15rem', margin: 0 }}>
                      Sube o personaliza tu foto de perfil (JPG, PNG, WEBP, GIF. Máx. 5 MB).
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/jpeg,image/png,image/webp,image/gif" 
                    onChange={manejarSeleccionFoto} 
                    style={{ display: 'none' }} 
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()} 
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    disabled={subiendoFoto}
                  >
                    <Camera size={14} />
                    {subiendoFoto ? 'Cargando...' : (user?.foto_perfil ? 'Cambiar Foto' : 'Subir Foto')}
                  </button>

                  {user?.foto_perfil && (
                    <button 
                      type="button"
                      onClick={manejarEliminarFoto} 
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
                      title="Quitar foto de perfil"
                      disabled={subiendoFoto}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Correo y Nombre */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Correo Electrónico:</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {user?.correo}
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--surface-elevated)', color: 'var(--text-subtle)', border: '1px solid var(--border-subtle)' }}>
                      No modificable
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => { setVerFormularioCorreo(!verFormularioCorreo); setVerFormularioClave(false); }} 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
                >
                  {verFormularioCorreo ? 'Cancelar' : 'Cambiar Nombre'}
                </button>
              </div>

              {/* Formulario de Nombre Completo */}
              {verFormularioCorreo && (
                <form onSubmit={guardarDatosPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0', animation: 'fadeIn 0.25s ease' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Nombre Completo</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={nombre} 
                      onChange={(e) => setNombre(e.target.value)} 
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '0.78rem', padding: '0.5rem' }} disabled={cargando}>
                    {cargando ? 'Guardando Cambios...' : 'Guardar Nombre'}
                  </button>
                </form>
              )}

              {/* Contraseña */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Contraseña:</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>**********</div>
                </div>
                <button 
                  onClick={() => { setVerFormularioClave(!verFormularioClave); setVerFormularioCorreo(false); }} 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
                >
                  {verFormularioClave ? 'Cancelar' : 'Modificar Clave'}
                </button>
              </div>

              {/* Formulario de Contraseña */}
              {verFormularioClave && (
                <form onSubmit={guardarNuevaClave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0', animation: 'fadeIn 0.25s ease' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Nueva Contraseña</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      value={nuevaClave} 
                      placeholder="Mínimo 8 caracteres"
                      onChange={(e) => setNuevaClave(e.target.value)} 
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Confirmar Contraseña</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      value={confirmarClave} 
                      placeholder="Repite la contraseña"
                      onChange={(e) => setConfirmarClave(e.target.value)} 
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '0.78rem', padding: '0.5rem' }} disabled={cargando}>
                    {cargando ? 'Actualizando Contraseña...' : 'Actualizar Contraseña'}
                  </button>
                </form>
              )}

            </div>
          </div>

          {/* Seguridad y Salida */}
          <div style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Seguridad y Sesión
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>Sesión de Usuario:</span>
                <button 
                  onClick={cerrarSesion} 
                  className="btn btn-outline text-danger" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.78rem' }}
                >
                  <LogOut size={14} />
                  Cerrar sesión en esta computadora
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>Borrar Cuenta Permanente:</span>
                <button 
                  onClick={eliminarMiCuenta} 
                  className="btn text-danger" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.78rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  Eliminar mi cuenta y borrar datos
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Lado derecho: Tema y Exportación */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Apariencia */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div className="glass-card-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {theme === 'dark' ? <Moon size={18} className="text-secondary" /> : <Sun size={18} className="text-warning" />}
                Apariencia del Sistema (Tema)
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Cambia el tema de color a claro u oscuro.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="button"
                onClick={() => setTheme('dark')} 
                className={`theme-selector-btn ${theme === 'dark' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  padding: '1rem',
                  borderRadius: '12px',
                  border: theme === 'dark' ? '2px solid hsl(var(--primary))' : '1px solid var(--border-subtle)',
                  background: theme === 'dark' ? 'rgba(134, 59, 255, 0.1)' : 'var(--surface-elevated)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                <Moon size={24} color="#8b5cf6" />
                <span>Tema Oscuro</span>
              </button>

              <button 
                type="button"
                onClick={() => setTheme('light')} 
                className={`theme-selector-btn ${theme === 'light' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  padding: '1rem',
                  borderRadius: '12px',
                  border: theme === 'light' ? '2px solid hsl(var(--primary))' : '1px solid var(--border-subtle)',
                  background: theme === 'light' ? 'rgba(134, 59, 255, 0.1)' : 'var(--surface-elevated)',
                  color: theme === 'light' ? '#0f172a' : '#cbd5e1',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                <Sun size={24} color="#eab308" />
                <span>Tema Claro</span>
              </button>
            </div>
          </div>

          {/* Exportación */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div className="glass-card-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={18} color="#10b981" />
                Exportar Información
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Descarga tus datos en formato JSON o un reporte PDF para imprimir.
              </p>
            </div>

            {/* Checkboxes de Secciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={seccionesExportar.cultivos} 
                  onChange={(e) => setSeccionesExportar({ ...seccionesExportar, cultivos: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--primary))' }}
                />
                Lotes y Parcelas GPS ({cultivos.length})
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={seccionesExportar.simulaciones} 
                  onChange={(e) => setSeccionesExportar({ ...seccionesExportar, simulaciones: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--primary))' }}
                />
                Historial de Simulaciones
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={seccionesExportar.kpis} 
                  onChange={(e) => setSeccionesExportar({ ...seccionesExportar, kpis: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--primary))' }}
                />
                Métricas & Resúmenes de KPI
              </label>
            </div>

            {/* Formato de descarga */}
            <div style={{ marginBottom: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Elegir Formato:
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem', 
                  background: 'var(--surface-elevated)', 
                  border: formatoExportar === 'json' ? '1px solid hsl(var(--primary))' : '1px solid var(--border-subtle)', 
                  padding: '0.5rem 0.75rem', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontSize: '0.8rem', 
                  fontWeight: 600,
                  transition: 'all 0.15s ease'
                }}>
                  <input 
                    type="radio" 
                    name="formatoExportar" 
                    value="json" 
                    checked={formatoExportar === 'json'} 
                    onChange={() => setFormatoExportar('json')}
                    style={{ accentColor: 'hsl(var(--primary))' }}
                  />
                  <span>Archivo JSON</span>
                </label>
                <label style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem', 
                  background: 'var(--surface-elevated)', 
                  border: formatoExportar === 'pdf' ? '1px solid hsl(var(--primary))' : '1px solid var(--border-subtle)', 
                  padding: '0.5rem 0.75rem', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontSize: '0.8rem', 
                  fontWeight: 600,
                  transition: 'all 0.15s ease'
                }}>
                  <input 
                    type="radio" 
                    name="formatoExportar" 
                    value="pdf" 
                    checked={formatoExportar === 'pdf'} 
                    onChange={() => setFormatoExportar('pdf')}
                    style={{ accentColor: 'hsl(var(--primary))' }}
                  />
                  <span>Documento PDF</span>
                </label>
              </div>
            </div>

            <button 
              onClick={procesarExportarDatos} 
              className="btn" 
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              disabled={cargandoExportar || (!seccionesExportar.cultivos && !seccionesExportar.simulaciones && !seccionesExportar.kpis)}
            >
              {cargandoExportar ? (
                'Descargando...'
              ) : exitoExportar ? (
                <>
                  <Check size={18} style={{ color: 'white' }} />
                  ¡Listo, exportado!
                </>
              ) : (
                <>
                  <Download size={18} />
                  Descargar ahora
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile grid styling adjustments */}
      <style>{`
        @media (max-width: 768px) {
          .config-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
