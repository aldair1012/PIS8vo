import axios from 'axios';
import { avatarUrl } from '../utils/avatarUrl';
import { leerRespuestaChat } from './streamChat';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}/ZeaSys/backend-api/public/index.php`;
  }

  const basePath = window.location.pathname.includes('/ZeaSys') ? '/ZeaSys' : (window.location.pathname.includes('/AgroPredict') ? '/AgroPredict' : '');
  return `${window.location.origin}${basePath}/backend-api/public/index.php`;
};

const API = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  }
});

API.interceptors.response.use((response) => {
  if (response.data?.usuario) response.data.usuario.foto_perfil = avatarUrl(response.data.usuario.foto_perfil, API.defaults.baseURL);
  return response;
}, (error) => {
  const ruta = error.config?.url ?? '';
  if (error.response?.status === 401 && !/^\/api\/auth\/(?:iniciar-sesion|registrarse|google-iniciar-sesion|yo)(?:$|\?)/.test(ruta)) {
    window.dispatchEvent(new Event('zeasys:sesion-expirada'));
  }
  return Promise.reject(error);
});

export const acompanamientoService = {
  panel: async () => (await API.get('/api/acompanamiento')).data,
  conceder: (parcela_id, correo) => API.post('/api/acompanamiento/accesos', { parcela_id, correo }),
  revocar: (parcela_id, tecnico_id) => API.delete('/api/acompanamiento/accesos', { data: { parcela_id, tecnico_id } }),
  csv: () => API.getUri({ url: '/api/acompanamiento/exportar' }),
};

export const authService = {
  iniciarSesion: async (correo, contrasena, recordar = false) => {
    const response = await API.post('/api/auth/iniciar-sesion', { correo, contrasena, recordar });
    return response.data;
  },
  registrarse: async (nombre, correo, contrasena, confirmar_contrasena) => {
    const response = await API.post('/api/auth/registrarse', { 
      nombre, 
      correo, 
      contrasena, 
      confirmar_contrasena
    });
    return response.data;
  },
  cerrarSesion: async () => {
    const response = await API.post('/api/auth/cerrar-sesion');
    return response.data;
  },
  iniciarSesionGoogle: async (idToken, recordar = false) => {
    const response = await API.post('/api/auth/google-iniciar-sesion', { id_token: idToken, recordar });
    return response.data;
  },
  yo: async () => {
    const response = await API.get('/api/auth/yo');
    return response.data;
  },
  actualizarPerfil: async (datos) => {
    const response = await API.post('/api/auth/actualizar', datos);
    return response.data;
  },
  subirAvatar: async (file) => {
    const formData = new FormData();
    formData.append('foto', file);
    // El navegador debe generar el boundary multipart; fijarlo manualmente puede
    // producir cargas vacías en algunos adaptadores/versiones de Axios.
    const response = await API.post('/api/auth/subir-avatar', formData);
    return response.data;
  },
  eliminarAvatar: async () => {
    const response = await API.post('/api/auth/eliminar-avatar');
    return response.data;
  },
  sincronizarAvatarGoogle: async (fotoUrl) => {
    const response = await API.post('/api/auth/sincronizar-avatar-google', { foto_url: fotoUrl });
    return response.data;
  },
  eliminarCuenta: async () => {
    const response = await API.post('/api/auth/eliminar-cuenta');
    return response.data;
  }
};

export const parcelasService = {
  listar: async () => {
    const response = await API.get('/api/parcelas');
    return response.data;
  },
  crear: async (datos) => {
    const response = await API.post('/api/parcelas', datos);
    return response.data;
  },
  actualizar: async (datos) => {
    const response = await API.put('/api/parcelas', datos);
    return response.data;
  },
  eliminar: async (id) => {
    const response = await API.delete(`/api/parcelas?id=${id}`);
    return response.data;
  },
  obtenerMapa: async () => {
    const response = await API.get('/api/parcelas/mapa');
    return response.data;
  },
  obtenerValoresUbicacion: async (id, options = {}) => {
    const response = await API.get(`/api/parcelas/valores-ubicacion?id=${id}`, options);
    return response.data;
  }
};

export const simulacionService = {
  evaluarVariedades: async (datos) => {
    const response = await API.post('/api/simulaciones/evaluar-variedades', datos);
    return response.data;
  },
  simular: async (datos) => {
    const response = await API.post('/api/simulaciones/simular', datos);
    return response.data;
  },
  historial: async (año = null, pagina = 1, porPagina = 25) => {
    const params = { pagina, por_pagina: porPagina };
    if (año !== null && año !== '') params.año = año;
    const response = await API.get('/api/simulaciones/historial', { params });
    return response.data;
  },
  eliminar: async (id) => {
    const response = await API.delete(`/api/simulaciones/eliminar?id=${id}`);
    return response.data;
  },
  estadoIA: async () => {
    const response = await API.get('/api/simulaciones/estado-ia');
    return response.data;
  },
  explicarDatos: async (contexto) => {
    const response = await API.post('/api/simulaciones/explicar', contexto);
    return response.data;
  }
};

export const chatService = {
  consentimiento: async () => (await API.get('/api/chat/consentimiento')).data,
  decidirConsentimiento: async (autorizado, version) => (await API.post('/api/chat/consentimiento', { autorizado, version })).data,
  preguntar: async (pregunta, vista = null, cultivoId = null, año = null, dashboard = null, simulacion = null, signal, onDelta, simple = false) => {
    const body = { pregunta, vista, cultivo_id: cultivoId, año, dashboard, simulacion, modo_simple: simple };
    if (!onDelta) return (await API.post('/api/chat/preguntar', body, { timeout: 90000, signal })).data;
    const controller = new AbortController();
    const cancelar = () => controller.abort();
    const timeout = setTimeout(cancelar, 90000);
    if (signal?.aborted) cancelar();
    signal?.addEventListener('abort', cancelar, { once: true });
    try {
      const response = await fetch(`${API.defaults.baseURL}/api/chat/preguntar`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(body), signal: controller.signal,
      });
      if (response.status === 401) window.dispatchEvent(new Event('zeasys:sesion-expirada'));
      return await leerRespuestaChat(response, onDelta);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancelar);
    }
  },
  limpiar: async () => {
    const response = await API.post('/api/chat/limpiar');
    return response.data;
  },
  guardarFavorito: async (datos) => {
    const response = await API.post('/api/chat/favorito', datos);
    return response.data;
  },
  eliminarFavorito: async (conversacionId) => {
    const response = await API.post('/api/chat/favorito/eliminar', { conversacion_id: conversacionId });
    return response.data;
  },
};

export const dssService = {
  getEscenarioData: async (parcelaId = null, año = null) => {
    const query = new URLSearchParams();
    if (parcelaId !== null && parcelaId !== '') query.set('parcela_id', parcelaId);
    if (año !== null && año !== '') query.set('año', año);
    const qStr = query.size > 0 ? `?${query.toString()}` : '';
    const response = await API.get(`/api/escenarios${qStr}`);
    return response.data;
  },
  avisoLluvia: async (id, method = 'get', data) => (await API.request({
    url: '/api/clima/avisos', method, params: { parcela_id: id }, data,
  })).data,
  getClimaData: async (parcelaId = null, año = null, options = {}) => {
    const query = new URLSearchParams();
    if (parcelaId !== null && parcelaId !== '') query.set('parcela_id', parcelaId);
    if (año !== null && año !== '') query.set('año', año);
    const qStr = query.size > 0 ? `?${query.toString()}` : '';
    const response = await API.get(`/api/clima${qStr}`, options);
    return response.data;
  },
  getRendimientoData: async (parcelaId = null, año = null) => {
    const query = new URLSearchParams();
    if (parcelaId !== null && parcelaId !== '') query.set('parcela_id', parcelaId);
    if (año !== null && año !== '') query.set('año', año);
    const qStr = query.size > 0 ? `?${query.toString()}` : '';
    const response = await API.get(`/api/rendimiento${qStr}`);
    return response.data;
  },
  getRendimientoMediciones: async (parcelaId) => {
    const response = await API.get('/api/rendimiento/mediciones/consulta', { params: { parcela_id: parcelaId } });
    return response.data.mediciones;
  },
  getCampanas: async (parcelaId) => (await API.get('/api/rendimiento/campanas', { params: { parcela_id: parcelaId } })).data,
  registrarCosecha: (datos) => API.post('/api/rendimiento/campanas/cosecha', datos),
  registrarObservacion: (formData) => API.post('/api/rendimiento/campanas/observacion', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  adjuntoCampana: (id) => API.getUri({ url: '/api/rendimiento/campanas/adjunto', params: { id } }),
  saveRendimientoMediciones: async (parcelaId, datos) => {
    const response = await API.post('/api/rendimiento/mediciones', { ...datos, parcela_id: parcelaId });
    return response.data;
  },
  getFinancieroData: async (params = {}) => {
    const query = new URLSearchParams();
    const campos = {
      parcelaId: 'parcela_id',
      año: 'año',
      precioMaizQq: 'precio_maiz_qq',
      rendimientoQq: 'rendimiento_qq',
      costoSemilla: 'costo_semilla',
      costoFert: 'costo_fert',
      costoRiego: 'costo_riego',
      costoProteccion: 'costo_proteccion',
      otrosVar: 'otros_var',
      costosFijos: 'costos_fijos',
    };
    Object.entries(campos).forEach(([propiedad, parametro]) => {
      const valor = params[propiedad];
      if (valor !== null && valor !== undefined && valor !== '') {
        query.set(parametro, valor);
      }
    });

    const qStr = query.size > 0 ? `?${query.toString()}` : '';
    const response = await API.get(`/api/financiero${qStr}`);
    return response.data;
  }
};
