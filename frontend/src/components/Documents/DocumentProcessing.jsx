//workspaces/cloud-project-management-tool/frontend/src/components/Documents/DocumentProcessing.jsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://x8dd7fpwf3.execute-api.eu-west-1.amazonaws.com/dev/api/v1';

function DocumentProcessing() {
  const [activeTab, setActiveTab] = useState('upload');
  const [dragActive, setDragActive] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const queryClient = useQueryClient();

  // Fetch pending suggestions
  const { data: suggestionsResponse, isLoading, error } = useQuery(
    ['suggestions'],
    async () => {
      const response = await fetch(`${API_BASE_URL}/document-suggestions/pending`);
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      return response.json();
    },
    {
      refetchInterval: 10000
    }
  );

  // Fetch projects for dropdown
  const { data: projectsData } = useQuery(
    'projects',
    async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/projects`);
        if (!response.ok) return { projects: [] };
        return response.json();
      } catch (error) {
        return { projects: [] };
      }
    }
  );

  const suggestions = suggestionsResponse?.suggestions || [];
  const projects = projectsData?.projects || [];

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

  // Approve suggestion mutation - FIXED
  const approveMutation = useMutation(
    async ({ suggestionId, actionData }) => {
      console.log('Approving suggestion:', { suggestionId, actionData });
      
      const response = await fetch(`${API_BASE_URL}/document-suggestions/${suggestionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          suggestionId: suggestionId,
          actionData: actionData 
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Approval failed: ${response.status} - ${errorText}`);
      }
      return response.json();
    },
    {
      onSuccess: (data) => {
        console.log('Approval successful:', data);
        queryClient.invalidateQueries(['suggestions']);
        queryClient.invalidateQueries('actions'); // Refresh actions page
        alert(`Action created successfully! Check the Actions page to see your new confirmed action.`);
      },
      onError: (error) => {
        console.error('Approval failed:', error);
        alert(`Failed to approve suggestion: ${error.message}`);
      }
    }
  );

  // Reject suggestion mutation
  const rejectMutation = useMutation(
    async (suggestionId) => {
      const response = await fetch(`${API_BASE_URL}/document-suggestions/${suggestionId}/reject`, {
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
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload only PDF or DOCX files.');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB.');
      return;
    }
    
    uploadMutation.mutate(file);
  };

  // Start editing a suggestion
  const handleEditSuggestion = (suggestion) => {
    setEditingSuggestion(suggestion.index);
    setEditFormData({
      title: suggestion.text,
      description: suggestion.context || '',
      owner: suggestion.extracted_assignee || '',
      priority: suggestion.priority || 'MEDIUM',
      status: 'PENDING',
      projectId: '',
      deadline: suggestion.extracted_due_date || ''
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingSuggestion(null);
    setEditFormData({});
  };

  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle approve with edited data
  const handleApprove = (suggestion) => {
    const actionData = editingSuggestion === suggestion.index ? {
      // Use edited data
      title: editFormData.title,
      description: editFormData.description,
      owner: editFormData.owner || 'unassigned@company.com',
      priority: editFormData.priority,
      status: editFormData.status,
      projectId: editFormData.projectId || 'miscellaneous',
      deadline: editFormData.deadline
    } : {
      // Use original suggestion data
      title: suggestion.text,
      description: suggestion.context || `Extracted from document: ${suggestionsResponse?.document_key || 'document'}`,
      owner: suggestion.extracted_assignee || 'unassigned@company.com',
      priority: suggestion.priority || 'MEDIUM',
      status: 'PENDING',
      projectId: 'miscellaneous',
      deadline: suggestion.extracted_due_date || null
    };

    console.log('Preparing to approve:', { 
      suggestionId: suggestionsResponse?.suggestionId, 
      actionData 
    });

    approveMutation.mutate({
      suggestionId: suggestionsResponse?.suggestionId,
      actionData
    });

    // Close edit form
    setEditingSuggestion(null);
    setEditFormData({});
  };

  const handleReject = (suggestionIndex) => {
    if (window.confirm('Are you sure you want to reject this suggestion?')) {
      rejectMutation.mutate(suggestionsResponse?.suggestionId);
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.7) return 'bg-green-100 text-green-800';
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getProjectName = (projectId) => {
    if (projectId === 'miscellaneous') return 'Miscellaneous';
    const project = projects.find(p => p.projectId === projectId);
    return project?.name || projectId;
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
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-4">Error loading suggestions: {error.message}</div>
              <button 
                onClick={() => queryClient.invalidateQueries(['suggestions'])}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
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
              
              {suggestions.map((suggestion, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4">
                  {/* Header with badges */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {suggestion.priority}
                      </span>
                      <span className="text-sm text-gray-500">From: {suggestionsResponse?.document_key}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {editingSuggestion !== index && (
                        <button
                          onClick={() => handleEditSuggestion(suggestion)}
                          className="px-3 py-1 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content - Editable or Read-only */}
                  {editingSuggestion === index ? (
                    // Edit Form
                    <div className="space-y-4 bg-gray-50 p-4 rounded">
                      <h3 className="font-medium text-gray-900">Edit Action Details</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                          <input
                            type="text"
                            name="title"
                            value={editFormData.title}
                            onChange={handleFormChange}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            name="description"
                            value={editFormData.description}
                            onChange={handleFormChange}
                            rows={3}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                          <input
                            type="email"
                            name="owner"
                            value={editFormData.owner}
                            onChange={handleFormChange}
                            placeholder="owner@company.com"
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                          <select
                            name="priority"
                            value={editFormData.priority}
                            onChange={handleFormChange}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            name="status"
                            value={editFormData.status}
                            onChange={handleFormChange}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                          <select
                            name="projectId"
                            value={editFormData.projectId}
                            onChange={handleFormChange}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Project</option>
                            <option value="miscellaneous">Miscellaneous</option>
                            {projects.map(project => (
                              <option key={project.projectId} value={project.projectId}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                          <input
                            type="date"
                            name="deadline"
                            value={editFormData.deadline}
                            onChange={handleFormChange}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleApprove(suggestion)}
                          className="px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                          disabled={approveMutation.isLoading}
                        >
                          {approveMutation.isLoading ? 'Approving...' : 'Approve & Create Action'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Read-only View
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">
                        Suggested Action: {suggestion.text}
                      </h3>
                      <div className="bg-gray-50 rounded-md p-3">
                        <p className="text-sm text-gray-600 italic">
                          Context: "{suggestion.context}"
                        </p>
                      </div>
                      
                      {(suggestion.extracted_assignee || suggestion.extracted_due_date) && (
                        <div className="flex space-x-4 text-sm text-gray-600 mt-3">
                          {suggestion.extracted_assignee && (
                            <span>Owner: <strong>{suggestion.extracted_assignee}</strong></span>
                          )}
                          {suggestion.extracted_due_date && (
                            <span>Due: <strong>{suggestion.extracted_due_date}</strong></span>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          onClick={() => handleReject(index)}
                          className="px-3 py-1 text-sm text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                          disabled={rejectMutation.isLoading}
                        >
                          {rejectMutation.isLoading ? 'Rejecting...' : 'Reject'}
                        </button>
                        <button
                          onClick={() => handleApprove(suggestion)}
                          className="px-3 py-1 text-sm text-white bg-green-600 border border-transparent rounded hover:bg-green-700"
                          disabled={approveMutation.isLoading}
                        >
                          {approveMutation.isLoading ? 'Approving...' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  )}
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