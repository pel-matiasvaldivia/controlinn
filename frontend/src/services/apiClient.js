import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 segundos de timeout
});

// Interceptor para inyectar token JWT
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de respuesta para refrescar token automáticamente
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Detectar desconexión de red / servidor caído
    if (!error.response) {
      console.warn('[API-CLIENT] Error de red. Posible estado offline del cliente.');
      error.isOffline = true;
      return Promise.reject(error);
    }

    // Si el token expiró y no hemos intentado ya refrescarlo
    if (error.response.status === 401 && error.response.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Llamar directo a axios para evitar interceptores recursivos
        const res = await axios.post(`${API_URL}/auth/refresh`, { token: refreshToken });
        const { accessToken } = res.data;

        localStorage.setItem('accessToken', accessToken);
        
        // Reintentar la consulta original con el nuevo token
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        console.error('[API-CLIENT] Falló refresco de token, deslogueando...', refreshErr);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.reload(); // Redirigir a login
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
