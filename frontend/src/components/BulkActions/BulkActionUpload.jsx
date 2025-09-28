import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const BulkActionUpload = () => {
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [step, setStep] = useState('upload'); // upload, preview, results

  const API_BASE_URL = 'https://x8dd7fpwf3.execute-api.eu-west-1.amazonaws.com/dev/api/v1';

  // Handle file upload
  const handleFileUpload = (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith('.csv')) {
      setErrors(['Please upload a CSV file']);
      return;
    }

    setFile(uploadedFile);
    setErrors([]);
    
    // Read and parse CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseCSV(text);
        setCsvData(parsed);
        validateAndPreview(parsed);
      } catch (error) {
        setErrors(['Error reading CSV file: ' + error.message]);
      }
    };
    reader.readAsText(uploadedFile);
  };

  // Simple CSV parser
  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const expectedHeaders = ['title', 'project', 'description', 'owner', 'priority', 'status', 'dueDate'];
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }
    
    return data;
  };

  // Validate data and create preview
  const validateAndPreview = (data) => {
    const validatedData = [];
    const validationErrors = [];

    data.forEach((row, index) => {
      const rowErrors = [];
      const validatedRow = { ...row, rowIndex: index + 1 };

      // Validate required fields
      if (!row.title?.trim()) rowErrors.push('Title is required');
      if (!row.description?.trim()) rowErrors.push('Description is required');
      if (!row.owner?.trim()) rowErrors.push('Owner is required');

      // Validate email format
      if (row.owner && !row.owner.includes('@')) {
        rowErrors.push('Owner must be a valid email address');
      }

      // Validate priority
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      if (row.priority && !validPriorities.includes(row.priority.toUpperCase())) {
        rowErrors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
      } else if (row.priority) {
        validatedRow.priority = row.priority.toUpperCase();
      }

      // Validate status
      const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
      if (row.status && !validStatuses.includes(row.status.toUpperCase())) {
        rowErrors.push(`Status must be one of: ${validStatuses.join(', ')}`);
      } else if (row.status) {
        validatedRow.status = row.status.toUpperCase();
      }

      // Validate due date
      if (row.dueDate && row.dueDate.trim()) {
        const date = new Date(row.dueDate);
        if (isNaN(date.getTime())) {
          rowErrors.push('Due date must be in YYYY-MM-DD format');
        }
      }

      // Set defaults
      validatedRow.priority = validatedRow.priority || 'MEDIUM';
      validatedRow.status = validatedRow.status || 'PENDING';
      validatedRow.project = validatedRow.project || 'Miscellaneous';

      if (rowErrors.length > 0) {
        validationErrors.push(`Row ${index + 2}: ${rowErrors.join(', ')}`);
      }

      validatedData.push(validatedRow);
    });

    setErrors(validationErrors);
    setPreviewData(validatedData);
    
    if (validationErrors.length === 0) {
      setStep('preview');
    }
  };

  // Upload actions to API
  const handleBulkUpload = async () => {
    setIsProcessing(true);
    const results = { successful: 0, failed: 0, errors: [] };

    try {
      for (const [index, action] of previewData.entries()) {
        try {
          const actionData = {
            title: action.title,
            description: action.description,
            owner: action.owner,
            priority: action.priority,
            status: action.status,
            project: action.project,
            deadline: action.dueDate || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const response = await fetch(`${API_BASE_URL}/actions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(actionData)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${action.rowIndex}: ${error.message}`);
        }
      }
    } catch (error) {
      results.errors.push(`Upload failed: ${error.message}`);
    }

    setUploadResults(results);
    setIsProcessing(false);
    setStep('results');
  };

  // Reset to start over
  const handleReset = () => {
    setFile(null);
    setCsvData([]);
    setPreviewData([]);
    setErrors([]);
    setUploadResults(null);
    setStep('upload');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Bulk Action Upload</h2>

        {/* Step 1: File Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Upload CSV File</h3>
              <p className="text-sm text-gray-500 mb-4">
                Upload a CSV file with columns: title, project, description, owner, priority, status, dueDate
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="bg-blue-500 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
              >
                Choose CSV File
              </label>
            </div>

            {/* CSV Format Example */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-2">Expected CSV Format:</h4>
              <pre className="text-sm text-gray-600 overflow-x-auto">
{`title,project,description,owner,priority,status,dueDate
"Update authentication","Portal","Implement OAuth 2.0","john@company.com","HIGH","PENDING","2025-02-01"
"Database migration","Backend","Migrate to PostgreSQL","jane@company.com","MEDIUM","IN_PROGRESS","2025-02-15"`}
              </pre>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <XCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                  <div>
                    <h4 className="font-medium text-red-800">Validation Errors:</h4>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-medium text-gray-800">
                Preview Actions ({previewData.length} items)
              </h3>
              <div className="space-x-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpload}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {isProcessing ? 'Uploading...' : 'Create Actions'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Title</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Project</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Owner</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Priority</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {previewData.map((action, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{action.title}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{action.project}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{action.owner}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          action.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                          action.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          action.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {action.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          action.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          action.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {action.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{action.dueDate || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && uploadResults && (
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-800">Upload Results</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                  <span className="font-medium text-green-800">Successful</span>
                </div>
                <p className="text-2xl font-bold text-green-600 mt-2">{uploadResults.successful}</p>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-400 mr-2" />
                  <span className="font-medium text-red-800">Failed</span>
                </div>
                <p className="text-2xl font-bold text-red-600 mt-2">{uploadResults.failed}</p>
              </div>
            </div>

            {uploadResults.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                <ul className="text-sm text-red-700 list-disc list-inside">
                  {uploadResults.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Upload Another File
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                View Actions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkActionUpload;