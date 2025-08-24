// src/components/Requirements/RequirementCard.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Edit, 
  Trash2, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  MoreHorizontal,
  ArrowRight
} from 'lucide-react';
import { useMutation, useQueryClient } from 'react-query';
import { apiService } from '../../services/api';

const RequirementCard = ({ requirement, onUpdate }) => {
  const [showActions, setShowActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  // Delete mutation
  const deleteMutation = useMutation(
    (id) => apiService.requirements.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('requirements');
        onUpdate?.();
      },
      onError: (error) => {
        console.error('Failed to delete requirement:', error);
      },
      onSettled: () => {
        setIsDeleting(false);
      }
    }
  );

  // Approve mutation
  const approveMutation = useMutation(
    (id) => apiService.requirements.approve(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('requirements');
        onUpdate?.();
      },
    }
  );

  // Reject mutation
  const rejectMutation = useMutation(
    ({ id, reason }) => apiService.requirements.reject(id, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('requirements');
        onUpdate?.();
      },
    }
  );

  const getStatusIcon = (status) => {
    const icons = {
      'DRAFT': Clock,
      'PENDING_REVIEW': AlertCircle,
      'APPROVED': CheckCircle,
      'REJECTED': XCircle,
      'IN_PROGRESS': ArrowRight,
      'COMPLETED': CheckCircle,
    };
    return icons[status] || Clock;
  };

  const getStatusColor = (status) => {
    const colors = {
      'DRAFT': 'text-gray-600 bg-gray-100',
      'PENDING_REVIEW': 'text-yellow-700 bg-yellow-100',
      'APPROVED': 'text-green-700 bg-green-100',
      'REJECTED': 'text-red-700 bg-red-100',
      'IN_PROGRESS': 'text-blue-700 bg-blue-100',
      'COMPLETED': 'text-green-700 bg-green-100',
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'HIGH': 'priority-high',
      'MEDIUM': 'priority-medium',
      'LOW': 'priority-low',
    };
    return colors[priority] || 'priority-medium';
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this requirement?')) {
      setIsDeleting(true);
      await deleteMutation.mutateAsync(requirement.requirementId);
    }
  };

  const handleApprove = async () => {
    await approveMutation.mutateAsync(requirement.requirementId);
  };

  const handleReject = async () => {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason) {
      await rejectMutation.mutateAsync({ 
        id: requirement.requirementId, 
        reason 
      });
    }
  };

  const StatusIcon = getStatusIcon(requirement.status);

  return (
    <div className="card p-6 hover:shadow-md transition-shadow animate-slide-up">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-2">
            <span className={`status-badge ${getStatusColor(requirement.status)}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {requirement.status.replace('_', ' ')}
            </span>
            <span className={`status-badge ${getPriorityColor(requirement.priority)}`}>
              {requirement.priority}
            </span>
            <span className="text-xs text-gray-500">
              {requirement.requirementId}
            </span>
          </div>

          {/* Title and Description */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
            {requirement.title}
          </h3>
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {requirement.description}
          </p>

          {/* Metadata */}
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            {requirement.assignedTo && (
              <div className="flex items-center">
                <User className="w-3 h-3 mr-1" />
                {requirement.assignedTo}
              </div>
            )}
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {new Date(requirement.createdAt).toLocaleDateString()}
            </div>
            {requirement.estimatedHours && (
              <div>
                Est. {requirement.estimatedHours}h
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {requirement.status === 'PENDING_REVIEW' && (
            <>
              <button
                onClick={handleApprove}
                disabled={approveMutation.isLoading}
                className="text-green-600 hover:text-green-800 p-1 hover:bg-green-50 rounded transition-colors"
                title="Approve"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isLoading}
                className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors"
                title="Reject"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}

          <Link
            to={`/requirements/edit/${requirement.requirementId}`}
            className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </Link>

          <button
            onClick={handleDelete}
            disabled={isDeleting || deleteMutation.isLoading}
            className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Delete"
          >
            {isDeleting ? (
              <div className="w-4 h-4 spinner border-red-600" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Workflow Progress */}
      {requirement.workflowStatus && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Workflow Progress</span>
            <span className="font-medium text-gray-700">
              {requirement.workflowStatus}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequirementCard;