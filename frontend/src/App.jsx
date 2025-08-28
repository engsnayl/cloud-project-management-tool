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
    <div className="p-8" style={{ marginLeft: '256px' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Action Tracking Dashboard</h1>
          <p className="text-gray-600">Monitor and manage project actions and deliverables</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-2xl">📋</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Actions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {actionsLoading ? '...' : totalActions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <span className="text-2xl">⏳</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {actionsLoading ? '...' : pendingActions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {actionsLoading ? '...' : completedActions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <span className="text-2xl">🚨</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {actionsLoading ? '...' : overdueActions}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          
          {actionsLoading || projectsLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading recent activity...</p>
            </div>
          ) : actions.length > 0 || projects.length > 0 ? (
            <div className="space-y-4">
              {/* Recent Projects */}
              {projects.slice(0, 2).map(project => (
                <div key={project.projectId} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-semibold">P</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Project created: {project.name}</p>
                    <p className="text-xs text-gray-500">{new Date(project.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              
              {/* Recent Actions */}
              {actions.slice(0, 3).map(action => (
                <div key={action.actionId} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">A</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Action: {action.title}</p>
                    <p className="text-xs text-gray-500">
                      Assigned to {action.owner} • Status: {action.status}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
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
            <main className="flex-1 overflow-auto">
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