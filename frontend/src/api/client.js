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

// Response interceptor: auto-logout on 401
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('pt_token');
      localStorage.removeItem('pt_passcode_verified');
      // Force page reload to show login
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default client;
