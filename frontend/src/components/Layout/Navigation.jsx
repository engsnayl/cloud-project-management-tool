// src/components/Layout/Navigation.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  CheckSquare, 
  Upload, 
  GitBranch, 
  BarChart3, 
  Settings,
  Plus,
  FolderOpen
} from 'lucide-react';

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard', count: null },
    { path: '/actions', icon: CheckSquare, label: 'Actions', count: '0' },
    { path: '/projects', icon: FolderOpen, label: 'Projects', count: '0' },
    { path: '/documents', icon: Upload, label: 'Documents', count: '0' },
    { path: '/workflows', icon: GitBranch, label: 'Workflows', count: '0' },
  ];

  const quickActions = [
    { path: '/actions', icon: Plus, label: 'New Action' },
    { path: '/projects', icon: FolderOpen, label: 'Create Project' },
    { path: '/documents', icon: Upload, label: 'Upload Document' },
  ];

  const isActivePath = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed left-0 top-16 h-screen w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-6">
        {/* Main Navigation */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700 ml-0 pl-2'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                <span className="flex-1">{item.label}</span>
                {item.count !== null && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Actions
          </h3>
          <div className="space-y-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              
              return (
                <Link
                  key={action.path}
                  to={action.path}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <Icon className="w-4 h-4 mr-3 text-gray-400" />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-green-800">All Systems Operational</span>
          </div>
          <div className="mt-2 text-xs text-green-600">
            <div>API: Online</div>
            <div>Actions: Ready</div>
            <div>Storage: Available</div>
          </div>
        </div>

        {/* Architecture Info */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-xs font-semibold text-blue-800 mb-1">Architecture</div>
          <div className="text-xs text-blue-600 space-y-1">
            <div>• Serverless (AWS Lambda)</div>
            <div>• Event-Driven (EventBridge)</div>
            <div>• Auto-Scaling (DynamoDB)</div>
            <div>• Action Workflows</div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;