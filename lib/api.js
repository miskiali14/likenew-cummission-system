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

// A token can go stale in several ways (1-day expiry, server JWT secret
// rotated, or the account itself deleted) — most visible in a long-lived
// installed PWA session that's left open across days. Whatever the cause,
// every page should react the same way: drop the stale session and send
// the person back to log in, instead of leaving them stuck on a page full
// of failed requests.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;
    const sessionExpired = status === 401 || (status === 403 && message === 'Token is invalid or has expired');

    if (sessionExpired && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default API;