import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import ActionModal from './ActionModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://x8dd7fpwf3.execute-api.eu-west-1.amazonaws.com/dev';

function Actions() {
  const [selectedAction, setSelectedAction] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const queryClient = useQueryClient();

  // Fetch actions
  const { data, isLoading, error } = useQuery(
    'actions',
    async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions`);
      if (!response.ok) throw new Error('Failed to fetch actions');
      return response.json();
    },
    {
      refetchInterval: 30000
    }
  );

  const actions = data?.actions || [];

  // Create action mutation
  const createActionMutation = useMutation(
    async (actionData) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData)
      });
      if (!response.ok) throw new Error('Failed to create action');
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
      }
    }
  );

  // Update action mutation
  const updateActionMutation = useMutation(
    async ({ actionId, actionData }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData)
      });
      if (!response.ok) throw new Error('Failed to update action');
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
      }
    }
  );

  // Delete action mutation
  const deleteActionMutation = useMutation(
    async (actionId) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/actions/${actionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete action');
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('actions');
      }
    }
  );

  const handleCreateAction = () => {
    setSelectedAction(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEditAction = (action) => {
    setSelectedAction(action);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleDeleteAction = async (actionId) => {
    if (window.confirm('Are you sure you want to delete this action?')) {
      deleteActionMutation.mutate(actionId);
    }
  };

  const handleSaveAction = async (formData) => {
    if (modalMode === 'create') {
      await createActionMutation.mutateAsync(formData);
    } else {
      await updateActionMutation.mutateAsync({
        actionId: selectedAction.actionId,
        actionData: formData
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toUpperCase()) {
      case 'HIGH': return 'border-l-red-500';
      case 'MEDIUM': return 'border-l-yellow-500';
      case 'LOW': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading actions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error loading actions: {error.message}</p>
        <button 
          onClick={() => queryClient.invalidateQueries('actions')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Actions ({actions.length})</h1>
        <button
          onClick={handleCreateAction}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          Create Action
        </button>
      </div>

      <div className="space-y-4">
        {actions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500">No actions found.</p>
            <button
              onClick={handleCreateAction}
              className="mt-4 text-blue-500 hover:text-blue-600"
            >
              Create your first action
            </button>
          </div>
        ) : (
          actions.map((action) => (
            <div
              key={action.actionId}
              className={`bg-white rounded-lg border-l-4 ${getPriorityColor(action.priority)} shadow-sm p-6`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{action.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(action.status)}`}>
                      {action.status}
                    </span>
                  </div>
                  
                  {action.description && (
                    <p className="text-gray-600 mb-3">{action.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Owner: <span className="font-medium">{action.owner}</span></span>
                    <span>Priority: <span className="font-medium">{action.priority}</span></span>
                    {action.deadline && (
                      <span>Due: <span className="font-medium">{new Date(action.deadline).toLocaleDateString()}</span></span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditAction(action)}
                    className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50"
                    title="Edit action"
                  >
                    ✏️
                  </button>
                  
                  <button
                    onClick={() => handleDeleteAction(action.actionId)}
                    className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50"
                    title="Delete action"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <ActionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        action={selectedAction}
        onSave={handleSaveAction}
        mode={modalMode}
      />
    </div>
  );
}

export default Actions;
