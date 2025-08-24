// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Header from './components/Layout/Header';
import Navigation from './components/Layout/Navigation';
import RequirementsList from './components/Requirements/RequirementsList';
import RequirementForm from './components/Requirements/RequirementForm';
import DocumentUpload from './components/Documents/DocumentUpload';
import WorkflowDashboard from './components/Workflows/WorkflowDashboard';
import ProjectOverview from './components/Projects/ProjectOverview';
import './App.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <div className="flex">
            <Navigation />
            <main className="flex-1 p-6 ml-64">
              <Routes>
                <Route path="/" element={<ProjectOverview />} />
                <Route path="/requirements" element={<RequirementsList />} />
                <Route path="/requirements/new" element={<RequirementForm />} />
                <Route path="/requirements/edit/:id" element={<RequirementForm />} />
                <Route path="/documents" element={<DocumentUpload />} />
                <Route path="/workflows" element={<WorkflowDashboard />} />
                <Route path="/projects" element={<ProjectOverview />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;