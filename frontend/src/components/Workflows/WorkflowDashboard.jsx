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
  BarChart3,
  Mail,
  Calendar
} from 'lucide-react';

const WorkflowDashboard = () => {
  const [filter, setFilter] = useState('ALL');

  // Mock workflow data - in Phase 7.2 this will connect to real Step Functions
  const mockWorkflows = [
    {
      id: 'wf-001',
      name: 'Daily Action Reminders',
      type: 'action-reminder',
      status: 'RUNNING',
      lastExecution: '2025-08-28T06:00:00Z',
      nextExecution: '2025-08-29T06:00:00Z',
      executionCount: 28,
      successRate: 100,
      description: 'Sends daily email reminders to action owners'
    },
    {
      id: 'wf-002', 
      name: 'Overdue Action Escalation',
      type: 'action-escalation',
      status: 'PAUSED',
      lastExecution: '2025-08-27T18:00:00Z',
      nextExecution: null,
      executionCount: 12,
      successRate: 95,
      description: 'Escalates overdue actions to project managers'
    },
    {
      id: 'wf-003',
      name: 'Weekly Status Reports',
      type: 'status-report',
      status: 'RUNNING',
      lastExecution: '2025-08-26T09:00:00Z',
      nextExecution: '2025-09-02T09:00:00Z',
      executionCount: 4,
      successRate: 100,
      description: 'Generates weekly project status reports'
    }
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'RUNNING':
        return <PlayCircle className="w-5 h-5 text-green-600" />;
      case 'PAUSED':
        return <PauseCircle className="w-5 h-5 text-yellow-600" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'SUCCEEDED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-green-100 text-green-800';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'SUCCEEDED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'action-reminder':
        return <Mail className="w-5 h-5 text-blue-600" />;
      case 'action-escalation':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'status-report':
        return <BarChart3 className="w-5 h-5 text-purple-600" />;
      default:
        return <GitBranch className="w-5 h-5 text-gray-600" />;
    }
  };

  const filteredWorkflows = mockWorkflows.filter(workflow => {
    if (filter === 'ALL') return true;
    return workflow.status === filter;
  });

  const totalWorkflows = mockWorkflows.length;
  const runningWorkflows = mockWorkflows.filter(w => w.status === 'RUNNING').length;
  const remindersSent = mockWorkflows
    .filter(w => w.type === 'action-reminder')[0]?.executionCount || 0;

  return (
    <div className="p-6" style={{ marginLeft: '256px' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Workflow Dashboard</h1>
              <p className="text-gray-600">Monitor action tracking and automation workflows</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Status
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <GitBranch className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Workflows</p>
                <p className="text-2xl font-bold text-gray-900">{runningWorkflows}</p>
                <p className="text-xs text-gray-500 mt-1">of {totalWorkflows} total</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Executions Today</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
                <p className="text-xs text-gray-500 mt-1">All successful</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Reminders Sent</p>
                <p className="text-2xl font-bold text-gray-900">{remindersSent}</p>
                <p className="text-xs text-gray-500 mt-1">This month</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">98%</p>
                <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex space-x-8">
            {['ALL', 'RUNNING', 'PAUSED', 'FAILED'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  filter === status
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {status} ({mockWorkflows.filter(w => status === 'ALL' || w.status === status).length})
              </button>
            ))}
          </div>
        </div>

        {/* Workflows List */}
        <div className="space-y-4 mb-8">
          {filteredWorkflows.map((workflow) => (
            <div key={workflow.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {getTypeIcon(workflow.type)}
                    <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}>
                      {workflow.status}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-4">{workflow.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 font-medium">Last Execution</p>
                      <p className="text-gray-900">{new Date(workflow.lastExecution).toLocaleString()}</p>
                    </div>
                    {workflow.nextExecution && (
                      <div>
                        <p className="text-gray-500 font-medium">Next Execution</p>
                        <p className="text-gray-900">{new Date(workflow.nextExecution).toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500 font-medium">Success Rate</p>
                      <p className="text-gray-900">{workflow.successRate}% ({workflow.executionCount} runs)</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {getStatusIcon(workflow.status)}
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center">
                    View Details <ExternalLink className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Architecture Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Action Workflow Architecture</h3>
          <div className="text-blue-800 space-y-2 text-sm">
            <p>• <strong>EventBridge Rules:</strong> Schedule daily reminders and weekly reports</p>
            <p>• <strong>Step Functions:</strong> Orchestrate action reminder and escalation workflows</p>
            <p>• <strong>SES Integration:</strong> Send email notifications to action owners</p>
            <p>• <strong>Lambda Functions:</strong> Process action status changes and trigger notifications</p>
            <p>• <strong>DynamoDB Streams:</strong> React to action updates in real-time</p>
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Phase 7.2 Feature:</strong> Live workflow monitoring will be implemented when we add the reminder workflows. The dashboard shows the architecture that will be built.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDashboard;