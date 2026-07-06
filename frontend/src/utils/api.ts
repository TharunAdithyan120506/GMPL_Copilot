/**
 * api.ts — Axios client with silent token refresh
 *
 * [FIX: AUTH-1] Implements silent refresh token rotation:
 *   - On every request, attaches the current access token
 *   - On 401, attempts ONE silent refresh using the stored refresh token
 *   - If refresh succeeds: stores new tokens, retries the original request
 *   - If refresh fails: fires gmpl:unauthorized → triggers logout
 *   - Prevents infinite retry loops via _retry flag
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach current access token ──────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gmpl_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: silent refresh on 401 ───────────────────────────────
let _isRefreshing = false;
let _refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processRefreshQueue(error: any, token: string | null = null) {
  _refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  _refreshQueue = [];
}

api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config;

    // Only intercept 401s that are NOT the auth endpoints themselves
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') ||
                           originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('gmpl_refresh_token');

      // No refresh token stored → log out immediately
      if (!refreshToken) {
        window.dispatchEvent(new Event('gmpl:unauthorized'));
        return Promise.reject(error);
      }

      // If a refresh is already in progress, queue this request
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push({
            resolve: (newToken) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      try {
        // Silent refresh — does NOT go through the intercepted api instance to avoid loops
        const res = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken },
        );
        const { accessToken, refreshToken: newRefreshToken } = res.data.data;

        // Persist new tokens
        localStorage.setItem('gmpl_token', accessToken);
        localStorage.setItem('gmpl_refresh_token', newRefreshToken);

        // Update default header and retry queued requests
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        processRefreshQueue(null, accessToken);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processRefreshQueue(refreshError, null);
        // Refresh failed → full logout
        localStorage.removeItem('gmpl_token');
        localStorage.removeItem('gmpl_refresh_token');
        localStorage.removeItem('gmpl_user');
        window.dispatchEvent(new Event('gmpl:unauthorized'));
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
