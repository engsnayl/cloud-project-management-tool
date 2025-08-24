// src/components/Requirements/RequirementsList.jsx
import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { apiService, handleApiError } from '../../services/api';
import RequirementCard from './RequirementCard';

const RequirementsList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Fetch requirements using React Query
  const {
    data: requirementsResponse,
    isLoading,
    error,
    refetch
  } = useQuery(
    'requirements',
    apiService.requirements.getAll,
    {
      onError: (error) => {
        console.error('Failed to fetch requirements:', handleApiError(error));
      }
    }
  );

  const requirements = requirementsResponse?.data?.requirements || [];

  // Filter requirements based on search and filters
  const filteredRequirements = requirements.filter(req => {
    const matchesSearch = req.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         req.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Status statistics
  const statusCounts = requirements.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {});

  const getStatusIcon = (status) => {
    const icons = {
      'DRAFT': Clock,
      'PENDING_REVIEW': AlertCircle,
      'APPROVED': CheckCircle,
      'REJECTED': XCircle,
      'IN_PROGRESS': Clock,
      'COMPLETED': CheckCircle,
    };
    return icons[status] || Clock;
  };

  const getStatusColor = (status) => {
    const colors = {
      'DRAFT': 'text-gray-500 bg-gray-100',
      'PENDING_REVIEW': 'text-yellow-700 bg-yellow-100',
      'APPROVED': 'text-green-700 bg-green-100',
      'REJECTED': 'text-red-700 bg-red-100',
      'IN_PROGRESS': 'text-blue-700 bg-blue-100',
      'COMPLETED': 'text-green-700 bg-green-100',
    };
    return colors[status] || 'text-gray-500 bg-gray-100';
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error Loading Requirements</h3>
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
          <h1 className="text-2xl font-bold text-gray-900">Requirements</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage and track project requirements through automated workflows
          </p>
        </div>
        <Link
          to="/requirements/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Requirement
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { status: 'DRAFT', label: 'Draft', color: 'bg-gray-50 text-gray-600' },
          { status: 'PENDING_REVIEW', label: 'Pending Review', color: 'bg-yellow-50 text-yellow-600' },
          { status: 'APPROVED', label: 'Approved', color: 'bg-green-50 text-green-600' },
          { status: 'REJECTED', label: 'Rejected', color: 'bg-red-50 text-red-600' },
        ].map((stat) => {
          const Icon = getStatusIcon(stat.status);
          const count = statusCounts[stat.status] || 0;
          
          return (
            <div key={stat.status} className={`${stat.color} overflow-hidden rounded-lg px-4 py-5 shadow`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium truncate">{stat.label}</dt>
                    <dd className="text-lg font-medium">{count}</dd>
                  </dl>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Search */}
            <div className="flex-1 min-w-0">
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search requirements..."
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex space-x-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="block text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Priority</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Requirements List */}
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredRequirements.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No requirements found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by creating your first requirement.'}
              </p>
              <div className="mt-6">
                <Link
                  to="/requirements/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Requirement
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequirements.map((requirement) => (
                <RequirementCard
                  key={requirement.requirementId || requirement.PK}
                  requirement={requirement}
                  onUpdate={refetch}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequirementsList;