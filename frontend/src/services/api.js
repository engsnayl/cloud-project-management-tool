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

  // Actions API (formerly Requirements)
  actions: {
    getAll: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.owner) params.append('owner', filters.owner);
      if (filters.status) params.append('status', filters.status);
      
      const queryString = params.toString();
      return api.get(`/actions${queryString ? '?' + queryString : ''}`);
    },
    create: (actionData) => api.post('/actions', actionData),
    getById: (id) => api.get(`/actions/${id}`),
    updateStatus: (id, status) => api.put(`/actions/${id}`, { status }),
    delete: (id) => api.delete(`/actions/${id}`),
    getMyActions: (owner) => api.get(`/actions?owner=${encodeURIComponent(owner)}`),
  },

  // Projects API
  projects: {
    getAll: () => api.get('/projects'),
    create: (projectData) => api.post('/projects', projectData),
    getById: (id) => api.get(`/projects/${id}`),
    update: (id, data) => api.put(`/projects/${id}`, data),
    delete: (id) => api.delete(`/projects/${id}`),
    getActions: (projectId) => api.get(`/actions?projectId=${projectId}`),
  },

  // Documents API (for future email/document parsing)
  documents: {
    parseEmail: (emailContent) => api.post('/parse-email', { content: emailContent }),
    parseDocument: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      
      return api.post('/parse-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
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

  // Workflows API (for Step Functions monitoring)
  workflows: {
    getStatus: (executionArn) => api.get(`/workflows/status?executionArn=${encodeURIComponent(executionArn)}`),
    getHistory: (actionId) => api.get(`/workflows/history/${actionId}`),
    getAll: () => api.get('/workflows'),
    triggerReminder: (actionId) => api.post(`/workflows/reminder/${actionId}`),
  },

  // Analytics API
  analytics: {
    getDashboard: () => api.get('/analytics/dashboard'),
    getProjectMetrics: (projectId) => api.get(`/analytics/projects/${projectId}`),
    getActionMetrics: () => api.get('/analytics/actions'),
    getOverdueActions: () => api.get('/analytics/overdue-actions'),
  },

  // Email Integration API (for Phase 7.2)
  email: {
    processIncoming: (emailData) => api.post('/email/process', emailData),
    sendReminder: (actionId) => api.post(`/email/reminder/${actionId}`),
    sendDailySummary: (owner) => api.post('/email/daily-summary', { owner }),
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