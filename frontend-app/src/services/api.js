import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }

  const isViteDevServer = window.location.port === '5173' || window.location.port === '5174' || window.location.port === '3000';
  if (isViteDevServer) {
    return 'http://localhost/ZeaSys/backend-api/public/index.php';
  }

  const basePath = window.location.pathname.includes('/ZeaSys') ? '/ZeaSys' : (window.location.pathname.includes('/AgroPredict') ? '/AgroPredict' : '');
  return `${window.location.origin}${basePath}/backend-api/public/index.php`;
};

const API = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const authService = {
  login: async (correo, contrasena, remember = false) => {
    const response = await API.post('/api/auth/login', { correo, contrasena, remember });
    return response.data;
  },
  register: async (nombre, correo, contrasena, confirmar_contrasena) => {
    const response = await API.post('/api/auth/register', { 
      nombre, 
      correo, 
      contrasena, 
      confirmar_contrasena
    });
    return response.data;
  },
  logout: async () => {
    const response = await API.post('/api/auth/logout');
    return response.data;
  },
  googleLogin: async (idToken, remember = false) => {
    const response = await API.post('/api/auth/google-login', { id_token: idToken, remember });
    return response.data;
  },
  me: async () => {
    const response = await API.get('/api/auth/me');
    return response.data;
  },
  updateProfile: async (datos) => {
    const response = await API.post('/api/auth/update', datos);
    return response.data;
  },
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('foto', file);
    const response = await API.post('/api/auth/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },
  deleteAvatar: async () => {
    const response = await API.post('/api/auth/delete-avatar');
    return response.data;
  },
  syncGoogleAvatar: async (fotoUrl) => {
    const response = await API.post('/api/auth/sync-google-avatar', { foto_url: fotoUrl });
    return response.data;
  },
  deleteAccount: async () => {
    const response = await API.post('/api/auth/delete');
    return response.data;
  }
};

export const cultivosService = {
  listar: async () => {
    const response = await API.get('/api/cultivos');
    return response.data;
  },
  obtenerTodos: async () => {
    const response = await API.get('/api/cultivos');
    return response.data;
  },
  crear: async (datos) => {
    const response = await API.post('/api/cultivos', datos);
    return response.data;
  },
  actualizar: async (datos) => {
    const response = await API.put('/api/cultivos', datos);
    return response.data;
  },
  eliminar: async (id) => {
    const response = await API.delete(`/api/cultivos?id=${id}`);
    return response.data;
  },
  obtenerMapa: async () => {
    const response = await API.get('/api/cultivos/mapa');
    return response.data;
  },
  obtenerValoresUbicacion: async (id) => {
    const response = await API.get(`/api/cultivos/valores-ubicacion?id=${id}`);
    return response.data;
  }
};

export const simulacionService = {
  simular: async (datos) => {
    const response = await API.post('/api/simulaciones/simular', datos);
    return response.data;
  },
  historial: async (anio = null) => {
    const url = anio ? `/api/simulaciones/historial?anio=${anio}` : '/api/simulaciones/historial';
    const response = await API.get(url);
    return response.data;
  },
  eliminar: async (id) => {
    const response = await API.delete(`/api/simulaciones/eliminar?id=${id}`);
    return response.data;
  },
  iaStatus: async (start = false) => {
    const response = await API.get(`/api/simulaciones/ia-status${start ? '?start=1' : ''}`);
    return response.data;
  },
  explainData: async (context) => {
    const response = await API.post('/api/simulaciones/explain', context);
    return response.data;
  }
};

export const dssService = {
  getScenarioData: async (cultivoId = null, anio = null) => {
    let query = [];
    if (cultivoId) query.push(`cultivo_id=${cultivoId}`);
    if (anio) query.push(`anio=${anio}`);
    const qStr = query.length > 0 ? '?' + query.join('&') : '';
    const response = await API.get(`/api/scenarios${qStr}`);
    return response.data;
  },
  getClimateData: async (cultivoId = null, anio = null) => {
    let query = [];
    if (cultivoId) query.push(`cultivo_id=${cultivoId}`);
    if (anio) query.push(`anio=${anio}`);
    const qStr = query.length > 0 ? '?' + query.join('&') : '';
    const response = await API.get(`/api/climate${qStr}`);
    return response.data;
  },
  getYieldData: async (cultivoId = null, anio = null) => {
    let query = [];
    if (cultivoId) query.push(`cultivo_id=${cultivoId}`);
    if (anio) query.push(`anio=${anio}`);
    const qStr = query.length > 0 ? '?' + query.join('&') : '';
    const response = await API.get(`/api/yield${qStr}`);
    return response.data;
  },
  getFinancialData: async (params = {}) => {
    let query = [];
    if (params.cultivoId) query.push(`cultivo_id=${params.cultivoId}`);
    if (params.anio) query.push(`anio=${params.anio}`);
    if (params.precioMaizQq) query.push(`precio_maiz_qq=${params.precioMaizQq}`);
    if (params.rendimientoQq) query.push(`rendimiento_qq=${params.rendimientoQq}`);
    if (params.costoSemilla) query.push(`costo_semilla=${params.costoSemilla}`);
    if (params.costoFert) query.push(`costo_fert=${params.costoFert}`);
    if (params.costoRiego) query.push(`costo_riego=${params.costoRiego}`);
    if (params.costoProteccion) query.push(`costo_proteccion=${params.costoProteccion}`);
    if (params.otrosVar) query.push(`otros_var=${params.otrosVar}`);
    if (params.costosFijos) query.push(`costos_fijos=${params.costosFijos}`);
    
    const qStr = query.length > 0 ? '?' + query.join('&') : '';
    const response = await API.get(`/api/financial${qStr}`);
    return response.data;
  }
};
