// src/components/Requirements/RequirementForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'react-query';
import { Save, X, AlertCircle } from 'lucide-react';
import { apiService, handleApiError } from '../../services/api';

const RequirementForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      projectId: '',
      assignedTo: '',
      estimatedHours: '',
      acceptanceCriteria: '',
      businessValue: '',
      technicalNotes: '',
    },
  });

  // Fetch existing requirement if editing
  const { data: existingRequirement, isLoading } = useQuery(
    ['requirement', id],
    () => apiService.requirements.getById(id),
    {
      enabled: isEdit,
      onSuccess: (data) => {
        const requirement = data.data;
        Object.keys(requirement).forEach(key => {
          if (key !== 'createdAt' && key !== 'lastModified') {
            setValue(key, requirement[key] || '');
          }
        });
      },
    }
  );

  // Create/Update mutation
  const saveMutation = useMutation(
    (data) => {
      if (isEdit) {
        return apiService.requirements.update(id, data);
      } else {
        return apiService.requirements.create(data);
      }
    },
    {
      onSuccess: () => {
        navigate('/requirements');
      },
      onError: (error) => {
        console.error('Failed to save requirement:', handleApiError(error));
      },
      onSettled: () => {
        setIsSubmitting(false);
      },
    }
  );

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    
    // Convert estimatedHours to number
    if (data.estimatedHours) {
      data.estimatedHours = parseInt(data.estimatedHours, 10);
    }

    await saveMutation.mutateAsync(data);
  };

  const handleCancel = () => {
    navigate('/requirements');
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Requirement' : 'New Requirement'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isEdit 
              ? 'Update the requirement details below'
              : 'Create a new requirement that will automatically trigger the approval workflow'
            }
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className="form-label">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter requirement title"
                  {...register('title', {
                    required: 'Title is required',
                    minLength: {
                      value: 5,
                      message: 'Title must be at least 5 characters',
                    },
                  })}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="form-label">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  className="form-input"
                  {...register('priority', { required: 'Priority is required' })}
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
                {errors.priority && (
                  <p className="mt-1 text-sm text-red-600">{errors.priority.message}</p>
                )}
              </div>

              {/* Estimated Hours */}
              <div>
                <label className="form-label">Estimated Hours</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  className="form-input"
                  placeholder="0"
                  {...register('estimatedHours', {
                    min: {
                      value: 1,
                      message: 'Must be at least 1 hour',
                    },
                  })}
                />
                {errors.estimatedHours && (
                  <p className="mt-1 text-sm text-red-600">{errors.estimatedHours.message}</p>
                )}
              </div>

              {/* Project ID */}
              <div>
                <label className="form-label">Project ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="PROJ-001"
                  {...register('projectId')}
                />
              </div>

              {/* Assigned To */}
              <div>
                <label className="form-label">Assigned To</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="user@example.com"
                  {...register('assignedTo', {
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                />
                {errors.assignedTo && (
                  <p className="mt-1 text-sm text-red-600">{errors.assignedTo.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="form-label">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              className="form-input"
              placeholder="Provide a detailed description of the requirement..."
              {...register('description', {
                required: 'Description is required',
                minLength: {
                  value: 10,
                  message: 'Description must be at least 10 characters',
                },
              })}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Additional Details */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Details</h3>
            
            {/* Acceptance Criteria */}
            <div className="space-y-4">
              <div>
                <label className="form-label">Acceptance Criteria</label>
                <textarea
                  rows={3}
                  className="form-input"
                  placeholder="Define the criteria that must be met for this requirement to be considered complete..."
                  {...register('acceptanceCriteria')}
                />
              </div>

              {/* Business Value */}
              <div>
                <label className="form-label">Business Value</label>
                <textarea
                  rows={2}
                  className="form-input"
                  placeholder="Explain the business value and impact of this requirement..."
                  {...register('businessValue')}
                />
              </div>

              {/* Technical Notes */}
              <div>
                <label className="form-label">Technical Notes</label>
                <textarea
                  rows={3}
                  className="form-input"
                  placeholder="Any technical considerations, constraints, or implementation notes..."
                  {...register('technicalNotes')}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || saveMutation.isLoading}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 spinner mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEdit ? 'Update' : 'Create'} Requirement
            </button>
          </div>

          {/* Form Error */}
          {saveMutation.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">
                    Error saving requirement
                  </h3>
                  <p className="mt-1 text-sm text-red-700">
                    {handleApiError(saveMutation.error).message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default RequirementForm;