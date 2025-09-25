//workspaces/cloud-project-management-tool/frontend/src/components/Documents/DocumentProcessing.jsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

function DocumentProcessing() {
  const [activeTab, setActiveTab] = useState('upload');
  const [dragActive, setDragActive] = useState(false);
  const queryClient = useQueryClient();

  // Fetch pending suggestions
  const { data: suggestions = [], isLoading } = useQuery(
    ['suggestions'],
    async () => {
      const response = await fetch(`${API_BASE_URL}/suggestions?status=pending_review`);
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      return response.json();
    },
    {
      refetchInterval: 10000
    }
  );

  // Document upload mutation
  const uploadMutation = useMutation(
    async (file) => {
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    }
  );

  // Approve suggestion mutation
  const approveMutation = useMutation(
    async ({ suggestionId, actionData }) => {
      const response = await fetch(`${API_BASE_URL}/suggestions/${suggestionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData)
      });
      if (!response.ok) throw new Error('Failed to approve suggestion');
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['suggestions']);
      }
    }
  );

  // Reject suggestion mutation
  const rejectMutation = useMutation(
    async (suggestionId) => {
      const response = await fetch(`${API_BASE_URL}/suggestions/${suggestionId}/reject`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to reject suggestion');
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['suggestions']);
      }
    }
  );

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload only PDF or DOCX files.');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB.');
      return;
    }
    
    uploadMutation.mutate(file);
  };

  const handleApprove = (suggestion) => {
    const actionData = {
      title: suggestion.extracted_action,
      description: `From document: ${suggestion.document_name}\n\nOriginal: ${suggestion.original_text}`,
      owner: suggestion.suggested_assignee || 'unassigned@company.com',
      priority: suggestion.confidence_score > 0.7 ? 'high' : 'medium',
      status: 'pending',
      due_date: suggestion.suggested_due_date || null,
      project: 'miscellaneous'
    };

    approveMutation.mutate({
      suggestionId: suggestion.suggestion_id,
      actionData
    });
  };

  const handleReject = (suggestionId) => {
    if (window.confirm('Are you sure you want to reject this suggestion?')) {
      rejectMutation.mutate(suggestionId);
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.7) return 'bg-green-100 text-green-800';
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Document Processing</h1>
        {suggestions.length > 0 && (
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            {suggestions.length} pending review
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Upload Document
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'review'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Review Suggestions
            {suggestions.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                {suggestions.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Upload Document</h2>
            <p className="text-gray-600">
              Upload a PDF or Word document to automatically extract action items.
            </p>
          </div>

          <div
            className={`relative border-2 border-dashed rounded-lg p-6 text-center ${
              dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            } ${uploadMutation.isLoading ? 'opacity-50' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleChange}
              disabled={uploadMutation.isLoading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
                </svg>
              </div>
              
              <div>
                <p className="text-gray-600">
                  <span className="font-medium text-blue-600 hover:text-blue-500">
                    Click to upload
                  </span>
                  {' '}or drag and drop
                </p>
                <p className="text-sm text-gray-500">PDF or DOCX files up to 10MB</p>
              </div>
            </div>

            {uploadMutation.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Processing document...</p>
                </div>
              </div>
            )}
          </div>

          {uploadMutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm font-medium text-green-800">
                Document uploaded successfully! Check the "Review Suggestions" tab.
              </p>
            </div>
          )}

          {uploadMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm font-medium text-red-800">
                Upload failed: {uploadMutation.error.message}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Review Tab */}
      {activeTab === 'review' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading suggestions...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No suggestions to review</h3>
              <p className="mt-1 text-sm text-gray-500">Upload a document to extract action items.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">
                Review Extracted Actions ({suggestions.length})
              </h2>
              
              {suggestions.map((suggestion) => (
                <div key={suggestion.suggestion_id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence_score)}`}>
                        {Math.round(suggestion.confidence_score * 100)}% confidence
                      </span>
                      <span className="text-sm text-gray-500">From: {suggestion.document_name}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Suggested Action: {suggestion.extracted_action}
                    </h3>
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-sm text-gray-600 italic">
                        "{suggestion.original_text}"
                      </p>
                    </div>
                  </div>

                  {(suggestion.suggested_assignee || suggestion.suggested_due_date) && (
                    <div className="flex space-x-4 text-sm text-gray-600">
                      {suggestion.suggested_assignee && (
                        <span>Owner: <strong>{suggestion.suggested_assignee}</strong></span>
                      )}
                      {suggestion.suggested_due_date && (
                        <span>Due: <strong>{suggestion.suggested_due_date}</strong></span>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => handleReject(suggestion.suggestion_id)}
                      className="px-3 py-1 text-sm text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(suggestion)}
                      className="px-3 py-1 text-sm text-white bg-green-600 border border-transparent rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentProcessing;