import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/Config';

const api = axios.create({
  baseURL: Config.API_URL,
  timeout: 10000,
});

// Attach JWT token to every request automatically
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  register: (name, email, password) =>
    api.post('/api/auth/register', { name, email, password }),

  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }),

  resetPassword: (email, otp, newPassword) =>
    api.post('/api/auth/reset-password', { email, otp, newPassword }),
};

export const userService = {
  getMe: () => api.get('/api/user/me'),
  savePushToken: (token) => api.post('/api/user/push-token', { token }),
  updatePlan: (plan) => api.post('/api/user/plan', { plan }),
  toggleMute: (companyId) => api.post(`/api/user/mute/${companyId}`),
  updateProfile: (fields) => api.patch('/api/user/profile', fields),
  deleteAccount: (password) => api.delete('/api/user/account', { data: { password } }),
};

export const discoverService = {
  search: (filters) => api.post('/api/discover', filters),
};

export const outreachService = {
  generate: (companyId, type) =>
    api.post('/api/outreach/generate', { companyId, type }),
  getUsage: () => api.get('/api/outreach/usage'),
};

export const resumeService = {
  upload: (formData) =>
    api.post('/api/resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000, // parsing can take a few seconds
    }),
  remove: () => api.delete('/api/resume'),
};

export const companyService = {
  search: (q) => api.get(`/api/companies/search?q=${encodeURIComponent(q)}`),
  create: (data) => api.post('/api/companies', data),
  getById: (id) => api.get(`/api/companies/${id}`),
  scan: (id) => api.post(`/api/companies/${id}/scan`),
  getWatchlist: () => api.get('/api/companies/watchlist/me'),
  watch: (id) => api.post(`/api/companies/${id}/watch`),
  unwatch: (id) => api.delete(`/api/companies/${id}/watch`),
  getAlerts: () => api.get('/api/companies/alerts/me'),
  markAlertRead: (id) => api.patch(`/api/companies/alerts/${id}/read`),
};

export default api;
