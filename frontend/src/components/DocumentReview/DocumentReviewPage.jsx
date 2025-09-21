// src/components/DocumentReview/DocumentReviewPage.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiService from '../../services/api';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Edit3,
  Calendar,
  User,
  BarChart3
} from 'lucide-react';

const DocumentReviewPage = () => {
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [editingAction, setEditingAction] = useState(null);
  const queryClient = useQueryClient();

  // Fetch pending document suggestions
  const { data: suggestions, isLoading, error } = useQuery(
    'pendingSuggestions',
    () => apiService.get('/api/v1/document-suggestions/pending'),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Approve suggestion mutation
  const approveMutation = useMutation(
    (data) => apiService.post(`/api/v1/document-suggestions/${data.suggestionId}/approve`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pendingSuggestions');
        setEditingAction(null);
      }
    }
  );

  // Reject suggestion mutation
  const rejectMutation = useMutation(
    (suggestionId) => apiService.post(`/api/v1/document-suggestions/${suggestionId}/reject`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pendingSuggestions');
      }
    }
  );

  const handleApproveAction = (suggestion, actionItem) => {
    const actionData = {
      suggestionId: suggestion.suggestionId,
      actionItemIndex: actionItem.index,
      action: {
        title: editingAction?.title || actionItem.text,
        description: editingAction?.description || actionItem.context.substring(0, 200),
        priority: editingAction?.priority || actionItem.suggested_priority,
        deadline: editingAction?.deadline || null,
        owner: editingAction?.owner || 'unassigned',
        projectId: editingAction?.projectId || 'miscellaneous'
      }
    };

    approveMutation.mutate(actionData);
  };

  const handleRejectAction = (suggestion, actionItem) => {
    rejectMutation.mutate(`${suggestion.suggestionId}:${actionItem.index}`);
  };

  const getConfidenceColor = (confidence) => {
    const conf = parseFloat(confidence);
    if (conf >= 0.8) return 'text-green-600 bg-green-100';
    if (conf >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'text-red-600 bg-red-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading document suggestions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Error loading suggestions: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500" />
            Document Review Center
          </h1>
          <p className="mt-2 text-gray-600">
            Review AI-extracted action items from uploaded documents and approve them for your action tracker.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Documents Processed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {suggestions?.length || 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Suggestions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {suggestions?.reduce((sum, doc) => sum + doc.total_suggestions, 0) || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">High Confidence</p>
                <p className="text-2xl font-bold text-gray-900">
                  {suggestions?.reduce((sum, doc) => 
                    sum + doc.suggestions.filter(s => parseFloat(s.confidence) >= 0.8).length, 0
                  ) || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">High Priority</p>
                <p className="text-2xl font-bold text-gray-900">
                  {suggestions?.reduce((sum, doc) => 
                    sum + doc.suggestions.filter(s => s.suggested_priority === 'HIGH').length, 0
                  ) || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Document Suggestions */}
        {!suggestions || suggestions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pending suggestions</h3>
            <p className="text-gray-500">
              Upload documents to automatically extract action items for review.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {suggestions.map((document) => (
              <div key={document.suggestionId} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Document Header */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {document.document_key?.split('/').pop() || 'Unknown Document'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Processed on {new Date(document.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">
                        {document.total_suggestions} suggestions
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        document.status === 'PENDING_REVIEW' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {document.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Items */}
                <div className="divide-y divide-gray-200">
                  {document.suggestions.map((actionItem, index) => (
                    <div key={index} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Action Text */}
                          <div className="flex items-start space-x-3 mb-3">
                            <div className="flex-1">
                              <h4 className="text-lg font-medium text-gray-900 mb-2">
                                {actionItem.text}
                              </h4>
                              <p className="text-sm text-gray-600 mb-3">
                                <strong>Context:</strong> {actionItem.context}
                              </p>
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="flex items-center space-x-6 text-sm">
                            <div className="flex items-center space-x-1">
                              <BarChart3 className="w-4 h-4" />
                              <span className={`px-2 py-1 rounded-full font-medium ${getConfidenceColor(actionItem.confidence)}`}>
                                {Math.round(parseFloat(actionItem.confidence) * 100)}% confidence
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              <AlertTriangle className="w-4 h-4" />
                              <span className={`px-2 py-1 rounded-full font-medium ${getPriorityColor(actionItem.suggested_priority)}`}>
                                {actionItem.suggested_priority} priority
                              </span>
                            </div>

                            {actionItem.suggested_deadline && (
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span className="text-gray-600">{actionItem.suggested_deadline}</span>
                              </div>
                            )}

                            {actionItem.suggested_assignee && (
                              <div className="flex items-center space-x-1">
                                <User className="w-4 h-4" />
                                <span className="text-gray-600">{actionItem.suggested_assignee}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2 ml-6">
                          <button
                            onClick={() => setEditingAction({
                              suggestionId: document.suggestionId,
                              index,
                              title: actionItem.text,
                              description: actionItem.context.substring(0, 200),
                              priority: actionItem.suggested_priority,
                              deadline: actionItem.suggested_deadline,
                              owner: actionItem.suggested_assignee || 'unassigned',
                              projectId: 'miscellaneous'
                            })}
                            className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span>Edit & Approve</span>
                          </button>
                          
                          <button
                            onClick={() => handleApproveAction(document, { ...actionItem, index })}
                            disabled={approveMutation.isLoading}
                            className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Approve</span>
                          </button>
                          
                          <button
                            onClick={() => handleRejectAction(document, { ...actionItem, index })}
                            disabled={rejectMutation.isLoading}
                            className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Action Modal */}
      {editingAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Action Before Approval</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={editingAction.title}
                    onChange={(e) => setEditingAction({...editingAction, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editingAction.description}
                    onChange={(e) => setEditingAction({...editingAction, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={editingAction.priority}
                      onChange={(e) => setEditingAction({...editingAction, priority: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                    <input
                      type="text"
                      value={editingAction.owner}
                      onChange={(e) => setEditingAction({...editingAction, owner: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline (optional)</label>
                  <input
                    type="date"
                    value={editingAction.deadline || ''}
                    onChange={(e) => setEditingAction({...editingAction, deadline: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setEditingAction(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const suggestion = suggestions.find(s => s.suggestionId === editingAction.suggestionId);
                    const actionItem = suggestion.suggestions[editingAction.index];
                    handleApproveAction(suggestion, { ...actionItem, index: editingAction.index });
                  }}
                  disabled={approveMutation.isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {approveMutation.isLoading ? 'Approving...' : 'Approve Action'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentReviewPage;