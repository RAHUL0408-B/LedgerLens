import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Preconfigured axios instance for all backend API calls.
 * Uses a relative base URL in development (proxied by Vite) and an
 * absolute URL in production (set via VITE_API_URL env var).
 */
export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
});

// Attach auth token if present (will be used from Phase 21)
apiClient.interceptors.request.use((config) => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('ledgerlens_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize error responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);
