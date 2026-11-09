import { useState, useRef } from 'react';
import { 
  User, 
  Sun, 
  Moon, 
  Download, 
  LogOut, 
  Check, 
  AlertTriangle,
  Camera,
  Trash2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { authService, parcelasService, dssService, simulacionService } from '../services/api';
import { prepararExportacion, crearArchivoJson } from '../utils/prepararExportacion';
import { exportarReporteAPdf } from '../utils/exportarPdf';
import '../assets/configuracion.css';

export default function Configuracion({ user, setUser, theme, setTheme, cerrarSesion, cultivos }) {
  // Datos del perfil en variables simples en español
  const [nombre, setNombre] = useState(user?.nombre || '');
  const correo = user?.correo || '';

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
      const respuesta = await authService.subirAvatar(archivo);
      if (respuesta.exito) {
        setUser(respuesta.usuario);
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
      const respuesta = await authService.eliminarAvatar();
      if (respuesta.exito) {
        setUser(respuesta.usuario);
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
              const resBackend = await authService.sincronizarAvatarGoogle(fotoHD);
              if (resBackend.exito) {
                setUser(resBackend.usuario);
                setMensajeExito('¡Foto de perfil sincronizada con tu cuenta de Google en Alta Definición!');
              }
            } else {
              setErrorMsj('Tu cuenta de Google no posee una foto de perfil personalizada.');
            }
          } catch {
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
    mediciones: false,
    kpis: true
  });
  const [formatoExportar, setFormatoExportar] = useState('json');
  const [cargandoExportar, setCargandoExportar] = useState(false);
  const [exitoExportar, setExitoExportar] = useState(false);
  const [errorExportar, setErrorExportar] = useState(null);
  const [progresoExportar, setProgresoExportar] = useState('');

  // Guardar cambios del nombre o correo
  const guardarDatosPerfil = async (e) => {
    e.preventDefault();
    setMensajeExito(null);
    setErrorMsj(null);
    setCargando(true);

    try {
      const respuesta = await authService.actualizarPerfil({
        nombre,
        correo
      });

      if (respuesta.exito) {
        setUser(respuesta.usuario);
        setMensajeExito(respuesta.mensaje);
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
      const respuesta = await authService.actualizarPerfil({
        nombre: user.nombre,
        correo: user.correo,
        nueva_contrasena: nuevaClave,
        confirmar_nueva_contrasena: confirmarClave
      });

      if (respuesta.exito) {
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
        await authService.eliminarCuenta();
        await cerrarSesion();
      } catch (err) {
        setErrorMsj(err.response?.data?.error || 'No se pudo eliminar la cuenta. Inténtalo de nuevo.');
        setCargando(false);
      }
    }
  };

  // Exportar los datos elegidos en el formato deseado
  const procesarExportarDatos = async () => {
    const ventanaPdf = formatoExportar === 'pdf' ? window.open('', '_blank') : null;
    if (formatoExportar === 'pdf' && !ventanaPdf) {
      setErrorExportar('Permite las ventanas emergentes para generar el PDF e inténtalo de nuevo.');
      return;
    }
    if (ventanaPdf) ventanaPdf.document.write('<!doctype html><html lang="es"><title>Preparando informe</title><body><p>Preparando tu informe de ZeaSys…</p></body></html>');
    setCargandoExportar(true);
    setExitoExportar(false);
    setErrorExportar(null);
    try {
      const datosAExportar = await prepararExportacion({
        secciones: seccionesExportar, usuario: user,
        obtenerParcelas: parcelasService.listar,
        obtenerHistorial: simulacionService.historial,
        obtenerMediciones: dssService.getRendimientoMediciones,
        progreso: setProgresoExportar,
      });
      if (formatoExportar === 'json') {
        const url = URL.createObjectURL(crearArchivoJson(datosAExportar));
        const link = document.createElement('a');
        link.href = url;
        link.download = `datos_zeasys_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        exportarReporteAPdf(datosAExportar, ventanaPdf);
      }
      setExitoExportar(true);
    } catch (err) {
      ventanaPdf?.close();
      setErrorExportar(err.response?.data?.error || (err.response ? 'No se pudo consultar toda la información. Inténtalo de nuevo.' : err.message === 'Network Error' ? 'No se pudo conectar al servidor. Inténtalo de nuevo.' : err.message) || 'No se pudo preparar la descarga. Inténtalo de nuevo.');
    } finally {
      setCargandoExportar(false);
      setProgresoExportar('');
    }
  };

  return <div className="settings-page">
    <header className="settings-intro"><div><span className="settings-eyebrow">TU ESPACIO · ZEASYS</span><h1>Tu cuenta y preferencias</h1><p>Gestiona tu perfil, la apariencia y tus descargas en un solo lugar.</p></div></header>
    {mensajeExito && <div className="settings-feedback settings-feedback--success" role="status"><Check size={18} aria-hidden="true" />{mensajeExito}</div>}
    {errorMsj && <div className="settings-feedback settings-feedback--error" role="alert"><AlertTriangle size={18} aria-hidden="true" />{errorMsj}</div>}
    <div className="settings-layout">
      <div className="settings-main">
        <section className="settings-card" aria-labelledby="settings-cuenta">
          <header className="settings-card-heading"><span className="settings-icon"><User size={20} aria-hidden="true" /></span><div><h2 id="settings-cuenta">Tu perfil</h2><p>La información con la que te identificas en ZeaSys.</p></div></header>
          <div className="settings-profile">
            <div className="settings-avatar">{user?.foto_perfil && <img src={user.foto_perfil} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'flex'; }} />}<span style={{ display: user?.foto_perfil ? 'none' : 'flex' }}>{user?.nombre?.charAt(0).toUpperCase() || <User size={24} />}</span></div>
            <div className="settings-profile-copy"><strong>{user.nombre}</strong><span>{correo}</span>{Number(user.es_google) === 1 && <small>Cuenta vinculada a Google</small>}</div>
            <div className="settings-avatar-actions"><input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/webp,image/gif" onChange={manejarSeleccionFoto} hidden /><button type="button" className="settings-button" disabled={subiendoFoto} onClick={() => fileInputRef.current?.click()}><Camera size={16} />{subiendoFoto ? 'Cargando…' : user?.foto_perfil ? 'Cambiar foto' : 'Subir foto'}</button>{user?.foto_perfil && <button type="button" className="settings-icon-button" disabled={subiendoFoto} onClick={manejarEliminarFoto} aria-label="Quitar foto de perfil" title="Quitar foto de perfil"><Trash2 size={17} /></button>}{window.google?.accounts?.oauth2 && <button type="button" className="settings-button" disabled={subiendoFoto} onClick={sincronizarFotoGoogle}>Sincronizar Google</button>}</div>
            <p className="settings-photo-hint">JPG, PNG, WEBP o GIF · Máximo 5 MB</p>
          </div>
          <div className="settings-row"><div><span className="settings-label">Nombre</span><strong>{user.nombre}</strong></div><button type="button" className="settings-button" aria-expanded={verFormularioCorreo} onClick={() => { setNombre(user.nombre); setVerFormularioCorreo(!verFormularioCorreo); setVerFormularioClave(false); }}>{verFormularioCorreo ? 'Cancelar' : 'Editar nombre'}</button></div>
          {verFormularioCorreo && <form className="settings-form" onSubmit={guardarDatosPerfil}><label htmlFor="settings-nombre">Nombre completo</label><input id="settings-nombre" type="text" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required autoComplete="name" /><button type="submit" className="settings-button settings-button--primary" disabled={cargando}>{cargando ? 'Guardando…' : 'Guardar nombre'}</button></form>}
          <div className="settings-row"><div><span className="settings-label">Correo electrónico</span><strong className="settings-email">{correo}</strong><small>El correo no se puede modificar desde aquí.</small></div></div>
          <div className="settings-row"><div><span className="settings-label">Contraseña</span><strong>••••••••••</strong><small>Úsala para acceder a tu cuenta.</small></div><button type="button" className="settings-button" aria-expanded={verFormularioClave} onClick={() => { setVerFormularioClave(!verFormularioClave); setVerFormularioCorreo(false); }}>{verFormularioClave ? 'Cancelar' : 'Cambiar contraseña'}</button></div>
          {verFormularioClave && <form className="settings-form" onSubmit={guardarNuevaClave}><p>Usa al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.</p><label htmlFor="settings-clave">Nueva contraseña</label><input id="settings-clave" type="password" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} autoComplete="new-password" minLength={8} required /><label htmlFor="settings-clave-confirmar">Confirmar contraseña</label><input id="settings-clave-confirmar" type="password" value={confirmarClave} onChange={(e) => setConfirmarClave(e.target.value)} autoComplete="new-password" minLength={8} required /><button type="submit" className="settings-button settings-button--primary" disabled={cargando}>{cargando ? 'Guardando…' : 'Actualizar contraseña'}</button></form>}
        </section>
        <section className="settings-card" aria-labelledby="settings-seguridad"><header className="settings-card-heading"><span className="settings-icon"><ShieldCheck size={20} aria-hidden="true" /></span><div><h2 id="settings-seguridad">Seguridad y sesión</h2><p>Controla el acceso y la permanencia de tu cuenta.</p></div></header><div className="settings-row"><div><strong>Cerrar sesión</strong><small>Sal de tu cuenta en este dispositivo.</small></div><button type="button" className="settings-button" onClick={cerrarSesion}><LogOut size={16} />Cerrar sesión</button></div><div className="settings-row settings-danger"><div><strong>Eliminar cuenta</strong><small>Elimina tu cuenta, parcelas y simulaciones de forma permanente.</small></div><button type="button" className="settings-button settings-button--danger" onClick={eliminarMiCuenta} disabled={cargando}><Trash2 size={16} />Eliminar cuenta</button></div></section>
      </div>
      <div className="settings-aside">
        <section className="settings-card" aria-labelledby="settings-apariencia"><header className="settings-card-heading"><span className="settings-icon"><Sun size={20} aria-hidden="true" /></span><div><h2 id="settings-apariencia">Apariencia</h2><p>Elige el tema que te resulte más cómodo.</p></div></header><div className="settings-theme-grid" role="group" aria-label="Tema de la aplicación">{[['dark', 'Oscuro', Moon], ['light', 'Claro', Sun]].map(([value, label, Icon]) => <button key={value} type="button" className={`settings-theme ${theme === value ? 'is-active' : ''}`} aria-pressed={theme === value} onClick={() => setTheme(value)}><Icon size={21} aria-hidden="true" /><span>{label}</span>{theme === value && <Check size={16} className="settings-theme-check" aria-hidden="true" />}</button>)}</div></section>
        <section className="settings-card" aria-labelledby="settings-exportar"><header className="settings-card-heading"><span className="settings-icon"><Download size={20} aria-hidden="true" /></span><div><h2 id="settings-exportar">Descargar información</h2><p>Guarda una copia de los datos que necesites.</p></div></header><fieldset className="settings-options" disabled={cargandoExportar}><legend>¿Qué quieres incluir?</legend>{[['cultivos', `Parcelas registradas (${cultivos.length})`, 'Datos de tus lotes y ubicación.'], ['simulaciones', 'Historial de simulaciones', 'Tus simulaciones guardadas.'], ['mediciones', 'Registros de campo', 'Mediciones y observaciones de tus parcelas.'], ['kpis', 'Resumen de parcelas', 'Cantidad de parcelas registradas.']].map(([key, title, detail]) => <label className="settings-option" key={key}><input type="checkbox" checked={seccionesExportar[key]} onChange={(e) => { setSeccionesExportar({ ...seccionesExportar, [key]: e.target.checked }); setExitoExportar(false); setErrorExportar(null); }} /><span><strong>{title}</strong><small>{detail}</small></span></label>)}</fieldset><fieldset className="settings-formats" disabled={cargandoExportar}><legend>Formato</legend><div className="settings-format-grid">{[['json', 'JSON', 'Archivo de datos'], ['pdf', 'PDF', 'Para guardar o imprimir']].map(([value, label, detail]) => <label key={value} className={formatoExportar === value ? 'is-active' : ''}><input type="radio" name="formatoExportar" value={value} checked={formatoExportar === value} onChange={() => { setFormatoExportar(value); setExitoExportar(false); setErrorExportar(null); }} /><span><strong>{label}</strong><small>{detail}</small></span></label>)}</div></fieldset><p className="settings-export-note">{formatoExportar === 'json' ? 'JSON conserva los datos seleccionados para uso técnico.' : 'PDF prepara un informe resumido para imprimir o guardar.'} La copia puede incluir ubicaciones y datos de tus parcelas.</p>{cargandoExportar && <p className="settings-export-progress" role="status">{progresoExportar || 'Preparando descarga…'}</p>}{errorExportar && <p className="settings-export-error" role="alert">{errorExportar}</p>}{exitoExportar && <p className="settings-export-success" role="status">{formatoExportar === 'pdf' ? 'Se abrió la ventana de impresión. Allí puedes guardar el PDF.' : 'Tu archivo está listo.'}</p>}<button type="button" className="settings-button settings-button--primary settings-download" onClick={procesarExportarDatos} disabled={cargandoExportar || !Object.values(seccionesExportar).some(Boolean)}><Download size={17} />{cargandoExportar ? 'Preparando…' : formatoExportar === 'pdf' ? 'Preparar PDF' : 'Descargar JSON'}<ChevronRight size={16} /></button></section>
      </div>
    </div>
  </div>;
}
