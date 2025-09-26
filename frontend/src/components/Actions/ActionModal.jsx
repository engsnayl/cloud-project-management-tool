import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://x8dd7fpwf3.execute-api.eu-west-1.amazonaws.com/dev';

const ActionModal = ({ isOpen, onClose, action, onSave, mode = 'create' }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    status: 'PENDING',
    owner: '',
    projectId: '',
    deadline: ''
  });

  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);

  // Fetch projects for dropdown
  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.warn('Could not fetch projects:', error);
      setProjects([]);
    }
  };

  // Pre-populate form when editing
  useEffect(() => {
    if (action && mode === 'edit') {
      setFormData({
        title: action.title || '',
        description: action.description || '',
        priority: action.priority || 'MEDIUM',
        status: action.status || 'PENDING',
        owner: action.owner || '',
        projectId: action.projectId || '',
        deadline: action.deadline || ''
      });
    } else {
      // Reset for create mode
      setFormData({
        title: '',
        description: '',
        priority: 'MEDIUM',
        status: 'PENDING',
        owner: '',
        projectId: '',
        deadline: ''
      });
    }
  }, [action, mode, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let finalProjectId = formData.projectId;
      
      // Create new project if needed
      if (showNewProject && newProjectName.trim()) {
        try {
          const projectResponse = await fetch(`${API_BASE_URL}/api/v1/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newProjectName.trim(),
              description: `Project created for action: ${formData.title}`,
              status: 'ACTIVE'
            })
          });
          
          if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            finalProjectId = projectData.project?.projectId || projectData.projectId;
          }
        } catch (error) {
          console.warn('Could not create project:', error);
        }
      }
      
      const actionData = {
        ...formData,
        projectId: finalProjectId || 'miscellaneous'
      };
      
      await onSave(actionData);
      onClose();
      setShowNewProject(false);
      setNewProjectName('');
    } catch (error) {
      console.error('Error saving action:', error);
      alert('Failed to save action. Please try again.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">
            {mode === 'edit' ? 'Edit Action' : 'Create New Action'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            {/* Title and Description Row */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner
                </label>
                <input
                  type="email"
                  name="owner"
                  value={formData.owner}
                  onChange={handleChange}
                  placeholder="owner@company.com"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Priority, Status, and Deadline Row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline
                </label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Project Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project
              </label>
              {!showNewProject ? (
                <div className="flex gap-2">
                  <select
                    name="projectId"
                    value={formData.projectId}
                    onChange={handleChange}
                    className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Project</option>
                    <option value="miscellaneous">Miscellaneous</option>
                    {projects.map(project => (
                      <option key={project.projectId} value={project.projectId}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewProject(true)}
                    className="px-3 py-2 bg-green-500 text-white text-sm rounded-md hover:bg-green-600"
                  >
                    + New
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter new project name"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewProject(false);
                      setNewProjectName('');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {mode === 'edit' ? 'Update Action' : 'Create Action'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ActionModal;