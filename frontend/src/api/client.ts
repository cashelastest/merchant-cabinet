import axios from 'axios';

const client = axios.create({ baseURL: '/api/v1' });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('merchantToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      localStorage.removeItem('merchantToken');
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  }
);

export default client;
