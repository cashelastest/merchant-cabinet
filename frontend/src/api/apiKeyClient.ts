import axios from 'axios';

const apiKeyClient = axios.create({ baseURL: '/api/v1' });

apiKeyClient.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('merchantApiKey');
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  } else {
    const token = localStorage.getItem('merchantToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiKeyClient;
