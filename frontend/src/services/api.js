import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Generic CRUD service factory
const createCrudService = (basePath) => ({
  getAll: (params) => api.get(basePath, { params }),
  getById: (id) => api.get(`${basePath}/${id}`),
  create: (data) => api.post(basePath, data),
  update: (id, data) => api.put(`${basePath}/${id}`, data),
  delete: (id) => api.delete(`${basePath}/${id}`),
});

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
};

// Data Catalog API
export const catalogAPI = createCrudService('/data-catalog');

// Data Classification API
export const classificationAPI = createCrudService('/data-classification');

// Data Quality API
export const qualityAPI = createCrudService('/data-quality');

// Data Lineage API
export const lineageAPI = createCrudService('/data-lineage');

// Metadata API
export const metadataAPI = createCrudService('/metadata');

// Policies API
export const policiesAPI = createCrudService('/data-policies');

// Stewardship API
export const stewardshipAPI = createCrudService('/data-stewardship');

// Compliance API
export const complianceAPI = createCrudService('/compliance');

// Access Control API
export const accessControlAPI = createCrudService('/access-control');

// Glossary API
export const glossaryAPI = createCrudService('/data-glossary');

// Audit API (read-only + create for logging)
export const auditAPI = {
  getAll: (params) => api.get('/audit-logs', { params }),
  getById: (id) => api.get(`/audit-logs/${id}`),
};

// AI API
export const aiAPI = {
  classify: (data) => api.post('/ai/classify', data),
  detectAnomalies: (data) => api.post('/ai/anomaly-detection', data),
  generatePolicy: (data) => api.post('/ai/generate-policy', data),
  impactAnalysis: (data) => api.post('/ai/impact-analysis', data),
  suggestQualityRules: (data) => api.post('/ai/suggest-quality-rules', data),
  generateDescription: (data) => api.post('/ai/generate-description', data),
};

export default api;
