import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import ActionModal from './ActionModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://x8dd7fpwf3.execute-api.eu-west-1.amazonaws.com/dev';

function Actions() {
  const [selectedAction, setSelectedAction] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const queryClient = useQueryClient();

  // Add filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    owner: '',
    project: '',
    deadline: ''
  });

  // Fetch actions
  const { data, isLoading, error } = useQuery(
    'actions',
    async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions`);
      if (!response.ok) throw new Error('Failed to fetch actions');
      return response.json();
    },
    {
      refetchInterval: 30000
    }
  );

  // Fetch projects for filter dropdown
  const { data: projectsData } = useQuery(
    'projects',
    async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/projects`);
        if (!response.ok) return { projects: [] };
        return response.json();
      } catch (error) {
        return { projects: [] };
      }
    }
  );

  const actions = data?.actions || [];
  const projects = projectsData?.projects || [];

  // Create action mutation
  const createActionMutation = useMutation(
    async (actionData) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData)
      });
      if (!response.ok) throw new Error('Failed to create action');
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
      }
    }
  );

  // Update action mutation
  const updateActionMutation = useMutation(
    async ({ actionId, actionData }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData)
      });
      if (!response.ok) throw new Error('Failed to update action');
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
      }
    }
  );

  // Delete action mutation
  const deleteActionMutation = useMutation(
    async (actionId) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions/${actionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete action');
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
      }
    }
  );

  const handleCreateAction = () => {
    setSelectedAction(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEditAction = (action) => {
    setSelectedAction(action);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleDeleteAction = async (actionId) => {
    if (window.confirm('Are you sure you want to delete this action?')) {
      deleteActionMutation.mutate(actionId);
    }
  };

  const handleSaveAction = async (formData) => {
    if (modalMode === 'create') {
      await createActionMutation.mutateAsync(formData);
    } else {
      await updateActionMutation.mutateAsync({
        actionId: selectedAction.actionId,
        actionData: formData
      });
    }
  };

  // Enhanced filtering logic
  const filteredActions = actions.filter(action => {
    // Search filter
    const matchesSearch = !searchTerm || 
      action.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.description?.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus = !filters.status || action.status === filters.status;

    // Priority filter
    const matchesPriority = !filters.priority || action.priority === filters.priority;

    // Owner filter
    const matchesOwner = !filters.owner || action.owner === filters.owner;

    // Project filter
    const matchesProject = !filters.project || action.projectId === filters.project;

    // Deadline filter
    const matchesDeadline = !filters.deadline || action.deadline === filters.deadline;

    return matchesSearch && matchesStatus && matchesPriority && 
           matchesOwner && matchesProject && matchesDeadline;
  });

  // Get unique values for dropdowns
  const uniqueOwners = [...new Set(actions.map(action => action.owner).filter(Boolean))];
  const uniqueStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
  const uniquePriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  // Filter handlers
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      status: '',
      priority: '',
      owner: '',
      project: '',
      deadline: ''
    });
    setSearchTerm('');
  };

  const getStatusColor = (status) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toUpperCase()) {
      case 'URGENT': return 'border-l-red-600';
      case 'HIGH': return 'border-l-red-500';
      case 'MEDIUM': return 'border-l-yellow-500';
      case 'LOW': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  const getProjectName = (projectId) => {
    if (projectId === 'miscellaneous') return 'Miscellaneous';
    const project = projects.find(p => p.projectId === projectId);
    return project?.name || projectId;
  };

  const activeFiltersCount = Object.values(filters).filter(Boolean).length + (searchTerm ? 1 : 0);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading actions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error loading actions: {error.message}</p>
        <button 
          onClick={() => queryClient.invalidateQueries('actions')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Actions ({filteredActions.length}/{actions.length})</h1>
          {activeFiltersCount > 0 && (
            <p className="text-sm text-gray-600 mt-1">{activeFiltersCount} filters active</p>
          )}
        </div>
        <button
          onClick={handleCreateAction}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          Create Action
        </button>
      </div>

      {/* Search Bar */}
      <div>
        <input
          type="text"
          placeholder="Search actions by title or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filter Controls */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>
                  {status.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {uniquePriorities.map(priority => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          {/* Owner Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Owner</label>
            <select
              value={filters.owner}
              onChange={(e) => handleFilterChange('owner', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {uniqueOwners.map(owner => (
                <option key={owner} value={owner}>
                  {owner?.split('@')[0] || owner}
                </option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
            <select
              value={filters.project}
              onChange={(e) => handleFilterChange('project', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="miscellaneous">Miscellaneous</option>
              {projects.map(project => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Deadline Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Deadline</label>
            <input
              type="date"
              value={filters.deadline}
              onChange={(e) => handleFilterChange('deadline', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={clearAllFilters}
              disabled={activeFiltersCount === 0}
              className="w-full px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              Clear ({activeFiltersCount})
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredActions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500">
              {actions.length === 0 ? 'No actions found.' : 'No actions match your filters.'}
            </p>
            {actions.length === 0 ? (
              <button
                onClick={handleCreateAction}
                className="mt-4 text-blue-500 hover:text-blue-600"
              >
                Create your first action
              </button>
            ) : (
              <button
                onClick={clearAllFilters}
                className="mt-4 text-blue-500 hover:text-blue-600"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filteredActions.map((action) => {
            const isOverdue = action.deadline && new Date(action.deadline) < new Date() && action.status !== 'COMPLETED';
            
            return (
              <div
                key={action.actionId}
                className={`bg-white rounded-lg border-l-4 ${getPriorityColor(action.priority)} shadow-sm p-6 ${
                  isOverdue ? 'bg-red-50 border-red-300' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{action.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}>
                        {action.status}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    
                    {action.description && (
                      <p className="text-gray-600 mb-3">{action.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Owner: <span className="font-medium">{action.owner?.split('@')[0] || action.owner}</span></span>
                      <span>Priority: <span className="font-medium">{action.priority}</span></span>
                      <span>Project: <span className="font-medium">{getProjectName(action.projectId)}</span></span>
                      {action.deadline && (
                        <span>Due: <span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                          {new Date(action.deadline).toLocaleDateString()}
                        </span></span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditAction(action)}
                      className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50"
                      title="Edit action"
                    >
                      ✏️
                    </button>
                    
                    <button
                      onClick={() => handleDeleteAction(action.actionId)}
                      className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50"
                      title="Delete action"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ActionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        action={selectedAction}
        onSave={handleSaveAction}
        mode={modalMode}
      />
    </div>
  );
}

export default Actions;