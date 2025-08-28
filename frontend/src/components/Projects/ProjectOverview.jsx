// src/components/Projects/ProjectOverview.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import apiService from '../../services/api';
import { 
  Plus, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle,
  CheckSquare,
  Upload,
  GitBranch,
  Activity,
  ExternalLink,
  FolderOpen,
  BarChart3
} from 'lucide-react';

const ProjectOverview = () => {
  // Fetch projects data
  const { data: projectsResponse, isLoading: projectsLoading, error: projectsError } = useQuery(
    'projects',
    () => apiService.projects.getAll(),
    { retry: 1, refetchOnWindowFocus: false }
  );

  // Fetch actions data for metrics
  const { data: actionsResponse, isLoading: actionsLoading } = useQuery(
    'actions',
    () => apiService.actions.getAll(),
    { retry: 1, refetchOnWindowFocus: false }
  );

  // Calculate metrics
  const projects = projectsResponse?.data?.projects || [];
  const actions = actionsResponse?.data?.actions || [];
  const totalActions = actions.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedActions = actions.filter(a => a.status === 'completed').length;
  const completionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  console.log('Projects data:', projects);
  console.log('Actions data:', actions);

  return (
    <div className="p-8" style={{ marginLeft: '256px' }}> {/* Fixed sidebar overlap */}
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Project Overview</h1>
              <p className="text-gray-600">Monitor your action tracking and project delivery platform</p>
            </div>
            <Link 
              to="/actions" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Action
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Actions */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Actions</p>
                <p className="text-2xl font-bold text-gray-900">{totalActions}</p>
                <p className="text-xs text-gray-500 mt-1">+0%</p>
              </div>
            </div>
          </div>

          {/* Active Projects */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FolderOpen className="w-5 h-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">{activeProjects}</p>
                <p className="text-xs text-gray-500 mt-1">{projects.length} total</p>
              </div>
            </div>
          </div>

          {/* Documents Processed */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Upload className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Documents Processed</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-xs text-gray-500 mt-1">+0 today</p>
              </div>
            </div>
          </div>

          {/* Completion Rate */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{completionRate}%</p>
                <p className="text-xs text-gray-500 mt-1">{completedActions}/{totalActions} completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading States */}
        {(projectsLoading || actionsLoading) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex space-x-4">
                    <div className="rounded-full bg-gray-200 h-8 w-8"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error States */}
        {(projectsError || actionsResponse?.error) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">Error loading data. Please check your API connection.</p>
            <p className="text-sm text-red-600 mt-1">
              Projects: {projectsError?.message || 'OK'} | 
              Actions: {actionsResponse?.error || 'OK'}
            </p>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            
            {!projectsLoading && !actionsLoading && (actions.length > 0 || projects.length > 0) ? (
              <div className="space-y-4">
                {/* Show recent projects */}
                {projects.slice(0, 2).map(project => (
                  <div key={project.projectId} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <FolderOpen className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Project created: {project.name}</p>
                      <p className="text-xs text-gray-500">{new Date(project.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {/* Show recent actions */}
                {actions.slice(0, 3).map(action => (
                  <div key={action.actionId} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Action: {action.title}</p>
                      <p className="text-xs text-gray-500">Assigned to {action.owner} • {action.status}</p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(action.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : !projectsLoading && !actionsLoading ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No recent activity</p>
                <p className="text-sm text-gray-400 mt-1">Create your first project or action to get started</p>
              </div>
            ) : null}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link 
                to="/actions"
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group block"
              >
                <div className="flex items-center">
                  <CheckSquare className="w-4 h-4 text-gray-400 group-hover:text-blue-600 mr-3" />
                  <span className="font-medium text-gray-700 group-hover:text-blue-700">Create Action</span>
                </div>
              </Link>

              <button className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors group">
                <div className="flex items-center">
                  <FolderOpen className="w-4 h-4 text-gray-400 group-hover:text-purple-600 mr-3" />
                  <span className="font-medium text-gray-700 group-hover:text-purple-700">Create Project</span>
                </div>
              </button>

              <Link 
                to="/documents"
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors group block"
              >
                <div className="flex items-center">
                  <Upload className="w-4 h-4 text-gray-400 group-hover:text-green-600 mr-3" />
                  <span className="font-medium text-gray-700 group-hover:text-green-700">Upload Document</span>
                </div>
              </Link>

              <Link 
                to="/workflows"
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors group block"
              >
                <div className="flex items-center">
                  <GitBranch className="w-4 h-4 text-gray-400 group-hover:text-orange-600 mr-3" />
                  <span className="font-medium text-gray-700 group-hover:text-orange-700">View Workflows</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">API Gateway</span>
              <span className="text-sm font-medium text-green-600">Operational</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Lambda Functions</span>
              <span className="text-sm font-medium text-green-600">Healthy</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Step Functions</span>
              <span className="text-sm font-medium text-green-600">Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">DynamoDB</span>
              <span className="text-sm font-medium text-green-600">Available</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">EventBridge</span>
              <span className="text-sm font-medium text-green-600">Running</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOverview;