import axios from 'axios';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
});

// Attach token safely & Clean up URL spacing issues
API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // Trim any stray whitespace in the URL, if present
  if (config.url) {
    config.url = config.url.trim();
  }

  return config;
});

export default API;