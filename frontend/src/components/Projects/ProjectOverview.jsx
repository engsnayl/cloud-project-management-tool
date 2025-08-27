// src/components/Projects/ProjectOverview.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
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
  FolderOpen
} from 'lucide-react';
import { apiService, handleApiError } from '../../services/api';

const ProjectOverview = () => {
  // Fetch dashboard data
  const { data: dashboardData, isLoading, error } = useQuery(
    'dashboard',
    apiService.analytics.getDashboard,
    {
      onError: (error) => {
        console.error('Failed to fetch dashboard data:', handleApiError(error));
      }
    }
  );

  const dashboard = dashboardData?.data || {
    actions: { total: 0, byStatus: {} },
    workflows: { active: 0, completed: 0 },
    documents: { processed: 0, pending: 0 },
    projects: { total: 0, active: 0 },
    recentActivity: []
  };

  const quickStats = [
    {
      name: 'Total Actions',
      value: dashboard.actions?.total || 0,
      change: '+0%',
      changeType: 'neutral',
      icon: CheckSquare,
      color: 'text-blue-600 bg-blue-100',
      href: '/actions'
    },
    {
      name: 'Active Projects',
      value: dashboard.projects?.active || 0,
      change: '0 active',
      changeType: 'neutral',
      icon: FolderOpen,
      color: 'text-purple-600 bg-purple-100',
      href: '/projects'
    },
    {
      name: 'Documents Processed',
      value: dashboard.documents?.processed || 0,
      change: '+0 today',
      changeType: 'neutral',
      icon: Upload,
      color: 'text-green-600 bg-green-100',
      href: '/documents'
    },
    {
      name: 'Completion Rate',
      value: '0%',
      change: 'N/A',
      changeType: 'neutral',
      icon: TrendingUp,
      color: 'text-orange-600 bg-orange-100',
      href: '/actions'
    }
  ];

  const recentActivity = dashboard.recentActivity || [
    {
      id: 1,
      type: 'action_created',
      title: 'New action created',
      description: 'Review authentication requirements - HIGH priority',
      timestamp: new Date().toISOString(),
      user: 'System'
    },
    {
      id: 2,
      type: 'workflow_completed',
      title: 'Workflow completed',
      description: 'Document processing workflow finished successfully',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      user: 'Auto'
    },
    {
      id: 3,
      type: 'project_created',
      title: 'Project created',
      description: 'Customer Portal Redesign project initialized',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      user: 'User'
    }
  ];

  const getActivityIcon = (type) => {
    const icons = {
      action_created: CheckSquare,
      action_completed: CheckCircle,
      project_created: FolderOpen,
      workflow_completed: CheckCircle,
      document_uploaded: Upload,
    };
    return icons[type] || Activity;
  };

  const getActivityColor = (type) => {
    const colors = {
      action_created: 'text-blue-600 bg-blue-100',
      action_completed: 'text-green-600 bg-green-100',
      project_created: 'text-purple-600 bg-purple-100',
      workflow_completed: 'text-green-600 bg-green-100',
      document_uploaded: 'text-orange-600 bg-orange-100',
    };
    return colors[type] || 'text-gray-600 bg-gray-100';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Overview</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor your action tracking and project delivery platform
          </p>
        </div>
        <Link
          to="/actions"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Action
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          
          return (
            <Link
              key={stat.name}
              to={stat.href}
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-lg ${stat.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {stat.value}
                        </div>
                        <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                          stat.changeType === 'increase' ? 'text-green-600' : 
                          stat.changeType === 'decrease' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {stat.change}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            </div>
            <div className="p-6">
              <div className="flow-root">
                <ul className="-mb-8">
                  {recentActivity.map((activity, activityIdx) => {
                    const Icon = getActivityIcon(activity.type);
                    const isLast = activityIdx === recentActivity.length - 1;
                    
                    return (
                      <li key={activity.id}>
                        <div className="relative pb-8">
                          {!isLast && (
                            <span
                              className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                              aria-hidden="true"
                            />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getActivityColor(activity.type)}`}>
                                <Icon className="h-4 w-4" />
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-900">{activity.title}</p>
                                <p className="text-sm text-gray-500">{activity.description}</p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                <time dateTime={activity.timestamp}>
                                  {new Date(activity.timestamp).toLocaleTimeString()}
                                </time>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions & System Status */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
            </div>
            <div className="p-6 space-y-3">
              <Link
                to="/actions"
                className="w-full flex items-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <CheckSquare className="w-5 h-5 mr-3 text-blue-500" />
                Create Action
              </Link>
              <Link
                to="/projects"
                className="w-full flex items-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FolderOpen className="w-5 h-5 mr-3 text-purple-500" />
                Create Project
              </Link>
              <Link
                to="/documents"
                className="w-full flex items-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-5 h-5 mr-3 text-green-500" />
                Upload Document
              </Link>
              <Link
                to="/workflows"
                className="w-full flex items-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <GitBranch className="w-5 h-5 mr-3 text-orange-500" />
                View Workflows
              </Link>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">System Status</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">API Gateway</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">Operational</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">Lambda Functions</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">Healthy</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">Step Functions</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">DynamoDB</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">Available</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">EventBridge</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">Running</span>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Activity className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <h4 className="font-medium text-blue-900 mb-2">Enterprise Architecture</h4>
                <ul className="space-y-1 text-blue-700 text-xs">
                  <li>• Serverless (AWS Lambda + API Gateway)</li>
                  <li>• Event-Driven (EventBridge orchestration)</li>
                  <li>• Workflow Automation (Step Functions)</li>
                  <li>• Auto-Scaling NoSQL (DynamoDB)</li>
                  <li>• Action Tracking (Business Process Automation)</li>
                  <li>• Infrastructure as Code (Terraform)</li>
                </ul>
                <div className="mt-3 pt-2 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-800">Live Environment</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Production Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AWS Console Links */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">AWS Resources</h3>
            </div>
            <div className="p-6 space-y-2">
              <a
                href="https://console.aws.amazon.com/states/home?region=eu-west-1#/statemachines/view/arn:aws:states:eu-west-1:340752829546:stateMachine:deliverycommand-dev-requirement-approval"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span>Step Functions Console</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="https://console.aws.amazon.com/dynamodb/home?region=eu-west-1#tables:selected=deliverycommand-dev-main"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span>DynamoDB Console</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="https://console.aws.amazon.com/events/home?region=eu-west-1#/eventbus/deliverycommand-dev-event-bus"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span>EventBridge Console</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <Clock className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
            <div className="text-sm text-yellow-700">
              <h4 className="font-medium">Dashboard data temporarily unavailable</h4>
              <p className="mt-1">
                Showing static demo data. The backend API may be starting up or experiencing issues.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectOverview;