// src/components/Projects/ProjectOverview.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiService from '../../services/api';
import { 
  Plus, 
  FolderOpen, 
  CheckSquare, 
  Users,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  X
} from 'lucide-react';

const ProjectsPage = () => {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    owner: ''
  });

  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projectsResponse, isLoading: projectsLoading } = useQuery(
    'projects-page',
    () => apiService.projects.getAll(),
    { retry: 2 }
  );

  // Fetch actions to show project stats
  const { data: actionsResponse } = useQuery(
    'actions-for-projects',
    () => apiService.actions.getAll(),
    { retry: 2 }
  );

  // Create project mutation
  const createProjectMutation = useMutation(
    (projectData) => apiService.projects.create(projectData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('projects-page');
        queryClient.invalidateQueries('nav-projects');
        setShowCreateProject(false);
        setNewProject({ name: '', description: '', owner: '' });
      },
      onError: (error) => {
        console.error('Failed to create project:', error);
      }
    }
  );

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (newProject.name && newProject.description) {
      createProjectMutation.mutate(newProject);
    }
  };

  // Extract data
  const projects = projectsResponse?.projects || [];
  const actions = actionsResponse?.actions || [];

  // Calculate project stats
  const getProjectStats = (projectId) => {
    const projectActions = actions.filter(action => action.projectId === projectId);
    return {
      totalActions: projectActions.length,
      pendingActions: projectActions.filter(a => a.status === 'PENDING').length,
      completedActions: projectActions.filter(a => a.status === 'COMPLETED').length
    };
  };

  if (projectsLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-600">Loading projects...</span>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Organize and manage your action items by project</p>
        </div>
        <button
          onClick={() => setShowCreateProject(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Project
        </button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-600 mb-4">Create your first project to organize your actions</p>
          <button
            onClick={() => setShowCreateProject(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const stats = getProjectStats(project.projectId);
            
            return (
              <div key={project.projectId} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{project.description}</p>
                  </div>
                  <div className="ml-4">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Project Stats */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 bg-blue-50 rounded">
                      <div className="text-lg font-semibold text-blue-600">{stats.totalActions}</div>
                      <div className="text-xs text-blue-600">Total</div>
                    </div>
                    <div className="p-2 bg-yellow-50 rounded">
                      <div className="text-lg font-semibold text-yellow-600">{stats.pendingActions}</div>
                      <div className="text-xs text-yellow-600">Pending</div>
                    </div>
                    <div className="p-2 bg-green-50 rounded">
                      <div className="text-lg font-semibold text-green-600">{stats.completedActions}</div>
                      <div className="text-xs text-green-600">Done</div>
                    </div>
                  </div>

                  {/* Project Info */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <Users className="w-3 h-3 mr-1" />
                      {project.owner || 'Unassigned'}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-between items-center pt-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      project.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status || 'ACTIVE'}
                    </span>
                    
                    <div className="flex space-x-1">
                      <button className="p-1 text-gray-400 hover:text-blue-600 rounded">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create New Project</h3>
              <button
                onClick={() => setShowCreateProject(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter project name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Describe the project"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Owner
                </label>
                <input
                  type="email"
                  value={newProject.owner}
                  onChange={(e) => setNewProject({...newProject, owner: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="owner@company.com"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateProject(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createProjectMutation.isLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;