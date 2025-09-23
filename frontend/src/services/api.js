// src/services/api.js
import axios from 'axios';

// API Configuration - Fixed for Vite environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://x8dd7fpwf3.execute-api.eu-west-1.amazonaws.com/dev/api/v1';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor for debugging
api.interceptors.request.use((config) => {
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

const apiService = {
  // Raw API calls for components that need direct access
  get: (url) => api.get(url).then(response => response.data),
  post: (url, data) => api.post(url, data).then(response => response.data),
  put: (url, data) => api.put(url, data).then(response => response.data),
  delete: (url) => api.delete(url).then(response => response.data),

  // Actions API
  actions: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `/actions?${queryString}` : '/actions';
      return api.get(url).then(response => response.data);
    },
    getById: (actionId) => api.get(`/actions/${actionId}`).then(response => response.data),
    create: (actionData) => api.post('/actions', actionData).then(response => response.data),
    update: (actionId, actionData) => api.put(`/actions/${actionId}`, actionData).then(response => response.data),
    delete: (actionId) => api.delete(`/actions/${actionId}`).then(response => response.data),
  },

  // Projects API
  projects: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `/projects?${queryString}` : '/projects';
      return api.get(url).then(response => response.data);
    },
    getById: (projectId) => api.get(`/projects/${projectId}`).then(response => response.data),
    create: (projectData) => api.post('/projects', projectData).then(response => response.data),
    update: (projectId, projectData) => api.put(`/projects/${projectId}`, projectData).then(response => response.data),
    delete: (projectId) => api.delete(`/projects/${projectId}`).then(response => response.data),
  },

  // Documents API - Upload to S3
  documents: {
    upload: (formData) => api.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(response => response.data),
    getProcessingStatus: (documentId) => api.get(`/documents/${documentId}/status`).then(response => response.data),
    getExtractedText: (documentId) => api.get(`/documents/${documentId}/extracted-text`).then(response => response.data),
  },

  // Document Suggestions API - Your working backend endpoints
  documentSuggestions: {
    getPending: () => api.get('/document-suggestions/pending').then(response => response.data),
    getById: (suggestionId) => api.get(`/document-suggestions/${suggestionId}`).then(response => response.data),
    approve: (suggestionId, actionData) => api.post(`/document-suggestions/${suggestionId}/approve`, actionData).then(response => response.data),
    reject: (suggestionId, reason) => api.post(`/document-suggestions/${suggestionId}/reject`, { reason }).then(response => response.data),
  },

  // Workflows API
  workflows: {
    getStatus: (executionArn) => api.get(`/workflows/status?executionArn=${encodeURIComponent(executionArn)}`).then(response => response.data),
    getHistory: (actionId) => api.get(`/workflows/history/${actionId}`).then(response => response.data),
    getAll: () => api.get('/workflows').then(response => response.data),
  },

  // Analytics API
  analytics: {
    getDashboard: () => api.get('/analytics/dashboard').then(response => response.data),
    getProjectMetrics: (projectId) => api.get(`/analytics/projects/${projectId}`).then(response => response.data),
    getActionMetrics: () => api.get('/analytics/actions').then(response => response.data),
  },
};

export default apiService;