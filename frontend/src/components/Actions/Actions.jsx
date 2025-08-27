// frontend/src/components/Actions.jsx
import React, { useState, useEffect } from 'react';
import { Plus, User, Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://x8dd7fpwf3.execute-api.eu-west-1.amazonaws.com/dev';

const Actions = () => {
  const [actions, setActions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    owner: '',
    projectId: '',
    deadline: '',
    priority: 'MEDIUM',
    source: 'MANUAL'
  });

  useEffect(() => {
    fetchActions();
    fetchProjects();
  }, []);

  const fetchActions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions`);
      if (!response.ok) throw new Error('Failed to fetch actions');
      
      const data = await response.json();
      setActions(data.actions || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching actions:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const createAction = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAction)
      });

      if (!response.ok) throw new Error('Failed to create action');

      const data = await response.json();
      setActions([...actions, data.action]);
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
    } catch (err) {
      console.error('Error creating action:', err);
      setError(err.message);
    }
  };

  const updateActionStatus = async (actionId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update action');

      // Refresh actions list
      fetchActions();
    } catch (err) {
      console.error('Error updating action:', err);
      setError(err.message);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'OVERDUE':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
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
    return action.status === filter;
  });

  if (loading) return <div className="flex justify-center p-8">Loading actions...</div>;
  if (error) return <div className="text-red-600 p-4">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Action Tracking</h1>
          <p className="text-gray-600">Manage and track project actions and deliverables</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Action
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-8">
          {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === status
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {status.replace('_', ' ')} ({actions.filter(a => status === 'ALL' || a.status === status).length})
            </button>
          ))}
        </div>
      </div>

      {/* Actions List */}
      <div className="space-y-4">
        {filteredActions.map((action) => (
          <div key={action.actionId} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(action.status)}
                  <h3 className="text-lg font-medium text-gray-900">{action.title}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(action.priority)}`}>
                    {action.priority}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-3">{action.description}</p>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {action.owner}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Due: {new Date(action.deadline).toLocaleDateString()}
                  </div>
                  <div>
                    Project: {getProjectName(action.projectId)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                {action.status !== 'COMPLETED' && (
                  <select
                    value={action.status}
                    onChange={(e) => updateActionStatus(action.actionId, e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                )}
                <span className="text-xs text-gray-400">
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

      {/* Create Action Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Action</h2>
            <form onSubmit={createAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newAction.title}
                  onChange={(e) => setNewAction({...newAction, title: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newAction.description}
                  onChange={(e) => setNewAction({...newAction, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="3"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner (Email)</label>
                <input
                  type="email"
                  required
                  value={newAction.owner}
                  onChange={(e) => setNewAction({...newAction, owner: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <select
                  required
                  value={newAction.projectId}
                  onChange={(e) => setNewAction({...newAction, projectId: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={newAction.priority}
                  onChange={(e) => setNewAction({...newAction, priority: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
                >
                  Create Action
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Actions;