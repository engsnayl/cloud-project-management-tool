// src/components/Actions/Actions.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useLocation } from 'react-router-dom';
import apiService from '../../services/api';
import { 
  Plus, 
  Search, 
  Filter, 
  CheckSquare, 
  Clock, 
  User, 
  Calendar,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';

const Actions = () => {
  const [showNewAction, setShowNewAction] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [deadlineFilter, setDeadlineFilter] = useState('');
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    owner: '',
    projectId: '',
    deadline: '',
    priority: 'MEDIUM',
    status: 'PENDING'
  });

  const location = useLocation();
  const queryClient = useQueryClient();

  // Check URL params for auto-opening new action modal
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'true') {
      setShowNewAction(true);
    }
  }, [location]);

  // Fetch actions
  const { data: actionsResponse, isLoading: actionsLoading, error: actionsError } = useQuery(
    'actions',
    () => apiService.actions.getAll(),
    { retry: 2, refetchInterval: 30000 }
  );

  // Fetch projects for dropdown
  const { data: projectsResponse } = useQuery(
    'projects',
    () => apiService.projects.getAll(),
    { retry: 2 }
  );

  // Create action mutation
  const createActionMutation = useMutation(
    (actionData) => apiService.actions.create(actionData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
        queryClient.invalidateQueries('nav-actions');
        queryClient.invalidateQueries('dashboard-analytics');
        setShowNewAction(false);
        resetForm();
      },
      onError: (error) => {
        console.error('Failed to create action:', error);
      }
    }
  );

  // Update action mutation
  const updateActionMutation = useMutation(
    ({ actionId, data }) => apiService.actions.update(actionId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
        queryClient.invalidateQueries('nav-actions');
        queryClient.invalidateQueries('dashboard-analytics');
        setEditingAction(null);
      },
      onError: (error) => {
        console.error('Failed to update action:', error);
      }
    }
  );

  // Delete action mutation
  const deleteActionMutation = useMutation(
    (actionId) => apiService.actions.delete(actionId),
    {
      onSuccess: (data, deletedActionId) => {
        // Correct manual cache update for the response structure
        queryClient.setQueryData('actions', (oldData) => {
          if (!oldData || !oldData.actions) return oldData;
          
          const updatedActions = oldData.actions.filter(
            action => action.actionId !== deletedActionId
          );
          
          return {
            actions: updatedActions,
            count: updatedActions.length
          };
        });
        
        // Invalidate other queries
        queryClient.invalidateQueries('nav-actions');
        queryClient.invalidateQueries('dashboard-analytics');
        setDeleteConfirm(null);
      },
      onError: (error, actionId) => {
        console.error('Delete failed:', error);
        setDeleteConfirm(null);
      }
    }
  );

  const resetForm = () => {
    setNewAction({
      title: '',
      description: '',
      owner: '',
      projectId: '',
      deadline: '',
      priority: 'MEDIUM',
      status: 'PENDING'
    });
  };

  const handleCreateAction = (e) => {
    e.preventDefault();
    if (newAction.title && newAction.description && newAction.owner) {
      createActionMutation.mutate(newAction);
    }
  };

  const handleEditAction = (action) => {
    setEditingAction({
      ...action,
      deadline: action.deadline ? action.deadline.split('T')[0] : ''
    });
  };

  const handleUpdateAction = (e) => {
    e.preventDefault();
    if (editingAction) {
      const { actionId, ...updateData } = editingAction;
      updateActionMutation.mutate({ actionId, data: updateData });
    }
  };

  const handleDeleteAction = (actionId) => {
    console.log('Setting up delete for action ID:', actionId);
    setDeleteConfirm(actionId);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      console.log('Confirming delete for action ID:', deleteConfirm);
      deleteActionMutation.mutate(deleteConfirm);
    }
  };

  // Extract data
  const actions = actionsResponse?.actions || [];
  const projects = projectsResponse?.projects || [];

  // Get unique values for filter dropdowns
  const uniqueOwners = [...new Set(actions.map(action => action.owner))].filter(Boolean);
  const uniqueProjects = [...new Set(actions.map(action => action.projectId))].filter(Boolean);

  // Enhanced filtering
  const filteredActions = actions.filter(action => {
    const matchesSearch = action.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         action.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || action.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || action.priority === priorityFilter;
    const matchesOwner = ownerFilter === 'ALL' || action.owner === ownerFilter;
    const matchesProject = projectFilter === 'ALL' || action.projectId === projectFilter;
    const matchesDeadline = !deadlineFilter || action.deadline === deadlineFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesOwner && matchesProject && matchesDeadline;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'BLOCKED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'text-red-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'LOW': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.projectId === projectId);
    return project?.name || 'Miscellaneous';
  };

  if (actionsLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-600">Loading actions...</span>
      </div>
    );
  }

  if (actionsError) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">Failed to load actions</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Actions</h1>
          <p className="text-gray-600 mt-1">Manage and track action items across all projects</p>
        </div>
        <button
          onClick={() => setShowNewAction(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Action
        </button>
      </div>

      {/* Enhanced Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col gap-4">
          {/* First Row: Search */}
          <div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search actions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Second Row: All Filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="BLOCKED">Blocked</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="ALL">All Priority</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Owner Filter */}
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="ALL">All Owners</option>
              {uniqueOwners.map(owner => (
                <option key={owner} value={owner}>
                  {owner.split('@')[0]} {/* Show just name part of email */}
                </option>
              ))}
            </select>

            {/* Project Filter */}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="ALL">All Projects</option>
              {uniqueProjects.map(projectId => (
                <option key={projectId} value={projectId}>
                  {getProjectName(projectId)}
                </option>
              ))}
            </select>

            {/* Deadline Filter */}
            <input
              type="date"
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Filter by deadline"
            />

            {/* Clear Filters Button */}
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setOwnerFilter('ALL');
                setProjectFilter('ALL');
                setDeadlineFilter('');
              }}
              className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Filter Summary */}
      {(searchTerm || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || ownerFilter !== 'ALL' || projectFilter !== 'ALL' || deadlineFilter) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              Showing {filteredActions.length} of {actions.length} actions
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setOwnerFilter('ALL');
                setProjectFilter('ALL');
                setDeadlineFilter('');
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Reset filters
            </button>
          </div>
        </div>
      )}

      {/* Actions List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {filteredActions.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No actions found</h3>
            <p className="text-gray-600 mb-4">
              {actions.length === 0 ? 'Create your first action to get started' : 'Try adjusting your filters'}
            </p>
            <button
              onClick={() => setShowNewAction(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Action
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredActions.map((action) => (
              <div key={action.actionId} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 truncate">{action.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(action.status)}`}>
                        {action.status}
                      </span>
                      <span className={`text-sm font-medium ${getPriorityColor(action.priority)}`}>
                        {action.priority}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-3">{action.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-1" />
                        {action.owner}
                      </div>
                      {action.deadline && (
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(action.deadline).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex items-center">
                        <FolderOpen className="w-4 h-4 mr-1" />
                        {getProjectName(action.projectId)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEditAction(action)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit action"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAction(action.actionId)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete action"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Action Modal */}
      {showNewAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create New Action</h3>
              <button
                onClick={() => setShowNewAction(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateAction} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={newAction.title}
                    onChange={(e) => setNewAction({...newAction, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter action title"
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={newAction.description}
                    onChange={(e) => setNewAction({...newAction, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Describe the action"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
                  <input
                    type="email"
                    value={newAction.owner}
                    onChange={(e) => setNewAction({...newAction, owner: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="owner@company.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                  <select
                    value={newAction.projectId}
                    onChange={(e) => setNewAction({...newAction, projectId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select project (optional)</option>
                    {projects.map(project => (
                      <option key={project.projectId} value={project.projectId}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={newAction.priority}
                    onChange={(e) => setNewAction({...newAction, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                  <input
                    type="date"
                    value={newAction.deadline}
                    onChange={(e) => setNewAction({...newAction, deadline: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewAction(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createActionMutation.isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createActionMutation.isLoading ? 'Creating...' : 'Create Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Action Modal */}
      {editingAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Action</h3>
              <button
                onClick={() => setEditingAction(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateAction} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={editingAction.title}
                    onChange={(e) => setEditingAction({...editingAction, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editingAction.description}
                    onChange={(e) => setEditingAction({...editingAction, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
                  <input
                    type="email"
                    value={editingAction.owner}
                    onChange={(e) => setEditingAction({...editingAction, owner: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={editingAction.status}
                    onChange={(e) => setEditingAction({...editingAction, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={editingAction.priority}
                    onChange={(e) => setEditingAction({...editingAction, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                  <input
                    type="date"
                    value={editingAction.deadline}
                    onChange={(e) => setEditingAction({...editingAction, deadline: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingAction(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateActionMutation.isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateActionMutation.isLoading ? 'Updating...' : 'Update Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Delete Action</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this action? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteActionMutation.isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteActionMutation.isLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Actions;