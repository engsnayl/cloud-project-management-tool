// src/components/Layout/Navigation.jsx - Updated with Document Review
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import apiService from '../../services/api';
import { 
  Home, 
  CheckSquare, 
  Upload, 
  GitBranch, 
  BarChart3, 
  Settings,
  FileText,
  Clock,
  AlertCircle
} from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  
  // Get counts for navigation badges
  const { data: actionCounts } = useQuery(
    'actionCounts',
    () => apiService.get('/api/v1/analytics/actions'),
    { refetchInterval: 30000 }
  );

  // Get pending document suggestions count
  const { data: pendingSuggestions } = useQuery(
    'pendingSuggestionsCount',
    () => apiService.get('/api/v1/document-suggestions/pending'),
    { 
      refetchInterval: 30000,
      select: (data) => data?.length || 0
    }
  );

  const navItems = [
    {
      name: 'Dashboard',
      path: '/',
      icon: Home,
      badge: null
    },
    {
      name: 'Actions',
      path: '/actions',
      icon: CheckSquare,
      badge: actionCounts?.total_actions || 0
    },
    {
      name: 'Projects',
      path: '/projects',
      icon: GitBranch,
      badge: null
    },
    {
      name: 'Document Review',
      path: '/document-review',
      icon: FileText,
      badge: pendingSuggestions || 0,
      badgeColor: 'bg-purple-500'
    },
    {
      name: 'Upload',
      path: '/upload',
      icon: Upload,
      badge: null
    },
    {
      name: 'Analytics',
      path: '/analytics',
      icon: BarChart3,
      badge: null
    }
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-white shadow-sm border-r border-gray-200 w-64 min-h-screen">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">DeliveryCommand</h1>
        </div>
      </div>

      <div className="px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.path}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </div>
                {item.badge !== null && item.badge > 0 && (
                  <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white rounded-full ${
                    item.badgeColor || 'bg-blue-500'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Document Processing Status */}
      {pendingSuggestions > 0 && (
        <div className="mx-3 mt-6 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">Pending Review</span>
          </div>
          <p className="text-xs text-purple-700 mt-1">
            {pendingSuggestions} document{pendingSuggestions !== 1 ? 's' : ''} awaiting action review
          </p>
        </div>
      )}
      
      {/* Quick Actions */}
      <div className="px-3 mt-8">
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Quick Actions
        </h3>
        <ul className="mt-3 space-y-1">
          <li>
            <Link
              to="/actions/new"
              className="flex items-center px-3 py-2 text-sm text-gray-600 rounded-lg hover:text-gray-900 hover:bg-gray-50"
            >
              <CheckSquare className="w-4 h-4 mr-3" />
              New Action
            </Link>
          </li>
          <li>
            <Link
              to="/upload"
              className="flex items-center px-3 py-2 text-sm text-gray-600 rounded-lg hover:text-gray-900 hover:bg-gray-50"
            >
              <Upload className="w-4 h-4 mr-3" />
              Upload Document
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;