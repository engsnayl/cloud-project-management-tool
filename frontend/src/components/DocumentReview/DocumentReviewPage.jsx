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

  // Fetch pending document suggestions using the correct API method
  const { data: suggestionsResponse, isLoading, error } = useQuery(
    'pendingSuggestions',
    () => apiService.documentSuggestions.getPending(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
      onError: (error) => {
        console.error('Failed to fetch suggestions:', error);
      }
    }
  );

  // Extract suggestions from the response - handle both array and object response formats
  const suggestions = React.useMemo(() => {
    if (!suggestionsResponse?.data) return [];
    
    const responseData = suggestionsResponse.data;
    
    // Handle array of suggestion objects
    if (Array.isArray(responseData)) {
      return responseData.flatMap(doc => 
        doc.suggestions?.map(suggestion => ({
          ...suggestion,
          documentId: doc.suggestionId,
          document_key: doc.document_key,
          created_at: doc.created_at
        })) || []
      );
    }
    
    // Handle single suggestion object
    if (responseData.suggestions) {
      return responseData.suggestions.map(suggestion => ({
        ...suggestion,
        documentId: responseData.suggestionId,
        document_key: responseData.document_key,
        created_at: responseData.created_at
      }));
    }
    
    return [];
  }, [suggestionsResponse]);

  // Approve suggestion mutation
  const approveMutation = useMutation(
    (data) => apiService.documentSuggestions.approve(data.documentId, {
      suggestionIndex: data.index,
      title: data.title || data.text,
      description: data.context,
      priority: data.priority || data.suggested_priority,
      owner: data.owner || data.suggested_assignee,
      deadline: data.deadline || data.suggested_deadline
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pendingSuggestions');
        setEditingAction(null);
        setSelectedSuggestion(null);
      },
      onError: (error) => {
        console.error('Failed to approve suggestion:', error);
      }
    }
  );

  // Reject suggestion mutation
  const rejectMutation = useMutation(
    (data) => apiService.documentSuggestions.reject(data.documentId, 
      `Rejected suggestion: ${data.text}`
    ),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pendingSuggestions');
        setSelectedSuggestion(null);
      },
      onError: (error) => {
        console.error('Failed to reject suggestion:', error);
      }
    }
  );

  const handleApprove = (suggestion) => {
    if (editingAction) {
      approveMutation.mutate({
        documentId: suggestion.documentId,
        index: suggestion.index,
        title: editingAction.title,
        description: editingAction.description,
        priority: editingAction.priority,
        owner: editingAction.owner,
        deadline: editingAction.deadline
      });
    } else {
      approveMutation.mutate(suggestion);
    }
  };

  const handleReject = (suggestion) => {
    rejectMutation.mutate(suggestion);
  };

  const handleEdit = (suggestion) => {
    setEditingAction({
      title: suggestion.text,
      description: suggestion.context,
      priority: suggestion.suggested_priority || 'MEDIUM',
      owner: suggestion.suggested_assignee || '',
      deadline: suggestion.suggested_deadline || ''
    });
    setSelectedSuggestion(suggestion);
  };

  const getConfidenceColor = (confidence) => {
    const conf = parseFloat(confidence);
    if (conf >= 0.8) return 'text-green-600 bg-green-100';
    if (conf >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toUpperCase()) {
      case 'HIGH': return 'text-red-700 bg-red-100';
      case 'MEDIUM': return 'text-yellow-700 bg-yellow-100';
      case 'LOW': return 'text-green-700 bg-green-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const formatConfidencePercentage = (confidence) => {
    return Math.round(parseFloat(confidence) * 100);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="text-lg font-medium text-red-900">Error Loading Suggestions</h3>
                <p className="text-red-700 mt-1">
                  {error.message || 'Failed to load document suggestions. Please try again.'}
                </p>
                <button 
                  onClick={() => queryClient.invalidateQueries('pendingSuggestions')}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Document Review</h1>
          <p className="mt-2 text-gray-600">
            Review and approve extracted action items from processed documents
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Suggestions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : suggestions.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">High Confidence</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : suggestions.filter(s => parseFloat(s.confidence) >= 0.8).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">High Priority</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : suggestions.filter(s => s.suggested_priority === 'HIGH').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending Review</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : suggestions.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Clock className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading document suggestions...</p>
          </div>
        )}

        {/* No Suggestions State */}
        {!isLoading && suggestions.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Suggestions</h3>
            <p className="text-gray-600 mb-4">
              Upload some documents to start extracting action items for review.
            </p>
            <a 
              href="/documents" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Documents
            </a>
          </div>
        )}

        {/* Suggestions List */}
        {!isLoading && suggestions.length > 0 && (
          <div className="space-y-6">
            {suggestions.map((suggestion, index) => (
              <div key={`${suggestion.documentId}-${suggestion.index}`} className="bg-white rounded-lg shadow border">
                <div className="p-6">
                  {/* Suggestion Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {suggestion.text}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Line {suggestion.line_number}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                          {formatConfidencePercentage(suggestion.confidence)}% confident
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(suggestion.suggested_priority)}`}>
                          {suggestion.suggested_priority || 'MEDIUM'} priority
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Context */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Context:</p>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {suggestion.context}
                      </p>
                    </div>
                  </div>

                  {/* Edit Form */}
                  {editingAction && selectedSuggestion?.index === suggestion.index && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-medium text-blue-900 mb-3">Edit Action Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title
                          </label>
                          <input
                            type="text"
                            value={editingAction.title}
                            onChange={(e) => setEditingAction(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Priority
                          </label>
                          <select
                            value={editingAction.priority}
                            onChange={(e) => setEditingAction(prev => ({ ...prev, priority: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Owner
                          </label>
                          <input
                            type="text"
                            value={editingAction.owner}
                            onChange={(e) => setEditingAction(prev => ({ ...prev, owner: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Assign to..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Deadline
                          </label>
                          <input
                            type="date"
                            value={editingAction.deadline}
                            onChange={(e) => setEditingAction(prev => ({ ...prev, deadline: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          rows={3}
                          value={editingAction.description}
                          onChange={(e) => setEditingAction(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end space-x-3">
                    <button
                      onClick={() => handleReject(suggestion)}
                      disabled={rejectMutation.isLoading}
                      className="px-4 py-2 text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleEdit(suggestion)}
                      className="px-4 py-2 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleApprove(suggestion)}
                      disabled={approveMutation.isLoading}
                      className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>
                        {approveMutation.isLoading ? 'Approving...' : 'Approve'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentReviewPage;