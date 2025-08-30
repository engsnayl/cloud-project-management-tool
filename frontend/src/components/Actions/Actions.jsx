// src/components/Actions/Actions.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiService from '../../services/api';
import { Plus, User, Calendar, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';

const Actions = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const queryClient = useQueryClient();

  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    owner: '',
    projectId: '',
    deadline: '',
    priority: 'MEDIUM',
    source: 'MANUAL'
  });

  // Fetch actions using React Query and API service
  const { data: actionsResponse, isLoading: actionsLoading, error: actionsError } = useQuery(
    'actions',
    () => apiService.actions.getAll(),
    { retry: 1, refetchOnWindowFocus: false }
  );

  // Fetch projects for the dropdown
  const { data: projectsResponse, isLoading: projectsLoading } = useQuery(
    'projects',
    () => apiService.projects.getAll(),
    { retry: 1, refetchOnWindowFocus: false }
  );

  // Create action mutation
  const createActionMutation = useMutation(
    (actionData) => apiService.actions.create(actionData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
        setNewAction({
          title: '',
          description: '',
          owner: '',
          projectId: '',
          deadline: '',
          priority: 'MEDIUM',
          source: 'MANUAL'
        });
        setShowCreateForm(false);
      },
    }
  );

  // Update action status mutation
  const updateStatusMutation = useMutation(
    ({ actionId, status }) => apiService.actions.updateStatus(actionId, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
      },
    }
  );

  const actions = actionsResponse?.data?.actions || [];
  const projects = projectsResponse?.data?.projects || [];

  const createAction = async (e) => {
    e.preventDefault();
    createActionMutation.mutate(newAction);
  };

  const updateActionStatus = (actionId, newStatus) => {
    updateStatusMutation.mutate({ actionId, status: newStatus });
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toUpperCase()) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.projectId === projectId);
    return project ? project.name : projectId;
  };

  const filteredActions = actions.filter(action => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return action.status === 'pending';
    return action.status?.toLowerCase() === filter.toLowerCase();
  });

  if (actionsLoading) return (
    <div className="p-4 lg:p-8">
      <div className="flex justify-center">Loading actions...</div>
    </div>
  );

  if (actionsError) return (
    <div className="p-4 lg:p-8">
      <div className="text-red-600">Error: {actionsError.message}</div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Action Tracking</h1>
            <p className="text-sm lg:text-base text-gray-600">Manage and track project actions and deliverables</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full lg:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Action
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200 overflow-x-auto">
          <div className="flex space-x-4 lg:space-x-8 min-w-max">
            {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  filter === status
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {status.replace('_', ' ')} ({actions.filter(a => 
                  status === 'ALL' || 
                  (status === 'PENDING' ? a.status === 'pending' : a.status?.toLowerCase() === status.toLowerCase())
                ).length})
              </button>
            ))}
          </div>
        </div>

        {/* Actions List */}
        <div className="space-y-4">
          {filteredActions.map((action) => (
            <div key={action.actionId} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {getStatusIcon(action.status)}
                    <h3 className="text-base lg:text-lg font-medium text-gray-900 truncate flex-1">{action.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getPriorityColor(action.priority)}`}>
                      {action.priority}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-3 text-sm lg:text-base">{action.description}</p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{action.owner}</span>
                    </div>
                    {action.deadline && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>Due: {new Date(action.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="truncate">
                      Project: {getProjectName(action.projectId)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between lg:justify-end gap-2">
                  {action.status !== 'completed' && (
                    <select
                      value={action.status}
                      onChange={(e) => updateActionStatus(action.actionId, e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm flex-shrink-0"
                      disabled={updateStatusMutation.isLoading}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  )}
                  <span className="text-xs text-gray-400 font-mono">
                    {action.actionId}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredActions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No actions found for the selected filter.
          </div>
        )}

        {/* Create Action Modal - Fixed positioning and scrolling */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold">Create New Action</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="overflow-y-auto flex-1">
                <form onSubmit={createAction} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      required
                      value={newAction.title}
                      onChange={(e) => setNewAction({...newAction, title: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter action title"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newAction.description}
                      onChange={(e) => setNewAction({...newAction, description: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows="3"
                      placeholder="Enter action description"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner (Email)</label>
                    <input
                      type="email"
                      required
                      value={newAction.owner}
                      onChange={(e) => setNewAction({...newAction, owner: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="owner@example.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                    <select
                      required
                      value={newAction.projectId}
                      onChange={(e) => setNewAction({...newAction, projectId: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Project</option>
                      {projects.map(project => (
                        <option key={project.projectId} value={project.projectId}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                    <input
                      type="date"
                      value={newAction.deadline}
                      onChange={(e) => setNewAction({...newAction, deadline: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={newAction.priority}
                      onChange={(e) => setNewAction({...newAction, priority: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={createAction}
                    disabled={createActionMutation.isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md disabled:opacity-50 transition-colors"
                  >
                    {createActionMutation.isLoading ? 'Creating...' : 'Create Action'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Actions;