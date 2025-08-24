// src/services/api.js
import axios from 'axios';

// API Configuration - Update with your actual API Gateway URL
const API_BASE_URL = 'https://x8dd7fpwf3.execute-api.eu-west-1.amazonaws.com/dev/api/v1';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method.toUpperCase()} request to: ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API Methods
export const apiService = {
  // Health Check
  checkHealth: () => api.get('/health'),

  // Requirements API
  requirements: {
    getAll: () => api.get('/requirements'),
    create: (requirementData) => api.post('/requirements', requirementData),
    getById: (id) => api.get(`/requirements/${id}`),
    update: (id, data) => api.put(`/requirements/${id}`, data),
    delete: (id) => api.delete(`/requirements/${id}`),
    approve: (id) => api.post(`/requirements/${id}/approve`),
    reject: (id, reason) => api.post(`/requirements/${id}/reject`, { reason }),
  },

  // Projects API
  projects: {
    getAll: () => api.get('/projects'),
    create: (projectData) => api.post('/projects', projectData),
    getById: (id) => api.get(`/projects/${id}`),
    update: (id, data) => api.put(`/projects/${id}`, data),
    delete: (id) => api.delete(`/projects/${id}`),
    getRequirements: (projectId) => api.get(`/projects/${projectId}/requirements`),
  },

  // Documents API
  documents: {
    upload: (file, metadata) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));
      
      return api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    getProcessingStatus: (documentId) => api.get(`/documents/${documentId}/status`),
    getExtractedText: (documentId) => api.get(`/documents/${documentId}/extracted-text`),
  },

  // Workflows API
  workflows: {
    getStatus: (executionArn) => api.get(`/workflows/status?executionArn=${encodeURIComponent(executionArn)}`),
    getHistory: (requirementId) => api.get(`/workflows/history/${requirementId}`),
    getAll: () => api.get('/workflows'),
  },

  // Analytics API
  analytics: {
    getDashboard: () => api.get('/analytics/dashboard'),
    getProjectMetrics: (projectId) => api.get(`/analytics/projects/${projectId}`),
    getWorkflowMetrics: () => api.get('/analytics/workflows'),
  },
};

// Utility functions
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    return {
      message: error.response.data?.message || 'Server error occurred',
      status: error.response.status,
      data: error.response.data,
    };
  } else if (error.request) {
    // Request made but no response
    return {
      message: 'No response from server. Please check your connection.',
      status: 0,
    };
  } else {
    // Something else happened
    return {
      message: error.message || 'An unexpected error occurred',
      status: -1,
    };
  }
};

export default api;