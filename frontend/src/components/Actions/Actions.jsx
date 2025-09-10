// src/components/Actions.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Edit3,
  Trash2,
  ExternalLink,
  Folder,
  FolderPlus
} from 'lucide-react';
import apiService from '../../services/api';

const Actions = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuickProject, setShowQuickProject] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    owner: '',
    projectId: '',
    deadline: '',
    priority: 'MEDIUM'
  });
  const [quickProjectData, setQuickProjectData] = useState({
    name: '',
    description: '',
    owner: ''
  });

  const queryClient = useQueryClient();

  // Fetch actions
  const { data: actionsData, isLoading: actionsLoading, error: actionsError } = useQuery(
    ['actions', statusFilter],
    () => apiService.actions.getAll(statusFilter !== 'all' ? { status: statusFilter } : {}),
    {
      staleTime: 30000,
      refetchOnWindowFocus: false
    }
  );

  // Fetch projects for dropdown
  const { data: projectsData, isLoading: projectsLoading } = useQuery(
    'projects',
    () => apiService.projects.getAll(),
    {
      staleTime: 60000,
      refetchOnWindowFocus: false
    }
  );

  // Create action mutation
  const createActionMutation = useMutation(
    (actionData) => apiService.actions.create(actionData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
        setShowCreateModal(false);
        resetForm();
      },
      onError: (error) => {
        console.error('Error creating action:', error);
        alert('Failed to create action. Please try again.');
      }
    }
  );

  // Create quick project mutation
  const createProjectMutation = useMutation(
    (projectData) => apiService.projects.create(projectData),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('projects');
        // Auto-select the newly created project
        setFormData(prev => ({ ...prev, projectId: response.project.projectId }));
        setShowQuickProject(false);
        setQuickProjectData({ name: '', description: '', owner: '' });
      },
      onError: (error) => {
        console.error('Error creating project:', error);
        alert('Failed to create project. Please try again.');
      }
    }
  );

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      owner: '',
      projectId: '',
      deadline: '',
      priority: 'MEDIUM'
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.owner) {
      alert('Please fill in required fields (Title and Owner)');
      return;
    }

    // Use "miscellaneous" project if no project selected
    const actionData = {
      ...formData,
      projectId: formData.projectId || 'miscellaneous'
    };

    createActionMutation.mutate(actionData);
  };

  const handleQuickProjectSubmit = (e) => {
    e.preventDefault();
    
    if (!quickProjectData.name || !quickProjectData.owner) {
      alert('Please fill in project name and owner');
      return;
    }

    createProjectMutation.mutate(quickProjectData);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in_progress': return Clock;
      case 'overdue': return AlertTriangle;
      default: return Clock;
    }
  };

  const actions = actionsData?.actions || [];
  const projects = projectsData?.projects || [];
  
  // Filter actions based on search term
  const filteredActions = actions.filter(action => 
    action.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    action.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    action.owner?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Status counts
  const statusCounts = {
    all: actions.length,
    pending: actions.filter(a => a.status === 'pending').length,
    in_progress: actions.filter(a => a.status === 'in_progress').length,
    completed: actions.filter(a => a.status === 'completed').length,
    overdue: actions.filter(a => a.status === 'overdue').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Action Tracking</h1>
          <p className="text-gray-600 mt-1">Manage and track project actions and deliverables</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Action
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
        {[
          { key: 'all', label: 'ALL' },
          { key: 'pending', label: 'PENDING' },
          { key: 'in_progress', label: 'IN PROGRESS' },
          { key: 'completed', label: 'COMPLETED' },
          { key: 'overdue', label: 'OVERDUE' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              statusFilter === tab.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label} ({statusCounts[tab.key]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search actions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Actions List */}
      {actionsLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading actions...</p>
        </div>
      ) : actionsError ? (
        <div className="text-center py-8">
          <p className="text-red-600">Error loading actions. Please try again.</p>
        </div>
      ) : filteredActions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No actions found for the selected filter.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Action
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredActions.map((action) => {
            const StatusIcon = getStatusIcon(action.status);
            const project = projects.find(p => p.projectId === action.projectId);
            
            return (
              <div key={action.actionId} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{action.title}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {action.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    {action.description && (
                      <p className="text-gray-600 mb-3">{action.description}</p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{action.owner}</span>
                      </div>
                      
                      {project && (
                        <div className="flex items-center gap-1">
                          <Folder className="w-4 h-4" />
                          <span>{project.name}</span>
                        </div>
                      )}
                      
                      {action.deadline && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(action.deadline).toLocaleDateString()}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <span>Priority: {action.priority}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Action Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Create New Action</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter action title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter action description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner (Email) *
                  </label>
                  <input
                    type="email"
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    placeholder="owner@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Project
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickProject(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <FolderPlus className="w-4 h-4" />
                      New Project
                    </button>
                  </div>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Miscellaneous (No Project)</option>
                    {projects.map((project) => (
                      <option key={project.projectId} value={project.projectId}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select a project or leave as "Miscellaneous" to assign later
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createActionMutation.isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createActionMutation.isLoading ? 'Creating...' : 'Create Action'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Quick Project Creation Modal */}
      {showQuickProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Quick Create Project</h2>
                <button
                  onClick={() => setShowQuickProject(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleQuickProjectSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={quickProjectData.name}
                    onChange={(e) => setQuickProjectData({ ...quickProjectData, name: e.target.value })}
                    placeholder="Enter project name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={quickProjectData.description}
                    onChange={(e) => setQuickProjectData({ ...quickProjectData, description: e.target.value })}
                    placeholder="Brief project description"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner (Email) *
                  </label>
                  <input
                    type="email"
                    value={quickProjectData.owner}
                    onChange={(e) => setQuickProjectData({ ...quickProjectData, owner: e.target.value })}
                    placeholder="owner@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowQuickProject(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createProjectMutation.isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createProjectMutation.isLoading ? 'Creating...' : 'Create & Select'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Actions;