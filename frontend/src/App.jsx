import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Header from './components/Layout/Header';
import Navigation from './components/Layout/Navigation';
import Actions from './components/Actions/Actions';
import BulkActionUpload from './components/BulkActions/BulkActionUpload';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <Header />
          
          {/* Navigation */}
          <Navigation />
          
          {/* Main Content */}
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Actions />} />
              <Route path="/actions" element={<Actions />} />
              <Route path="/documents" element={<BulkActionUpload />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
