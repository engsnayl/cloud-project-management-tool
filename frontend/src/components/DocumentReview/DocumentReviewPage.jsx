import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DocumentReviewPage = () => {
  const [editingAction, setEditingAction] = useState(null);
  const navigate = useNavigate();

  // Mock data for testing the interface
  const mockSuggestions = [
    {
      suggestionId: "test-123",
      document_key: "meeting-notes-2025-09-24.pdf",
      user_id: "engsnayl@gmail.com", 
      status: "PENDING_REVIEW",
      created_at: "2025-09-24T10:30:00Z",
      total_suggestions: 3,
      suggestions: [
        {
          text: "Complete database migration by Friday",
          confidence: "0.85",
          line_number: 12,
          context: "Action items from weekly standup meeting",
          suggested_deadline: "2025-09-27",
          suggested_priority: "HIGH",
          suggested_assignee: "john.doe@company.com"
        },
        {
          text: "Review and approve the new user interface designs",
          confidence: "0.92",
          line_number: 18,
          context: "UI/UX team requires approval for next sprint",
          suggested_deadline: "2025-09-26",
          suggested_priority: "MEDIUM",
          suggested_assignee: "design-team@company.com"
        },
        {
          text: "Schedule follow-up meeting with client",
          confidence: "0.78",
          line_number: 25,
          context: "Client requested additional discussion on project scope",
          suggested_deadline: "2025-09-25",
          suggested_priority: "HIGH",
          suggested_assignee: "engsnayl@gmail.com"
        }
      ]
    }
  ];

  const handleApprove = (suggestion, actionItemIndex) => {
    console.log('Approve clicked:', suggestion.suggestionId, actionItemIndex);
    alert(`Approved action item ${actionItemIndex + 1} from document ${suggestion.document_key}`);
  };

  const handleReject = (suggestion, actionItemIndex) => {
    console.log('Reject clicked:', suggestion.suggestionId, actionItemIndex);
    alert(`Rejected action item ${actionItemIndex + 1} from document ${suggestion.document_key}`);
  };

  const handleEditAction = (suggestion, actionItemIndex) => {
    const actionItem = suggestion.suggestions[actionItemIndex];
    setEditingAction({
      suggestionId: suggestion.suggestionId,
      actionItemIndex,
      title: actionItem.text.length > 100 ? 
        actionItem.text.substring(0, 97) + '...' : 
        actionItem.text,
      description: actionItem.context || actionItem.text,
      priority: actionItem.suggested_priority || 'MEDIUM',
      owner: actionItem.suggested_assignee || '',
      deadline: actionItem.suggested_deadline || '',
      projectId: 'miscellaneous'
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence) => {
    const conf = parseFloat(confidence) || 0;
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Review (Test Mode)</h1>
        <p className="text-gray-600">
          Review and approve action items extracted from your documents. 
          Found {mockSuggestions.reduce((acc, s) => acc + s.total_suggestions, 0)} suggestions 
          across {mockSuggestions.length} documents.
        </p>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>Test Mode:</strong> This page is showing mock data to demonstrate the interface. 
            In production, this would show real document suggestions from your uploaded files.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {mockSuggestions.map((suggestion) => (
          <div key={suggestion.suggestionId} className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="border-b border-gray-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Document: {suggestion.document_key}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Uploaded by {suggestion.user_id} • {suggestion.total_suggestions} suggestions found
                  </p>
                </div>
                <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                  {suggestion.status}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {suggestion.suggestions.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-700">Line {item.line_number}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(item.suggested_priority)}`}>
                            {item.suggested_priority || 'MEDIUM'}
                          </span>
                          <span className={`text-sm font-medium ${getConfidenceColor(item.confidence)}`}>
                            {Math.round(parseFloat(item.confidence || 0) * 100)}% confidence
                          </span>
                        </div>
                        <p className="text-gray-900 font-medium mb-2">{item.text}</p>
                        {item.context && (
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Context:</span> {item.context}
                          </p>
                        )}
                        {(item.suggested_deadline || item.suggested_assignee) && (
                          <div className="flex gap-4 text-sm text-gray-600">
                            {item.suggested_deadline && (
                              <span><span className="font-medium">Deadline:</span> {item.suggested_deadline}</span>
                            )}
                            {item.suggested_assignee && (
                              <span><span className="font-medium">Assignee:</span> {item.suggested_assignee}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleReject(suggestion, index)}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-300 rounded transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleEditAction(suggestion, index)}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 border border-blue-300 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleApprove(suggestion, index)}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Action Modal */}
      {editingAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Action Details</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={editingAction.title}
                  onChange={(e) => setEditingAction({...editingAction, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editingAction.description}
                  onChange={(e) => setEditingAction({...editingAction, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={editingAction.priority}
                    onChange={(e) => setEditingAction({...editingAction, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
                  <input
                    type="text"
                    value={editingAction.owner}
                    onChange={(e) => setEditingAction({...editingAction, owner: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                <input
                  type="date"
                  value={editingAction.deadline}
                  onChange={(e) => setEditingAction({...editingAction, deadline: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setEditingAction(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleApprove({ suggestionId: editingAction.suggestionId }, editingAction.actionItemIndex);
                  setEditingAction(null);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Save & Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentReviewPage;
