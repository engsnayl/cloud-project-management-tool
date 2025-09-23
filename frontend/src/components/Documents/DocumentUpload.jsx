// src/components/Documents/DocumentUpload.jsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import { 
  Upload, 
  File, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  X,
  FileText,
  Image,
  Paperclip,
  Eye
} from 'lucide-react';

const DocumentUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processingFiles, setProcessingFiles] = useState([]);
  const navigate = useNavigate();

  // Upload mutation for real file upload
  const uploadMutation = useMutation(
    async (fileData) => {
      const formData = new FormData();
      formData.append('file', fileData.file);
      formData.append('filename', fileData.file.name);
      
      const response = await apiService.documents.upload(formData);
      return response.data;
    },
    {
      onSuccess: (data, variables) => {
        // Update file status to processing
        setProcessingFiles(prev => 
          prev.map(f => 
            f.id === variables.id 
              ? { ...f, status: 'processing', documentId: data.documentId, uploadResult: data }
              : f
          )
        );
        
        // Start polling for processing status
        pollProcessingStatus(data.documentId, variables.id);
      },
      onError: (error, variables) => {
        setProcessingFiles(prev => 
          prev.map(f => 
            f.id === variables.id 
              ? { ...f, status: 'error', error: error.message }
              : f
          )
        );
      }
    }
  );

  // Poll for processing status
  const pollProcessingStatus = async (documentId, fileId) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    const checkStatus = async () => {
      try {
        const response = await apiService.documents.getProcessingStatus(documentId);
        const status = response.data.status;
        
        setProcessingFiles(prev => 
          prev.map(f => 
            f.id === fileId 
              ? { ...f, processingStatus: status, attempts: attempts + 1 }
              : f
          )
        );

        if (status === 'COMPLETED') {
          // Get extracted suggestions
          const suggestionsResponse = await apiService.documentSuggestions.getByDocument(documentId);
          
          setProcessingFiles(prev => 
            prev.map(f => 
              f.id === fileId 
                ? { 
                    ...f, 
                    status: 'completed', 
                    extractedActions: suggestionsResponse.data.suggestions || [],
                    suggestionsCount: suggestionsResponse.data.suggestions?.length || 0
                  }
                : f
            )
          );
          
          // Move to uploaded files
          setTimeout(() => {
            setProcessingFiles(prev => prev.filter(f => f.id !== fileId));
            setUploadedFiles(prev => [...prev, prev.find(f => f.id === fileId) || {}]);
          }, 2000);
          
        } else if (status === 'FAILED') {
          setProcessingFiles(prev => 
            prev.map(f => 
              f.id === fileId 
                ? { ...f, status: 'error', error: 'Document processing failed' }
                : f
            )
          );
        } else if (attempts < maxAttempts) {
          // Continue polling
          setTimeout(checkStatus, 5000);
        } else {
          // Timeout
          setProcessingFiles(prev => 
            prev.map(f => 
              f.id === fileId 
                ? { ...f, status: 'error', error: 'Processing timeout' }
                : f
            )
          );
        }
        
        attempts++;
      } catch (error) {
        console.error('Error checking processing status:', error);
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000);
          attempts++;
        }
      }
    };
    
    // Start checking after initial delay
    setTimeout(checkStatus, 2000);
  };

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
      extractedActions: [],
      attempts: 0
    }));

    setProcessingFiles(prev => [...prev, ...newFiles]);

    // Start actual uploads
    newFiles.forEach(fileObj => {
      uploadMutation.mutate(fileObj);
    });
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  const removeFile = (fileId, isProcessing = false) => {
    if (isProcessing) {
      setProcessingFiles(prev => prev.filter(f => f.id !== fileId));
    } else {
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    }
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileText className="w-8 h-8 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-8 h-8 text-blue-500" />;
      case 'txt':
        return <FileText className="w-8 h-8 text-gray-500" />;
      default:
        return <File className="w-8 h-8 text-gray-400" />;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'uploading':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (file) => {
    switch (file.status) {
      case 'uploading':
        return 'Uploading to S3...';
      case 'processing':
        return `Processing document... (${file.attempts || 0}/60)`;
      case 'completed':
        return `Complete - ${file.suggestionsCount || 0} suggestions extracted`;
      case 'error':
        return `Error: ${file.error || 'Unknown error'}`;
      default:
        return 'Preparing...';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Document Upload</h1>
          <p className="mt-2 text-gray-600">
            Upload documents to extract action items automatically. Supported formats: PDF, Word (.docx, .doc), and Text files.
          </p>
        </div>

        {/* Upload Area */}
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400 bg-white'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-gray-500 mb-4">
            or click to browse files
          </p>
          <div className="text-sm text-gray-400">
            <p>Supported: PDF, Word documents, Text files</p>
            <p>Maximum size: 10MB per file</p>
          </div>
        </div>

        {/* Processing Files */}
        {processingFiles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Processing Files</h2>
            <div className="space-y-4">
              {processingFiles.map((file) => (
                <div key={file.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      {getFileIcon(file.name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(file.status)}
                        <span className="text-sm text-gray-600">
                          {getStatusText(file)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(file.id, true)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Progress bar for uploading */}
                  {file.status === 'uploading' && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: '45%' }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Processing status details */}
                  {file.status === 'processing' && file.processingStatus && (
                    <div className="mt-3 text-sm text-gray-600">
                      Status: {file.processingStatus}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Uploads */}
        {uploadedFiles.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recent Uploads</h2>
              <button
                onClick={() => navigate('/document-review')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>Review Suggestions</span>
              </button>
            </div>
            <div className="space-y-4">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      {getFileIcon(file.name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(file.size)} • {file.suggestionsCount || 0} actions extracted
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">
                          Processing Complete
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(file.id, false)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Actions summary */}
                  {file.extractedActions && file.extractedActions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Extracted Actions Preview:
                      </p>
                      <div className="space-y-1">
                        {file.extractedActions.slice(0, 3).map((action, index) => (
                          <p key={index} className="text-sm text-gray-600 truncate">
                            • {action.title || action.text}
                          </p>
                        ))}
                        {file.extractedActions.length > 3 && (
                          <p className="text-sm text-gray-500">
                            + {file.extractedActions.length - 3} more actions
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            How Document Processing Works
          </h3>
          <div className="text-blue-700 space-y-2">
            <p>1. <strong>Upload:</strong> Drag and drop your documents or click to browse</p>
            <p>2. <strong>Processing:</strong> Our AI analyzes the content and extracts action items</p>
            <p>3. <strong>Review:</strong> Review and approve the extracted suggestions</p>
            <p>4. <strong>Integration:</strong> Approved actions are added to your action tracker</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;