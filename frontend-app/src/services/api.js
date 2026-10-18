import axios from 'axios';

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
    // El navegador debe generar el boundary multipart; fijarlo manualmente puede
    // producir cargas vacías en algunos adaptadores/versiones de Axios.
    const response = await API.post('/api/auth/upload-avatar', formData);
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
  iaStatus: async () => {
    const response = await API.get('/api/simulaciones/ia-status');
    return response.data;
  },
  explainData: async (context) => {
    const response = await API.post('/api/simulaciones/explain', context);
    return response.data;
  }
};

export const chatService = {
  preguntar: async (pregunta, vista = null, cultivoId = null, anio = null, dashboard = null) => {
    const response = await API.post('/api/chat/preguntar', {
      pregunta,
      vista,
      cultivo_id: cultivoId,
      anio,
      dashboard,
    });
    return response.data;
  },
  limpiar: async () => {
    const response = await API.post('/api/chat/limpiar');
    return response.data;
  },
};

export const dssService = {
  getScenarioData: async (cultivoId = null, anio = null) => {
    const query = new URLSearchParams();
    if (cultivoId !== null && cultivoId !== '') query.set('cultivo_id', cultivoId);
    if (anio !== null && anio !== '') query.set('anio', anio);
    const qStr = query.size > 0 ? `?${query.toString()}` : '';
    const response = await API.get(`/api/scenarios${qStr}`);
    return response.data;
  },
  getClimateData: async (cultivoId = null, anio = null) => {
    const query = new URLSearchParams();
    if (cultivoId !== null && cultivoId !== '') query.set('cultivo_id', cultivoId);
    if (anio !== null && anio !== '') query.set('anio', anio);
    const qStr = query.size > 0 ? `?${query.toString()}` : '';
    const response = await API.get(`/api/climate${qStr}`);
    return response.data;
  },
  getYieldData: async (cultivoId = null, anio = null) => {
    const query = new URLSearchParams();
    if (cultivoId !== null && cultivoId !== '') query.set('cultivo_id', cultivoId);
    if (anio !== null && anio !== '') query.set('anio', anio);
    const qStr = query.size > 0 ? `?${query.toString()}` : '';
    const response = await API.get(`/api/yield${qStr}`);
    return response.data;
  },
  getFinancialData: async (params = {}) => {
    const query = new URLSearchParams();
    const campos = {
      cultivoId: 'cultivo_id',
      anio: 'anio',
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
    const response = await API.get(`/api/financial${qStr}`);
    return response.data;
  }
};
