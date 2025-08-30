// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useQuery } from 'react-query';
import apiService from './services/api';
import Header from "./components/Layout/Header";
import Navigation from "./components/Layout/Navigation";
import Actions from "./components/Actions";
import Projects from "./components/Projects/ProjectOverview";
import Documents from "./components/Documents/DocumentUpload";
import Workflows from "./components/Workflows/WorkflowDashboard";
import './App.css';

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Dashboard Component with Real Data
const Dashboard = () => {
  // Fetch actions data
  const { data: actionsResponse, isLoading: actionsLoading } = useQuery(
    'dashboard-actions',
    () => apiService.actions.getAll(),
    { retry: 1, refetchOnWindowFocus: false }
  );

  // Fetch projects data
  const { data: projectsResponse, isLoading: projectsLoading } = useQuery(
    'dashboard-projects',
    () => apiService.projects.getAll(),
    { retry: 1, refetchOnWindowFocus: false }
  );

  const actions = actionsResponse?.data?.actions || [];
  const projects = projectsResponse?.data?.projects || [];

  // Calculate metrics
  const totalActions = actions.length;
  const pendingActions = actions.filter(a => a.status === 'pending').length;
  const completedActions = actions.filter(a => a.status === 'completed').length;
  const overdueActions = actions.filter(a => {
    if (!a.deadline) return false;
    return new Date(a.deadline) < new Date() && a.status !== 'completed';
  }).length;

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Action Tracking Dashboard</h1>
          <p className="text-gray-600 text-sm lg:text-base">Monitor and manage project actions and deliverables</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <span className="text-xl lg:text-2xl">📋</span>
              </div>
              <div className="ml-3 lg:ml-4 min-w-0">
                <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Total Actions</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-900">
                  {actionsLoading ? '...' : totalActions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                <span className="text-xl lg:text-2xl">⏳</span>
              </div>
              <div className="ml-3 lg:ml-4 min-w-0">
                <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Pending</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-900">
                  {actionsLoading ? '...' : pendingActions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                <span className="text-xl lg:text-2xl">✅</span>
              </div>
              <div className="ml-3 lg:ml-4 min-w-0">
                <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Completed</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-900">
                  {actionsLoading ? '...' : completedActions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                <span className="text-xl lg:text-2xl">🚨</span>
              </div>
              <div className="ml-3 lg:ml-4 min-w-0">
                <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Overdue</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-900">
                  {actionsLoading ? '...' : overdueActions}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          
          {actionsLoading || projectsLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading recent activity...</p>
            </div>
          ) : actions.length > 0 || projects.length > 0 ? (
            <div className="space-y-3 lg:space-y-4">
              {/* Recent Projects */}
              {projects.slice(0, 2).map(project => (
                <div key={project.projectId} className="flex items-center space-x-3 lg:space-x-4 p-3 hover:bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-semibold text-sm">P</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">Project created: {project.name}</p>
                    <p className="text-xs text-gray-500">{new Date(project.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              
              {/* Recent Actions */}
              {actions.slice(0, 3).map(action => (
                <div key={action.actionId} className="flex items-center space-x-3 lg:space-x-4 p-3 hover:bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-sm">A</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">Action: {action.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      Assigned to {action.owner} • Status: {action.status}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                    {new Date(action.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No recent activity. Start by creating your first action!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <div className="flex">
            <Navigation />
            <main className="flex-1 ml-0 lg:ml-64 md:ml-56 transition-all duration-300 overflow-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/actions" element={<Actions />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/workflows" element={<Workflows />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;