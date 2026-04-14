import axios from 'axios';

const client = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: auto-logout on 401 (only if user had a token)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const hadToken = !!localStorage.getItem('pt_token');
      // Only clear + reload if the user actually had a token (expired session).
      // If they never had one, 401 is expected for auth-gated endpoints and
      // should NOT trigger a reload (which would cause infinite loops).
      if (hadToken) {
        localStorage.removeItem('pt_token');
        localStorage.removeItem('pt_passcode_verified');
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default client;
