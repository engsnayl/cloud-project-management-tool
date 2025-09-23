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
  BarChart3,
  Download,
  Eye
} from 'lucide-react';

const DocumentReviewPage = () => {
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [editingAction, setEditingAction] = useState(null);
  const queryClient = useQueryClient();

  // Fetch pending document suggestions - Fixed API call
  const { data: suggestions, isLoading, error } = useQuery(
    'pendingSuggestions',
    () => apiService.documentSuggestions.getPending(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Approve suggestion mutation - Fixed API call
  const approveMutation = useMutation(
    (data) => apiService.documentSuggestions.approve(data.suggestionId, data.actionData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pendingSuggestions');
        setEditingAction(null);
        setSelectedSuggestion(null);
      }
    }
  );

  // Reject suggestion mutation - Fixed API call
  const rejectMutation = useMutation(
    (data) => apiService.documentSuggestions.reject(data.suggestionId, data.reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pendingSuggestions');
        setSelectedSuggestion(null);
      }
    }
  );

  const handleApprove = (suggestion) => {
    const actionData = editingAction || {
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority || 'medium',
      assignee: '',
      project: '',
      dueDate: ''
    };

    approveMutation.mutate({
      suggestionId: suggestion.id,
      actionData
    });
  };

  const handleReject = (suggestion, reason = 'Not relevant') => {
    rejectMutation.mutate({
      suggestionId: suggestion.id,
      reason
    });
  };

  const handleEdit = (suggestion) => {
    setEditingAction({
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority || 'medium',
      assignee: '',
      project: '',
      dueDate: ''
    });
    setSelectedSuggestion(suggestion);
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading document suggestions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-2">Error loading suggestions</p>
          <p className="text-gray-600 text-sm">
            {error.message || 'Unable to connect to the backend API'}
          </p>
          <button 
            onClick={() => queryClient.invalidateQueries('pendingSuggestions')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pendingSuggestions = suggestions?.suggestions || suggestions || [];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Review</h1>
        <p className="text-gray-600">
          Review and approve action items extracted from uploaded documents
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{pendingSuggestions.length}</p>
              <p className="text-sm text-gray-600">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">0</p>
              <p className="text-sm text-gray-600">Approved Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {pendingSuggestions.length > 0 
                  ? Math.round(pendingSuggestions.reduce((acc, s) => acc + (s.confidence || 0), 0) / pendingSuggestions.length * 100)
                  : 0}%
              </p>
              <p className="text-sm text-gray-600">Avg Confidence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {pendingSuggestions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending suggestions</h3>
          <p className="text-gray-600 mb-4">
            Upload documents to extract action items for review
          </p>
          <a 
            href="/documents" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Upload Documents
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Suggestions List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Pending Suggestions</h2>
            {pendingSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`bg-white p-6 rounded-lg shadow-sm border cursor-pointer transition-all ${
                  selectedSuggestion?.id === suggestion.id 
                    ? 'ring-2 ring-blue-500' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedSuggestion(suggestion)}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium text-gray-900 line-clamp-2">
                    {suggestion.title || suggestion.text || 'Untitled Action'}
                  </h3>
                  <div className="flex space-x-2 ml-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                      {Math.round((suggestion.confidence || 0) * 100)}%
                    </span>
                    {suggestion.priority && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(suggestion.priority)}`}>
                        {suggestion.priority}
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {suggestion.description || suggestion.context || 'No description available'}
                </p>
                
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Document: {suggestion.documentName || 'Unknown'}</span>
                  <span>{new Date(suggestion.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="lg:sticky lg:top-6">
            {selectedSuggestion ? (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Review Action</h2>
                  <button
                    onClick={() => setSelectedSuggestion(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {editingAction ? (
                  /* Edit Form */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      <input
                        type="text"
                        value={editingAction.title}
                        onChange={(e) => setEditingAction({...editingAction, title: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        value={editingAction.description}
                        onChange={(e) => setEditingAction({...editingAction, description: e.target.value})}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                        <select
                          value={editingAction.priority}
                          onChange={(e) => setEditingAction({...editingAction, priority: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                        <input
                          type="date"
                          value={editingAction.dueDate}
                          onChange={(e) => setEditingAction({...editingAction, dueDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assignee</label>
                      <input
                        type="text"
                        value={editingAction.assignee}
                        onChange={(e) => setEditingAction({...editingAction, assignee: e.target.value})}
                        placeholder="Enter assignee name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex space-x-3 pt-4">
                      <button
                        onClick={() => handleApprove(selectedSuggestion)}
                        disabled={approveMutation.isLoading}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {approveMutation.isLoading ? 'Saving...' : 'Approve & Create Action'}
                      </button>
                      <button
                        onClick={() => setEditingAction(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {selectedSuggestion.title || selectedSuggestion.text || 'Untitled Action'}
                      </h3>
                      <p className="text-gray-600">
                        {selectedSuggestion.description || selectedSuggestion.context || 'No description available'}
                      </p>
                    </div>

                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm font-medium text-gray-700">Confidence</span>
                      <span className={`text-sm font-medium ${getConfidenceColor(selectedSuggestion.confidence).split(' ')[0]}`}>
                        {Math.round((selectedSuggestion.confidence || 0) * 100)}%
                      </span>
                    </div>

                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm font-medium text-gray-700">Document</span>
                      <span className="text-sm text-gray-600">{selectedSuggestion.documentName || 'Unknown'}</span>
                    </div>

                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm font-medium text-gray-700">Extracted</span>
                      <span className="text-sm text-gray-600">
                        {new Date(selectedSuggestion.createdAt || Date.now()).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex space-x-3 pt-6">
                      <button
                        onClick={() => handleEdit(selectedSuggestion)}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit & Approve
                      </button>
                      <button
                        onClick={() => handleReject(selectedSuggestion)}
                        disabled={rejectMutation.isLoading}
                        className="flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        {rejectMutation.isLoading ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-sm border text-center">
                <Eye className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Select a suggestion to review</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentReviewPage;