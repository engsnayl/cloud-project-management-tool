// src/components/Workflows/WorkflowDashboard.jsx
import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { 
  GitBranch, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  ExternalLink,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { apiService, handleApiError } from '../../services/api';

const WorkflowDashboard = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');

  // Fetch workflow data
  const {
    data: workflowsResponse,
    isLoading,
    error,
    refetch
  } = useQuery(
    'workflows',
    apiService.workflows.getAll,
    {
      refetchInterval: 10000, // Refresh every 10 seconds
      onError: (error) => {
        console.error('Failed to fetch workflows:', handleApiError(error));
      }
    }
  );

  // Fetch analytics
  const { data: analyticsResponse } = useQuery(
    ['workflow-analytics', timeRange],
    () => apiService.analytics.getWorkflowMetrics(),
    {
      onError: (error) => {
        console.error('Failed to fetch analytics:', error);
      }
    }
  );

  const workflows = workflowsResponse?.data?.workflows || [];
  const analytics = analyticsResponse?.data || {};

  const getStatusIcon = (status) => {
    const icons = {
      'RUNNING': PlayCircle,
      'SUCCEEDED': CheckCircle,
      'FAILED': XCircle,
      'TIMED_OUT': Clock,
      'ABORTED': PauseCircle,
    };
    return icons[status] || AlertTriangle;
  };

  const getStatusColor = (status) => {
    const colors = {
      'RUNNING': 'text-blue-600 bg-blue-100',
      'SUCCEEDED': 'text-green-600 bg-green-100',
      'FAILED': 'text-red-600 bg-red-100',
      'TIMED_OUT': 'text-yellow-600 bg-yellow-100',
      'ABORTED': 'text-gray-600 bg-gray-100',
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getWorkflowTypeLabel = (type) => {
    const labels = {
      'requirement-approval': 'Requirement Approval',
      'document-processing': 'Document Processing',
    };
    return labels[type] || type;
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error Loading Workflows</h3>
              <p className="mt-1 text-sm text-red-700">
                {handleApiError(error).message}
              </p>
              <button 
                onClick={() => refetch()}
                className="mt-2 text-sm text-red-800 underline hover:text-red-900"
              >
                Try Again
              </button>
            </div>
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
          <h1 className="text-2xl font-bold text-gray-900">Workflow Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor Step Functions workflows and track approval processes
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            name: 'Active Workflows',
            value: workflows.filter(w => w.status === 'RUNNING').length,
            icon: PlayCircle,
            color: 'text-blue-600 bg-blue-100',
          },
          {
            name: 'Completed Today',
            value: analytics.completedToday || 0,
            icon: CheckCircle,
            color: 'text-green-600 bg-green-100',
          },
          {
            name: 'Failed',
            value: workflows.filter(w => w.status === 'FAILED').length,
            icon: XCircle,
            color: 'text-red-600 bg-red-100',
          },
          {
            name: 'Avg Duration',
            value: analytics.avgDuration ? formatDuration(analytics.avgDuration) : 'N/A',
            icon: Clock,
            color: 'text-yellow-600 bg-yellow-100',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          
          return (
            <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
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
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Workflow List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Recent Workflow Executions</h3>
            <span className="text-sm text-gray-500">
              Auto-refreshing every 10 seconds
            </span>
          </div>
        </div>

        <div className="overflow-hidden">
          {isLoading ? (
            <div className="px-6 py-8">
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : workflows.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <GitBranch className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No workflows found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Workflows will appear here when requirements are created or documents are uploaded.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {workflows.map((workflow) => {
                const StatusIcon = getStatusIcon(workflow.status);
                const statusColor = getStatusColor(workflow.status);
                
                return (
                  <div key={workflow.executionArn} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-full ${statusColor}`}>
                          <StatusIcon className="w-4 h-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {getWorkflowTypeLabel(workflow.workflowType)}
                            </h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                              {workflow.status}
                            </span>
                          </div>
                          
                          <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                            {workflow.requirementId && (
                              <span>Requirement: {workflow.requirementId}</span>
                            )}
                            <span>
                              Started: {new Date(workflow.startTime).toLocaleString()}
                            </span>
                            {workflow.duration && (
                              <span>Duration: {formatDuration(workflow.duration)}</span>
                            )}
                          </div>
                          
                          {workflow.currentStep && (
                            <div className="mt-1 text-xs text-blue-600">
                              Current step: {workflow.currentStep}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {workflow.consoleUrl && (
                          <a
                            href={workflow.consoleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded transition-colors"
                            title="View in AWS Console"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Workflow Progress */}
                    {workflow.status === 'RUNNING' && workflow.progress && (
                      <div className="mt-3 ml-12">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{workflow.progress.completed}/{workflow.progress.total} steps</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${(workflow.progress.completed / workflow.progress.total) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <BarChart3 className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <h4 className="font-medium">Workflow Architecture</h4>
            <ul className="mt-1 space-y-1 text-xs">
              <li>• Step Functions orchestrate approval and processing workflows</li>
              <li>• EventBridge automatically triggers workflows from API events</li>
              <li>• Real-time status updates via Step Functions execution history</li>
              <li>• Visual workflow designer available in AWS Console</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDashboard;